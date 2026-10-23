import { doc, collection, runTransaction } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { db } from '../config/firebase';
import { obtenerFechaLocal } from './fecha';
import { formatoColones } from './formato';
import { aCentavos, deCentavos, tieneMaximoDosDecimales } from './dinero.js';

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
    const deudaActual = deCentavos(aCentavos(pedido.precio || 0) - aCentavos(pedido.monto_pagado || 0));

    if (deudaActual <= 0) {
        await Swal.fire('Aviso', 'Este pedido ya está pagado en su totalidad.', 'info');
        return false;
    }

    const { value: formValues } = await Swal.fire({
        title: 'Abonar a la deuda',
        html: `
            <div class="text-start mb-2">
                <label>Deuda actual: ${formatoColones(deudaActual)}</label>
                <input id="swal-monto" type="number" step="0.01" class="form-control border-primary" placeholder="Monto a abonar" min="0.01" max="${deudaActual}">
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
            const monto = Number(document.getElementById('swal-monto').value);
            const metodo = document.getElementById('swal-metodo').value;
            if (!tieneMaximoDosDecimales(monto) || monto <= 0) {
                Swal.showValidationMessage('Ingresa un monto válido con máximo dos decimales');
                return false;
            }
            if (aCentavos(monto) > aCentavos(deudaActual)) {
                Swal.showValidationMessage(`El abono no puede superar la deuda (${formatoColones(deudaActual)})`);
                return false;
            }
            return { monto, metodo };
        }
    });

    if (!formValues) return false;

    const { monto, metodo } = formValues;
    const montoCentavos = aCentavos(monto);
    const hoy = obtenerFechaLocal();
    const pedidoRef = doc(db, 'pedidos', pedido.id);
    const movimientoRef = doc(collection(db, 'movimientos'));
    try {
        await runTransaction(db, async (transaccion) => {
            const actual = await transaccion.get(pedidoRef);
            if (!actual.exists() || actual.data().estado === 'Cancelado') {
                throw new Error('El pedido ya no está disponible para recibir abonos.');
            }
            const datos = actual.data();
            const pagadoCentavos = Math.max(0, aCentavos(datos.monto_pagado || 0));
            const deudaVigenteCentavos = Math.max(0, aCentavos(datos.precio || 0) - pagadoCentavos);
            if (montoCentavos > deudaVigenteCentavos) {
                throw new Error(`El saldo cambió. Ahora es ${formatoColones(deCentavos(deudaVigenteCentavos))}; vuelve a ingresar el abono.`);
            }
            transaccion.update(pedidoRef, {
                monto_pagado: deCentavos(pagadoCentavos + montoCentavos),
                ultimo_metodo_pago: metodo,
                historial_pagos: [...(Array.isArray(datos.historial_pagos) ? datos.historial_pagos : []), { fecha: hoy, monto: deCentavos(montoCentavos), metodo }]
            });
            transaccion.set(movimientoRef, {
                tipo: 'entrada',
                metodo_pago: metodo,
                fecha: hoy,
                descripcion: `Abono: ${datos.producto || pedido.producto}`,
                entidad: datos.cliente || pedido.cliente,
                monto: deCentavos(montoCentavos),
                pedido_id: pedido.id,
                timestamp: new Date()
            });
        });

        await Swal.fire({ icon: 'success', title: 'Abono Registrado', text: 'El dinero ya ingresó a Caja.', timer: 1500, showConfirmButton: false });
        return true;
    } catch (err) {
        console.error('Error registrando abono:', err);
        const mensaje = err.message?.startsWith('El saldo cambió') || err.message?.startsWith('El pedido ya no está')
            ? err.message
            : err.code === 'unavailable' || !navigator.onLine
                ? 'Conéctate a internet para registrar el abono y comprobar el saldo vigente.'
                : 'No se pudo registrar el abono. Intenta de nuevo.';
        await Swal.fire('Error', mensaje, 'error');
        return false;
    }
}
