import { Spinner } from 'react-bootstrap';

/** Indicador de carga consistente para usar mientras Firestore trae los datos. */
export default function EstadoCarga({ texto = 'Cargando datos...' }) {
    return (
        <div className="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
            <Spinner animation="border" role="status" className="mb-2" />
            <span>{texto}</span>
        </div>
    );
}

/** Aviso consistente cuando Firestore falla (permisos, sin conexión, etc). */
export function EstadoError({ texto = 'No se pudieron cargar los datos. Revisa tu conexión.' }) {
    return (
        <div className="alert alert-danger text-center m-3">
            <i className="fas fa-triangle-exclamation me-2"></i>
            {texto}
        </div>
    );
}
