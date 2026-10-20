import { obtenerFechaLocal } from './fecha.js';

const nombreNormalizado = (nombre) => String(nombre ?? '').trim().replace(/\s+/g, ' ');
const claveCliente = (nombre) => (nombreNormalizado(nombre) || 'Anónimo').toLocaleLowerCase('es-CR');
const ESTADOS_ACTIVOS = new Set(['Pendiente', 'En producción', 'Por Retirar']);
const montoNoNegativo = (valor) => {
    const numero = Number(valor);
    return Number.isFinite(numero) ? Math.max(0, numero) : 0;
};

const diasEntreFechas = (desde, hasta) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde || '') || !/^\d{4}-\d{2}-\d{2}$/.test(hasta || '')) return null;
    const inicio = Date.parse(`${desde}T00:00:00Z`);
    const fin = Date.parse(`${hasta}T00:00:00Z`);
    return Number.isFinite(inicio) && Number.isFinite(fin)
        ? Math.max(0, Math.floor((fin - inicio) / 86400000))
        : null;
};

/**
 * Calcula el historial y métricas de un cliente específico.
 */
export function obtenerHistorialCliente(cliente, pedidos, hoy = obtenerFechaLocal()) {
    if (!nombreNormalizado(cliente)) return null;

    const clave = claveCliente(cliente);
    const pedidosCliente = pedidos.filter(
        (p) => claveCliente(p.cliente) === clave
    );

    const totalPedidos = pedidosCliente.length;
    let totalGastado = 0;
    let totalPagado = 0;
    let saldoActivo = 0;

    pedidosCliente.forEach((p) => {
        if (p.estado === 'Cancelado') return;
        const precio = montoNoNegativo(p.precio);
        const pagado = montoNoNegativo(p.monto_pagado);
        totalGastado += precio;
        totalPagado += pagado;
        if (ESTADOS_ACTIVOS.has(p.estado)) saldoActivo += Math.max(0, precio - pagado);
    });

    const saldoEntregado = clientesMorosos(pedidosCliente, {}, hoy)[0];
    const deudaActual = saldoEntregado?.deuda || 0;

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

    return {
        cliente,
        totalPedidos,
        totalGastado,
        totalPagado,
        deudaActual,
        saldoEntregado: deudaActual,
        saldoActivo,
        ultimaPedido,
        primerPedido,
        promedioDias,
        diasDeuda: saldoEntregado?.diasDeuda ?? null,
        fechaPrimeraEntregaConSaldo: saldoEntregado?.fechaPrimeraEntrega || null,
        pedidosCliente
    };
}

/**
 * Saldos por cobrar de pedidos entregados. El nombre se conserva por
 * compatibilidad con las pantallas que aún llaman clientesMorosos().
 * El rango selecciona pedidos por fecha de cierre (o solicitud si falta).
 * La edad se cuenta desde la entrega más antigua con saldo; no hay edad
 * confiable si alguno de esos pedidos carece de fecha de cierre.
 */
export function clientesMorosos(pedidos, rango = {}, hoy = obtenerFechaLocal()) {
    const clientes = new Map();

    pedidos.forEach((p) => {
        if (p.estado !== 'Entregado') return;

        const fecha = p.fecha_cierre || p.fecha_solicitud;
        // Sin fecha no se puede ubicar el pedido ni siquiera en el histórico.
        if (!fecha) return;
        if (rango.inicio && fecha < rango.inicio) return;
        if (rango.fin && fecha > rango.fin) return;

        const precio = montoNoNegativo(p.precio);
        const pagado = montoNoNegativo(p.monto_pagado);
        const deuda = Math.max(0, precio - pagado);
        if (deuda === 0) return;

        const cliente = nombreNormalizado(p.cliente) || 'Anónimo';
        const clave = cliente.toLocaleLowerCase('es-CR');
        if (!clientes.has(clave)) {
            clientes.set(clave, {
                cliente, deuda: 0, pagado: 0, pedidos: 0,
                ultimaFecha: null, fechaPrimeraEntrega: null, fechaCierreFaltante: false
            });
        }
        const datos = clientes.get(clave);
        datos.deuda += deuda;
        datos.pagado += pagado;
        datos.pedidos += 1;
        if (!datos.ultimaFecha || fecha > datos.ultimaFecha) datos.ultimaFecha = fecha;
        if (p.fecha_cierre) {
            if (!datos.fechaPrimeraEntrega || p.fecha_cierre < datos.fechaPrimeraEntrega) {
                datos.fechaPrimeraEntrega = p.fecha_cierre;
            }
        } else {
            datos.fechaCierreFaltante = true;
        }
    });

    return [...clientes.values()]
        .map(({ fechaCierreFaltante, ...datos }) => ({
            ...datos,
            diasDeuda: fechaCierreFaltante ? null : diasEntreFechas(datos.fechaPrimeraEntrega, hoy)
        }))
        .sort((a, b) => b.deuda - a.deuda);
}
