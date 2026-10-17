export const LOGO_TICKET = (import.meta.env?.BASE_URL ?? './') + 'logo-masucri.png';

const formatoMonto = new Intl.NumberFormat('es-CR', { maximumFractionDigits: 2 });

const montoValido = (valor) => {
    const numero = Number(valor);
    return Number.isFinite(numero) ? Math.max(0, Math.round((numero + Number.EPSILON) * 100) / 100) : 0;
};

export const formatoMontoTicket = (valor) => '₡' + formatoMonto.format(montoValido(valor));

export const fechaTicket = (valor) => {
    if (!valor) return 'Sin fecha';
    const fecha = String(valor);
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
    return partes ? partes[3] + '/' + partes[2] + '/' + partes[1] : fecha;
};

// Ambos formatos usan los mismos datos. Las notas internas no forman parte del ticket.
export function prepararDatosTicket(pedido, nombreCliente) {
    const pagos = (Array.isArray(pedido.historial_pagos) ? pedido.historial_pagos : [])
        .filter((pago) => pago && montoValido(pago.monto) > 0)
        .map((pago) => ({
            fecha: fechaTicket(pago.fecha),
            metodo: String(pago.metodo || 'Abono'),
            monto: montoValido(pago.monto)
        }));
    const total = montoValido(pedido.precio);
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
