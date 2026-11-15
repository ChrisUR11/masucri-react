import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { esFechaISOValida, obtenerFechaLocal } from '../utils/fecha';
import { calcularTotalesPedido, resumenProductos, validarProductosPedido } from '../utils/productosPedido';
import { aCentavos, deCentavos, tieneMaximoDosDecimales } from '../utils/dinero.ts';

/** Guarda un pedido borrador con el mismo esquema y vínculo de caja del formulario habitual. */
export async function guardarPedidoAsistente(borrador) {
    const cliente = String(borrador.cliente ?? '').trim();
    if (!cliente) throw new Error('Ingresa el nombre del cliente.');

    const productos = validarProductosPedido(borrador.productos);
    const descuentoValor = borrador.aplica_descuento && borrador.descuento_valor !== ''
        ? Number(borrador.descuento_valor) : 0;
    const totales = calcularTotalesPedido(productos, !borrador.aplica_descuento
        ? { descuento_monto: 0 }
        : borrador.descuento_tipo === 'porcentaje'
            ? { descuento_porcentaje: descuentoValor }
            : { descuento_monto: descuentoValor });

    if (!Number.isFinite(descuentoValor) || descuentoValor < 0 || (borrador.descuento_tipo === 'porcentaje'
        ? descuentoValor > 100
        : !tieneMaximoDosDecimales(descuentoValor) || descuentoValor > totales.subtotal)) {
        throw new Error('El descuento debe estar entre cero y el subtotal (o entre 0 % y 100 %).');
    }

    const adelantoIndicado = borrador.adelanto === '' || borrador.adelanto == null ? 0 : Number(borrador.adelanto);
    if (!tieneMaximoDosDecimales(adelantoIndicado) || adelantoIndicado < 0) {
        throw new Error('Ingresa un adelanto válido con máximo dos decimales.');
    }
    const adelanto = deCentavos(aCentavos(adelantoIndicado));
    if (aCentavos(adelanto) > aCentavos(totales.precio)) {
        throw new Error('El adelanto no puede superar el total del pedido.');
    }
    const metodoAdelanto = String(borrador.metodo_adelanto || '').trim();
    if (adelanto > 0 && !metodoAdelanto) throw new Error('Selecciona el método del adelanto.');
    if (adelanto > 0 && !['Efectivo', 'Sinpe Móvil', 'Transferencia'].includes(metodoAdelanto)) {
        throw new Error('El método del adelanto no es válido.');
    }

    const fechaEntrega = String(borrador.fecha_entrega || '').trim();
    if (fechaEntrega && !esFechaISOValida(fechaEntrega)) throw new Error('La fecha de entrega no es válida.');

    const fechaSolicitud = obtenerFechaLocal();
    const pedidoRef = doc(collection(db, 'pedidos'));
    const movimientoRef = adelanto > 0 ? doc(collection(db, 'movimientos')) : null;
    const fechaAdelanto = adelanto > 0 ? fechaSolicitud : null;
    const datosPedido = {
        fecha_solicitud: fechaSolicitud,
        fecha_entrega: fechaEntrega,
        cliente,
        telefono: String(borrador.telefono || '').trim(),
        producto: resumenProductos(productos),
        productos,
        descripcion: String(borrador.descripcion || '').trim(),
        ...totales,
        estado: 'Pendiente',
        monto_pagado: adelanto,
        historial_pagos: [],
        timestamp: new Date()
    };

    if (movimientoRef) {
        datosPedido.ultimo_metodo_pago = metodoAdelanto;
        datosPedido.historial_pagos.push({
            fecha: fechaAdelanto,
            monto: adelanto,
            metodo: metodoAdelanto,
            movimiento_id: movimientoRef.id
        });
    }

    const batch = writeBatch(db);
    batch.set(pedidoRef, datosPedido);
    if (movimientoRef) {
        batch.set(movimientoRef, {
            tipo: 'entrada',
            metodo_pago: metodoAdelanto,
            fecha: fechaAdelanto,
            descripcion: `Adelanto: ${datosPedido.producto}`,
            entidad: cliente,
            monto: adelanto,
            pedido_id: pedidoRef.id,
            timestamp: new Date()
        });
    }
    await batch.commit();
    return pedidoRef.id;
}
