import { obtenerFechaLocal, primerDiaMes, ultimoDiaMes, restarDias, primerDiaAnio } from './fecha.js';

export const PRESETS = [
    { id: 'historico', label: 'Todo el histórico' },
    { id: 'mes_actual', label: 'Mes actual' },
    { id: 'mes_anterior', label: 'Mes anterior' },
    { id: 'ultimos_30', label: '30 días' },
    { id: 'este_anio', label: 'Este año' },
    { id: 'personalizado', label: 'Personalizado' }
];

/** Calcula el rango { inicio, fin } (YYYY-MM-DD) para un preset dado. */
export function calcularRangoPreset(presetId, hoy = new Date()) {
    switch (presetId) {
        case 'historico':
            return { inicio: null, fin: null };
        case 'mes_anterior': {
            // Anclar al día 1 evita que el 31 desborde al mes actual.
            const base = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
            return { inicio: primerDiaMes(base), fin: ultimoDiaMes(base) };
        }
        case 'ultimos_30':
            // Hoy y los 29 días anteriores: 30 fechas inclusivas.
            return { inicio: restarDias(29, hoy), fin: obtenerFechaLocal(hoy) };
        case 'este_anio':
            return { inicio: primerDiaAnio(hoy), fin: obtenerFechaLocal(hoy) };
        case 'mes_actual':
        default:
            return { inicio: primerDiaMes(hoy), fin: ultimoDiaMes(hoy) };
    }
}
