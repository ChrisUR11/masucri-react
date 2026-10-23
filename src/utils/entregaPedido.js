import { doc, collection, runTransaction } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { db } from '../config/firebase';
import { obtenerFechaLocal } from './fecha';
import { formatoColones } from './formato';
import { aCentavos, deCentavos, tieneMaximoDosDecimales } from './dinero.js';

/**
 * Marca un pedido como "Entregado". Si tiene saldo pendiente, primero
 * pregunta cuánto pagó el cliente al retirar (puede ser 0 si no dejó nada)
 * y con qué método, y lo registra como abono + movimiento de Caja en el
 * mismo paso. Si ya estaba pagado al 100%, solo pide confirmar la entrega.
 *
 * @returns {Promise<boolean>} true si se marcó como entregado.
 */
export async function entregarPedido(pedido) {
    const deuda = deCentavos(aCentavos(pedido.precio || 0) - aCentavos(pedido.monto_pagado || 0));
    let montoPagadoAhora = 0;
    let metodo = null;

    if (deuda > 0) {
        const { value: formValues } = await Swal.fire({
            title: '¿Entregar Pedido?',
            html: `
                <p class="text-start small text-muted mb-2">Saldo pendiente: <strong>${formatoColones(deuda)}</strong></p>
                <div class="text-start mb-2">
                    <label class="small">¿Cuánto pagó al retirar?</label>
                    <input id="swal-monto-entrega" type="number" step="0.01" class="form-control border-primary" placeholder="0" min="0" max="${deuda}" value="0">
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
                const monto = montoEl.value === '' ? 0 : Number(montoEl.value);
                if (!tieneMaximoDosDecimales(monto) || monto < 0 || aCentavos(monto) > aCentavos(deuda)) {
                    Swal.showValidationMessage(`El monto debe estar entre 0 y ${formatoColones(deuda)}, con máximo dos decimales`);
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
    const montoCentavos = aCentavos(montoPagadoAhora);

    try {
        await runTransaction(db, async (transaccion) => {
            const actual = await transaccion.get(pedidoRef);
            if (!actual.exists() || !['Pendiente', 'En producción', 'Por Retirar'].includes(actual.data().estado)) {
                throw new Error('El pedido cambió de estado. Vuelve a abrirlo antes de entregarlo.');
            }
            const datos = actual.data();
            const pagadoCentavos = Math.max(0, aCentavos(datos.monto_pagado || 0));
            const deudaVigenteCentavos = Math.max(0, aCentavos(datos.precio || 0) - pagadoCentavos);
            if (montoCentavos > deudaVigenteCentavos) {
                throw new Error(`El saldo cambió. Ahora es ${formatoColones(deCentavos(deudaVigenteCentavos))}; vuelve a confirmar la entrega.`);
            }
            const datosPedido = { estado: 'Entregado', fecha_cierre: hoy };
            if (montoCentavos > 0) {
                datosPedido.monto_pagado = deCentavos(pagadoCentavos + montoCentavos);
                datosPedido.ultimo_metodo_pago = metodo;
                datosPedido.historial_pagos = [...(Array.isArray(datos.historial_pagos) ? datos.historial_pagos : []),
                    { fecha: hoy, monto: deCentavos(montoCentavos), metodo }];
            }
            transaccion.update(pedidoRef, datosPedido);
            if (movimientoRef) {
                transaccion.set(movimientoRef, {
                    tipo: 'entrada',
                    metodo_pago: metodo,
                    fecha: hoy,
                    descripcion: `Pago al entregar: ${datos.producto || pedido.producto}`,
                    entidad: datos.cliente || pedido.cliente,
                    monto: deCentavos(montoCentavos),
                    pedido_id: pedido.id,
                    timestamp: new Date()
                });
            }
        });

        await Swal.fire({ icon: 'success', title: 'Entregado', timer: 1200, showConfirmButton: false });
        return true;
    } catch (err) {
        console.error('Error al entregar pedido:', err);
        const mensaje = err.message?.startsWith('El pedido cambió') || err.message?.startsWith('El saldo cambió')
            ? err.message
            : err.code === 'unavailable' || !navigator.onLine
                ? 'Conéctate a internet para entregar el pedido y comprobar el saldo vigente.'
                : 'No se pudo marcar como entregado.';
        await Swal.fire('Error', mensaje, 'error');
        return false;
    }
}
