import test from 'node:test';
import assert from 'node:assert/strict';
import { indicePagoEnHistorial, prepararCorreccionAbono } from '../src/utils/correccionAbonoDatos.js';

const fechaHora = new Date('2026-11-01T15:00:00Z');
const auditoria = { fechaHora, usuario: 'admin@gmail.com', motivo: 'Monto incorrecto' };
const pedido = {
    id: 'pedido-1', precio: 5000, monto_pagado: 1500,
    historial_pagos: [
        { fecha: '2026-10-30', monto: 1000, metodo: 'Efectivo', movimiento_id: 'mov-1' },
        { fecha: '2026-10-31', monto: 500, metodo: 'Sinpe Móvil', movimiento_id: 'mov-2' }
    ]
};
const movimiento = {
    id: 'mov-1', pedido_id: 'pedido-1', tipo: 'entrada',
    fecha: '2026-10-30', monto: 1000, metodo_pago: 'Efectivo', descripcion: 'Abono: Pijama'
};

test('editar un abono conserva el original anulado y ajusta pedido y Caja una sola vez', () => {
    const plan = prepararCorreccionAbono(
        pedido, movimiento,
        { fecha: '2026-10-29', monto: 750, metodo: 'Transferencia' },
        'mov-3', auditoria
    );
    assert.equal(plan.pedidoActualizado.monto_pagado, 1250);
    assert.equal(plan.movimientoAnulado.anulado, true);
    assert.equal(plan.movimientoAnulado.reemplazado_por, 'mov-3');
    assert.equal(plan.movimientoNuevo.monto, 750);
    assert.equal(plan.movimientoNuevo.corrige_movimiento_id, 'mov-1');
    assert.equal(plan.pedidoActualizado.historial_pagos[0].anulado, true);
    assert.equal(plan.pedidoActualizado.historial_pagos[2].movimiento_id, 'mov-3');
    assert.equal(pedido.historial_pagos[0].anulado, undefined);
    assert.equal(movimiento.anulado, undefined);
});

test('anular un abono reduce lo pagado y conserva un rastro sin movimiento sustituto', () => {
    const plan = prepararCorreccionAbono(pedido, movimiento, null, null, auditoria);
    assert.equal(plan.pedidoActualizado.monto_pagado, 500);
    assert.equal(plan.pedidoActualizado.ultimo_metodo_pago, 'Sinpe Móvil');
    assert.equal(plan.pedidoActualizado.historial_pagos.length, 2);
    assert.equal(plan.pedidoActualizado.historial_pagos[0].anulado, true);
    assert.equal(plan.movimientoNuevo, null);
});

test('una corrección concurrente del mismo movimiento no puede descontarlo dos veces', () => {
    assert.throws(
        () => prepararCorreccionAbono(pedido, { ...movimiento, anulado: true }, null, null, auditoria),
        /ya fue corregido o anulado/
    );
});

test('rechaza un nuevo abono que supera el precio tras corregir el anterior', () => {
    assert.throws(
        () => prepararCorreccionAbono(
            pedido, movimiento,
            { fecha: '2026-11-01', monto: 4600, metodo: 'Efectivo' },
            'mov-3', auditoria
        ),
        /no puede superar el precio/
    );
});

test('bloquea pagos antiguos idénticos sin id porque no tienen vínculo único', () => {
    const antiguo = {
        ...pedido, monto_pagado: 2000,
        historial_pagos: [
            { fecha: '2026-10-30', monto: 1000, metodo: 'Efectivo' },
            { fecha: '2026-10-30', monto: 1000, metodo: 'Efectivo' }
        ]
    };
    assert.throws(
        () => prepararCorreccionAbono(antiguo, movimiento, null, null, auditoria),
        /No se pudo vincular/
    );
});

test('permite corregir un pago antiguo solo si el vínculo por datos es único', () => {
    const antiguo = {
        ...pedido, monto_pagado: 1000,
        historial_pagos: [{ fecha: '2026-10-30', monto: 1000, metodo: 'Efectivo' }]
    };
    const plan = prepararCorreccionAbono(antiguo, movimiento, null, null, auditoria);
    assert.equal(plan.pedidoActualizado.monto_pagado, 0);
    assert.equal(plan.pedidoActualizado.historial_pagos[0].movimiento_id, 'mov-1');
});

test('rechaza un id de movimiento si su importe difiere del historial', () => {
    const incoherente = {
        ...pedido, monto_pagado: 1400,
        historial_pagos: [
            { fecha: '2026-10-30', monto: 900, metodo: 'Efectivo', movimiento_id: 'mov-1' },
            pedido.historial_pagos[1]
        ]
    };
    assert.throws(
        () => prepararCorreccionAbono(incoherente, movimiento, null, null, auditoria),
        /No se pudo vincular/
    );
});

test('rechaza un id de movimiento si la fecha o el método difieren', () => {
    const incoherente = {
        ...pedido,
        historial_pagos: [{ ...pedido.historial_pagos[0], metodo: 'Transferencia' }, pedido.historial_pagos[1]]
    };
    assert.throws(
        () => prepararCorreccionAbono(incoherente, movimiento, null, null, auditoria),
        /No se pudo vincular/
    );
});

test('rechaza un historial incompleto aunque el movimiento tenga id', () => {
    const incompleto = { ...pedido, monto_pagado: 1600 };
    assert.throws(
        () => prepararCorreccionAbono(incompleto, movimiento, null, null, auditoria),
        /no coincide con el total pagado/
    );
});

test('no altera saldos si el movimiento carece de historial verificable', () => {
    assert.throws(
        () => prepararCorreccionAbono({ ...pedido, historial_pagos: [] }, movimiento, null, null, auditoria),
        /no coincide con el total pagado/
    );
});

test('la interfaz no asigna entradas ambiguas a movimientos antiguos idénticos', () => {
    const historial = [
        { fecha: '2026-10-30', monto: 1000, metodo: 'Efectivo' },
        { fecha: '2026-10-30', monto: 1000, metodo: 'Efectivo' }
    ];
    const usados = new Set();
    assert.equal(indicePagoEnHistorial(historial, movimiento, usados), -1);
    assert.equal(indicePagoEnHistorial(historial, { ...movimiento, id: 'mov-2' }, usados), -1);
});
