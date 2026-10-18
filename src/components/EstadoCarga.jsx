import { Spinner } from 'react-bootstrap';

/** Indicador de carga consistente para usar mientras Firestore trae los datos. */
export default function EstadoCarga({ texto = 'Cargando datos...' }) {
    return (
        <div className="d-flex flex-column align-items-center justify-content-center py-5 text-muted" role="status" aria-live="polite">
            <Spinner animation="border" aria-hidden="true" className="mb-2" />
            <span>{texto}</span>
        </div>
    );
}

/** Aviso consistente cuando Firestore falla (permisos, sin conexión, etc). */
export function EstadoError({ texto = 'No se pudieron cargar los datos. Revisa tu conexión.' }) {
    return (
        <div className="alert alert-danger text-center m-3" role="alert">
            <i className="fas fa-triangle-exclamation me-2" aria-hidden="true"></i>
            {texto}
        </div>
    );
}
