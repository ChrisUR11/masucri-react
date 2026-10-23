import { calcularTotalesPedido, resumenProductos, validarProductosPedido } from './productosPedido.js';
import { aCentavos, deCentavos, tieneMaximoDosDecimales } from './dinero.js';

/** Valida y construye los registros que se guardan para una venta rápida. */
export function prepararDatosVentaRapida(
    { cliente, telefono, producto, productos, precio, descripcion, descuento_tipo, descuento_valor, pagado, metodo },
    fecha,
    pedidoId,
    timestamp = new Date()
) {
    const nombreCliente = String(cliente ?? '').trim();
    const lineas = Array.isArray(productos) ? productos : [{ nombre: producto, precio_unitario: precio, cantidad: 1 }];
    const productosNormalizados = validarProductosPedido(lineas);
    const nombreProducto = resumenProductos(productosNormalizados);
    const descuentoValor = descuento_valor === '' || descuento_valor == null ? 0 : Number(descuento_valor);
    const pagoIndicado = pagado === '' || pagado == null ? 0 : Number(pagado);

    if (!nombreCliente) throw new Error('El nombre del cliente es obligatorio.');
    const totales = calcularTotalesPedido(productosNormalizados, descuento_tipo === 'porcentaje'
        ? { descuento_porcentaje: descuentoValor }
        : { descuento_monto: descuentoValor });

    if (totales.subtotal <= 0) {
        throw new Error('El subtotal debe ser mayor a cero.');
    }
    if (!Number.isFinite(descuentoValor) || descuentoValor < 0
        || (descuento_tipo === 'porcentaje'
            ? descuentoValor > 100
            : !tieneMaximoDosDecimales(descuentoValor) || descuentoValor > totales.subtotal)) {
        throw new Error('El descuento no puede ser negativo ni superar el subtotal.');
    }
    if (!tieneMaximoDosDecimales(pagoIndicado) || pagoIndicado < 0) {
        throw new Error('El pago debe ser un monto válido con máximo dos decimales.');
    }
    const montoPagado = deCentavos(aCentavos(pagoIndicado));
    if (aCentavos(montoPagado) > aCentavos(totales.precio)) throw new Error('El pago no puede superar el precio total.');
    if (montoPagado > 0 && !String(metodo ?? '').trim()) {
        throw new Error('Selecciona un método de pago.');
    }

    const datosPedido = {
        fecha_solicitud: fecha,
        fecha_entrega: fecha,
        fecha_cierre: fecha,
        cliente: nombreCliente,
        telefono: String(telefono ?? '').trim(),
        producto: nombreProducto,
        productos: productosNormalizados,
        descripcion: String(descripcion ?? '').trim() || (Array.isArray(productos) ? '' : 'Venta rápida'),
        ...totales,
        monto_pagado: montoPagado,
        estado: 'Entregado',
        ultimo_metodo_pago: montoPagado > 0 ? metodo : 'Pendiente',
        historial_pagos: montoPagado > 0 ? [{ fecha, monto: montoPagado, metodo }] : [],
        timestamp
    };

    const datosMovimiento = montoPagado > 0 ? {
        tipo: 'entrada',
        metodo_pago: metodo,
        fecha,
        descripcion: `Venta Rápida: ${nombreProducto}`,
        entidad: nombreCliente,
        monto: montoPagado,
        pedido_id: pedidoId,
        timestamp
    } : null;

    return { datosPedido, datosMovimiento };
}
