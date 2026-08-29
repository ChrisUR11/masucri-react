import { useRegisterSW } from 'virtual:pwa-register/react';
import { ToastContainer, Toast, Button } from 'react-bootstrap';

const UNA_HORA_MS = 60 * 60 * 1000;

/**
 * Registra el Service Worker de la PWA y avisa con un toast cuando hay una
 * versión nueva lista. Antes, con registerType: 'autoUpdate', la app se
 * actualizaba sola en segundo plano y el usuario solo la veía reflejada
 * hasta que cerraba y volvía a abrir la app manualmente (o nunca, si la
 * dejaba abierta todo el día en el mostrador).
 */
export default function ActualizacionPWA() {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker
    } = useRegisterSW({
        onRegisteredSW(_url, registration) {
            // Revisa cada hora si hay una versión nueva. Útil porque esta PWA
            // se suele dejar abierta todo el día en una tablet/celular del negocio.
            if (registration) {
                setInterval(() => registration.update(), UNA_HORA_MS);
            }
        }
    });

    const cerrar = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    if (!offlineReady && !needRefresh) return null;

    return (
        <ToastContainer position="bottom-center" className="p-3 d-print-none" style={{ zIndex: 2000 }}>
            <Toast show onClose={cerrar} bg={needRefresh ? 'warning' : 'success'}>
                <Toast.Body className={needRefresh ? 'text-dark' : 'text-white'}>
                    <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                        <span className="small fw-bold">
                            {needRefresh
                                ? '🔄 Hay una versión nueva de MASUCRI disponible.'
                                : '✓ MASUCRI ya puede usarse sin conexión.'}
                        </span>
                        <div className="d-flex gap-2">
                            {needRefresh && (
                                <Button size="sm" variant="dark" onClick={() => updateServiceWorker(true)}>
                                    Actualizar ahora
                                </Button>
                            )}
                            <Button size="sm" variant="outline-secondary" onClick={cerrar} aria-label="Cerrar aviso">
                                <i className="fas fa-times"></i>
                            </Button>
                        </div>
                    </div>
                </Toast.Body>
            </Toast>
        </ToastContainer>
    );
}
