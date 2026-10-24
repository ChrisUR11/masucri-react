/** Categorías que se pueden asignar a una salida registrada en Caja. */
export const CATEGORIAS_GASTO = Object.freeze([
    'Luz',
    'Agua',
    'Maquinaria',
    'Telas',
    'Sublimación',
    'Transporte',
    'Alimentación',
    'Varios',
    'Gastos generales',
    'Otros'
]);

export const esCategoriaGastoValida = (valor) => CATEGORIAS_GASTO.includes(valor);
