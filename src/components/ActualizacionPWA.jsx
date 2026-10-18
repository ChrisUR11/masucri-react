import { useRef, useState } from 'react';
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
    const [actualizando, setActualizando] = useState(false);
    const [errorActualizacion, setErrorActualizacion] = useState('');
    const recargaSolicitada = useRef(false);
    const recargarUnaVez = () => {
        if (recargaSolicitada.current) return;
        recargaSolicitada.current = true;
        window.location.reload();
    };

    const {
        needRefresh: [needRefresh, setNeedRefresh]
    } = useRegisterSW({
        onNeedReload: recargarUnaVez,
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

    const aplicarActualizacion = async () => {
        if (actualizando) return;
        setActualizando(true);
        setErrorActualizacion('');

        try {
            const registration = await navigator.serviceWorker.getRegistration();
            if (!registration) throw new Error('No hay un service worker registrado');

            // El aviso puede quedar abierto si otra pestaña ya activó la versión.
            if (!registration.waiting) await registration.update();
            const waiting = registration.waiting;
            if (!waiting) {
                setNeedRefresh(false);
                recargarUnaVez();
                return;
            }

            await new Promise((resolve, reject) => {
                let terminado = false;
                let temporizador;
                const finalizar = (error) => {
                    if (terminado) return;
                    terminado = true;
                    window.clearTimeout(temporizador);
                    waiting.removeEventListener('statechange', revisarEstado);
                    navigator.serviceWorker.removeEventListener('controllerchange', cambioDeControl);
                    if (error) reject(error);
                    else resolve();
                };
                const revisarEstado = () => {
                    if (waiting.state === 'activated') finalizar();
                    else if (waiting.state === 'redundant') finalizar(new Error('El worker quedó obsoleto'));
                };
                const cambioDeControl = () => finalizar();

                waiting.addEventListener('statechange', revisarEstado);
                navigator.serviceWorker.addEventListener('controllerchange', cambioDeControl);
                temporizador = window.setTimeout(() => finalizar(new Error('La activación tardó demasiado')), 15000);
                try {
                    waiting.postMessage({ type: 'SKIP_WAITING' });
                    revisarEstado();
                } catch (error) {
                    finalizar(error);
                }
            });

            recargarUnaVez();
        } catch {
            setErrorActualizacion('No se pudo completar la actualización. Inténtalo de nuevo.');
            setActualizando(false);
        }
    };

    if (!needRefresh) return null;

    return (
        <ToastContainer position="bottom-center" className="p-3 d-print-none" style={{ zIndex: 2000 }}>
            <Toast show onClose={() => setNeedRefresh(false)} bg="warning">
                <Toast.Body className="text-dark">
                    <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                        <span className="small fw-bold">🔄 Hay una versión nueva de MASUCRI disponible.</span>
                        <div className="d-flex gap-2">
                            <Button size="sm" variant="dark" onClick={aplicarActualizacion} disabled={actualizando}>
                                {actualizando ? 'Actualizando…' : 'Actualizar ahora'}
                            </Button>
                            <Button size="sm" variant="outline-secondary" onClick={() => setNeedRefresh(false)} aria-label="Cerrar aviso" disabled={actualizando}>
                                <span aria-hidden="true">&times;</span>
                            </Button>
                        </div>
                    </div>
                    {errorActualizacion && <div className="small text-danger mt-2" role="alert">{errorActualizacion}</div>}
                </Toast.Body>
            </Toast>
        </ToastContainer>
    );
}
