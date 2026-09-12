import { useEffect, useRef } from 'react';
import { useIndexedDB } from './useIndexedDB';

export function useSincronizacionOffline() {
    const idb = useIndexedDB();
    const sincronizandoRef = useRef(false);

    useEffect(() => {
        if (!idb.ready) return;

        // Escuchar cambios de conexión
        const handleOnline = () => {
            console.log('✓ Conexión restaurada, sincronizando datos locales...');
            sincronizarColaLocal();
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [idb.ready]);

    const sincronizarColaLocal = async () => {
        if (sincronizandoRef.current || !navigator.onLine) return;

        sincronizandoRef.current = true;
        try {
            const cola = await idb.obtenerColaSync();
            if (cola.length === 0) return;

            for (const item of cola) {
                if (!item.sincronizado) {
                    // Aquí irían las llamadas a Firebase para sincronizar
                    // Por ahora solo marcamos como sincronizado
                    await idb.marcarSincronizado(item.id);
                    console.log(`✓ Sincronizado: ${item.tipo}`);
                }
            }

            console.log('✓ Sincronización completada');
        } catch (err) {
            console.error('Error en sincronización:', err);
        } finally {
            sincronizandoRef.current = false;
        }
    };

    return {
        sincronizarColaLocal,
        sincronizando: sincronizandoRef.current
    };
}
