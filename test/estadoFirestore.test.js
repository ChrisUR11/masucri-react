import test from 'node:test';
import assert from 'node:assert/strict';
import {
    actualizarConsultaFirestore,
    eliminarConsultaFirestore,
    obtenerEstadoFirestore,
    suscribirEstadoFirestore
} from '../src/utils/estadoFirestore.js';

test('combina metadatos de las consultas activas y limpia al desuscribir', () => {
    const pedidos = Symbol('pedidos');
    const productos = Symbol('productos');
    let notificaciones = 0;
    const desuscribir = suscribirEstadoFirestore(() => { notificaciones += 1; });

    try {
        actualizarConsultaFirestore(pedidos, { fromCache: true, hasPendingWrites: false });
        actualizarConsultaFirestore(productos, { fromCache: false, hasPendingWrites: true });
        assert.equal(obtenerEstadoFirestore().desdeCache, true);
        assert.equal(obtenerEstadoFirestore().cambiosPendientes, true);
        const primeraRevision = obtenerEstadoFirestore().revisionCache;

        actualizarConsultaFirestore(pedidos, { fromCache: false, hasPendingWrites: false });
        assert.equal(obtenerEstadoFirestore().desdeCache, false);
        assert.equal(obtenerEstadoFirestore().cambiosPendientes, true);

        eliminarConsultaFirestore(productos);
        assert.equal(obtenerEstadoFirestore().desdeCache, false);
        assert.equal(obtenerEstadoFirestore().cambiosPendientes, false);

        actualizarConsultaFirestore(pedidos, { fromCache: true, hasPendingWrites: false });
        assert.equal(obtenerEstadoFirestore().revisionCache, primeraRevision + 1);
        assert.equal(notificaciones, 5);
    } finally {
        eliminarConsultaFirestore(pedidos);
        eliminarConsultaFirestore(productos);
        desuscribir();
    }
});
