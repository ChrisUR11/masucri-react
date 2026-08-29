import { useState, useEffect } from 'react';
import { onSnapshot } from 'firebase/firestore';

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
        setCargando(true);
        setError(null);

        let query;
        try {
            query = construirQuery();
        } catch (err) {
            console.error('Error construyendo query de Firestore:', err);
            setError(err);
            setCargando(false);
            return;
        }

        const unsubscribe = onSnapshot(
            query,
            (snapshot) => {
                const items = [];
                snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
                setDatos(items);
                setCargando(false);
            },
            (err) => {
                console.error('Error de Firestore:', err);
                setError(err);
                setCargando(false);
            }
        );

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return { datos, cargando, error };
}
