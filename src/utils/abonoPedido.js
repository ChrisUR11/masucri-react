import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { db } from '../config/firebase';
import { obtenerFechaLocal } from './fecha';

/**
 * Abre el diálogo de "Abonar a la deuda" y, si se confirma, registra el pago
 * tanto en el pedido (historial_pagos, monto_pagado) como en Caja (movimientos).
 *
 * Antes este bloque estaba copiado y pegado en Pedidos.jsx e Historial.jsx,
 * con la diferencia de que Pedidos.jsx no validaba que el abono no superara
 * la deuda. Aquí quedó unificado y con esa validación agregada.
 *
 * @param {object} pedido - el pedido activo (debe traer id, precio, monto_pagado, cliente, producto).
 * @returns {Promise<boolean>} true si se registró el abono, false si se canceló.
 */
export async function registrarAbono(pedido) {
    const deudaActual = (pedido.precio || 0) - (pedido.monto_pagado || 0);

    if (deudaActual <= 0) {
        await Swal.fire('Aviso', 'Este pedido ya está pagado en su totalidad.', 'info');
        return false;
    }

    const { value: formValues } = await Swal.fire({
        title: 'Abonar a la deuda',
        html: `
            <div class="text-start mb-2">
                <label>Deuda Actual: ₡${deudaActual.toLocaleString('es-CR')}</label>
                <input id="swal-monto" type="number" class="form-control border-primary" placeholder="Monto a abonar" min="1" max="${deudaActual}">
            </div>
            <select id="swal-metodo" class="form-select border-primary">
                <option>Sinpe Móvil</option>
                <option>Efectivo</option>
                <option>Transferencia</option>
            </select>
        `,
        showCancelButton: true,
        confirmButtonText: 'Registrar Abono',
        preConfirm: () => {
            const monto = parseFloat(document.getElementById('swal-monto').value);
            const metodo = document.getElementById('swal-metodo').value;
            if (!monto || monto <= 0) {
                Swal.showValidationMessage('Ingresa un monto válido');
                return false;
            }
            if (monto > deudaActual) {
                Swal.showValidationMessage(`El abono no puede superar la deuda (₡${deudaActual.toLocaleString('es-CR')})`);
                return false;
            }
            return { monto, metodo };
        }
    });

    if (!formValues) return false;

    const { monto, metodo } = formValues;
    const hoy = obtenerFechaLocal();
    const nuevoPagado = (pedido.monto_pagado || 0) + monto;
    const historialPagos = [...(pedido.historial_pagos || []), { fecha: hoy, monto, metodo }];

    try {
        await updateDoc(doc(db, 'pedidos', pedido.id), {
            monto_pagado: nuevoPagado,
            ultimo_metodo_pago: metodo,
            historial_pagos: historialPagos
        });

        await addDoc(collection(db, 'movimientos'), {
            tipo: 'entrada',
            metodo_pago: metodo,
            fecha: hoy,
            descripcion: `Abono: ${pedido.producto}`,
            entidad: pedido.cliente,
            monto,
            timestamp: new Date()
        });

        await Swal.fire({ icon: 'success', title: 'Abono Registrado', text: 'El dinero ya ingresó a Caja.', timer: 1500, showConfirmButton: false });
        return true;
    } catch (err) {
        console.error('Error registrando abono:', err);
        await Swal.fire('Error', 'No se pudo registrar el abono. Intenta de nuevo.', 'error');
        return false;
    }
}
