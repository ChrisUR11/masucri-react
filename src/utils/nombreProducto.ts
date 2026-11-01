export interface ProductoConNombre {
    id?: string | null;
    nombre?: unknown;
}

export const limpiarNombreProducto = (nombre: unknown): string => String(nombre ?? '').trim().replace(/\s+/g, ' ');

/** Comparación sin diferencias de acentos, mayúsculas ni espacios repetidos. */
export const normalizarNombreProducto = (nombre: unknown): string => limpiarNombreProducto(nombre)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CR');

export function buscarProductoDuplicado<T extends ProductoConNombre>(
    productos: readonly T[], nombre: unknown, idActual: string | null = null
): T | null {
    const clave = normalizarNombreProducto(nombre);
    return clave
        ? productos.find((producto) => producto.id !== idActual && normalizarNombreProducto(producto.nombre) === clave) ?? null
        : null;
}

/** Una clave estable evita dos fichas nuevas si dos dispositivos crean el mismo nombre. */
export async function idDocumentoProducto(nombre: unknown): Promise<string> {
    const clave = normalizarNombreProducto(nombre);
    if (!clave) throw new Error('El nombre del producto es requerido.');
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clave));
    const hexadecimal = [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return `nombre_${hexadecimal}`;
}
