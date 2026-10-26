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

/** Mantiene el detalle de salidas antiguas al reclasificarlas. */
export function descripcionMovimientoParaGuardar(form, movimientoAnterior = null) {
    if (form.tipo !== 'salida') return String(form.descripcion ?? '').trim();

    const descripcionAnterior = movimientoAnterior?.tipo === 'salida'
        ? String(movimientoAnterior.descripcion ?? '').trim()
        : '';
    const categoriaAnterior = String(movimientoAnterior?.categoria ?? '').trim();
    const eraEtiquetaDeCategoria = esCategoriaGastoValida(descripcionAnterior) ||
        (Boolean(categoriaAnterior) && descripcionAnterior === categoriaAnterior);

    return descripcionAnterior && !eraEtiquetaDeCategoria
        ? descripcionAnterior
        : form.categoria;
}
