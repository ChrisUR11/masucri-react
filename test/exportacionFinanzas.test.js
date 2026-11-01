import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'vite';
import writeExcelFile from 'write-excel-file/node';

test('el respaldo Excel conserva hojas, columnas y separa abonos anulados', async () => {
    const vite = await createServer({
        appType: 'custom',
        logLevel: 'silent',
        server: { middlewareMode: true },
        optimizeDeps: { noDiscovery: true }
    });

    try {
        const { construirHojasRespaldo, construirHojaExcelMovimientos } = await vite.ssrLoadModule('/src/services/exportacionFinanzas.js');
        const pedidos = [{
            id: 'pedido-1', cliente: 'Ana', producto: 'Delantal', precio: 6000,
            monto_pagado: 1000, estado: 'Pendiente',
            productos: [{ nombre: 'Delantal', cantidad: 1, precio_unitario: 6000, total: 6000 }]
        }];
        const productos = [{ nombre: 'Delantal', proveedor: 'Proveedor', codigo_proveedor: 'D1', precio_costo: 2000, precio_venta: 6000 }];
        const movimientos = [
            { id: 'abono-1', pedido_id: 'pedido-1', fecha: '2026-11-01', tipo: 'entrada', metodo_pago: 'Efectivo', descripcion: 'Abono', monto: 1000 },
            { id: 'abono-2', pedido_id: 'pedido-1', fecha: '2026-11-01', tipo: 'entrada', metodo_pago: 'Sinpe Móvil', descripcion: 'Abono anterior', monto: 500, anulado: true, motivo_anulacion: 'Error', anulado_en: { toDate: () => new Date('2026-11-01T12:00:00.000Z') } }
        ];

        const hojas = construirHojasRespaldo(pedidos, productos, movimientos);
        assert.deepEqual(hojas.map((hoja) => hoja.sheet), [
            'Pedidos', 'Productos por pedido', 'Movimientos', 'Abonos anulados', 'Catálogo'
        ]);
        assert.deepEqual(hojas[0].data[0], [
            'Pedido ID', 'Cliente', 'Teléfono', 'Producto', 'Productos', 'Descripción',
            'Subtotal', 'Descuento (%)', 'Descuento (₡)', 'Precio', 'Pagado', 'Estado',
            'Fecha Solicitud', 'Fecha Entrega', 'Fecha Cierre'
        ]);
        assert.deepEqual(hojas[3].data[0], [
            'Movimiento ID', 'Pedido ID', 'Fecha', 'Método', 'Concepto',
            'Monto original', 'Motivo', 'Anulado en', 'Anulado por', 'Reemplazado por'
        ]);
        assert.equal(hojas[2].data.length, 2);
        assert.equal(hojas[2].data[1][5], null);
        assert.equal(hojas[3].data.length, 2);
        assert.equal(hojas[3].data[1][0], 'abono-2');
        assert.equal(hojas[3].data[1][6], 'Error');
        assert.equal(hojas[3].data[1][7], '2026-11-01T12:00:00.000Z');
        assert.equal(hojas[4].data[1][3], 2000);

        const hojaMovimientos = construirHojaExcelMovimientos(movimientos);
        assert.equal(hojaMovimientos.sheet, 'Datos');
        assert.deepEqual(hojaMovimientos.data[0], ['Fecha', 'Método', 'Tipo', 'Categoría', 'Concepto', 'Monto']);
        assert.equal(hojaMovimientos.data.length, 2);

        const archivo = await writeExcelFile(hojas).toBuffer();
        assert.equal(archivo.subarray(0, 2).toString(), 'PK');
        assert.ok(archivo.length > 1000);
    } finally {
        await vite.close();
    }
});
