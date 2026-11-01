import { obtenerProductosPedido } from './productosPedido.js';
import { limpiarNombreProducto, normalizarNombreProducto } from './nombreProducto.ts';
import type { ProductoConNombre } from './nombreProducto.ts';

interface LineaProductoPedido {
    nombre?: unknown;
    cantidad?: unknown;
    precio_unitario?: unknown;
    total?: unknown;
}

export interface PedidoCatalogoFuente {
    estado?: string | null;
    producto?: unknown;
    productos?: readonly LineaProductoPedido[] | null;
    precio?: unknown;
    subtotal?: unknown;
}

export interface SugerenciaCatalogo {
    clave: string;
    nombre: string;
    pedidos: number;
    precioReferencia: number | null;
}

/** Productos de pedidos recientes que todavía no tienen ficha en el catálogo. */
export function calcularSugerenciasCatalogo(
    pedidosRecientes: readonly PedidoCatalogoFuente[] = [],
    productosCatalogo: readonly ProductoConNombre[] = []
): SugerenciaCatalogo[] {
    const existentes = new Set<string>(productosCatalogo.map((producto) => normalizarNombreProducto(producto.nombre)).filter(Boolean));
    const sugerencias = new Map<string, SugerenciaCatalogo>();

    for (const pedido of pedidosRecientes) {
        if (pedido.estado === 'Cancelado') continue;
        const vistosEnPedido = new Set<string>();

        for (const linea of obtenerProductosPedido(pedido)) {
            const nombre = limpiarNombreProducto(linea.nombre);
            const clave = normalizarNombreProducto(nombre);
            if (!clave || existentes.has(clave)) continue;

            const precio = Number(linea.precio_unitario);
            const precioReferencia = Number.isFinite(precio) && precio > 0 ? precio : null;
            let sugerencia = sugerencias.get(clave);
            if (!sugerencia) {
                sugerencia = { clave, nombre, pedidos: 0, precioReferencia };
                sugerencias.set(clave, sugerencia);
            } else if (sugerencia.precioReferencia == null && precioReferencia != null) {
                sugerencia.precioReferencia = precioReferencia;
            }

            if (!vistosEnPedido.has(clave)) {
                sugerencia.pedidos += 1;
                vistosEnPedido.add(clave);
            }
        }
    }

    return [...sugerencias.values()];
}
