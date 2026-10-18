import { useState, useEffect } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { actualizarConsultaFirestore, eliminarConsultaFirestore } from '../utils/estadoFirestore';

/**
 * Se suscribe en tiempo real a una query/colección de Firestore.
 * Reemplaza el patrón repetido de useEffect + onSnapshot que existía,
 * sin manejo de errores ni estado de carga, en las 5 páginas.
 *
 * @param {() => import('firebase/firestore').Query} construirQuery - función que arma la query.
 *        Se pasa como función (no la query ya armada) para poder reconstruirla
 *        cuando cambien las dependencias sin provocar renders de más.
 * @param {any[]} deps - dependencias que, al cambiar, vuelven a suscribir.
 */
export function useFirestoreCollection(construirQuery, deps = []) {
    const [datos, setDatos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let query;
        try {
            query = construirQuery();
        } catch (err) {
            console.error('Error construyendo query de Firestore:', err);
            // No existe una suscripción que pueda avisar de este error después.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setError(err);
            setCargando(false);
            return;
        }

        const consultaId = Symbol('consultaFirestore');
        let primeraRespuesta = true;
        const unsubscribe = onSnapshot(
            query,
            { includeMetadataChanges: true },
            (snapshot) => {
                actualizarConsultaFirestore(consultaId, snapshot.metadata);
                setError(null);
                // Una actualización solo de metadatos no necesita reconstruir
                // toda la lista ni volver a renderizar las páginas extensas.
                if (primeraRespuesta || snapshot.docChanges().length > 0) {
                    const items = [];
                    snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
                    setDatos(items);
                }
                primeraRespuesta = false;
                setCargando(false);
            },
            (err) => {
                eliminarConsultaFirestore(consultaId);
                console.error('Error de Firestore:', err);
                setError(err);
                setCargando(false);
            }
        );

        return () => {
            unsubscribe();
            eliminarConsultaFirestore(consultaId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return { datos, cargando, error };
}
