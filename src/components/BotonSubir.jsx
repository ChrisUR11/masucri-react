import { useState, useEffect } from 'react';
import { Button } from 'react-bootstrap';

/**
 * Botón flotante "subir" que aparece tras bajar un poco en la página.
 * Nota: en Catálogo, Historial y Finanzas la tabla tiene su propio scroll
 * interno (para que el encabezado quede fijo), así que este botón ayuda
 * sobre todo en el Dashboard BI y en páginas donde el scroll es de la
 * ventana completa.
 */
export default function BotonSubir() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const onScroll = () => setVisible(window.scrollY > 350);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    if (!visible) return null;

    return (
        <Button
            variant="dark"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="shadow rounded-circle d-print-none d-flex align-items-center justify-content-center"
            style={{ position: 'fixed', bottom: '20px', right: '20px', width: '48px', height: '48px', zIndex: 1030 }}
            aria-label="Subir al inicio de la página"
        >
            <i className="fas fa-arrow-up"></i>
        </Button>
    );
}
