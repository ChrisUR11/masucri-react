// Estado agregado de las consultas activas. Firestore informa si una vista se
// obtuvo del caché y si incluye escrituras locales aún no confirmadas.
const consultas = new Map();
const listeners = new Set();
let estado = { desdeCache: false, cambiosPendientes: false, revisionCache: 0 };

function publicarEstado() {
    const siguiente = {
        desdeCache: false,
        cambiosPendientes: false,
        revisionCache: estado.revisionCache
    };
    for (const metadata of consultas.values()) {
        siguiente.desdeCache ||= metadata.fromCache;
        siguiente.cambiosPendientes ||= metadata.hasPendingWrites;
    }

    if (siguiente.desdeCache === estado.desdeCache &&
        siguiente.cambiosPendientes === estado.cambiosPendientes) return;

    if (siguiente.desdeCache && !estado.desdeCache) siguiente.revisionCache += 1;
    estado = siguiente;
    listeners.forEach((listener) => listener());
}

export function actualizarConsultaFirestore(id, metadata) {
    consultas.set(id, metadata);
    publicarEstado();
}

export function eliminarConsultaFirestore(id) {
    consultas.delete(id);
    publicarEstado();
}

export function suscribirEstadoFirestore(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function obtenerEstadoFirestore() {
    return estado;
}
