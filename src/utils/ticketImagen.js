import Swal from 'sweetalert2';
import { LOGO_TICKET, formatoMontoTicket, lineasTicket, prepararDatosTicket } from './ticketDatos';

const ANCHO = 680;
const MARGEN = 40;
const CONTENIDO = ANCHO - MARGEN * 2;
const AZUL = '#073449';
const GRIS = '#52636d';
const NARANJA = '#e74925';
let logoPendiente;

function cargarLogo() {
    if (!logoPendiente) {
        logoPendiente = new Promise((resolve, reject) => {
            const imagen = new Image();
            imagen.onload = () => resolve(imagen);
            imagen.onerror = () => {
                logoPendiente = null;
                reject(new Error('No se pudo cargar el logo de MASUCRI.'));
            };
            imagen.src = LOGO_TICKET;
        });
    }
    return logoPendiente;
}

// Se mide primero y luego se dibuja: la altura depende del producto y de los abonos.
function dibujarTicket(ctx, datos, logo, pintar) {
    const texto = (valor, x, y, ancho, tam = 24, color = AZUL, negrita = false, alineacion = 'left') => {
        ctx.font = (negrita ? 'bold ' : '') + tam + 'px Arial, sans-serif';
        ctx.textAlign = alineacion;
        ctx.textBaseline = 'top';
        ctx.fillStyle = color;
        const lineas = lineasTicket(ctx, valor, ancho);
        const altoLinea = Math.ceil(tam * 1.4);
        if (pintar) lineas.forEach((linea, i) => ctx.fillText(linea, x, y + i * altoLinea));
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
    const logoAlto = logoAncho * logo.naturalHeight / logo.naturalWidth;
    if (pintar) ctx.drawImage(logo, (ANCHO - logoAncho) / 2, y, logoAncho, logoAlto);
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

    const yProducto = y;
    y += 22;
    const altoEtiqueta = texto('PRODUCTO', MARGEN + 22, y, CONTENIDO - 44, 18, GRIS, true);
    const yNombreProducto = y + altoEtiqueta + 8;
    const altoProducto = texto(datos.producto, MARGEN + 22, yNombreProducto, CONTENIDO - 44, 28, AZUL, true);
    y = yNombreProducto + altoProducto + 22;
    rectangulo(MARGEN, yProducto, CONTENIDO, y - yProducto, '#f1f5f7');
    // El fondo se coloca detrás de los textos, usando las mismas medidas.
    if (pintar) {
        texto('PRODUCTO', MARGEN + 22, yProducto + 22, CONTENIDO - 44, 18, GRIS, true);
        texto(datos.producto, MARGEN + 22, yNombreProducto, CONTENIDO - 44, 28, AZUL, true);
    }
    y += 30;
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
    y += texto('WhatsApp: 6274-7761', ANCHO / 2, y, CONTENIDO, 20, GRIS, false, 'center');
    return Math.ceil(y + 34);
}

export async function generarTicketImagenBlob(pedido, nombreCliente) {
    const datos = prepararDatosTicket(pedido, nombreCliente);
    const logo = await cargarLogo();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Este navegador no pudo preparar el ticket.');
    const alto = dibujarTicket(ctx, datos, logo, false);
    const escala = Math.min(2, 16000 / alto);
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

const opcionesDialogo = {
    width: 'min(34rem, calc(100vw - 2rem))',
    buttonsStyling: false,
    customClass: {
        popup: 'ticket-dialogo',
        htmlContainer: 'mx-3 mt-3 mb-0 p-0',
        actions: 'gap-2 flex-wrap px-3',
        confirmButton: 'btn btn-primary',
        denyButton: 'btn btn-outline-primary',
        cancelButton: 'btn btn-outline-secondary'
    }
};

async function elegirNombreTicket(nombreOriginal) {
    const nombre = String(nombreOriginal || '').trim();
    const panel = document.createElement('div');
    panel.className = 'text-start';
    const crearOpcion = (valor, titulo, detalle) => {
        const etiqueta = document.createElement('label');
        etiqueta.className = 'd-flex align-items-start gap-2 border rounded-3 p-3 mb-2';
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'nombre-ticket';
        radio.value = valor;
        radio.className = 'form-check-input flex-shrink-0 mt-1';
        const contenido = document.createElement('span');
        contenido.style.minWidth = '0';
        const encabezado = document.createElement('strong');
        encabezado.className = 'd-block';
        encabezado.textContent = titulo;
        contenido.append(encabezado);
        if (detalle) {
            const ayuda = document.createElement('span');
            ayuda.className = 'd-block small text-muted text-break';
            ayuda.textContent = detalle;
            contenido.append(ayuda);
        }
        etiqueta.append(radio, contenido);
        panel.append(etiqueta);
        return radio;
    };
    const actual = crearOpcion('actual', 'Usar el nombre registrado', nombre || 'Este pedido no tiene nombre.');
    const otro = crearOpcion('otro', 'Escribir otro nombre');
    actual.disabled = !nombre;
    actual.checked = Boolean(nombre);
    otro.checked = !nombre;
    const campo = document.createElement('div');
    campo.className = 'mt-3';
    const etiquetaNombre = document.createElement('label');
    etiquetaNombre.textContent = 'Nombre en el ticket';
    etiquetaNombre.className = 'form-label fw-bold';
    etiquetaNombre.htmlFor = 'ticket-nombre-personalizado';
    const entrada = document.createElement('input');
    entrada.id = 'ticket-nombre-personalizado';
    entrada.type = 'text';
    entrada.className = 'form-control';
    entrada.autocomplete = 'off';
    entrada.placeholder = 'Escribí el nombre';
    campo.append(etiquetaNombre, entrada);
    campo.hidden = Boolean(nombre);
    panel.append(campo);
    const nota = document.createElement('p');
    nota.className = 'small text-muted mt-3 mb-0';
    nota.textContent = 'El nombre elegido se usará únicamente en este ticket.';
    panel.append(nota);
    const actualizar = () => {
        campo.hidden = !otro.checked;
        Swal.resetValidationMessage();
        if (otro.checked) entrada.focus();
    };
    actual.addEventListener('change', actualizar);
    otro.addEventListener('change', actualizar);
    const resultado = await Swal.fire({
        ...opcionesDialogo,
        titleText: '¿Qué nombre querés agregar?',
        html: panel,
        showCancelButton: true,
        confirmButtonText: 'Preparar ticket',
        cancelButtonText: 'Cancelar',
        focusConfirm: false,
        didOpen: () => (nombre ? actual : entrada).focus(),
        preConfirm: () => {
            const elegido = otro.checked ? entrada.value.trim() : nombre;
            if (!elegido) {
                Swal.showValidationMessage('Escribí el nombre que querés agregar al ticket.');
                entrada.focus();
                return false;
            }
            return elegido;
        }
    });
    return resultado.isConfirmed ? resultado.value : null;
}

function descargarTicket(archivo) {
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = archivo.name;
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function compartirTicket(pedido, { onNombreConfirmado } = {}) {
    if (!pedido) return 'cancelado';
    const nombre = await elegirNombreTicket(pedido.cliente);
    if (nombre === null) return 'cancelado';
    onNombreConfirmado?.(nombre);
    Swal.fire({
        titleText: 'Preparando ticket…',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading()
    });
    let blob;
    try {
        blob = await generarTicketImagenBlob(pedido, nombre);
    } catch (error) {
        Swal.close();
        throw error;
    }
    const nombreSeguro = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80) || 'cliente';
    const archivo = new File([blob], 'Ticket_MASUCRI_' + nombreSeguro + '.png', { type: 'image/png' });
    let permiteCompartir = false;
    try {
        permiteCompartir = Boolean(navigator.share && navigator.canShare?.({ files: [archivo] }));
    } catch { /* Algunos navegadores rechazan la consulta de archivos. */ }
    const url = URL.createObjectURL(blob);
    const vista = document.createElement('div');
    Object.assign(vista.style, { maxHeight: '58dvh', overflowY: 'auto', border: '1px solid #dce4e8', borderRadius: '10px' });
    const imagen = document.createElement('img');
    imagen.src = url;
    imagen.alt = 'Ticket MASUCRI para ' + nombre;
    Object.assign(imagen.style, { display: 'block', width: '100%', height: 'auto' });
    vista.append(imagen);
    try {
        const resultado = await Swal.fire({
            ...opcionesDialogo,
            titleText: 'Revisá tu ticket',
            html: vista,
            showCancelButton: true,
            showDenyButton: permiteCompartir,
            confirmButtonText: permiteCompartir ? 'Compartir' : 'Descargar',
            denyButtonText: 'Descargar',
            cancelButtonText: 'Cerrar',
            showLoaderOnConfirm: true,
            allowOutsideClick: () => !Swal.isLoading(),
            allowEscapeKey: () => !Swal.isLoading(),
            preConfirm: async () => {
                if (!permiteCompartir) {
                    descargarTicket(archivo);
                    return 'descargado';
                }
                try {
                    // Se llama desde este clic, con el archivo listo, para conservar el permiso de compartir en móviles.
                    await navigator.share({ files: [archivo], title: 'Ticket MASUCRI' });
                    return 'compartido';
                } catch (error) {
                    if (error.name !== 'AbortError') Swal.showValidationMessage('No se pudo compartir. Podés descargar el ticket y adjuntarlo.');
                    return false;
                }
            }
        });
        if (resultado.isDenied) {
            descargarTicket(archivo);
            return 'descargado';
        }
        return resultado.isConfirmed ? resultado.value : 'cancelado';
    } finally {
        URL.revokeObjectURL(url);
    }
}
