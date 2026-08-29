import { collection, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { obtenerFechaLocal } from './fecha';

/**
 * Registra una venta rápida: crea el pedido ya como "Entregado" y, si hubo
 * pago, el movimiento de entrada correspondiente en Caja.
 * Lanza un Error con mensaje amigable si los datos no son válidos, para que
 * el formulario lo muestre sin depender de SweetAlert aquí.
 */
export async function registrarVentaRapida({ cliente, telefono, producto, precio, pagado, metodo }) {
    const precioTotal = parseFloat(precio) || 0;
    const montoPagado = parseFloat(pagado) || 0;

    if (!cliente.trim()) throw new Error('El nombre del cliente es obligatorio.');
    if (!producto.trim()) throw new Error('El producto es obligatorio.');
    if (precioTotal <= 0) throw new Error('El precio debe ser mayor a cero.');
    if (montoPagado > precioTotal) throw new Error('El pago no puede superar el precio total.');

    const hoy = obtenerFechaLocal();
    const datosPedido = {
        fecha_solicitud: hoy,
        fecha_entrega: hoy,
        fecha_cierre: hoy,
        cliente: cliente.trim(),
        telefono: telefono.trim(),
        producto: producto.trim(),
        descripcion: 'Venta rápida',
        precio: precioTotal,
        monto_pagado: montoPagado,
        estado: 'Entregado',
        ultimo_metodo_pago: montoPagado > 0 ? metodo : 'Pendiente',
        historial_pagos: montoPagado > 0 ? [{ fecha: hoy, monto: montoPagado, metodo }] : [],
        timestamp: new Date()
    };

    await addDoc(collection(db, 'pedidos'), datosPedido);

    if (montoPagado > 0) {
        await addDoc(collection(db, 'movimientos'), {
            tipo: 'entrada',
            metodo_pago: metodo,
            fecha: hoy,
            descripcion: `Venta Rápida: ${datosPedido.producto}`,
            entidad: datosPedido.cliente,
            monto: montoPagado,
            timestamp: new Date()
        });
    }
}
