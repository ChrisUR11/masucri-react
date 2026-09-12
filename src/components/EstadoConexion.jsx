import { useEffect, useState } from 'react';
import { useOfflineSync } from '../hooks/useOfflineSync';

export default function EstadoConexion() {
    const { offline, stats } = useOfflineSync();
    const [visible, setVisible] = useState(offline);

    useEffect(() => {
        setVisible(offline);
    }, [offline]);

    if (!visible) return null;

    return (
        <div
            style={{
                backgroundColor: '#dc3545',
                color: 'white',
                padding: '12px 16px',
                textAlign: 'center',
                fontSize: '14px',
                fontWeight: '600',
                zIndex: 1040
            }}
        >
            <i className="fas fa-wifi-slash me-2"></i>
            Sin conexión a internet
            {stats.pendingSync > 0 && (
                <span style={{ marginLeft: '10px' }}>
                    • {stats.pendingSync} cambio(s) pendiente(s) de sincronizar
                </span>
            )}
        </div>
    );
}
