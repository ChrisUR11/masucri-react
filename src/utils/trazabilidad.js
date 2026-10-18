import { doc, collection, query, where, getDocsFromServer, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

const MENSAJE_SIN_CONEXION = 'Conéctate a internet para borrar el pedido y verificar todos sus movimientos.';

function errorSinConexion() {
    return Object.assign(new Error(MENSAJE_SIN_CONEXION), { code: 'requiere-conexion' });
}

/**
 * Borra un pedido y los movimientos vinculados que encuentra en el servidor.
 * Requiere una consulta al servidor para no usar una caché incompleta al borrar.
 * La consulta y el batch no son una transacción frente a pagos concurrentes.
 *
 * Los movimientos se vinculan al pedido mediante `pedido_id` (cuando se
 * registran en los flujos de pago). Si un movimiento viejo
 * no tiene `pedido_id`, quedará en Finanzas (para no romper datos históricos).
 */
export async function borrarPedidoConTrazabilidad(pedidoId) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw errorSinConexion();
    }

    try {
        // Buscar todos los movimientos vinculados a este pedido.
        const movimientosQ = query(
            collection(db, 'movimientos'),
            where('pedido_id', '==', pedidoId)
        );
        const movimientosSnap = await getDocsFromServer(movimientosQ);

        if (movimientosSnap.size > 499) {
            throw new Error('El pedido tiene demasiados movimientos para eliminarse en una sola operación.');
        }

        // El pedido y sus movimientos se eliminan juntos para evitar registros huérfanos.
        const batch = writeBatch(db);
        batch.delete(doc(db, 'pedidos', pedidoId));
        movimientosSnap.docs.forEach((movimientoDoc) => batch.delete(movimientoDoc.ref));
        await batch.commit();

        return { exito: true, movimientosBorrados: movimientosSnap.size };
    } catch (err) {
        console.error('Error borrando pedido con trazabilidad:', err);
        if (err.code === 'unavailable') throw errorSinConexion();
        throw err;
    }
}
