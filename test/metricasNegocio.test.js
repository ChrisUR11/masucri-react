import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularMetricas } from '../src/utils/metricasNegocio.js';

const pedidos = [
    { estado: 'Entregado', fecha_solicitud: '2026-09-29', fecha_cierre: '2026-10-03', producto: 'Pijama', cliente: 'Ana', precio: 1000, monto_pagado: 400 },
    { estado: 'Pendiente', fecha_solicitud: '2026-10-05', producto: 'Taza', cliente: 'Bea', precio: 500, monto_pagado: 0 },
    { estado: 'Cancelado', fecha_solicitud: '2026-10-07', fecha_cierre: '2026-11-02', producto: 'Taza', cliente: 'Ceci', precio: 900, monto_pagado: 0 },
    { estado: 'Entregado', fecha_solicitud: '2026-10-08', fecha_cierre: '2026-10-09', producto: 'Taza', cliente: 'Bea', precio: 1200, monto_pagado: 1200 },
    { estado: 'Entregado', fecha_solicitud: '2026-10-11', producto: 'Pijama', cliente: 'Dana', precio: 700, monto_pagado: 300 },
    { estado: 'Cancelado', fecha_solicitud: '2026-10-12', fecha_cierre: '2026-10-15', producto: 'Pijama', cliente: 'Eva', precio: 200, monto_pagado: 0 }
];

const movimientos = [
    { fecha: '2026-09-30', tipo: 'entrada', monto: 100, metodo_pago: 'Efectivo' },
    { fecha: '2026-10-03', tipo: 'entrada', monto: 200, metodo_pago: 'Efectivo' },
    { fecha: '2026-10-15', tipo: 'entrada', monto: 50, metodo_pago: 'Sinpe Móvil' },
    { fecha: '2026-11-02', tipo: 'entrada', monto: 300, metodo_pago: 'Efectivo' }
];

test('usa solicitud para pedidos creados y cierre para entregas y cancelaciones', () => {
    const octubre = calcularMetricas(pedidos, movimientos, { inicio: '2026-10-01', fin: '2026-10-31' });

    assert.deepEqual(octubre.topProd, [['TAZA', 2], ['PIJAMA', 1]]);
    assert.equal(octubre.pedMedia, 3);
    assert.equal(octubre.entregadosPeriodo, 3);
    assert.equal(octubre.anuladosPeriodo, 1);
    assert.equal(octubre.tasaCanc, '25.0');
    assert.equal(octubre.pagados100, 1);
    assert.equal(octubre.conDeuda, 2);
    assert.deepEqual(octubre.mayorDeudor, { cliente: 'Ana', debe: 600 });
    assert.deepEqual(octubre.topClientes.map(([, c]) => [c.nombre, c.monto]), [['Bea', 1700], ['Dana', 700]]);
    assert.equal(octubre.ingresosPeriodo, 250);
    assert.equal(octubre.hasVol, false);

    const diaDeCierre = calcularMetricas(pedidos, movimientos, { inicio: '2026-10-03', fin: '2026-10-03' });
    assert.equal(diaDeCierre.entregadosPeriodo, 1);
    assert.equal(diaDeCierre.anuladosPeriodo, 0);
    assert.equal(diaDeCierre.conDeuda, 1);
    assert.equal(diaDeCierre.topProd.length, 0);

    const noviembre = calcularMetricas(pedidos, movimientos, { inicio: '2026-11-01', fin: '2026-11-30' });
    assert.equal(noviembre.entregadosPeriodo, 0);
    assert.equal(noviembre.anuladosPeriodo, 1);
    assert.equal(noviembre.tasaCanc, '100.0');
    assert.equal(noviembre.conDeuda, 0);
    assert.equal(noviembre.topProd.length, 0);
});

