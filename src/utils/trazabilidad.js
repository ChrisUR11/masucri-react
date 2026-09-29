import { doc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Borra un pedido y TODOS sus movimientos asociados (abonos). Mantiene la
 * consistencia entre Pedidos y Finanzas: si borras un pedido, no quedan
 * movimientos huérfanos en Finanzas.
 *
 * Los movimientos se vinculan al pedido mediante `pedido_id` (cuando se
 * registran en entregarPedido y registrarAbono). Si un movimiento viejo
 * no tiene `pedido_id`, quedará en Finanzas (para no romrer datos históricos).
 */
export async function borrarPedidoConTrazabilidad(pedidoId) {
    try {
        // Buscar todos los movimientos vinculados a este pedido.
        const movimientosQ = query(
            collection(db, 'movimientos'),
            where('pedido_id', '==', pedidoId)
        );
        const movimientosSnap = await getDocs(movimientosQ);

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
        throw err;
    }
}
