import { obtenerFechaLocal } from './fecha.js';

export type EstadoPedidoActivo = 'Pendiente' | 'En producción' | 'Por Retirar';

export interface PedidoResumenFuente {
    estado?: string | null;
    precio?: unknown;
    monto_pagado?: unknown;
    fecha_entrega?: string | null;
}

interface ResumenPedidos {
    cantidad: number;
    valorTotal: number;
    abonado: number;
    saldoPorCobrar: number;
    atrasados: number;
}

export interface ResumenEstadoPedidos extends ResumenPedidos {
    estado: EstadoPedidoActivo;
}

const ESTADOS_ACTIVOS: readonly EstadoPedidoActivo[] = ['Pendiente', 'En producción', 'Por Retirar'];

const montoNoNegativo = (valor: unknown): number => {
    const numero = Number(valor);
    return Number.isFinite(numero) ? Math.max(0, numero) : 0;
};

const resumenVacio = (): ResumenPedidos => ({
    cantidad: 0,
    valorTotal: 0,
    abonado: 0,
    saldoPorCobrar: 0,
    atrasados: 0
});

/** Resumen de la cartera activa actual, independiente del período contable. */
export function calcularPedidosActivos(pedidos: readonly PedidoResumenFuente[], hoy: string = obtenerFechaLocal()) {
    const estados: ResumenEstadoPedidos[] = ESTADOS_ACTIVOS.map((estado) => ({ estado, ...resumenVacio() }));
    const porEstado = new Map<string, ResumenEstadoPedidos>(estados.map((resumen) => [resumen.estado, resumen]));
    const totales = resumenVacio();

    pedidos.forEach((pedido) => {
        const estado = porEstado.get(pedido.estado ?? '');
        if (!estado) return;

        const precio = montoNoNegativo(pedido.precio);
        const pagado = montoNoNegativo(pedido.monto_pagado);
        const saldo = Math.max(0, precio - pagado);
        const fechaEntrega = pedido.fecha_entrega || '';
        const atrasado = /^\d{4}-\d{2}-\d{2}$/.test(fechaEntrega) && fechaEntrega < hoy ? 1 : 0;

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