test('el histórico incluye todos los períodos y la volatilidad sigue el rango', () => {
    const septiembre = calcularMetricas(pedidos, movimientos, { inicio: '2026-09-01', fin: '2026-09-30' });
    const historico = calcularMetricas(pedidos, movimientos, { inicio: null, fin: null });

    assert.deepEqual(septiembre.topClientes.map(([, c]) => c.nombre), ['Ana']);
    assert.equal(septiembre.pedMedia, 1);
    assert.equal(septiembre.entregadosPeriodo, 0);
    assert.equal(septiembre.conDeuda, 0);
    assert.equal(septiembre.hasVol, false);

    assert.equal(historico.pedMedia, 2);
    assert.equal(historico.entregadosPeriodo, 3);
    assert.equal(historico.anuladosPeriodo, 2);
    assert.equal(historico.tasaCanc, '40.0');
    assert.equal(historico.hasVol, true);
    assert.equal(historico.volMedia, (100 + 250 + 300) / 3);
    assert.equal(historico.minFecha, '2026-09-29');
    assert.equal(historico.maxFecha, '2026-11-02');
});

test('el histórico omite registros sin fecha que no se pueden asignar a un período', () => {
    const sinFecha = { estado: 'Entregado', producto: 'Sin fecha', cliente: 'Desconocido', precio: 1000, monto_pagado: 0 };
    const resultado = calcularMetricas([...pedidos, sinFecha], movimientos, { inicio: null, fin: null });

    assert.equal(resultado.entregadosPeriodo, 3);
    assert.equal(resultado.topProd.some(([nombre]) => nombre === 'SIN FECHA'), false);
    assert.equal(resultado.topClientes.some(([, cliente]) => cliente.nombre === 'Desconocido'), false);
});

test('montos inválidos o negativos no contaminan las métricas financieras', () => {
    const resultado = calcularMetricas(
        [{ estado: 'Entregado', fecha_solicitud: '2026-10-01', fecha_cierre: '2026-10-02', precio: 'error', monto_pagado: Infinity }],
        [
            { fecha: '2026-10-02', tipo: 'entrada', monto: 'error' },
            { fecha: '2026-10-02', tipo: 'entrada', monto: -100 }
        ],
        { inicio: '2026-10-01', fin: '2026-10-31' }
    );

    assert.equal(resultado.ingresosPeriodo, 0);
    assert.equal(resultado.utilidad, 0);
    assert.equal(resultado.conDeuda, 0);
    assert.equal(resultado.pagados100, 0);
    assert.equal(resultado.volMedia, 0);
    assert.equal(resultado.tasaCanc, '0.0');
});

test('desglosa los productos nuevos por pedido sin duplicar líneas ni categorías', () => {
    const pedidosConLineas = [
        {
            estado: 'Pendiente', fecha_solicitud: '2026-10-10',
            producto: 'Taza y 2 productos más', precio: 2700,
            productos: [
                { nombre: 'Taza', cantidad: 2, precio_unitario: 500 },
                { nombre: ' taza ', cantidad: 1, precio_unitario: 500 },
                { nombre: 'Vaso', cantidad: 1, precio_unitario: 700 },
                { nombre: 'Llavero', cantidad: 1, precio_unitario: 500 }
            ]
        },
        { estado: 'Entregado', fecha_solicitud: '2026-10-11', producto: 'Taza', precio: 500 },
        {
            estado: 'Cancelado', fecha_solicitud: '2026-10-12', producto: 'Llavero',
            productos: [{ nombre: 'Llavero', cantidad: 3, precio_unitario: 500 }], precio: 1500
        }
    ];

    const metricas = calcularMetricas(pedidosConLineas, [], { inicio: '2026-10-01', fin: '2026-10-31' });
    assert.deepEqual(metricas.topProd, [['TAZA', 2], ['VASO', 1], ['LLAVERO', 1]]);
    assert.deepEqual(metricas.catProductos, { 'Tazas y Vasos': 2, 'Llaveros y Placas': 1 });
    assert.equal(metricas.topProd.some(([nombre]) => nombre.includes('MÁS')), false);
});
