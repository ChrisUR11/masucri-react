import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularPedidosActivos } from '../src/utils/metricasPedidosActivos.js';

test('resume estados activos, abonos, saldos y entregas atrasadas', () => {
    const resumen = calcularPedidosActivos([
        { estado: 'Pendiente', precio: 1000, monto_pagado: 200, fecha_entrega: '2026-10-19' },
        { estado: 'Pendiente', precio: 500, monto_pagado: 0 },
        { estado: 'En producción', precio: 2500, monto_pagado: 500, fecha_entrega: '2026-10-20' },
        { estado: 'Por Retirar', precio: 900, monto_pagado: 1000, fecha_entrega: '2026-10-21' },
        { estado: 'Entregado', precio: 7000, monto_pagado: 0, fecha_entrega: '2026-10-01' },
        { estado: 'Cancelado', precio: 8000, monto_pagado: 0, fecha_entrega: '2026-10-01' }
    ], '2026-10-20');

    assert.deepEqual(resumen, {
        estados: [
            { estado: 'Pendiente', cantidad: 2, valorTotal: 1500, abonado: 200, saldoPorCobrar: 1300, atrasados: 1 },
            { estado: 'En producción', cantidad: 1, valorTotal: 2500, abonado: 500, saldoPorCobrar: 2000, atrasados: 0 },
            { estado: 'Por Retirar', cantidad: 1, valorTotal: 900, abonado: 1000, saldoPorCobrar: 0, atrasados: 0 }
        ],
        totales: { cantidad: 4, valorTotal: 4900, abonado: 1700, saldoPorCobrar: 3300, atrasados: 1 }
    });
});

test('sin pedidos activos entrega todas las filas en cero', () => {
    const resumen = calcularPedidosActivos([{ estado: 'Entregado', precio: 100 }], '2026-10-20');
    assert.deepEqual(resumen.estados.map(({ cantidad }) => cantidad), [0, 0, 0]);
    assert.deepEqual(resumen.totales, {
        cantidad: 0, valorTotal: 0, abonado: 0, saldoPorCobrar: 0, atrasados: 0
    });
});
