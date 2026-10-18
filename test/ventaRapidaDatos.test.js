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
