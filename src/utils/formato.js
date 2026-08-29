// Formato de números y moneda compartido. Antes se repetía
// `₡${x.toLocaleString('es-CR')}` en decenas de lugares, con inconsistencias
// (algunos usaban 'es-CR', otros el locale por defecto del navegador).

/** Formatea un monto en colones costarricenses: 15000 -> "₡15.000" */
export const formatoColones = (monto = 0) => `₡${Math.round(monto || 0).toLocaleString('es-CR')}`;

/** Formatea un número plano con separador de miles en es-CR. */
export const formatoNumero = (n = 0, decimales = 0) =>
    (n || 0).toLocaleString('es-CR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

/** Convierte un valor de input (string) a número seguro, nunca NaN. */
export const aNumeroSeguro = (valor) => {
    const n = parseFloat(valor);
    return Number.isFinite(n) ? n : 0;
};
