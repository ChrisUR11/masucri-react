import test from 'node:test';
import assert from 'node:assert/strict';
import { descripcionMovimientoParaGuardar } from '../src/utils/categoriasGasto.js';

test('la categoría reemplaza al concepto en salidas sin borrar detalles antiguos', () => {
    const salida = { tipo: 'salida', categoria: 'Agua', descripcion: '' };

    assert.equal(descripcionMovimientoParaGuardar(salida), 'Agua');
    assert.equal(descripcionMovimientoParaGuardar(salida, {
        tipo: 'entrada', descripcion: 'Venta de bolso'
    }), 'Agua');
    assert.equal(descripcionMovimientoParaGuardar(salida, {
        tipo: 'salida', categoria: 'Luz', descripcion: 'Luz'
    }), 'Agua');
    assert.equal(descripcionMovimientoParaGuardar(salida, {
        tipo: 'salida', descripcion: 'Compra de tintas'
    }), 'Compra de tintas');
    assert.equal(descripcionMovimientoParaGuardar({ tipo: 'entrada', descripcion: ' Venta ' }), 'Venta');
});
