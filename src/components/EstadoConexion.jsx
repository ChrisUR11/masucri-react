import { useState, useEffect } from 'react';

/**
 * Aviso discreto cuando el dispositivo se queda sin internet. Firestore
 * sigue funcionando en modo offline (guarda localmente y sincroniza al
 * volver la señal), pero sin este aviso el usuario no tiene forma de saber
 * por qué "no ve" los cambios reflejarse en otro dispositivo.
 */
export default function EstadoConexion() {
    const [online, setOnline] = useState(navigator.onLine);

    useEffect(() => {
        const marcarOffline = () => setOnline(false);
        const marcarOnline = () => setOnline(true);
        window.addEventListener('offline', marcarOffline);
        window.addEventListener('online', marcarOnline);
        return () => {
            window.removeEventListener('offline', marcarOffline);
            window.removeEventListener('online', marcarOnline);
        };
    }, []);

    if (online) return null;

    return (
        <div className="bg-danger text-white text-center small py-1 d-print-none fw-bold">
            <i className="fas fa-wifi"></i> Sin conexión — los cambios se guardarán y sincronizarán al volver la señal.
        </div>
    );
}
