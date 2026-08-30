// La Contact Picker API (navigator.contacts) solo existe en navegadores
// basados en Chromium para Android. No está disponible en iOS/Safari ni en
// computadora — en esos casos simplemente no se debe mostrar el botón.
export const soportaSelectorContactos = () => 'contacts' in navigator && 'ContactsManager' in window;

/**
 * Abre el selector nativo de contactos del teléfono y devuelve el nombre y
 * teléfono elegidos. Antes esta lógica estaba solo en Pedidos.jsx; ahora
 * también la usa Venta Rápida.
 *
 * @returns {Promise<{telefono?: string, nombre?: string} | null>} null si el
 *          usuario canceló o el dispositivo no soporta el selector.
 */
export async function seleccionarContacto() {
    if (!soportaSelectorContactos()) return null;

    try {
        const contactos = await navigator.contacts.select(['name', 'tel'], { multiple: false });
        if (contactos.length === 0) return null;

        const contacto = contactos[0];
        let telefono;
        if (contacto.tel?.length > 0) {
            telefono = contacto.tel[0].replace(/[\s-]/g, '');
            if (telefono.startsWith('+506')) telefono = telefono.substring(4);
        }
        const nombre = contacto.name?.length > 0 ? contacto.name[0] : undefined;

        return { telefono, nombre };
    } catch (ex) {
        console.log('Selección de contacto cancelada.');
        return null;
    }
}
