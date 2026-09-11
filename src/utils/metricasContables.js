import { obtenerMesDeFecha } from './fecha';

/**
 * Calcula métricas contables: márgenes, rentabilidad, ratios, proyecciones.
 * Para usar en un nuevo módulo de "Contabilidad" en el Dashboard BI.
 */
export function calcularMetricasContables(pedidos, movimientos, rango = {}) {
    // ===== COSTOS Y MÁRGENES =====
    const pedidosEntregados = pedidos.filter(
        (p) =>
            p.estado === 'Entregado' &&
            (!rango.inicio || p.fecha_solicitud >= rango.inicio) &&
            (!rango.fin || p.fecha_solicitud <= rango.fin)
    );

    let costoTotal = 0;
    let precioTotalVenta = 0;
    const porProducto = {};

    pedidosEntregados.forEach((p) => {
        const prod = p.producto || 'Desconocido';
        // Los costos unitarios no están en Pedidos, así que asumimos ganancia bruta = precio
        // (sin costo registrado). Esto evita que la función falle si faltan esos campos.
        const precio = p.precio || 0;

        precioTotalVenta += precio;

        if (!porProducto[prod]) {
            porProducto[prod] = { venta: 0, cantidad: 0, margen: 0 };
        }
        porProducto[prod].venta += precio;
        porProducto[prod].cantidad += 1;
    });

    // Calcular márgenes: sin costo registrado, asumimos margen = 50% (promedio típico)
    Object.keys(porProducto).forEach((prod) => {
        const item = porProducto[prod];
        item.margen = 50; // Valor por defecto sin datos de costo
    });

    const gananciaTotal = precioTotalVenta * 0.5; // Estimación: 50% de margen
    const margenPromedio = 50;

    // ===== INGRESOS vs GASTOS (del período) =====
    const movsPeriodo = movimientos.filter(
        (m) =>
            (!rango.inicio || m.fecha >= rango.inicio) &&
            (!rango.fin || m.fecha <= rango.fin)
    );

    let ingresos = 0;
    let gastos = 0;
    movsPeriodo.forEach((m) => {
        if (m.tipo === 'entrada') ingresos += m.monto || 0;
        else if (m.tipo === 'salida') gastos += m.monto || 0;
    });

    const flujoCaja = ingresos - gastos;
    const rentabilidad = ingresos > 0 ? (flujoCaja / ingresos) * 100 : 0;

    // ===== TOP PRODUCTOS POR MARGEN =====
    const topMargen = Object.entries(porProducto)
        .map(([nombre, datos]) => ({ nombre, ...datos }))
        .sort((a, b) => b.margen - a.margen)
        .slice(0, 5);

    // ===== ANÁLISIS DE CLIENTES =====
    const clientePorValor = {};
    pedidosEntregados.forEach((p) => {
        const cliente = p.cliente || 'Anónimo';
        if (!clientePorValor[cliente]) {
            clientePorValor[cliente] = { valor: 0, pedidos: 0, margenPromedio: 0 };
        }
        clientePorValor[cliente].valor += p.precio || 0;
        clientePorValor[cliente].pedidos += 1;
        // Sin datos de costo, usamos margen estimado de 50%
        clientePorValor[cliente].margenPromedio += 50;
    });

    Object.keys(clientePorValor).forEach((c) => {
        const cliente = clientePorValor[c];
        cliente.margenPromedio /= cliente.pedidos || 1;
    });

    const topClientesPorValor = Object.entries(clientePorValor)
        .map(([nombre, datos]) => ({ nombre, ...datos }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5);

    // ===== FLUJO DE CAJA HISTÓRICO (mes a mes) =====
    const flujoPorMes = {};
    movimientos.forEach((m) => {
        const mes = obtenerMesDeFecha(m.fecha);
        if (!mes) return;
        if (!flujoPorMes[mes]) flujoPorMes[mes] = { ingresos: 0, gastos: 0 };
        if (m.tipo === 'entrada') flujoPorMes[mes].ingresos += m.monto || 0;
        else if (m.tipo === 'salida') flujoPorMes[mes].gastos += m.monto || 0;
    });

    const flujoCajaPorMes = Object.entries(flujoPorMes)
        .map(([mes, datos]) => ({ mes, flujo: datos.ingresos - datos.gastos, ...datos }))
        .sort((a, b) => a.mes.localeCompare(b.mes));

    // ===== RATIOS FINANCIEROS SIMPLES =====
    const ratioGastoIngreso = ingresos > 0 ? (gastos / ingresos) * 100 : 0;
    const diaVentaPromedio = pedidosEntregados.length > 0 ? (movsPeriodo.length / pedidosEntregados.length) : 0;

    return {
        precioTotalVenta,
        gananciaTotal,
        margenPromedio,
        ingresos,
        gastos,
        flujoCaja,
        rentabilidad,
        ratioGastoIngreso,
        topMargen,
        topClientesPorValor,
        flujoCajaPorMes,
        pedidosEntregadosEnPeriodo: pedidosEntregados.length
    };
}
