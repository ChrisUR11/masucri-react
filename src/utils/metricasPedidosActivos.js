import { obtenerFechaLocal } from './fecha.js';

const ESTADOS_ACTIVOS = ['Pendiente', 'En producción', 'Por Retirar'];

const montoNoNegativo = (valor) => {
    const numero = Number(valor);
    return Number.isFinite(numero) ? Math.max(0, numero) : 0;
};

const resumenVacio = () => ({
    cantidad: 0,
    valorTotal: 0,
    abonado: 0,
    saldoPorCobrar: 0,
    atrasados: 0
});

/** Resumen de la cartera activa actual, independiente del período contable. */
export function calcularPedidosActivos(pedidos, hoy = obtenerFechaLocal()) {
    const estados = ESTADOS_ACTIVOS.map((estado) => ({ estado, ...resumenVacio() }));
    const porEstado = new Map(estados.map((resumen) => [resumen.estado, resumen]));
    const totales = resumenVacio();

    pedidos.forEach((pedido) => {
        const estado = porEstado.get(pedido.estado);
        if (!estado) return;

        const precio = montoNoNegativo(pedido.precio);
        const pagado = montoNoNegativo(pedido.monto_pagado);
        const saldo = Math.max(0, precio - pagado);
        const atrasado = /^\d{4}-\d{2}-\d{2}$/.test(pedido.fecha_entrega || '') && pedido.fecha_entrega < hoy ? 1 : 0;

        for (const resumen of [estado, totales]) {
            resumen.cantidad += 1;
            resumen.valorTotal += precio;
            resumen.abonado += pagado;
            resumen.saldoPorCobrar += saldo;
            resumen.atrasados += atrasado;
        }
    });

    return { estados, totales };
}
