const ANCHO = 600;
const PADDING = 40;
const COLOR_TITULO = '#1a5d3a';
const COLOR_TEXTO = '#2c3e50';
const COLOR_MUTED = '#7f8c8d';
const COLOR_LINEA = '#ecf0f1';
const COLOR_EXITO = '#27ae60';
const COLOR_ALERTA = '#e74c3c';

function generarTicketImagenBlob(pedido, logoImagen) {
    return new Promise((resolve) => {
        const saldo = (pedido.precio || 0) - (pedido.monto_pagado || 0);
        const historiaPagos = pedido.historial_pagos || [];
        let altoContent = 350 + historiaPagos.length * 30;
        const altoFinal = altoContent;

        const canvas = document.createElement('canvas');
        canvas.width = ANCHO;
        canvas.height = altoFinal;
        const ctx = canvas.getContext('2d');

        // Fondo blanco
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, ANCHO, altoFinal);

        let y = PADDING;

        // Logo si existe
        if (logoImagen && logoImagen instanceof HTMLImageElement) {
            try {
                ctx.drawImage(logoImagen, ANCHO / 2 - 25, y, 50, 50);
                y += 70;
            } catch (err) {
                console.warn('No se pudo dibujar el logo:', err);
                y += 20;
            }
        } else {
            y += 20;
        }

        // Título
        ctx.fillStyle = COLOR_TITULO;
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('MASUCRI', ANCHO / 2, y);
        y += 30;
        
        ctx.font = '12px Arial';
        ctx.fillStyle = COLOR_MUTED;
        ctx.fillText('Confecciones y Sublimaciones', ANCHO / 2, y);
        y += 25;

        // Línea
        ctx.strokeStyle = COLOR_LINEA;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(PADDING, y);
        ctx.lineTo(ANCHO - PADDING, y);
        ctx.stroke();
        y += 20;

        // ID y fecha
        ctx.textAlign = 'left';
        ctx.font = '11px Arial';
        ctx.fillStyle = COLOR_MUTED;
        ctx.fillText(`ID: ${pedido.id || '-'}`, PADDING, y);
        ctx.textAlign = 'right';
        ctx.fillText(`${pedido.fecha_solicitud || '-'}`, ANCHO - PADDING, y);
        ctx.textAlign = 'left';
        y += 20;

        // Cliente
        ctx.font = '11px Arial';
        ctx.fillStyle = COLOR_MUTED;
        ctx.fillText('CLIENTE', PADDING, y);
        y += 16;
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = COLOR_TEXTO;
        ctx.fillText(pedido.cliente || '-', PADDING, y);
        y += 22;

        // Producto
        ctx.font = '11px Arial';
        ctx.fillStyle = COLOR_MUTED;
        ctx.fillText('PRODUCTO', PADDING, y);
        y += 16;
        ctx.font = '13px Arial';
        ctx.fillStyle = COLOR_TEXTO;
        ctx.fillText(pedido.producto || '-', PADDING, y);
        y += 20;

        // Línea
        ctx.strokeStyle = COLOR_LINEA;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PADDING, y);
        ctx.lineTo(ANCHO - PADDING, y);
        ctx.stroke();
        y += 15;

        // Precio y pagado
        ctx.font = '13px Arial';
        ctx.fillStyle = COLOR_MUTED;
        ctx.fillText('Precio Total', PADDING, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = COLOR_TEXTO;
        ctx.fillText(`₡${(pedido.precio || 0).toLocaleString('es-CR')}`, ANCHO - PADDING, y);
        ctx.textAlign = 'left';
        y += 20;

        ctx.font = '13px Arial';
        ctx.fillStyle = COLOR_MUTED;
        ctx.fillText('Pagado', PADDING, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = COLOR_TEXTO;
        ctx.fillText(`₡${(pedido.monto_pagado || 0).toLocaleString('es-CR')}`, ANCHO - PADDING, y);
        ctx.textAlign = 'left';
        y += 20;

        // Historial de pagos
        if (historiaPagos.length > 0) {
            ctx.font = '11px Arial';
            ctx.fillStyle = COLOR_MUTED;
            ctx.fillText('Historial de pagos:', PADDING, y);
            y += 16;

            historiaPagos.forEach((pago) => {
                ctx.font = '11px Arial';
                ctx.fillStyle = COLOR_TEXTO;
                ctx.fillText(`• ${pago.fecha} - ${pago.metodo}`, PADDING + 5, y);
                ctx.textAlign = 'right';
                ctx.fillText(`₡${(pago.monto || 0).toLocaleString('es-CR')}`, ANCHO - PADDING, y);
                ctx.textAlign = 'left';
                y += 18;
            });
            y += 5;
        }

        // Línea final
        ctx.strokeStyle = COLOR_LINEA;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(PADDING, y);
        ctx.lineTo(ANCHO - PADDING, y);
        ctx.stroke();
        y += 15;

        // Saldo
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        if (saldo > 0) {
            ctx.fillStyle = COLOR_ALERTA;
            ctx.fillText(`Saldo: ₡${saldo.toLocaleString('es-CR')}`, ANCHO / 2, y);
        } else {
            ctx.fillStyle = COLOR_EXITO;
            ctx.fillText('✓ PAGADO COMPLETAMENTE', ANCHO / 2, y);
        }
        y += 20;

        // Pie
        ctx.font = 'italic 11px Arial';
        ctx.fillStyle = COLOR_MUTED;
        ctx.fillText('¡Gracias por su compra!', ANCHO / 2, y);

        // Convertir a blob
        canvas.toBlob((blob) => {
            if (!blob) {
                console.error('Error: canvas.toBlob retornó null');
                resolve(null);
            } else {
                resolve(blob);
            }
        }, 'image/png');
    });
}

async function cargarLogo() {
    const rutasIntento = [
        '/logo-masucri.png',
        '/logo_masucri.png',
        './logo-masucri.png',
        'logo-masucri.png'
    ];

    for (const ruta of rutasIntento) {
        try {
            const response = await fetch(ruta);
            if (response.ok) {
                const blob = await response.blob();
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => resolve(img);
                    img.onerror = () => reject(new Error(`No se pudo cargar imagen desde ${ruta}`));
                    img.src = URL.createObjectURL(blob);
                });
            }
        } catch (err) {
            console.log(`Ruta ${ruta} no disponible`);
        }
    }

    console.warn('Logo no encontrado en ninguna ruta, continuando sin él');
    return null;
}

export async function compartirTicket(pedido) {
    try {
        // Intentar cargar el logo (pero no fallar si no está disponible)
        let logoImagen = null;
        try {
            logoImagen = await cargarLogo();
        } catch (err) {
            console.warn('Error cargando logo:', err.message);
        }

        // Generar el blob del ticket
        const ticketBlob = await generarTicketImagenBlob(pedido, logoImagen);

        if (!ticketBlob) {
            throw new Error('No se pudo generar la imagen del ticket');
        }

        const nombreArchivo = `Ticket_${(pedido.cliente || 'cliente').trim().replace(/\s+/g, '_')}.png`;
        const file = new File([ticketBlob], nombreArchivo, { type: 'image/png' });

        // Compartir o descargar
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title: 'Ticket MASUCRI' });
                return 'compartido';
            } catch (err) {
                if (err.name === 'AbortError') return 'cancelado';
                throw err;
            }
        }

        // Descargar si no se puede compartir
        const url = URL.createObjectURL(ticketBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return 'descargado';
    } catch (err) {
        console.error('Error generando ticket:', err);
        throw err;
    }
}
