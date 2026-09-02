const ANCHO = 560;
const PADDING = 32;
const COLOR_TITULO = '#212529';
const COLOR_TEXTO = '#333333';
const COLOR_MUTED = '#6c757d';
const COLOR_LINEA = '#dee2e6';
const COLOR_EXITO = '#198754';
const COLOR_ALERTA = '#fd7e14';

/** Corta un texto largo en varias líneas para que quepa en el ancho disponible. */
function envolverTexto(ctx, texto, maxAncho) {
    const palabras = texto.split(' ');
    const lineas = [];
    let actual = '';
    palabras.forEach((palabra) => {
        const prueba = actual ? `${actual} ${palabra}` : palabra;
        if (ctx.measureText(prueba).width > maxAncho && actual) {
            lineas.push(actual);
            actual = palabra;
        } else {
            actual = prueba;
        }
    });
    if (actual) lineas.push(actual);
    return lineas;
}

/** Dibuja el comprobante del pedido en un <canvas> y devuelve un Blob PNG. */
function generarTicketImagenBlob(pedido) {
    const saldo = (pedido.precio || 0) - (pedido.monto_pagado || 0);
    const anchoTexto = ANCHO - PADDING * 2;

    // Canvas "invisible" solo para medir cuánto ocupa el texto envuelto,
    // antes de saber el alto final que va a necesitar el ticket real.
    const medidor = document.createElement('canvas').getContext('2d');
    medidor.font = '16px Arial';
    const lineasProducto = envolverTexto(medidor, pedido.producto || '-', anchoTexto);
    const lineasDetalle = pedido.descripcion ? envolverTexto(medidor, pedido.descripcion, anchoTexto) : [];

    let alto = 300 + lineasProducto.length * 22 + lineasDetalle.length * 20;
    if (pedido.fecha_entrega) alto += 26;

    const canvas = document.createElement('canvas');
    canvas.width = ANCHO;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ANCHO, alto);

    let y = 45;

    ctx.fillStyle = COLOR_TITULO;
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('MASUCRI', ANCHO / 2, y);
    y += 22;
    ctx.font = '13px Arial';
    ctx.fillStyle = COLOR_MUTED;
    ctx.fillText('Confecciones y Sublimaciones', ANCHO / 2, y);
    y += 22;

    ctx.strokeStyle = COLOR_LINEA;
    ctx.beginPath();
    ctx.moveTo(PADDING, y);
    ctx.lineTo(ANCHO - PADDING, y);
    ctx.stroke();
    y += 36;
    ctx.textAlign = 'left';

    ctx.font = '12px Arial';
    ctx.fillStyle = COLOR_MUTED;
    ctx.fillText('CLIENTE', PADDING, y);
    y += 20;
    ctx.font = 'bold 18px Arial';
    ctx.fillStyle = COLOR_TEXTO;
    ctx.fillText(pedido.cliente || '-', PADDING, y);
    y += 34;

    ctx.font = '12px Arial';
    ctx.fillStyle = COLOR_MUTED;
    ctx.fillText('PRODUCTO', PADDING, y);
    y += 20;
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = COLOR_TEXTO;
    lineasProducto.forEach((linea) => {
        ctx.fillText(linea, PADDING, y);
        y += 22;
    });

    if (lineasDetalle.length > 0) {
        y += 4;
        ctx.font = '13px Arial';
        ctx.fillStyle = COLOR_MUTED;
        lineasDetalle.forEach((linea) => {
            ctx.fillText(linea, PADDING, y);
            y += 20;
        });
    }

    y += 16;
    ctx.strokeStyle = COLOR_LINEA;
    ctx.beginPath();
    ctx.moveTo(PADDING, y);
    ctx.lineTo(ANCHO - PADDING, y);
    ctx.stroke();
    y += 34;

    const dibujarFila = (etiqueta, valor, color = COLOR_TEXTO, negrita = false) => {
        ctx.font = '15px Arial';
        ctx.fillStyle = COLOR_MUTED;
        ctx.textAlign = 'left';
        ctx.fillText(etiqueta, PADDING, y);
        ctx.font = negrita ? 'bold 17px Arial' : '15px Arial';
        ctx.fillStyle = color;
        ctx.textAlign = 'right';
        ctx.fillText(valor, ANCHO - PADDING, y);
        ctx.textAlign = 'left';
        y += 28;
    };

    dibujarFila('Precio Total', `₡${(pedido.precio || 0).toLocaleString('es-CR')}`);
    dibujarFila('Pagado', `₡${(pedido.monto_pagado || 0).toLocaleString('es-CR')}`);

    y += 4;
    ctx.strokeStyle = COLOR_LINEA;
    ctx.beginPath();
    ctx.moveTo(PADDING, y);
    ctx.lineTo(ANCHO - PADDING, y);
    ctx.stroke();
    y += 30;

    if (saldo > 0) {
        dibujarFila('Saldo Pendiente', `₡${saldo.toLocaleString('es-CR')}`, COLOR_ALERTA, true);
    } else {
        ctx.font = 'bold 17px Arial';
        ctx.fillStyle = COLOR_EXITO;
        ctx.textAlign = 'center';
        ctx.fillText('✓ Pagado en su totalidad', ANCHO / 2, y);
        ctx.textAlign = 'left';
        y += 28;
    }

    if (pedido.fecha_entrega) {
        y += 8;
        ctx.font = '13px Arial';
        ctx.fillStyle = COLOR_MUTED;
        ctx.textAlign = 'center';
        ctx.fillText(`Fecha de entrega: ${pedido.fecha_entrega}`, ANCHO / 2, y);
        y += 20;
    }

    y += 14;
    ctx.font = 'italic 13px Arial';
    ctx.fillStyle = COLOR_MUTED;
    ctx.textAlign = 'center';
    ctx.fillText('¡Gracias por su compra! 🙏', ANCHO / 2, y);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/**
 * Genera el ticket como imagen y lo comparte con el selector nativo del
 * dispositivo (WhatsApp, Mensajes, lo que sea) — así no hace falta tener el
 * teléfono del cliente guardado en el sistema: uno elige el contacto ahí mismo.
 * Si el navegador no soporta compartir archivos (típico en computadora), se
 * descarga la imagen para adjuntarla a mano donde se necesite.
 *
 * @returns {Promise<'compartido'|'cancelado'|'descargado'>}
 */
export async function compartirTicket(pedido) {
    const blob = await generarTicketImagenBlob(pedido);
    const nombreArchivo = `Ticket_${(pedido.cliente || 'cliente').trim().replace(/\s+/g, '_')}.png`;
    const file = new File([blob], nombreArchivo, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: 'Ticket MASUCRI' });
            return 'compartido';
        } catch (err) {
            if (err.name === 'AbortError') return 'cancelado'; // el usuario cerró el selector, no es un error
            throw err;
        }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return 'descargado';
}
