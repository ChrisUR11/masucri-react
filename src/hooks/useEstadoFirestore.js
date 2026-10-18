import { useSyncExternalStore } from 'react';
import { obtenerEstadoFirestore, suscribirEstadoFirestore } from '../utils/estadoFirestore';

export function useEstadoFirestore() {
    return useSyncExternalStore(suscribirEstadoFirestore, obtenerEstadoFirestore);
}
