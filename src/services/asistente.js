import { auth } from '../config/firebase';
import { obtenerFechaLocal } from '../utils/fecha';
import { interpretarMensajeLocal } from '../utils/asistente';

const URL_ASISTENTE = String(import.meta.env.VITE_ASISTENTE_API_URL || '').trim().replace(/\/$/, '');
const ASISTENTE_REMOTO_HABILITADO = String(import.meta.env.VITE_ASISTENTE_REMOTO || '').toLowerCase() === 'true';

/**
 * El servicio Python solo interpreta la solicitud. Sin URL o ante una caída,
 * las consultas básicas siguen disponibles con el enrutador local.
 */
export async function interpretarSolicitudAsistente(mensaje, catalogo = []) {
    const interpretacionLocal = interpretarMensajeLocal(mensaje, catalogo);
    if (!URL_ASISTENTE || !ASISTENTE_REMOTO_HABILITADO) return { ...interpretacionLocal, source: 'local' };

    const usuario = auth.currentUser;
    if (!usuario) throw new Error('La sesión terminó. Inicia sesión de nuevo para usar el asistente.');

    try {
        const token = await usuario.getIdToken();
        const respuesta = await fetch(`${URL_ASISTENTE}/api/interpretar`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: mensaje,
                today: obtenerFechaLocal(),
                catalog: catalogo.slice(0, 150).map((producto) => {
                    const precio = producto.precio_venta;
                    return {
                        name: producto.nombre,
                        price: precio == null || precio === '' || !Number.isFinite(Number(precio)) ? null : Number(precio)
                    };
                })
            })
        });

        if (respuesta.status === 401 || respuesta.status === 403) {
            const error = new Error('La sesión no está autorizada para el asistente. Inicia sesión de nuevo.');
            error.authError = true;
            throw error;
        }
        if (!respuesta.ok) {
            const detalle = await respuesta.json().catch(() => ({}));
            return {
                ...interpretacionLocal,
                source: 'local_fallback',
                warning: detalle.detail || 'No se pudo conectar con la IA; atendí la solicitud en modo local.'
            };
        }

        return { ...(await respuesta.json()), source: 'ia' };
    } catch (error) {
        if (error.authError) throw error;
        return {
            ...interpretacionLocal,
            source: 'local_fallback',
            warning: 'No se pudo conectar con la IA; atendí la solicitud en modo local.'
        };
    }
}
