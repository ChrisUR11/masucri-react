import test from 'node:test';
import assert from 'node:assert/strict';
import { aCentavos, deCentavos, tieneMaximoDosDecimales } from '../src/utils/dinero.js';

test('una deuda con centavos acepta exactamente el saldo pendiente', () => {
    const deuda = aCentavos(1000.30) - aCentavos(1000.10);
    assert.equal(deuda, aCentavos(0.20));
    assert.equal(deCentavos(deuda), 0.20);
});

test('los pagos solo admiten centavos completos', () => {
    assert.equal(tieneMaximoDosDecimales(0.29), true);
    assert.equal(tieneMaximoDosDecimales(0.291), false);
    assert.equal(tieneMaximoDosDecimales('Infinity'), false);
    assert.equal(tieneMaximoDosDecimales(1e14), false);
});
