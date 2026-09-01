// Antes esta normalización de teléfono + apertura de WhatsApp estaba
// copiada casi idéntica en Pedidos.jsx y Historial.jsx.

/**
 * Normaliza un teléfono costarricense para wa.me:
 * agrega el código de país 506 si el número tiene 8 dígitos y no lo trae.
 */
export const normalizarTelefonoCR = (telefono = '') => {
    let num = String(telefono).replace(/[\s-]/g, '');
    if (num.startsWith('+')) num = num.substring(1);
    if (num.length === 8) num = '506' + num;
    return num;
};

/** Abre WhatsApp Web/App con un mensaje precargado para el número dado. */
export const abrirWhatsApp = (telefono, mensaje) => {
    if (!telefono) return;
    const num = normalizarTelefonoCR(telefono);
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener,noreferrer');
};

/** Arma el mensaje típico de aviso de pedido usado en Pedidos e Historial. */
export const mensajePedido = (pedido) => {
    const saldo = (pedido.precio || 0) - (pedido.monto_pagado || 0);
    let txt = `Hola ${pedido.cliente}, somos *MASUCRI*. `;
    if (pedido.estado === 'Por Retirar') {
        txt += `Te avisamos que tu pedido de *${pedido.producto}* ya está listo para retirar.`;
    } else {
        txt += `Te contactamos sobre tu pedido de *${pedido.producto}*.`;
    }
    if (saldo > 0) txt += ` Queda un saldo pendiente de ${saldo.toLocaleString('es-CR')} colones.`;
    return txt;
};

/** Arma un comprobante/ticket en texto, listo para enviarse por WhatsApp. */
export const mensajeTicket = (pedido) => {
    const saldo = (pedido.precio || 0) - (pedido.monto_pagado || 0);
    let txt = `🧾 *Comprobante MASUCRI*\n\n`;
    txt += `Cliente: ${pedido.cliente}\n`;
    txt += `Producto: ${pedido.producto}\n`;
    if (pedido.descripcion) txt += `Detalle: ${pedido.descripcion}\n`;
    txt += `\nPrecio Total: ₡${(pedido.precio || 0).toLocaleString('es-CR')}\n`;
    txt += `Pagado: ₡${(pedido.monto_pagado || 0).toLocaleString('es-CR')}\n`;
    txt += saldo > 0 ? `Saldo Pendiente: ₡${saldo.toLocaleString('es-CR')}\n` : `✅ Pagado en su totalidad\n`;
    if (pedido.fecha_entrega) txt += `\nFecha de entrega: ${pedido.fecha_entrega}`;
    txt += `\n\n¡Gracias por su compra! 🙏`;
    return txt;
};
