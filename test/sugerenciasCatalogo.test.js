import test from 'node:test';
import assert from 'node:assert/strict';
import { buscarProductoDuplicado, idDocumentoProducto, normalizarNombreProducto } from '../src/utils/nombreProducto.ts';
import { calcularSugerenciasCatalogo } from '../src/utils/sugerenciasCatalogo.ts';
import { compararProductos } from '../src/utils/importarProductos.js';

test('agrupa variantes del mismo producto y lo omite si ya tiene ficha', () => {
    const pedidos = [
        {
            estado: 'Pendiente',
            productos: [
                { nombre: '  Pijáma   talla 6 ', precio_unitario: 8500, cantidad: 1 },
                { nombre: 'pijama talla 6', precio_unitario: 8500, cantidad: 1 },
                { nombre: 'Delantal', precio_unitario: 6000, cantidad: 1 }
            ]
        },
        { estado: 'Entregado', producto: 'PIJAMA TALLA 6', precio: 8000 },
        { estado: 'Por Retirar', producto: '  Bolso blanco ', precio: 3500 },
        { estado: 'Cancelado', producto: 'Producto cancelado', precio: 1000 }
    ];
    const catalogo = [{ nombre: 'bolso   BLANCO' }];

    const sugerencias = calcularSugerenciasCatalogo(pedidos, catalogo);
    assert.deepEqual(sugerencias.map(({ nombre, pedidos: cantidad, precioReferencia }) => ({ nombre, cantidad, precioReferencia })), [
        { nombre: 'Pijáma talla 6', cantidad: 2, precioReferencia: 8500 },
        { nombre: 'Delantal', cantidad: 1, precioReferencia: 6000 }
    ]);
});

test('un producto existente se reconoce aunque cambien acentos, espacios y mayúsculas', () => {
    const productos = [{ id: 'uno', nombre: 'Llavero Corazón' }];
    assert.equal(normalizarNombreProducto(' LLAVERO   CORAZON '), 'llavero corazon');
    assert.equal(buscarProductoDuplicado(productos, 'llavero corazon')?.id, 'uno');
    assert.equal(buscarProductoDuplicado(productos, 'llavero corazon', 'uno'), null);
});

test('dos altas del mismo nombre usan el mismo documento sin depender del dispositivo', async () => {
    const [primero, segundo, diferente] = await Promise.all([
        idDocumentoProducto('Llavero Corazón'),
        idDocumentoProducto(' llavero  CORAZON '),
        idDocumentoProducto('Llavero Corazón grande')
    ]);
    assert.equal(primero, segundo);
    assert.notEqual(primero, diferente);
    assert.match(primero, /^nombre_[0-9a-f]{64}$/);
});

test('la importación detecta nombres existentes y repetidos dentro del CSV', () => {
    const importados = [
        { nombre: 'Delantal' },
        { nombre: 'Pijama talla 6' },
        { nombre: ' pijáma   TALLA 6 ' }
    ];
    const resultado = compararProductos(importados, [{ nombre: 'delantál' }]);

    assert.deepEqual(resultado.nuevos.map((item) => item.nombre), ['Pijama talla 6']);
    assert.deepEqual(resultado.existentes.map((item) => item.importado.nombre), ['Delantal']);
    assert.deepEqual(resultado.duplicados.map((item) => item.importado.nombre), [' pijáma   TALLA 6 ']);
});
