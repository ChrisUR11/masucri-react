/**
 * Calcula el historial y métricas de un cliente específico.
 */
export function obtenerHistorialCliente(cliente, pedidos) {
    if (!cliente) return null;

    const pedidosCliente = pedidos.filter(
        (p) => p.cliente && p.cliente.toLowerCase() === cliente.toLowerCase()
    );

    let totalPedidos = pedidosCliente.length;
    let totalGastado = 0;
    let totalPagado = 0;
    let deudaActual = 0;

    pedidosCliente.forEach((p) => {
        const precio = p.precio || 0;
        const pagado = p.monto_pagado || 0;
        totalGastado += precio;
        totalPagado += pagado;
        deudaActual += precio - pagado;
    });

    const ultimaPedido = pedidosCliente.length > 0 ? pedidosCliente[0] : null;
    const primerPedido = pedidosCliente.length > 0 ? pedidosCliente[pedidosCliente.length - 1] : null;

    // Promedio de días entre pedidos
    let promedioDias = 0;
    if (pedidosCliente.length > 1) {
        const fechas = pedidosCliente.map((p) => new Date(p.fecha_solicitud)).sort((a, b) => a - b);
        let sumaDias = 0;
        for (let i = 1; i < fechas.length; i++) {
            const diff = (fechas[i] - fechas[i - 1]) / (1000 * 60 * 60 * 24);
            sumaDias += diff;
        }
        promedioDias = Math.round(sumaDias / (fechas.length - 1));
    }

    // Margen de tiempo: si debe dinero, cuántos días lleva sin pagar
    let diasDeuda = 0;
    if (deudaActual > 0 && ultimaPedido) {
        const ahora = new Date();
        const ultimaFecha = new Date(ultimaPedido.fecha_solicitud);
        diasDeuda = Math.round((ahora - ultimaFecha) / (1000 * 60 * 60 * 24));
    }

    return {
        cliente,
        totalPedidos,
        totalGastado,
        totalPagado,
        deudaActual,
        ultimaPedido,
        primerPedido,
        promedioDias,
        diasDeuda,
        pedidosCliente
    };
}

/**
 * Lista de clientes con deuda, ordenados por cantidad adeudada.
 */
export function clientesMorosos(pedidos) {
    const clientes = {};

    pedidos.forEach((p) => {
        const cliente = p.cliente || 'Anónimo';
        if (!clientes[cliente]) {
            clientes[cliente] = { deuda: 0, diasDeuda: 0, ultimaFecha: null };
        }
        const deuda = (p.precio || 0) - (p.monto_pagado || 0);
        if (deuda > 0) {
            clientes[cliente].deuda += deuda;
            if (!clientes[cliente].ultimaFecha || p.fecha_solicitud > clientes[cliente].ultimaFecha) {
                clientes[cliente].ultimaFecha = p.fecha_solicitud;
            }
        }
    });

    // Calcular días de deuda y filtrar solo los que deben
    const ahora = new Date();
    const morosos = Object.entries(clientes)
        .filter(([_, data]) => data.deuda > 0)
        .map(([nombre, data]) => {
            const diasDeuda = data.ultimaFecha
                ? Math.round((ahora - new Date(data.ultimaFecha)) / (1000 * 60 * 60 * 24))
                : 0;
            return { cliente: nombre, deuda: data.deuda, diasDeuda, ultimaFecha: data.ultimaFecha };
        })
        .sort((a, b) => b.deuda - a.deuda);

    return morosos;
}
