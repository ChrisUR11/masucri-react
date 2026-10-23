/** Desglose común de productos, incluidos los pedidos guardados antes de tener líneas. */
import { aCentavos, deCentavos, tieneMaximoDosDecimales } from './dinero.js';

const numeroFinito = (valor) => {
    if (valor == null || (typeof valor === 'string' && !valor.trim())) return null;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
};

const redondearCentimos = (numero) => Math.round((numero + Number.EPSILON) * 100) / 100;

export function obtenerProductosPedido(pedido = {}) {
    if (Array.isArray(pedido.productos) && pedido.productos.length > 0) {
        const lineas = pedido.productos
            .map((producto) => {
                const nombre = String(producto?.nombre ?? '').trim();
                const cantidad = numeroFinito(producto?.cantidad) ?? 1;
                const totalGuardado = numeroFinito(producto?.total);
                const precioGuardado = numeroFinito(producto?.precio_unitario);
                const precioUnitario = precioGuardado
                    ?? (cantidad > 0 && totalGuardado != null ? totalGuardado / cantidad : 0);
                const totalCentavos = aCentavos(precioUnitario) * cantidad;
                const totalCalculado = Number.isSafeInteger(cantidad) && cantidad >= 0
                    && tieneMaximoDosDecimales(precioUnitario) && Number.isSafeInteger(totalCentavos)
                    ? deCentavos(totalCentavos)
                    : redondearCentimos(precioUnitario * cantidad);
                return {
                    nombre,
                    precio_unitario: precioUnitario,
                    cantidad,
                    total: precioGuardado == null && totalGuardado != null
                        ? totalGuardado
                        : totalCalculado
                };
            })
            .filter((producto) => producto.nombre);
        if (lineas.length > 0) return lineas;
    }

    const nombre = String(pedido.producto ?? '').trim();
    if (!nombre) return [];
    const precio = numeroFinito(pedido.subtotal) ?? numeroFinito(pedido.precio) ?? 0;
    return [{ nombre, precio_unitario: precio, cantidad: 1, total: precio }];
}

export function resumenProductos(productos = []) {
    const nombres = productos.map((producto) => String(producto?.nombre ?? '').trim()).filter(Boolean);
    if (nombres.length === 0) return '';
    if (nombres.length === 1) return nombres[0];
    return `${nombres[0]} y ${nombres.length - 1} producto${nombres.length > 2 ? 's' : ''} más`;
}

export function detalleProductosPedido(pedido = {}) {
    return obtenerProductosPedido(pedido)
        .map(({ nombre, cantidad }) => `${cantidad} × ${nombre}`)
        .join(', ');
}

/** Valida las líneas del formulario y recalcula sus totales antes de guardar. */
export function validarProductosPedido(productos) {
    if (!Array.isArray(productos) || productos.length === 0) {
        throw new Error('Agrega al menos un producto.');
    }
    let subtotalCentavos = 0;
    const lineas = productos.map((producto) => {
        const nombre = String(producto?.nombre ?? '').trim();
        const precioUnitario = Number(producto?.precio_unitario);
        const cantidad = Number(producto?.cantidad);
        if (!nombre) throw new Error('Ingresa el nombre de cada producto.');
        if (producto?.precio_unitario == null
            || (typeof producto.precio_unitario === 'string' && !producto.precio_unitario.trim())
            || !Number.isFinite(precioUnitario) || precioUnitario < 0 || !tieneMaximoDosDecimales(precioUnitario)) {
            throw new Error('Ingresa un precio unitario válido, con máximo dos decimales, para cada producto.');
        }
        if (producto?.cantidad === '' || producto?.cantidad == null
            || !Number.isSafeInteger(cantidad) || cantidad < 1) {
            throw new Error('La cantidad de cada producto debe ser un entero mayor a cero.');
        }
        const totalCentavos = aCentavos(precioUnitario) * cantidad;
        if (!Number.isSafeInteger(totalCentavos)) {
            throw new Error('El total del producto es demasiado grande.');
        }
        if (!Number.isSafeInteger(subtotalCentavos + totalCentavos)) {
            throw new Error('El subtotal del pedido es demasiado grande.');
        }
        subtotalCentavos += totalCentavos;
        return {
            nombre,
            precio_unitario: precioUnitario,
            cantidad,
            total: deCentavos(totalCentavos)
        };
    });
    return lineas;
}

export function calcularTotalesPedido(productos = [], descuento = {}) {
    const sumaCentavos = productos.reduce((suma, producto) => {
        const cantidad = numeroFinito(producto?.cantidad) ?? 0;
        const precioUnitario = numeroFinito(producto?.precio_unitario) ?? 0;
        const total = Math.max(0, cantidad) * Math.max(0, aCentavos(precioUnitario));
        return suma + (Number.isFinite(total) ? total : 0);
    }, 0);
    const subtotalCentavos = Number.isSafeInteger(sumaCentavos) ? sumaCentavos : 0;
    const subtotal = deCentavos(subtotalCentavos);

    const montoIndicado = numeroFinito(descuento.descuento_monto);
    const porcentajeIndicado = numeroFinito(descuento.descuento_porcentaje) ?? 0;
    const monto = montoIndicado == null
        ? subtotal * Math.min(100, Math.max(0, porcentajeIndicado)) / 100
        : montoIndicado;
    const descuentoCentavos = aCentavos(Math.min(subtotal, Math.max(0, monto)));
    const descuentoMonto = deCentavos(descuentoCentavos);

    return {
        subtotal,
        descuento_monto: descuentoMonto,
        descuento_porcentaje: subtotal > 0
            ? Math.round((descuentoMonto / subtotal * 100 + Number.EPSILON) * 1e6) / 1e6 : 0,
        precio: deCentavos(subtotalCentavos - descuentoCentavos)
    };
}
