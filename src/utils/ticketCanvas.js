import { LOGO_TICKET, WHATSAPP_NEGOCIO, formatoMontoTicket, formatoPorcentajeTicket, lineasTicket, prepararDatosTicket } from './ticketDatos.js';

const ANCHO = 680;
const MARGEN = 40;
const CONTENIDO = ANCHO - MARGEN * 2;
const AZUL = '#073449';
const GRIS = '#52636d';
const NARANJA = '#e74925';
const MAX_PIXELES = 8_000_000;
const MAX_LADO = 16_000;
let logoPendiente;

function cargarLogo() {
    if (!logoPendiente) {
        logoPendiente = new Promise((resolve) => {
            const imagen = new Image();
            imagen.onload = () => resolve(imagen.naturalWidth && imagen.naturalHeight ? imagen : null);
            imagen.onerror = () => {
                logoPendiente = null;
                resolve(null);
            };
            imagen.src = LOGO_TICKET;
        });
    }
    return logoPendiente;
}
// Se mide primero y luego se dibuja: la altura depende de los productos y de los abonos.
function dibujarTicket(ctx, datos, logo, pintar) {
    const texto = (valor, x, y, ancho, tam = 24, color = AZUL, negrita = false, alineacion = 'left', mostrar = true) => {
        ctx.font = (negrita ? 'bold ' : '') + tam + 'px Arial, sans-serif';
        ctx.textAlign = alineacion;
        ctx.textBaseline = 'top';
        ctx.fillStyle = color;
        const lineas = lineasTicket(ctx, valor, ancho);
        const altoLinea = Math.ceil(tam * 1.4);
        if (pintar && mostrar) lineas.forEach((linea, i) => ctx.fillText(linea, x, y + i * altoLinea));
        return lineas.length * altoLinea;
    };
    const rectangulo = (x, y, ancho, alto, color) => {
        if (!pintar) return;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, ancho, alto);
    };
    const separador = (y) => rectangulo(MARGEN, y, CONTENIDO, 1, '#dce4e8');
    const fila = (etiqueta, monto, y, negrita = false, color = AZUL) => {
        const altoEtiqueta = texto(etiqueta, MARGEN, y, 290, 26, color, negrita);
        const altoMonto = texto(formatoMontoTicket(monto), ANCHO - MARGEN, y, 280, 26, color, negrita, 'right');
        return Math.max(altoEtiqueta, altoMonto) + 18;
    };

    rectangulo(0, 0, ANCHO, 8, NARANJA);
    let y = 34;
    const logoAncho = 440;
    const logoAlto = logo ? logoAncho * logo.naturalHeight / logo.naturalWidth : 90;
    if (pintar) {
        if (logo) ctx.drawImage(logo, (ANCHO - logoAncho) / 2, y, logoAncho, logoAlto);
        else texto('MASUCRI', ANCHO / 2, y + 10, CONTENIDO, 48, AZUL, true, 'center');
    }
    y += logoAlto + 26;
    y += texto('COMPROBANTE DE PEDIDO', ANCHO / 2, y, CONTENIDO, 20, AZUL, true, 'center') + 22;
    separador(y);
    y += 22;
    const referencia = datos.referencia ? 'Pedido #' + datos.referencia : 'Pedido';
    const altoRef = texto(referencia, MARGEN, y, 270, 20, GRIS);
    const altoFecha = texto(datos.fecha, ANCHO - MARGEN, y, 280, 20, GRIS, false, 'right');
    y += Math.max(altoRef, altoFecha) + 30;

    y += texto('CLIENTE', MARGEN, y, CONTENIDO, 18, GRIS, true) + 6;
    y += texto(datos.cliente, MARGEN, y, CONTENIDO, 30, AZUL, true) + 26;

    y += texto('PRODUCTOS', MARGEN, y, CONTENIDO, 18, GRIS, true) + 14;
    for (const producto of datos.productos) {
        y += texto(producto.nombre, MARGEN, y, CONTENIDO, 27, AZUL, true) + 5;
        const detalle = String(producto.cantidad) + ' × ' + formatoMontoTicket(producto.precioUnitario) + ' c/u';
        const altoDetalle = texto(detalle, MARGEN, y, 350, 20, GRIS);
        const altoTotal = texto(formatoMontoTicket(producto.total), ANCHO - MARGEN, y, 220, 23, AZUL, true, 'right');
        y += Math.max(altoDetalle, altoTotal) + 16;
        separador(y);
        y += 14;
    }
    if (datos.descuento > 0) {
        y += fila('Subtotal', datos.subtotal, y);
        y += fila('Descuento (' + formatoPorcentajeTicket(datos.descuentoPorcentaje) + ')', datos.descuento, y, false, '#176446');
    }
    y += fila('Total del pedido', datos.total, y, true);
    y += fila('Total abonado', datos.pagado, y, false, '#176446');
    separador(y);
    y += 24;

    y += texto('ABONOS REGISTRADOS', MARGEN, y, CONTENIDO, 18, GRIS, true) + 12;
    if (datos.pagos.length) {
        for (const pago of datos.pagos) {
            const altoDetalle = texto(pago.fecha + ' · ' + pago.metodo, MARGEN, y, 355, 22, GRIS);
            const altoImporte = texto(formatoMontoTicket(pago.monto), ANCHO - MARGEN, y, 220, 24, AZUL, true, 'right');
            y += Math.max(altoDetalle, altoImporte) + 14;
            separador(y);
            y += 14;
        }
    } else {
        const mensaje = datos.pagado > 0
            ? 'Hay abonos registrados por ' + formatoMontoTicket(datos.pagado) + '. Sin detalle de fechas.'
            : 'Aún no se han registrado abonos.';
        y += texto(mensaje, MARGEN, y, CONTENIDO, 22, GRIS) + 12;
    }
    y += 18;

    const ySaldo = y;
    const colorSaldo = datos.saldo > 0 ? AZUL : '#176446';
    // La cantidad también puede ocupar más de una línea sin quedar recortada.
    const altoSaldo = texto(formatoMontoTicket(datos.saldo), MARGEN + 24, y + 54, CONTENIDO - 48, 42, '#ffffff', true);
    const altoPanel = 54 + altoSaldo + 24;
    rectangulo(MARGEN, ySaldo, CONTENIDO, altoPanel, colorSaldo);
    if (pintar) {
        texto('SALDO PENDIENTE', MARGEN + 24, ySaldo + 22, CONTENIDO - 48, 18, '#ffffff', true);
        texto(formatoMontoTicket(datos.saldo), MARGEN + 24, ySaldo + 54, CONTENIDO - 48, 42, '#ffffff', true);
    }
    y += altoPanel + 14;
    y += texto(datos.estadoPago, MARGEN, y, CONTENIDO, 22, colorSaldo, true) + 12;
    if (datos.saldoAFavor > 0) y += texto('Saldo a favor: ' + formatoMontoTicket(datos.saldoAFavor), MARGEN, y, CONTENIDO, 22, '#176446') + 10;
    y += 24;
    separador(y);
    y += 24;
    y += texto('¡Gracias por tu compra!', ANCHO / 2, y, CONTENIDO, 24, AZUL, true, 'center') + 10;
    y += texto(`WhatsApp: ${WHATSAPP_NEGOCIO}`, ANCHO / 2, y, CONTENIDO, 20, GRIS, false, 'center');
    return Math.ceil(y + 34);
}

export async function generarTicketImagenBlob(pedido, nombreCliente) {
    const datos = prepararDatosTicket(pedido, nombreCliente);
    const logo = await cargarLogo();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Este navegador no pudo preparar el ticket.');
    const alto = dibujarTicket(ctx, datos, logo, false);
    // Limitar píxeles y longitud evita que un historial extenso agote la memoria del móvil.
    const escala = Math.min(2, MAX_LADO / alto, Math.sqrt(MAX_PIXELES / (ANCHO * alto)));
    canvas.width = Math.ceil(ANCHO * escala);
    canvas.height = Math.ceil(alto * escala);
    ctx.scale(escala, escala);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ANCHO, alto);
    dibujarTicket(ctx, datos, logo, true);
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo crear la imagen del ticket.')), 'image/png');
    });
}
