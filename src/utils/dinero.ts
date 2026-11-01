/** Convierte montos en colones a centavos para sumar y comparar pagos sin errores de coma flotante. */
export const aCentavos = (valor: unknown): number => {
    const centavos = Number(valor) * 100;
    return Number.isFinite(centavos) ? Math.round(centavos) : 0;
};

export const tieneMaximoDosDecimales = (valor: unknown): boolean => {
    const numero = Number(valor);
    const centavos = aCentavos(numero);
    return Number.isFinite(numero) && Number.isSafeInteger(centavos)
        && Math.abs(numero * 100 - centavos) < 1e-6;
};

export const deCentavos = (centavos: number): number => centavos / 100;
