const ANCHO = 600;
const ALTO_LOGO = 60;
const PADDING = 40;
const COLOR_TITULO = '#1a5d3a';
const COLOR_TEXTO = '#2c3e50';
const COLOR_MUTED = '#7f8c8d';
const COLOR_LINEA = '#ecf0f1';
const COLOR_EXITO = '#27ae60';
const COLOR_ALERTA = '#e74c3c';
const FONT_TITULO = 'bold 24px "Arial", sans-serif';
const FONT_SUBTITULO = 'bold 16px "Arial", sans-serif';
const FONT_NORMAL = '14px "Arial", sans-serif';
const FONT_SMALL = '12px "Arial", sans-serif';

/**
 * Genera el comprobante del pedido en un <canvas> con logo y devuelve un Blob PNG.
 */
async function generarTicketImagenBlob(pedido) {
    const saldo = (pedido.precio || 0) - (pedido.monto_pagado || 0);
    const historiaPagos = pedido.historial_pagos || [];

    // Cargar el logo
    let logoImg = null;
    try {
        logoImg = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('No se pudo cargar el logo'));
            img.src = '/logo-masucri.png'; // Desde public/
        });
    } catch (err) {
        console.warn('Logo no disponible, continuando sin él');
    }

    // Calcular alto dinámico según historial
    let altoContent = 420 + historiaPagos.length * 30; // Más alto para el logo
    const altoFinal = altoContent + 60;

    const canvas = document.createElement('canvas');
    canvas.width = ANCHO;
    canvas.height = altoFinal;
    const ctx = canvas.getContext('2d');

    // Fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ANCHO, altoFinal);

    let y = PADDING - 10;

    // ===== LOGO =====
    if (logoImg) {
        try {
            const logoAlto = 70;
            const logoAncho = (logoAlto / logoImg.height) * logoImg.width;
            const logoX = (ANCHO - logoAncho) / 2;
            ctx.drawImage(logoImg, logoX, y, logoAncho, logoAlto);
            y += logoAlto + 15;
        } catch (err) {
            console.warn('Error dibujando logo:', err);
        }
    }

    // ===== HEADER CON NOMBRE =====
    ctx.fillStyle = COLOR_TITULO;
    ctx.font = FONT_TITULO;
    ctx.textAlign = 'center';
    ctx.fillText('MASUCRI', ANCHO / 2, y + 20);
    y += 35;
    ctx.font = FONT_SMALL;
    ctx.fillStyle = COLOR_MUTED;
    ctx.fillText('Confecciones y Sublimaciones', ANCHO / 2, y);
    y += 20;

    // Línea separadora
    ctx.strokeStyle = COLOR_LINEA;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PADDING, y);
    ctx.lineTo(ANCHO - PADDING, y);
    ctx.stroke();
    y += 20;

    // ID y fecha
    ctx.textAlign = 'left';
    ctx.font = FONT_SMALL;
    ctx.fillStyle = COLOR_MUTED;
    ctx.fillText(`ID: ${pedido.id || '-'}`, PADDING, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${pedido.fecha_solicitud || '-'}`, ANCHO - PADDING, y);
    y += 22;

    ctx.textAlign = 'left';

    // ===== DATOS PRINCIPALES =====
    ctx.font = FONT_SMALL;
    ctx.fillStyle = COLOR_MUTED;
    ctx.fillText('CLIENTE', PADDING, y);
    y += 18;
    ctx.font = FONT_SUBTITULO;
    ctx.fillStyle = COLOR_TEXTO;
    ctx.fillText(pedido.cliente || '-', PADDING, y);
    y += 28;

    ctx.font = FONT_SMALL;
    ctx.fillStyle = COLOR_MUTED;
    ctx.fillText('PRODUCTO', PADDING, y);
    y += 18;
    ctx.font = FONT_NORMAL;
    ctx.fillStyle = COLOR_TEXTO;
    ctx.fillText(pedido.producto || '-', PADDING, y);
    y += 24;

    // Línea separadora
    ctx.strokeStyle = COLOR_LINEA;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING, y);
    ctx.lineTo(ANCHO - PADDING, y);
    ctx.stroke();
    y += 20;

    // ===== MONTOS =====
    const dibujarFila = (etiqueta, valor, esTotal = false) => {
        ctx.font = esTotal ? 'bold 16px "Arial"' : FONT_NORMAL;
        ctx.fillStyle = COLOR_MUTED;
        ctx.textAlign = 'left';
        ctx.fillText(etiqueta, PADDING, y);
        ctx.fillStyle = COLOR_TEXTO;
        ctx.textAlign = 'right';
        ctx.fillText(valor, ANCHO - PADDING, y);
        ctx.textAlign = 'left';
        y += 26;
    };

    dibujarFila('Precio Total', `₡${(pedido.precio || 0).toLocaleString('es-CR')}`);
    dibujarFila('Pagado', `₡${(pedido.monto_pagado || 0).toLocaleString('es-CR')}`);

    if (historiaPagos.length > 0) {
        y += 8;
        ctx.font = FONT_SMALL;
        ctx.fillStyle = COLOR_MUTED;
        ctx.fillText('Historial de pagos:', PADDING, y);
        y += 18;

        historiaPagos.forEach((pago) => {
            ctx.font = FONT_SMALL;
            ctx.fillStyle = COLOR_TEXTO;
            ctx.fillText(`• ${pago.fecha} - ${pago.metodo}`, PADDING + 10, y);
            ctx.textAlign = 'right';
            ctx.fillText(`₡${(pago.monto || 0).toLocaleString('es-CR')}`, ANCHO - PADDING, y);
            ctx.textAlign = 'left';
            y += 24;
        });

        y += 8;
    }

    // Línea separadora
    ctx.strokeStyle = COLOR_LINEA;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PADDING, y);
    ctx.lineTo(ANCHO - PADDING, y);
    ctx.stroke();
    y += 20;

    // ===== SALDO FINAL =====
    ctx.font = 'bold 18px "Arial"';
    if (saldo > 0) {
        ctx.fillStyle = COLOR_ALERTA;
        ctx.textAlign = 'center';
        ctx.fillText(`Saldo Pendiente: ₡${saldo.toLocaleString('es-CR')}`, ANCHO / 2, y);
    } else {
        ctx.fillStyle = COLOR_EXITO;
        ctx.textAlign = 'center';
        ctx.fillText('✓ PAGADO EN SU TOTALIDAD', ANCHO / 2, y);
    }
    y += 32;

    // Pie de página
    ctx.font = 'italic 12px "Arial"';
    ctx.fillStyle = COLOR_MUTED;
    ctx.textAlign = 'center';
    ctx.fillText('¡Gracias por su compra!', ANCHO / 2, y);

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
