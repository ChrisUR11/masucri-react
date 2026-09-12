import { useEffect, useState } from 'react';
import { initOfflineDB, getOfflineStats } from '../utils/offlineSync';

export function useOfflineSync() {
    const [offline, setOffline] = useState(!navigator.onLine);
    const [stats, setStats] = useState({ pendingSync: 0 });

    useEffect(() => {
        // Inicializar IndexedDB
        initOfflineDB().catch((err) => console.error('Error inicializando offline DB:', err));

        // Detectar cambios de conexión
        const handleOnline = () => {
            setOffline(false);
            console.log('✅ Conexión restaurada');
        };

        const handleOffline = () => {
            setOffline(true);
            console.log('⚠️ Sin conexión');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Actualizar stats cada 5 segundos
        const interval = setInterval(async () => {
            try {
                const newStats = await getOfflineStats();
                setStats(newStats);
            } catch (err) {
                console.error('Error actualizando offline stats:', err);
            }
        }, 5000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, []);

    return { offline, stats };
}
