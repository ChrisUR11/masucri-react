import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularMetricas } from '../src/utils/metricasNegocio.js';
import { calcularMetricasContables } from '../src/utils/metricasContables.js';
import { calcularPedidosActivos } from '../src/utils/metricasPedidosActivos.js';

test('BI separa caja del período, cierres del período y saldos activos actuales', () => {
    const rango = { inicio: '2026-10-01', fin: '2026-10-31' };
    const pedidos = [
        {
            estado: 'Entregado', cliente: 'Ana', producto: 'Bolso',
            fecha_solicitud: '2026-09-20', fecha_cierre: '2026-10-02',
            precio: 6000, monto_pagado: 1500
        },
        {
            estado: 'En producción', cliente: 'Beto', producto: 'Taza',
            fecha_solicitud: '2026-09-25', fecha_entrega: '2026-10-19',
            precio: 5000, monto_pagado: 1000
        },
        {
            estado: 'Cancelado', cliente: 'Cata', producto: 'Vaso',
            fecha_solicitud: '2026-09-28', fecha_cierre: '2026-10-05',
            precio: 2000, monto_pagado: 0
        }
    ];
    const movimientos = [
        { tipo: 'entrada', fecha: '2026-10-03', monto: 1500 },
        { tipo: 'entrada', fecha: '2026-10-10', monto: 1000 },
        { tipo: 'salida', fecha: '2026-10-08', monto: 300 },
        { tipo: 'salida', fecha: '2026-10-09', monto: -10 },
        { tipo: 'entrada', fecha: '2026-09-20', monto: 999 }
    ];

    const negocio = calcularMetricas(pedidos, movimientos, rango);
    const contabilidad = calcularMetricasContables(pedidos, movimientos, rango);
    const activos = calcularPedidosActivos(pedidos, '2026-10-20');

    assert.equal(negocio.ingresosPeriodo, contabilidad.ingresos);
    assert.equal(negocio.gastosPeriodo, contabilidad.gastos);
    assert.equal(negocio.utilidad, contabilidad.flujoCaja);
    assert.equal(negocio.entregadosPeriodo, 1);
    assert.equal(negocio.anuladosPeriodo, 1);
    assert.equal(contabilidad.precioTotalVenta, 6000);
    assert.equal(contabilidad.margenPromedio, null);
    assert.equal(contabilidad.morosos[0].deuda, 4500);
    assert.equal(activos.totales.cantidad, 1);
    assert.equal(activos.totales.valorTotal, 5000);
    assert.equal(activos.totales.saldoPorCobrar, 4000);
    assert.equal(activos.totales.atrasados, 1);
});
