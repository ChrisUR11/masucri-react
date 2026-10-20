import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularMetricasContables } from '../src/utils/metricasContables.js';

const rangoOctubre = { inicio: '2026-10-01', fin: '2026-10-31' };

test('atribuye las entregas a la fecha de cierre y usa la solicitud solo en registros antiguos', () => {
    const pedidos = [
        { estado: 'Entregado', fecha_solicitud: '2026-09-20', fecha_cierre: '2026-10-01', precio: 1000, cliente: 'Ana' },
        { estado: 'Entregado', fecha_solicitud: '2026-10-10', fecha_cierre: '2026-11-01', precio: 2000, cliente: 'Beto' },
        { estado: 'Entregado', fecha_solicitud: '2026-10-31', precio: 500, cliente: 'Cata' },
        { estado: 'Cancelado', fecha_solicitud: '2026-10-02', fecha_cierre: '2026-10-02', precio: 900 },
        { estado: 'Pendiente', fecha_solicitud: '2026-10-04', precio: 700 }
    ];

    const metricas = calcularMetricasContables(pedidos, [], rangoOctubre);
    assert.equal(metricas.pedidosEntregadosEnPeriodo, 2);
    assert.equal(metricas.precioTotalVenta, 1500);
    assert.deepEqual(metricas.topClientesPorValor.map((cliente) => cliente.nombre), ['Ana', 'Cata']);
});

test('agrupa variantes de mayúsculas y espacios de un mismo cliente', () => {
    const pedidos = [
        { estado: 'Entregado', fecha_cierre: '2026-10-01', precio: 1000, cliente: ' Ana  Sol ' },
        { estado: 'Entregado', fecha_cierre: '2026-10-02', precio: 500, cliente: 'ana sol' }
    ];

    const metricas = calcularMetricasContables(pedidos, [], rangoOctubre);
    assert.deepEqual(metricas.topClientesPorValor.map(({ nombre, valor, pedidos: cantidad }) => ({ nombre, valor, cantidad })), [
        { nombre: 'Ana Sol', valor: 1500, cantidad: 2 }
    ]);
});

test('calcula margen solo con costos y precios conocidos, incluido costo cero explícito', () => {
    const pedido = { estado: 'Entregado', fecha_cierre: '2026-10-15', fecha_solicitud: '2026-10-10' };
    const pedidos = [
        { ...pedido, producto: 'Con costo', precio: 1000, costo_unitario: 150, cantidad: 2 },
        { ...pedido, producto: 'Sin costo', precio: 2000 },
        { ...pedido, producto: 'Costo cero', precio: 100, costo_unitario: 0 },
        { ...pedido, producto: 'Costo inválido', precio: 400, costo_unitario: 'no existe' },
        { ...pedido, producto: 'Precio inválido', precio: 'no existe', costo_unitario: 30 }
    ];

    const metricas = calcularMetricasContables(pedidos, [], rangoOctubre);
    assert.equal(metricas.pedidosEntregadosEnPeriodo, 5);
    assert.equal(metricas.precioTotalVenta, 3500);
    assert.equal(metricas.pedidosConCosto, 2);
    assert.equal(metricas.ventasConCosto, 1100);
    assert.equal(metricas.costoTotal, 300);
    assert.equal(metricas.gananciaTotal, 800);
    assert.ok(Math.abs(metricas.margenPromedio - 800 / 1100 * 100) < 1e-9);
    assert.deepEqual(metricas.topMargen.map((producto) => producto.nombre), ['Costo cero', 'Con costo']);
});

test('sin costos registrados no presenta un margen supuesto', () => {
    const pedidos = [
        { estado: 'Entregado', fecha_cierre: '2026-10-15', precio: 3000, producto: 'Sin costo' },
        { estado: 'Entregado', fecha_cierre: '2026-10-16', precio: 500, costo_unitario: 1e308, cantidad: 1e308 }
    ];

    const metricas = calcularMetricasContables(pedidos, [], rangoOctubre);
    assert.equal(metricas.precioTotalVenta, 3500);
    assert.equal(metricas.pedidosConCosto, 0);
    assert.equal(metricas.ventasConCosto, 0);
    assert.equal(metricas.margenPromedio, null);
    assert.deepEqual(metricas.topMargen, []);
});

test('filtra movimientos por su fecha y conserva ambos extremos del rango', () => {
    const movimientos = [
        { fecha: '2026-09-30', tipo: 'entrada', monto: 999 },
        { fecha: '2026-10-01', tipo: 'entrada', monto: 500 },
        { fecha: '2026-10-31', tipo: 'entrada', monto: '250' },
        { fecha: '2026-10-31', tipo: 'salida', monto: 100 },
        { fecha: '2026-10-20', tipo: 'entrada', monto: 'no existe' },
        { fecha: '2026-10-20', tipo: 'salida', monto: Infinity },
        { fecha: '2026-10-20', tipo: 'salida', monto: -10 },
        { fecha: '2026-11-01', tipo: 'salida', monto: 999 }
    ];

    const metricas = calcularMetricasContables([], movimientos, rangoOctubre);
    assert.equal(metricas.ingresos, 750);
    assert.equal(metricas.gastos, 100);
    assert.equal(metricas.flujoCaja, 650);
    assert.ok(Math.abs(metricas.rentabilidad - 650 / 750 * 100) < 1e-9);
    assert.ok(Math.abs(metricas.ratioGastoIngreso - 100 / 750 * 100) < 1e-9);
    assert.deepEqual(metricas.flujoCajaPorMes, [
        { mes: '2026-10', flujo: 650, ingresos: 750, gastos: 100 }
    ]);
});
