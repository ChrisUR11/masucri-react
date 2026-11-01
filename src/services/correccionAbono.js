import { collection, doc, runTransaction } from 'firebase/firestore';
import { prepararCorreccionAbono } from '../utils/correccionAbonoDatos.js';

/** Corrige o anula un abono y su movimiento de Caja en una sola transacción. */
export async function aplicarCorreccionAbono(db, pedidoId, movimientoId, nuevoPago, { motivo, usuario }) {
    const pedidoRef = doc(db, 'pedidos', pedidoId);
    const movimientoRef = doc(db, 'movimientos', movimientoId);
    const reemplazoRef = nuevoPago ? doc(collection(db, 'movimientos')) : null;
    const auditoria = { motivo, usuario, fechaHora: new Date() };

    await runTransaction(db, async (transaccion) => {
        const pedidoSnapshot = await transaccion.get(pedidoRef);
        const movimientoSnapshot = await transaccion.get(movimientoRef);
        if (!pedidoSnapshot.exists() || !movimientoSnapshot.exists()) {
            throw new Error('El pedido o el abono ya no existe. Vuelve a abrir el detalle.');
        }

        const plan = prepararCorreccionAbono(
            { id: pedidoSnapshot.id, ...pedidoSnapshot.data() },
            { id: movimientoSnapshot.id, ...movimientoSnapshot.data() },
            nuevoPago,
            reemplazoRef?.id,
            auditoria
        );
        transaccion.update(pedidoRef, plan.pedidoActualizado);
        transaccion.update(movimientoRef, plan.movimientoAnulado);
        if (reemplazoRef) transaccion.set(reemplazoRef, plan.movimientoNuevo);
    });
}
