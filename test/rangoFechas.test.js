import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, calcularRangoPreset } from '../src/utils/rangoFechas.js';

test('permite consultar todo el histórico sin límites', () => {
    assert.ok(PRESETS.some((preset) => preset.id === 'historico'));
    assert.deepEqual(calcularRangoPreset('historico'), { inicio: null, fin: null });
});

test('30 días abarca exactamente 30 fechas de calendario inclusivas', () => {
    const { inicio, fin } = calcularRangoPreset('ultimos_30');
    const diferenciaDias = (Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86400000;

    assert.equal(diferenciaDias, 29);
});

test('mes anterior es correcto incluso al cerrar un mes de 31 días', () => {
    assert.deepEqual(calcularRangoPreset('mes_anterior', new Date(2026, 9, 31)), {
        inicio: '2026-09-01', fin: '2026-09-30'
    });
    assert.deepEqual(calcularRangoPreset('mes_anterior', new Date(2026, 0, 31)), {
        inicio: '2025-12-01', fin: '2025-12-31'
    });
});
