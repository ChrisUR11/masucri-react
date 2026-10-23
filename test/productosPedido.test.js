import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularTotalesPedido, detalleProductosPedido, obtenerProductosPedido, resumenProductos, validarProductosPedido } from '../src/utils/productosPedido.js';

const productos = [
    { nombre: 'Taza', precio_unitario: 3500, cantidad: 2, total: 7000 },
    { nombre: 'Camisa', precio_unitario: 6000, cantidad: 1, total: 6000 }
];

test('un pedido antiguo se puede editar como una línea sin perder su precio', () => {
    assert.deepEqual(obtenerProductosPedido({ producto: 'Taza', precio: 3500 }), [
        { nombre: 'Taza', precio_unitario: 3500, cantidad: 1, total: 3500 }
    ]);
    assert.equal(resumenProductos(productos), 'Taza y 1 producto más');
    assert.equal(detalleProductosPedido({ productos }), '2 × Taza, 1 × Camisa');
    assert.deepEqual(obtenerProductosPedido({ producto: 'Taza', precio: 3500, productos: [null] }), [
        { nombre: 'Taza', precio_unitario: 3500, cantidad: 1, total: 3500 }
    ]);
});

test('el total de cada línea sigue el precio unitario y la cantidad', () => {
    assert.deepEqual(obtenerProductosPedido({ productos: [
        { nombre: 'Taza', precio_unitario: 3500, cantidad: 2, total: 6000 }
    ] }), [{ nombre: 'Taza', precio_unitario: 3500, cantidad: 2, total: 7000 }]);
});

test('monto y porcentaje de descuento calculan el mismo total', () => {
    assert.deepEqual(calcularTotalesPedido(productos, { descuento_porcentaje: 10 }), {
        subtotal: 13000,
        descuento_monto: 1300,
        descuento_porcentaje: 10,
        precio: 11700
    });
    assert.deepEqual(calcularTotalesPedido(productos, { descuento_monto: 1300 }), {
        subtotal: 13000,
        descuento_monto: 1300,
        descuento_porcentaje: 10,
        precio: 11700
    });
});

test('el monto indicado prevalece y nunca genera un precio negativo', () => {
    assert.equal(calcularTotalesPedido(productos, {
        descuento_monto: 2000,
        descuento_porcentaje: 50
    }).precio, 11000);
    assert.deepEqual(calcularTotalesPedido(productos, { descuento_monto: 20000 }), {
        subtotal: 13000,
        descuento_monto: 13000,
        descuento_porcentaje: 100,
        precio: 0
    });
});

test('el subtotal coincide con la suma de líneas y un descuento pequeño conserva su porcentaje', () => {
    const lineas = validarProductosPedido([
        { nombre: 'Etiqueta', precio_unitario: '0.29', cantidad: 3 },
        { nombre: 'Sobre', precio_unitario: '0.10', cantidad: 1 }
    ]);
    assert.equal(lineas.reduce((suma, linea) => suma + linea.total, 0), 0.97);
    assert.equal(calcularTotalesPedido(lineas).subtotal, 0.97);
    assert.equal(calcularTotalesPedido([{ nombre: 'Pedido grande', precio_unitario: 100000, cantidad: 1 }], {
        descuento_monto: 1
    }).descuento_porcentaje, 0.001);
    const lineaGrande = validarProductosPedido([{ nombre: 'Máquina', precio_unitario: 4316131193098.97, cantidad: 9 }]);
    assert.equal(calcularTotalesPedido(lineaGrande).subtotal, lineaGrande[0].total);
    assert.equal(obtenerProductosPedido({ productos: lineaGrande })[0].total, lineaGrande[0].total);
});

test('no guarda precios con fracciones menores a un céntimo ni totales infinitos', () => {
    for (const linea of [
        { nombre: 'Etiqueta', precio_unitario: '0.001', cantidad: 1 },
        { nombre: 'Etiqueta', precio_unitario: 1e308, cantidad: 2 },
        { nombre: 'Etiqueta', precio_unitario: 1e13, cantidad: 10 },
        { nombre: 'Etiqueta', precio_unitario: ' ', cantidad: 1 },
        { nombre: 'Etiqueta', precio_unitario: '', cantidad: 1 }
    ]) {
        assert.throws(() => validarProductosPedido([linea]));
    }
    assert.throws(() => validarProductosPedido([
        { nombre: 'A', precio_unitario: 5e13, cantidad: 1 },
        { nombre: 'B', precio_unitario: 5e13, cantidad: 1 }
    ]));
});
