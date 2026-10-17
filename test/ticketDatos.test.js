import test from 'node:test';
import assert from 'node:assert/strict';
import { fechaTicket, formatoMontoTicket, lineasTicket, prepararDatosTicket } from '../src/utils/ticketDatos.js';

const pedido = Object.freeze({
    id: 'abc12345xyz',
    cliente: 'Cliente registrado',
    producto: 'Tazas personalizadas',
    descripcion: 'Nota interna que no debe aparecer',
    precio: 20000,
    monto_pagado: 7000,
    fecha_solicitud: '2026-10-17',
    historial_pagos: Object.freeze([
        Object.freeze({ fecha: '2026-10-15', metodo: 'Efectivo', monto: 3000 }),
        Object.freeze({ fecha: '2026-10-17', metodo: 'Sinpe Móvil', monto: 4000 })
    ])
});

test('el nombre del ticket no modifica el pedido ni expone las notas', () => {
    const ticket = prepararDatosTicket(pedido, '  Ana Rodríguez  ');
    assert.equal(ticket.cliente, 'Ana Rodríguez');
    assert.equal(pedido.cliente, 'Cliente registrado');
    assert.equal(ticket.producto, pedido.producto);
    assert.equal('descripcion' in ticket, false);
    assert.equal(ticket.fecha, '17/10/2026');
});

test('total, abonos y saldo no suman los pagos dos veces', () => {
    const ticket = prepararDatosTicket(pedido);
    assert.equal(ticket.total, 20000);
    assert.equal(ticket.pagado, 7000);
    assert.equal(ticket.saldo, 13000);
    assert.equal(ticket.pagos.length, 2);
    assert.equal(ticket.estadoPago, 'Abono parcial');
    assert.equal(prepararDatosTicket({ ...pedido, monto_pagado: 0 }).pagado, 0);
    assert.equal(prepararDatosTicket({ ...pedido, monto_pagado: null }).pagado, 7000);
});

test('los pedidos sin abonos, pagados y con saldo a favor tienen importes coherentes', () => {
    const sinAbonos = prepararDatosTicket({ ...pedido, monto_pagado: 0, historial_pagos: null });
    assert.equal(sinAbonos.saldo, 20000);
    assert.deepEqual(sinAbonos.pagos, []);
    assert.equal(sinAbonos.estadoPago, 'Pendiente de pago');
    const pagado = prepararDatosTicket({ ...pedido, monto_pagado: 20000 });
    assert.equal(pagado.saldo, 0);
    assert.equal(pagado.estadoPago, 'Pagado');
    const excedente = prepararDatosTicket({ ...pedido, monto_pagado: 22000 });
    assert.equal(excedente.saldo, 0);
    assert.equal(excedente.saldoAFavor, 2000);
});

test('los centavos se conservan y las fechas no cambian de día por la zona horaria', () => {
    const ticket = prepararDatosTicket({ precio: 1000.50, monto_pagado: 200.25 });
    assert.equal(ticket.saldo, 800.25);
    assert.match(formatoMontoTicket(ticket.saldo), /800,25/);
    assert.equal(fechaTicket('2026-10-17'), '17/10/2026');
});

test('nombres largos y palabras sin espacios se dividen sin perder texto', () => {
    const ctx = { measureText: (texto) => ({ width: [...texto].length * 10 }) };
    const original = 'María Fernanda\nProductoPersonalizadoMuyLargoSinEspacios';
    const lineas = lineasTicket(ctx, original, 100);
    assert.ok(lineas.length > 2);
    assert.ok(lineas.every((linea) => ctx.measureText(linea).width <= 100));
    assert.equal(lineas.join('').replace(/\s/g, ''), original.replace(/\s/g, ''));
});
