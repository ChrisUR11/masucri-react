import { obtenerFechaLocal, primerDiaMes, ultimoDiaMes, restarDias, primerDiaAnio } from './fecha';

export const PRESETS = [
    { id: 'mes_actual', label: 'Mes actual' },
    { id: 'mes_anterior', label: 'Mes anterior' },
    { id: 'ultimos_30', label: '30 días' },
    { id: 'este_anio', label: 'Este año' },
    { id: 'personalizado', label: 'Personalizado' }
];

/** Calcula el rango { inicio, fin } (YYYY-MM-DD) para un preset dado. */
export function calcularRangoPreset(presetId) {
    const hoy = new Date();
    switch (presetId) {
        case 'mes_anterior': {
            const base = new Date(hoy);
            base.setMonth(base.getMonth() - 1);
            return { inicio: primerDiaMes(base), fin: ultimoDiaMes(base) };
        }
        case 'ultimos_30':
            return { inicio: restarDias(30), fin: obtenerFechaLocal() };
        case 'este_anio':
            return { inicio: primerDiaAnio(hoy), fin: obtenerFechaLocal() };
        case 'mes_actual':
        default:
            return { inicio: primerDiaMes(hoy), fin: ultimoDiaMes(hoy) };
    }
}
