import { useRegisterSW } from 'virtual:pwa-register/react';
import { ToastContainer, Toast, Button } from 'react-bootstrap';

const QUINCE_MINUTOS_MS = 15 * 60 * 1000;
const UN_MINUTO_MS = 60 * 1000;
const registrosConRevision = new WeakSet();

/**
 * Registra el Service Worker de la PWA y avisa con un toast cuando hay una
 * versión nueva lista. Antes, con registerType: 'autoUpdate', la app se
 * actualizaba sola en segundo plano y el usuario solo la veía reflejada
 * hasta que cerraba y volvía a abrir la app manualmente (o nunca, si la
 * dejaba abierta todo el día en el mostrador).
 */
export default function ActualizacionPWA() {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker
    } = useRegisterSW({
        onRegisteredSW(_url, registration) {
            if (registration && !registrosConRevision.has(registration)) {
                registrosConRevision.add(registration);
                let ultimaRevision = 0;
                const revisar = () => {
                    // Un worker puede quedar en espera aunque se haya cerrado el aviso.
                    if (registration.waiting && navigator.serviceWorker.controller) setNeedRefresh(true);
                    if (document.hidden || Date.now() - ultimaRevision < UN_MINUTO_MS) return;
                    ultimaRevision = Date.now();
                    registration.update().catch(() => {});
                };

                // Detecta una versión nueva al abrir o volver a la aplicación.
                revisar();
                window.addEventListener('focus', revisar);
                window.addEventListener('online', revisar);
                document.addEventListener('visibilitychange', revisar);
                setInterval(revisar, QUINCE_MINUTOS_MS);
            }
        }
    });

    if (!needRefresh) return null;

    return (
        <ToastContainer position="bottom-center" className="p-3 d-print-none" style={{ zIndex: 2000 }}>
            <Toast show onClose={() => setNeedRefresh(false)} bg="warning">
                <Toast.Body className="text-dark">
                    <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                        <span className="small fw-bold">🔄 Hay una versión nueva de MASUCRI disponible.</span>
                        <div className="d-flex gap-2">
                            <Button size="sm" variant="dark" onClick={() => updateServiceWorker(true)}>
                                Actualizar ahora
                            </Button>
                            <Button size="sm" variant="outline-secondary" onClick={() => setNeedRefresh(false)} aria-label="Cerrar aviso">
                                <span aria-hidden="true">&times;</span>
                            </Button>
                        </div>
                    </div>
                </Toast.Body>
            </Toast>
        </ToastContainer>
    );
}
