import Swal from 'sweetalert2';
import { generarTicketImagenBlob } from './ticketCanvas.js';

export { generarTicketImagenBlob };

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
