import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { obtenerFechaLocal } from './fecha';
import { prepararDatosVentaRapida } from './ventaRapidaDatos';

/**
 * Registra una venta rápida: crea el pedido ya como "Entregado" y, si hubo
 * pago, el movimiento de entrada correspondiente en Caja.
 * Lanza un Error con mensaje amigable si los datos no son válidos, para que
 * el formulario lo muestre sin depender de SweetAlert aquí.
 */
export async function registrarVentaRapida(venta) {
    const pedidoRef = doc(collection(db, 'pedidos'));
    const movimientoRef = doc(collection(db, 'movimientos'));
    const { datosPedido, datosMovimiento } = prepararDatosVentaRapida(
        venta,
        obtenerFechaLocal(),
        pedidoRef.id,
        new Date(),
        movimientoRef.id
    );

    const batch = writeBatch(db);
    batch.set(pedidoRef, datosPedido);
    if (datosMovimiento) {
        batch.set(movimientoRef, datosMovimiento);
    }
    await batch.commit();
    return pedidoRef.id;
}
