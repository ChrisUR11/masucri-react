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

/** Convierte YYYY-MM-DD a DD/MM/YYYY para mostrarlo de forma legible. */
export const formatoFechaLegible = (fechaISO) => {
    if (!fechaISO) return '';
    const [y, m, d] = fechaISO.split('-');
    return `${d}/${m}/${y}`;
};

/** Devuelve el primer día del mes de la fecha dada, en formato YYYY-MM-DD. */
export const primerDiaMes = (fechaBase = new Date()) => {
    const d = new Date(fechaBase);
    d.setDate(1);
    return obtenerFechaLocal(d);
};

/** Devuelve el último día del mes de la fecha dada, en formato YYYY-MM-DD. */
export const ultimoDiaMes = (fechaBase = new Date()) => {
    const d = new Date(fechaBase);
    d.setMonth(d.getMonth() + 1, 0);
    return obtenerFechaLocal(d);
};

/** Resta N días a hoy (o a la fecha dada) y devuelve YYYY-MM-DD. */
export const restarDias = (dias, fechaBase = new Date()) => {
    const d = new Date(fechaBase);
    d.setDate(d.getDate() - dias);
    return obtenerFechaLocal(d);
};

/** Primer día del año en curso, en formato YYYY-MM-DD. */
export const primerDiaAnio = (fechaBase = new Date()) => {
    const d = new Date(fechaBase);
    d.setMonth(0, 1);
    return obtenerFechaLocal(d);
};
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
