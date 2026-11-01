import { aCentavos, deCentavos, tieneMaximoDosDecimales } from './dinero.ts';

const fechaValida = (fecha) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) return false;
    const dia = new Date(`${fecha}T12:00:00Z`);
    return !Number.isNaN(dia.getTime()) && dia.toISOString().slice(0, 10) === fecha;
};

/** Un saldo antiguo sin historial completo no debe corregirse a partir de una cifra parcial. */
export function historialConciliado(pedido) {
    const historial = Array.isArray(pedido?.historial_pagos) ? pedido.historial_pagos : [];
    if (!tieneMaximoDosDecimales(pedido?.monto_pagado)) return false;
    let suma = 0;
    for (const pago of historial) {
        if (pago?.anulado) continue;
        if (!tieneMaximoDosDecimales(pago?.monto) || aCentavos(pago.monto) < 0) return false;
        suma += aCentavos(pago.monto);
        if (!Number.isSafeInteger(suma)) return false;
    }
    return suma === aCentavos(pedido.monto_pagado);
}

/** Empareja un movimiento con una entrada del historial, incluidos registros sin id anteriores. */
export function indicePagoEnHistorial(historial, movimiento, utilizados = new Set()) {
    const estadoCoincide = (pago, posicion) => !utilizados.has(posicion)
        && Boolean(pago?.anulado) === Boolean(movimiento.anulado);
    const mismosDatos = (pago) => pago?.fecha === movimiento.fecha
        && pago?.metodo === movimiento.metodo_pago
        && tieneMaximoDosDecimales(pago?.monto)
        && aCentavos(pago?.monto) === aCentavos(movimiento.monto);
    const porId = historial.flatMap((pago, posicion) => pago?.movimiento_id === movimiento.id ? [posicion] : []);
    if (porId.length > 0) {
        const indice = porId[0];
        return porId.length === 1 && estadoCoincide(historial[indice], indice)
            && mismosDatos(historial[indice]) ? indice : -1;
    }
    const anteriores = historial.flatMap((pago, posicion) => Boolean(pago?.anulado) === Boolean(movimiento.anulado)
        && !pago?.movimiento_id
        && mismosDatos(pago) ? [posicion] : []);
    if (anteriores.length !== 1) return -1;
    return estadoCoincide(historial[anteriores[0]], anteriores[0]) ? anteriores[0] : -1;
}

/** Calcula una corrección sin modificar el pedido ni el movimiento recibidos. */
export function prepararCorreccionAbono(pedido, movimiento, nuevoPago, nuevoMovimientoId, auditoria) {
    if (!pedido?.id || movimiento?.pedido_id !== pedido.id || movimiento.tipo !== 'entrada') {
        throw new Error('Este movimiento no pertenece al pedido.');
    }
    if (movimiento.anulado) throw new Error('Este abono ya fue corregido o anulado.');
    if (!tieneMaximoDosDecimales(movimiento.monto) || aCentavos(movimiento.monto) <= 0) {
        throw new Error('El importe original del abono no es válido.');
    }

    const historial = Array.isArray(pedido.historial_pagos) ? pedido.historial_pagos : [];
    if (!historialConciliado(pedido)) {
        throw new Error('El historial de abonos no coincide con el total pagado. Revisa este pedido antes de corregirlo.');
    }
    const indice = indicePagoEnHistorial(historial, movimiento);
    if (indice < 0) {
        throw new Error('No se pudo vincular este abono con el historial del pedido. No se modificó ningún dato.');
    }

    const pagadoAntes = aCentavos(pedido.monto_pagado);
    const precio = aCentavos(pedido.precio);
    if (!tieneMaximoDosDecimales(pedido.monto_pagado) || pagadoAntes < aCentavos(movimiento.monto)
        || !tieneMaximoDosDecimales(pedido.precio) || precio < 0) {
        throw new Error('El saldo actual del pedido requiere revisión antes de corregir este abono.');
    }

    let nuevoMontoCentavos = 0;
    let metodo = '';
    let fecha = '';
    if (nuevoPago) {
        nuevoMontoCentavos = aCentavos(nuevoPago.monto);
        metodo = String(nuevoPago.metodo || '').trim();
        fecha = String(nuevoPago.fecha || '').trim();
        if (!nuevoMovimientoId || !tieneMaximoDosDecimales(nuevoPago.monto)
            || nuevoMontoCentavos <= 0 || !metodo || !fechaValida(fecha)) {
            throw new Error('Ingresa un monto, fecha y método válidos para el abono.');
        }
    }

    const pagadoDespues = pagadoAntes - aCentavos(movimiento.monto) + nuevoMontoCentavos;
    if (!Number.isSafeInteger(pagadoDespues) || pagadoDespues < 0 || pagadoDespues > precio) {
        throw new Error(`El nuevo total pagado no puede superar el precio del pedido (${deCentavos(precio)}).`);
    }

    const motivo = String(auditoria.motivo || '').trim().slice(0, 200)
        || (nuevoPago ? 'Corrección de registro' : 'Anulación de registro');
    const marca = {
        anulado: true,
        anulado_en: auditoria.fechaHora,
        anulado_por: auditoria.usuario || 'Administrador',
        motivo_anulacion: motivo,
        ...(nuevoPago ? { reemplazado_por: nuevoMovimientoId } : {})
    };
    const pagos = historial.map((pago, posicion) => posicion === indice
        ? { ...pago, movimiento_id: movimiento.id, ...marca }
        : pago);
    const importeNuevo = deCentavos(nuevoMontoCentavos);
    if (nuevoPago) {
        pagos.push({
            fecha,
            monto: importeNuevo,
            metodo,
            movimiento_id: nuevoMovimientoId,
            corrige_movimiento_id: movimiento.id
        });
    }
    const ultimoPago = [...pagos].reverse().find((pago) => !pago?.anulado);

    return {
        pedidoActualizado: {
            monto_pagado: deCentavos(pagadoDespues),
            historial_pagos: pagos,
            ultimo_metodo_pago: ultimoPago?.metodo
                || (pagadoDespues > 0 ? pedido.ultimo_metodo_pago || 'Pendiente' : 'Pendiente')
        },
        movimientoAnulado: marca,
        movimientoNuevo: nuevoPago ? {
            tipo: 'entrada',
            metodo_pago: metodo,
            fecha,
            descripcion: movimiento.descripcion || `Abono: ${pedido.producto || ''}`,
            entidad: movimiento.entidad || pedido.cliente || '',
            monto: importeNuevo,
            pedido_id: pedido.id,
            timestamp: auditoria.fechaHora,
            corrige_movimiento_id: movimiento.id,
            motivo_correccion: motivo,
            corregido_por: auditoria.usuario || 'Administrador'
        } : null
    };
}
