import { useEffect, useState } from 'react';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { useEstadoFirestore } from '../hooks/useEstadoFirestore';

export default function EstadoConexion() {
    const { offline } = useOfflineSync();
    const { desdeCache, cambiosPendientes, revisionCache } = useEstadoFirestore();
    const [revisionVisible, setRevisionVisible] = useState(-1);

    useEffect(() => {
        if (!desdeCache || offline) return undefined;
        const timer = setTimeout(() => setRevisionVisible(revisionCache), 1500);
        return () => clearTimeout(timer);
    }, [desdeCache, offline, revisionCache]);

    const cacheVisible = desdeCache && (offline || revisionVisible === revisionCache);
    if (!offline && !cacheVisible && !cambiosPendientes) return null;

    const mensaje = offline
        ? 'Sin conexión a internet. Podés consultar los datos que ya se cargaron en este dispositivo.'
        : cacheVisible
            ? 'Mostrando datos guardados en este dispositivo mientras se verifica la conexión con Firestore.'
            : 'Hay cambios de esta vista pendientes de confirmar en Firestore.';

    return (
        <div
            role="status"
            aria-live="polite"
            style={{
                backgroundColor: offline ? '#dc3545' : '#6c757d',
                color: 'white',
                padding: '12px 16px',
                textAlign: 'center',
                fontSize: '14px',
                fontWeight: '600',
                zIndex: 1040
            }}
        >
            <i className={`fas ${offline ? 'fa-wifi-slash' : 'fa-database'} me-2`} aria-hidden="true"></i>
            {mensaje}
            {cambiosPendientes && (offline || cacheVisible) && (
                <span className="ms-2">Hay cambios de esta vista pendientes de confirmar.</span>
            )}
        </div>
    );
}
