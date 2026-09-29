import { doc, collection, writeBatch } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { db } from '../config/firebase';
import { obtenerFechaLocal } from './fecha';
import { formatoColones } from './formato';

/**
 * Marca un pedido como "Entregado". Si tiene saldo pendiente, primero
 * pregunta cuánto pagó el cliente al retirar (puede ser 0 si no dejó nada)
 * y con qué método, y lo registra como abono + movimiento de Caja en el
 * mismo paso. Si ya estaba pagado al 100%, solo pide confirmar la entrega.
 *
 * @returns {Promise<boolean>} true si se marcó como entregado.
 */
export async function entregarPedido(pedido) {
    const deuda = (pedido.precio || 0) - (pedido.monto_pagado || 0);
    let montoPagadoAhora = 0;
    let metodo = null;

    if (deuda > 0) {
        const { value: formValues } = await Swal.fire({
            title: '¿Entregar Pedido?',
            html: `
                <p class="text-start small text-muted mb-2">Saldo pendiente: <strong>${formatoColones(deuda)}</strong></p>
                <div class="text-start mb-2">
                    <label class="small">¿Cuánto pagó al retirar?</label>
                    <input id="swal-monto-entrega" type="number" class="form-control border-primary" placeholder="0" min="0" max="${deuda}" value="0">
                    <small class="text-muted">Déjalo en 0 si no dejó nada.</small>
                </div>
                <select id="swal-metodo-entrega" class="form-select border-primary">
                    <option>Efectivo</option>
                    <option>Sinpe Móvil</option>
                    <option>Transferencia</option>
                </select>
            `,
            showCancelButton: true,
            confirmButtonText: 'Entregar',
            preConfirm: () => {
                const montoEl = document.getElementById('swal-monto-entrega');
                const metodoEl = document.getElementById('swal-metodo-entrega');
                const monto = parseFloat(montoEl.value) || 0;
                if (monto < 0 || monto > deuda) {
                    Swal.showValidationMessage(`El monto debe estar entre 0 y ${formatoColones(deuda)}`);
                    return false;
                }
                return { monto, metodo: metodoEl.value };
            }
        });
        if (!formValues) return false;
        montoPagadoAhora = formValues.monto;
        metodo = formValues.metodo;
    } else {
        const res = await Swal.fire({ title: '¿Marcar como entregado?', icon: 'question', showCancelButton: true, confirmButtonText: 'Entregar' });
        if (!res.isConfirmed) return false;
    }

    const hoy = obtenerFechaLocal();
    const pedidoRef = doc(db, 'pedidos', pedido.id);
    const movimientoRef = montoPagadoAhora > 0 ? doc(collection(db, 'movimientos')) : null;
    const datosPedido = { estado: 'Entregado', fecha_cierre: hoy };

    if (montoPagadoAhora > 0) {
        datosPedido.monto_pagado = (pedido.monto_pagado || 0) + montoPagadoAhora;
        datosPedido.ultimo_metodo_pago = metodo;
        datosPedido.historial_pagos = [...(pedido.historial_pagos || []), { fecha: hoy, monto: montoPagadoAhora, metodo }];
    }

    try {
        const batch = writeBatch(db);
        batch.update(pedidoRef, datosPedido);
        if (movimientoRef) {
            batch.set(movimientoRef, {
                tipo: 'entrada',
                metodo_pago: metodo,
                fecha: hoy,
                descripcion: `Pago al entregar: ${pedido.producto}`,
                entidad: pedido.cliente,
                monto: montoPagadoAhora,
                pedido_id: pedido.id,
                timestamp: new Date()
            });
        }
        await batch.commit();

        await Swal.fire({ icon: 'success', title: 'Entregado', timer: 1200, showConfirmButton: false });
        return true;
    } catch (err) {
        console.error('Error al entregar pedido:', err);
        await Swal.fire('Error', 'No se pudo marcar como entregado.', 'error');
        return false;
    }
}
