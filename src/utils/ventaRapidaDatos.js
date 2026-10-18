/** Valida y construye los registros que se guardan para una venta rápida. */
export function prepararDatosVentaRapida(
    { cliente, telefono, producto, precio, pagado, metodo },
    fecha,
    pedidoId,
    timestamp = new Date()
) {
    const nombreCliente = String(cliente ?? '').trim();
    const nombreProducto = String(producto ?? '').trim();
    const precioTotal = Number(precio);
    const montoPagado = pagado === '' || pagado == null ? 0 : Number(pagado);

    if (!nombreCliente) throw new Error('El nombre del cliente es obligatorio.');
    if (!nombreProducto) throw new Error('El producto es obligatorio.');
    if (!Number.isFinite(precioTotal) || precioTotal <= 0) {
        throw new Error('El precio debe ser mayor a cero.');
    }
    if (!Number.isFinite(montoPagado) || montoPagado < 0) {
        throw new Error('El pago debe ser un monto válido mayor o igual a cero.');
    }
    if (montoPagado > precioTotal) throw new Error('El pago no puede superar el precio total.');
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
        descripcion: 'Venta rápida',
        precio: precioTotal,
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
