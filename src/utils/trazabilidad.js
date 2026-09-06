import { doc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
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

        // Borrar el pedido.
        await deleteDoc(doc(db, 'pedidos', pedidoId));

        // Borrar todos los movimientos asociados.
        const promesas = movimientosSnap.docs.map((doc) => deleteDoc(doc.ref));
        await Promise.all(promesas);

        return { exito: true, movimientosBorrados: movimientosSnap.size };
    } catch (err) {
        console.error('Error borrando pedido con trazabilidad:', err);
        throw err;
    }
}
