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

function generarTicketImagenBlob(pedido, logoDataURL) {
    return new Promise((resolve) => {
        const saldo = (pedido.precio || 0) - (pedido.monto_pagado || 0);
        const historiaPagos = pedido.historial_pagos || [];

        let altoContent = 380 + historiaPagos.length * 30;
        const altoFinal = altoContent + 60;

        const canvas = document.createElement('canvas');
        canvas.width = ANCHO;
        canvas.height = altoFinal;
        const ctx = canvas.getContext('2d');

        // Fondo blanco
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, ANCHO, altoFinal);

        let y = PADDING;

        // ===== LOGO =====
        if (logoDataURL) {
            const logoImg = new Image();
            logoImg.onload = () => {
                const logoSize = 50;
                const logoPosX = ANCHO / 2 - logoSize / 2;
                ctx.drawImage(logoImg, logoPosX, y, logoSize, logoSize);
                renderTicket();
            };
            logoImg.src = logoDataURL;
            y += 70;
        } else {
            y += 20;
            renderTicket();
        }

        function renderTicket() {
            y = logoDataURL ? PADDING + 70 : PADDING + 20;

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

            canvas.toBlob(resolve, 'image/png');
        }
    });
}

export async function compartirTicket(pedido) {
    let logoImagen = null;
    try {
        const response = await fetch('/logo-masucri.png');
        const blob = await response.blob();
        logoImagen = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        console.warn('No se pudo cargar el logo:', err);
    }

    const blob = await generarTicketImagenBlob(pedido, logoImagen);
    const nombreArchivo = `Ticket_${(pedido.cliente || 'cliente').trim().replace(/\s+/g, '_')}.png`;
    const file = new File([blob], nombreArchivo, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: 'Ticket MASUCRI' });
            return 'compartido';
        } catch (err) {
            if (err.name === 'AbortError') return 'cancelado';
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
