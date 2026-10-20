import { obtenerMesDeFecha } from './fecha.js';
import { clientesMorosos } from './historialClientes.js';

const montoValido = (valor) => {
    if (typeof valor !== 'number' && typeof valor !== 'string') return null;
    if (typeof valor === 'string' && !valor.trim()) return null;
    const numero = Number(valor);
    return Number.isFinite(numero) && numero >= 0 ? numero : null;
};

const dentroDeRango = (fecha, rango) => Boolean(fecha) &&
    (!rango.inicio || fecha >= rango.inicio) &&
    (!rango.fin || fecha <= rango.fin);

export function calcularMetricasContables(pedidos, movimientos, rango = {}) {
    // La fecha de cierre identifica cuándo se entregó el pedido. Los registros
    // antiguos sin cierre conservan como referencia su fecha de solicitud.
    const pedidosEntregados = pedidos.filter((p) =>
        p.estado === 'Entregado' && dentroDeRango(p.fecha_cierre || p.fecha_solicitud, rango)
    );
    const movsPeriodo = movimientos.filter((m) => dentroDeRango(m.fecha, rango));

    let costoTotal = 0;
    let precioTotalVenta = 0;
    let ventasConCosto = 0;
    let pedidosConCosto = 0;
    const porProducto = {};
    const clientePorValor = new Map();

    pedidosEntregados.forEach((p) => {
        const precio = montoValido(p.precio);
        const costoUnitario = montoValido(p.costo_unitario);
        const cantidad = p.cantidad == null || p.cantidad === '' ? 1 : montoValido(p.cantidad);
        const costoCalculado = costoUnitario !== null && cantidad !== null ? costoUnitario * cantidad : null;
        const tieneCosto = precio !== null && cantidad > 0 &&
            costoCalculado !== null && Number.isFinite(costoCalculado);
        const costo = tieneCosto ? costoCalculado : null;
        const producto = p.producto?.trim() || 'Desconocido';
        const cliente = String(p.cliente ?? '').trim().replace(/\s+/g, ' ') || 'Anónimo';
        const claveCliente = cliente.toLocaleLowerCase('es-CR');

        if (precio !== null) precioTotalVenta += precio;

        if (!clientePorValor.has(claveCliente)) {
            clientePorValor.set(claveCliente, { nombre: cliente, valor: 0, pedidos: 0, ventaConCosto: 0, costo: 0 });
        }
        const resumenCliente = clientePorValor.get(claveCliente);
        resumenCliente.valor += precio ?? 0;
        resumenCliente.pedidos += 1;

        // El margen solo existe cuando se conocen tanto la venta como el costo.
        // Un costo ausente nunca equivale a cero; un costo cero explícito sí vale.
        if (!tieneCosto) return;
        pedidosConCosto += 1;
        ventasConCosto += precio;
        costoTotal += costo;
        resumenCliente.ventaConCosto += precio;
        resumenCliente.costo += costo;

        if (!porProducto[producto]) porProducto[producto] = { costo: 0, venta: 0, cantidad: 0 };
        porProducto[producto].costo += costo;
        porProducto[producto].venta += precio;
        porProducto[producto].cantidad += cantidad;
    });

    const gananciaTotal = ventasConCosto - costoTotal;
    const margenPromedio = ventasConCosto > 0 ? (gananciaTotal / ventasConCosto) * 100 : null;
    const topMargen = Object.entries(porProducto)
        .filter(([, datos]) => datos.venta > 0)
        .map(([nombre, datos]) => ({
            nombre,
            ...datos,
            margen: ((datos.venta - datos.costo) / datos.venta) * 100
        }))
        .sort((a, b) => b.margen - a.margen)
        .slice(0, 5);

    const topClientesPorValor = [...clientePorValor.values()]
        .map((datos) => ({
            nombre: datos.nombre,
            valor: datos.valor,
            pedidos: datos.pedidos,
            margenPromedio: datos.ventaConCosto > 0
                ? ((datos.ventaConCosto - datos.costo) / datos.ventaConCosto) * 100
                : null
        }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5);

    let ingresos = 0;
    let gastos = 0;
    const flujoPorMes = {};
    movsPeriodo.forEach((m) => {
        if (m.tipo !== 'entrada' && m.tipo !== 'salida') return;
        const monto = montoValido(m.monto);
        if (monto === null) return;
        const mes = obtenerMesDeFecha(m.fecha);
        if (!flujoPorMes[mes]) flujoPorMes[mes] = { ingresos: 0, gastos: 0 };

        if (m.tipo === 'entrada') {
            ingresos += monto;
            flujoPorMes[mes].ingresos += monto;
        } else {
            gastos += monto;
            flujoPorMes[mes].gastos += monto;
        }
    });

    const flujoCaja = ingresos - gastos;
    const flujoCajaPorMes = Object.entries(flujoPorMes)
        .map(([mes, datos]) => ({ mes, flujo: datos.ingresos - datos.gastos, ...datos }))
        .sort((a, b) => a.mes.localeCompare(b.mes));

    return {
        costoTotal,
        precioTotalVenta,
        ventasConCosto,
        pedidosConCosto,
        gananciaTotal,
        margenPromedio,
        ingresos,
        gastos,
        flujoCaja,
        rentabilidad: ingresos > 0 ? (flujoCaja / ingresos) * 100 : 0,
        ratioGastoIngreso: ingresos > 0 ? (gastos / ingresos) * 100 : 0,
        topMargen,
        topClientesPorValor,
        flujoCajaPorMes,
        pedidosEntregadosEnPeriodo: pedidosEntregados.length,
        morosos: clientesMorosos(pedidos, rango)
    };
}
