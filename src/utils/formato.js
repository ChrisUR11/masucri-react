// Formato de números y moneda compartido. Antes se repetía
// `₡${x.toLocaleString('es-CR')}` en decenas de lugares, con inconsistencias
// (algunos usaban 'es-CR', otros el locale por defecto del navegador).

/** Formatea colones conservando centavos cuando el monto los contiene. */
export const formatoColones = (monto = 0) => {
    const numero = Number(monto);
    return `₡${(Number.isFinite(numero) ? numero : 0).toLocaleString('es-CR', { maximumFractionDigits: 2 })}`;
};

/** Formatea un número plano con separador de miles en es-CR. */
export const formatoNumero = (n = 0, decimales = 0) =>
    (n || 0).toLocaleString('es-CR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

/** Convierte un valor de input (string) a número seguro, nunca NaN. */
export const aNumeroSeguro = (valor) => {
    const n = parseFloat(valor);
    return Number.isFinite(n) ? n : 0;
};
