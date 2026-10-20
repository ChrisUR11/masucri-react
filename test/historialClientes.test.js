import test from 'node:test';
import assert from 'node:assert/strict';
import { clientesMorosos, obtenerHistorialCliente } from '../src/utils/historialClientes.js';

test('cuentas por cobrar solo incluye el saldo residual de pedidos entregados', () => {
    const pedidos = [
        { cliente: ' Ana  Sol ', estado: 'Pendiente', precio: 1000, monto_pagado: 300 },
        { cliente: 'Ana Sol', estado: 'Entregado', precio: 2000, monto_pagado: 500, fecha_cierre: '2026-10-10' },
        { cliente: 'ana sol', estado: 'Entregado', precio: 1000, monto_pagado: 250, fecha_cierre: '2026-10-15' },
        { cliente: 'Ana Sol', estado: 'Entregado', precio: 500, monto_pagado: 500, fecha_cierre: '2026-10-16' },
        { cliente: 'Ana Sol', estado: 'Cancelado', precio: 900, monto_pagado: 0 }
    ];

    const saldos = clientesMorosos(pedidos, {}, '2026-10-20');
    assert.equal(saldos.length, 1);
    assert.deepEqual(saldos[0], {
        cliente: 'Ana Sol', deuda: 2250, pagado: 750, pedidos: 2,
        ultimaFecha: '2026-10-15', fechaPrimeraEntrega: '2026-10-10', diasDeuda: 10
    });
    assert.equal(obtenerHistorialCliente('Ana Sol', pedidos).totalPedidos, 5);
});

test('el período usa fecha de cierre, incluye sus límites y admite fecha de solicitud como respaldo', () => {
    const pedidos = [
        { cliente: 'Lía', estado: 'Entregado', precio: 100, fecha_solicitud: '2026-09-01', fecha_cierre: '2026-10-01' },
        { cliente: 'Lía', estado: 'Entregado', precio: 200, fecha_solicitud: '2026-09-02', fecha_cierre: '2026-10-20' },
        { cliente: 'Lía', estado: 'Entregado', precio: 300, fecha_solicitud: '2026-10-20' },
        { cliente: 'Lía', estado: 'Entregado', precio: 400, fecha_solicitud: '2026-09-04', fecha_cierre: '2026-10-21' },
        { cliente: 'Lía', estado: 'Entregado', precio: 500 }
    ];

    const saldos = clientesMorosos(pedidos, { inicio: '2026-10-20', fin: '2026-10-20' }, '2026-10-20');
    assert.equal(saldos.length, 1);
    assert.equal(saldos[0].deuda, 500);
    assert.equal(saldos[0].pedidos, 2);
    assert.equal(saldos[0].diasDeuda, null);

    const historico = clientesMorosos(pedidos, {}, '2026-10-20');
    assert.equal(historico[0].deuda, 1000);
    assert.equal(historico[0].pedidos, 4);
});

test('un abono reciente no cambia la antigüedad desde entrega', () => {
    const saldos = clientesMorosos([{
        cliente: 'Luis', estado: 'Entregado', precio: 1000, monto_pagado: 900,
        fecha_solicitud: '2026-09-01', fecha_cierre: '2026-10-01',
        historial_pagos: [{ fecha: '2026-10-19', monto: 900 }]
    }], {}, '2026-10-20');

    assert.equal(saldos[0].deuda, 100);
    assert.equal(saldos[0].pagado, 900);
    assert.equal(saldos[0].diasDeuda, 19);
});

test('historial del cliente separa saldos activos y entregados, sin cargar cancelados', () => {
    const pedidos = [
        { cliente: ' Mía  Mora ', estado: 'Pendiente', precio: 1000, monto_pagado: 200, fecha_solicitud: '2026-10-19' },
        { cliente: 'mía mora', estado: 'En producción', precio: 500, monto_pagado: 0, fecha_solicitud: '2026-10-18' },
        { cliente: 'Mía Mora', estado: 'Entregado', precio: 2000, monto_pagado: 500, fecha_solicitud: '2026-09-01', fecha_cierre: '2026-10-10' },
        { cliente: 'Mía Mora', estado: 'Entregado', precio: 1000, monto_pagado: 1000, fecha_solicitud: '2026-09-05', fecha_cierre: '2026-10-15' },
        { cliente: 'Mía Mora', estado: 'Cancelado', precio: 900, monto_pagado: 100, fecha_solicitud: '2026-10-17' }
    ];

    const historial = obtenerHistorialCliente('Mía Mora', pedidos, '2026-10-20');
    assert.equal(historial.totalPedidos, 5);
    assert.equal(historial.totalGastado, 4500);
    assert.equal(historial.totalPagado, 1700);
    assert.equal(historial.saldoActivo, 1300);
    assert.equal(historial.saldoEntregado, 1500);
    assert.equal(historial.deudaActual, 1500);
    assert.equal(historial.diasDeuda, 10);
    assert.equal(historial.fechaPrimeraEntregaConSaldo, '2026-10-10');
});

test('el historial no atribuye antigüedad de pago a pedidos solo activos', () => {
    const historial = obtenerHistorialCliente('Eva', [
        { cliente: 'Eva', estado: 'Por Retirar', precio: 1200, monto_pagado: 500, fecha_solicitud: '2026-09-01' },
        { cliente: 'Eva', estado: 'Cancelado', precio: 5000, monto_pagado: 0, fecha_solicitud: '2026-08-01' }
    ], '2026-10-20');

    assert.equal(historial.totalPedidos, 2);
    assert.equal(historial.totalGastado, 1200);
    assert.equal(historial.totalPagado, 500);
    assert.equal(historial.saldoActivo, 700);
    assert.equal(historial.saldoEntregado, 0);
    assert.equal(historial.diasDeuda, null);
});
