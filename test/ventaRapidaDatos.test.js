import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararDatosVentaRapida } from '../src/utils/ventaRapidaDatos.js';

const venta = {
    cliente: ' Ana ',
    telefono: ' 8888-8888 ',
    producto: ' Llaveros ',
    precio: '1000.50',
    pagado: '200.25',
    metodo: 'Efectivo'
};

test('la venta con pago vincula el ingreso al pedido y conserva los montos', () => {
    const timestamp = new Date('2026-10-17T12:00:00Z');
    const { datosPedido, datosMovimiento } = prepararDatosVentaRapida(
        venta,
        '2026-10-17',
        'pedido-123',
        timestamp
    );

    assert.equal(datosPedido.cliente, 'Ana');
    assert.equal(datosPedido.telefono, '8888-8888');
    assert.equal(datosPedido.producto, 'Llaveros');
    assert.equal(datosPedido.precio, 1000.50);
    assert.equal(datosPedido.monto_pagado, 200.25);
    assert.deepEqual(datosPedido.historial_pagos, [
        { fecha: '2026-10-17', monto: 200.25, metodo: 'Efectivo' }
    ]);
    assert.equal(datosMovimiento.pedido_id, 'pedido-123');
    assert.equal(datosMovimiento.monto, datosPedido.monto_pagado);
    assert.equal(datosMovimiento.timestamp, datosPedido.timestamp);
});

test('una venta sin pago no crea un ingreso en caja', () => {
    const { datosPedido, datosMovimiento } = prepararDatosVentaRapida(
        { ...venta, pagado: '' },
        '2026-10-17',
        'pedido-123'
    );
    assert.equal(datosPedido.monto_pagado, 0);
    assert.deepEqual(datosPedido.historial_pagos, []);
    assert.equal(datosPedido.ultimo_metodo_pago, 'Pendiente');
    assert.equal(datosMovimiento, null);
});

test('no acepta montos negativos, no numéricos, infinitos ni pagos excesivos', () => {
    for (const [campo, valor] of [
        ['precio', 'Infinity'],
        ['precio', '12abc'],
        ['precio', '0'],
        ['pagado', '-1'],
        ['pagado', 'NaN'],
        ['pagado', 'Infinity'],
        ['pagado', '1000.51']
    ]) {
        assert.throws(
            () => prepararDatosVentaRapida({ ...venta, [campo]: valor }, '2026-10-17', 'pedido-123'),
            Error,
            `${campo}=${valor}`
        );
    }
});

test('una venta con varios productos aplica el descuento antes de registrar el pago', () => {
    const { datosPedido, datosMovimiento } = prepararDatosVentaRapida({
        cliente: 'Ana',
        telefono: '',
        productos: [
            { nombre: 'Taza', precio_unitario: '1500', cantidad: '2' },
            { nombre: 'Llavero', precio_unitario: '500', cantidad: '1' }
        ],
        descripcion: 'Entregar en bolsa de regalo',
        descuento_tipo: 'porcentaje',
        descuento_valor: '10',
        pagado: '1000',
        metodo: 'Efectivo'
    }, '2026-10-17', 'pedido-multiple');

    assert.deepEqual(datosPedido.productos.map(({ total }) => total), [3000, 500]);
    assert.equal(datosPedido.subtotal, 3500);
    assert.equal(datosPedido.descuento_monto, 350);
    assert.equal(datosPedido.descuento_porcentaje, 10);
    assert.equal(datosPedido.precio, 3150);
    assert.equal(datosPedido.descripcion, 'Entregar en bolsa de regalo');
    assert.equal(datosPedido.monto_pagado, 1000);
    assert.equal(datosMovimiento.monto, 1000);
});

test('rechaza cantidades, líneas y descuentos inválidos en venta rápida', () => {
    const base = {
        cliente: 'Ana', productos: [{ nombre: 'Taza', precio_unitario: '1000', cantidad: 1 }],
        descuento_tipo: 'monto', descuento_valor: '', pagado: '', metodo: 'Efectivo'
    };
    for (const cambio of [
        { productos: [{ nombre: 'Taza', precio_unitario: '1000', cantidad: 0 }] },
        { productos: [{ nombre: '', precio_unitario: '1000', cantidad: 1 }] },
        { productos: [{ nombre: 'Taza', precio_unitario: '', cantidad: 1 }] },
        { descuento_valor: '1001' },
        { descuento_tipo: 'porcentaje', descuento_valor: '101' },
        { descuento_tipo: 'monto', descuento_valor: '-1' },
        { descuento_tipo: 'monto', descuento_valor: '0.001' },
        { pagado: '0.001' }
    ]) {
        assert.throws(() => prepararDatosVentaRapida({ ...base, ...cambio }, '2026-10-17', 'pedido-invalido'));
    }
});
