import { obtenerProductosPedido } from './productosPedido.js';

export const LOGO_TICKET = (import.meta.env?.BASE_URL ?? './') + 'logo-masucri.png';
export const WHATSAPP_NEGOCIO = '6274-7761';

const formatoMonto = new Intl.NumberFormat('es-CR', { maximumFractionDigits: 2 });
const formatoPorcentaje = new Intl.NumberFormat('es-CR', { maximumFractionDigits: 6 });

const montoValido = (valor) => {
    const numero = Number(valor);
    return Number.isFinite(numero) ? Math.max(0, Math.round((numero + Number.EPSILON) * 100) / 100) : 0;
};

export const formatoMontoTicket = (valor) => '₡' + formatoMonto.format(montoValido(valor));
export const formatoPorcentajeTicket = (valor) => {
    const porcentaje = Number(valor);
    return formatoPorcentaje.format(Number.isFinite(porcentaje) && porcentaje >= 0 ? porcentaje : 0) + '%';
};

export const fechaTicket = (valor) => {
    if (!valor) return 'Sin fecha';
    const fecha = String(valor);
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
    return partes ? partes[3] + '/' + partes[2] + '/' + partes[1] : fecha;
};

// Ambos formatos usan los mismos datos. Las notas internas no forman parte del ticket.
export function prepararDatosTicket(pedido, nombreCliente) {
    const lineas = obtenerProductosPedido(pedido);
    const productos = lineas.length
        ? lineas.map((item) => ({
            nombre: item.nombre,
            cantidad: item.cantidad,
            precioUnitario: montoValido(item.precio_unitario),
            total: montoValido(item.total)
        }))
        : [{
            nombre: String(pedido.producto || 'Producto no indicado').trim(),
            cantidad: 1,
            precioUnitario: montoValido(pedido.precio),
            total: montoValido(pedido.precio)
        }];
    const subtotal = montoValido(productos.reduce((suma, item) => suma + item.total, 0));
    const descuentoInformado = pedido.descuento_monto == null ? null : montoValido(pedido.descuento_monto);
    const total = pedido.precio == null
        ? montoValido(subtotal - (descuentoInformado ?? montoValido(subtotal * montoValido(pedido.descuento_porcentaje) / 100)))
        : montoValido(pedido.precio);
    // El total final es la referencia para que subtotal - descuento siempre coincida con el ticket.
    const descuento = montoValido(subtotal - total);
    const descuentoPorcentaje = subtotal > 0 ? descuento / subtotal * 100 : 0;
    const pagos = (Array.isArray(pedido.historial_pagos) ? pedido.historial_pagos : [])
        .filter((pago) => pago && montoValido(pago.monto) > 0)
        .map((pago) => ({
            fecha: fechaTicket(pago.fecha),
            metodo: String(pago.metodo || 'Abono'),
            monto: montoValido(pago.monto)
        }));
    // El acumulado es la referencia; sumar de nuevo el historial duplicaría los pagos.
    const pagado = pedido.monto_pagado == null
        ? montoValido(pagos.reduce((suma, pago) => suma + pago.monto, 0))
        : montoValido(pedido.monto_pagado);
    const saldo = montoValido(total - pagado);

    return {
        referencia: String(pedido.id || '').slice(0, 8).toUpperCase(),
        fecha: fechaTicket(pedido.fecha_solicitud || pedido.fecha_cierre),
        cliente: String(nombreCliente ?? pedido.cliente ?? '').trim() || 'Cliente',
        producto: String(pedido.producto || 'Producto no indicado').trim(),
        productos,
        subtotal,
        descuento,
        descuentoPorcentaje,
        total,
        pagado,
        saldo,
        saldoAFavor: montoValido(pagado - total),
        pagos,
        estadoPago: saldo > 0 ? (pagado > 0 ? 'Abono parcial' : 'Pendiente de pago') : (total > 0 ? 'Pagado' : 'Sin saldo pendiente')
    };
}

// También corta palabras largas para que los nombres o productos nunca se salgan.
export function lineasTicket(ctx, texto, ancho) {
    const lineas = [];
    for (const parrafo of String(texto).split(/\r?\n/)) {
        let linea = '';
        for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
            const candidato = linea ? linea + ' ' + palabra : palabra;
            if (ctx.measureText(candidato).width <= ancho) {
                linea = candidato;
                continue;
            }
            if (linea) lineas.push(linea);
            linea = '';
            for (const caracter of palabra) {
                if (linea && ctx.measureText(linea + caracter).width > ancho) {
                    lineas.push(linea);
                    linea = '';
                }
                linea += caracter;
            }
        }
        lineas.push(linea);
    }
    return lineas;
}
