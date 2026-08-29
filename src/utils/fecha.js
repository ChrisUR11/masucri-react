// Utilidades de fecha compartidas. Antes esta lógica estaba duplicada
// (copiada y pegada) en Historial.jsx, Pedidos.jsx, Finanzas.jsx y DashboardBI.jsx.

/**
 * Devuelve la fecha de hoy (o la fecha dada) en formato YYYY-MM-DD,
 * respetando la zona horaria local del navegador.
 */
export const obtenerFechaLocal = (fecha = new Date()) => {
    const tzOffset = fecha.getTimezoneOffset() * 60000;
    return new Date(fecha.getTime() - tzOffset).toISOString().split('T')[0];
};

/** Devuelve el mes actual en formato YYYY-MM. */
export const obtenerMesActual = () => obtenerFechaLocal().substring(0, 7);

/** Extrae el mes (YYYY-MM) de una fecha YYYY-MM-DD. Seguro ante valores vacíos. */
export const obtenerMesDeFecha = (fechaISO) => (fechaISO ? fechaISO.substring(0, 7) : '');

/** Formato corto "MM-DD" para tarjetas donde no hay espacio (Kanban). */
export const formatearFechaCorta = (fechaISO) => (fechaISO ? fechaISO.slice(5) : 'S/F');

/**
 * Calcula cuántos días faltan (o pasaron) para una fecha de entrega.
 * Positivo = faltan días, negativo = ya venció, 0 = hoy.
 * Devuelve null si no hay fecha.
 */
export const diasHastaEntrega = (fechaEntregaISO) => {
    if (!fechaEntregaISO) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaEntrega = new Date(fechaEntregaISO + 'T00:00:00');
    return Math.ceil((fechaEntrega - hoy) / 86400000);
};
