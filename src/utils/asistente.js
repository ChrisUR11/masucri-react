import { esFechaISOValida } from './fecha.js';

const sinAcentos = (texto = '') => String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CR')
    .replace(/\s+/g, ' ')
    .trim();

const PALABRAS_COMUNES = new Set([
    'a', 'al', 'algo', 'algun', 'alguna', 'como', 'con', 'cual', 'cuales', 'cuanto', 'cuantos',
    'de', 'del', 'dime', 'el', 'ella', 'ellas', 'ellos', 'en', 'es', 'esta', 'estan', 'este', 'hay',
    'la', 'las', 'lo', 'los', 'me', 'mi', 'mis', 'mostrar', 'muestra', 'necesito', 'para', 'por',
    'que', 'quien', 'quienes', 'quiero', 'se', 'tiene', 'tienen', 'un', 'una', 'unos', 'unas',
    'pedido', 'pedidos', 'cliente', 'clientes', 'producto', 'productos', 'buscar', 'busca', 'donde',
    'cuando', 'entrega', 'entregar', 'entregado', 'entregados', 'activo', 'activos', 'pendiente', 'pendientes',
    'atrasado', 'atrasados', 'atrasada', 'atrasadas', 'estado', 'historial', 'tengo', 'tenemos', 'lista', 'listar',
    'mostrame', 'muestrame', 'ensename', 'encuentra', 'encuentrame', 'dame', 'indica', 'favor', 'manana', 'hoy', 'ayer'
]);

/** Coincidencia por palabras para búsquedas con frases naturales y datos completos. */
export function coincideConsulta(consulta, valores) {
    const texto = Array.isArray(valores) ? valores.join(' ') : String(valores ?? '');
    const contenido = sinAcentos(texto);
    const clave = sinAcentos(consulta);
    if (!clave) return true;
    if (contenido.includes(clave)) return true;
    const palabras = [...new Set(clave.split(/[^a-z0-9]+/).filter((palabra) =>
        palabra.length > 1 && !PALABRAS_COMUNES.has(palabra)
    ))];
    if (palabras.length === 0) return true;
    const coincidencias = palabras.filter((palabra) => contenido.includes(palabra)).length;
    return coincidencias >= Math.ceil(palabras.length * 0.7);
}

const valorCampo = (texto, nombre) => {
    const expresion = new RegExp(`(?:^|[;,\\n])\\s*${nombre}\\s*[:=]\\s*([^;,\\n]+)`, 'i');
    return texto.match(expresion)?.[1]?.trim() || '';
};

const limpiarConsulta = (texto = '') => String(texto)
    .replace(/^[\s,:;?¿¡.!-]+|[\s,:;?¿¡.!-]+$/g, '')
    .replace(/^(?:(?:de|del|un|una|el|la|los|las|por|para|en|cliente|clientes|producto|productos|cat[aá]logo)\s+)+/i, '')
    .trim();

const numeroCampo = (texto, nombre) => {
    const valor = valorCampo(texto, nombre).replace(/₡|colones/gi, '').replace(/\s/g, '').replace(',', '.');
    if (!valor) return null;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
};

const fechaCampo = (texto) => {
    const fecha = valorCampo(texto, '(?:entrega|fecha)').replace(/^el\s+/i, '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
    const local = fecha.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (local) return `${local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}`;
    return '';
};

function productoLiteralEnTexto(textoNormalizado, catalogo) {
    const productosOrdenados = [...catalogo].filter((producto) => String(producto?.nombre || '').trim())
        .sort((a, b) => String(b.nombre).length - String(a.nombre).length);
    for (const producto of productosOrdenados) {
        const nombre = sinAcentos(producto.nombre);
        const escapado = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const expresion = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapado}(?=$|\\s+(?:x|cantidad|precio|unitario|entrega|fecha|para|con descuento|descuento|adelanto|pagado)|[,;])`, 'u');
        if (expresion.test(textoNormalizado)) return producto;
    }
    return null;
}

function extraerClienteNatural(texto, catalogo = []) {
    const coincidencia = texto.match(/\b(?:pedido|venta(?:\s+r[aá]pida)?)\s+(?:para|a)\s+(.+?)(?=\s*(?:[,;:]|$)|\s+(?:con\s+\d|producto|productos|cantidad|precio|entrega|fecha|tel[eé]fono|adelanto|descuento|pagado)\b)/i);
    let cliente = coincidencia?.[1]?.trim() || '';
    const producto = productoLiteralEnTexto(sinAcentos(texto), catalogo);
    if (cliente && producto?.nombre) {
        const escapado = String(producto.nombre).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        cliente = cliente.replace(new RegExp(`\\s+(?:de\\s+)?${escapado}$`, 'i'), '').trim();
    }
    if (!cliente && producto?.nombre) {
        const escapado = String(producto.nombre).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const despuesDelProducto = texto.match(new RegExp(
            `\\bpedido(?:\\s+(?:nuevo|nueva))?\\s+de\\s+${escapado}\\s+para\\s+(.+?)(?=\\s*(?:[,;:]|$)|\\s+(?:producto|cantidad|precio|entrega|fecha|tel[eé]fono|adelanto|pagado)\\b)`,
            'i'
        ));
        cliente = despuesDelProducto?.[1]?.trim() || '';
    }
    return cliente;
}

function extraerProductoDespuesDePedido(texto) {
    return texto.match(/\bpedido(?:\s+(?:nuevo|nueva))?\s+de\s+(.+?)(?=\s+(?:para|cliente|con\s+\d|cantidad|precio|entrega|fecha|tel[eé]fono|adelanto|pagado)\b|\s+(?:a|en|por)\s+₡?\d|[,;.\n]|[?!]|$)/i)?.[1]?.trim() || '';
}

function extraerTelefono(texto) {
    const etiquetado = valorCampo(texto, 'tel[eé]fono');
    if (etiquetado) return etiquetado;
    return texto.match(/\b(?:tel[eé]fono|tel)\s+(\+?\d[\d\s-]{6,})/i)?.[1]?.trim() || '';
}

function extraerProductoLibre(texto) {
    return texto.match(/\bproducto\s+(?:de\s+)?([^,;\n]+?)(?=\s+(?:cantidad|precio|entrega|fecha|cliente|tel[eé]fono|adelanto|descuento|pagado)\s*[:=]?|[,;\n]|$)/i)?.[1]?.trim() || '';
}

function extraerCantidad(texto, nombreProducto, cantidadEtiquetada) {
    if (cantidadEtiquetada != null && Number.isSafeInteger(cantidadEtiquetada) && cantidadEtiquetada > 0) return cantidadEtiquetada;
    if (!nombreProducto) return 1;
    const normalizado = sinAcentos(texto);
    const indice = normalizado.indexOf(sinAcentos(nombreProducto));
    if (indice < 0) return 1;
    const anterior = normalizado.slice(0, indice).match(/(\d+)\s*(?:x|×|unidades?(?: de)?|piezas?)?\s*$/);
    const posterior = normalizado.slice(indice + sinAcentos(nombreProducto).length).match(/^\s*(?:x|×|cantidad)?\s*(\d+)\b/);
    const cantidad = Number(anterior?.[1] || posterior?.[1] || 1);
    return Number.isSafeInteger(cantidad) && cantidad > 0 ? cantidad : 1;
}

function parsearPrecioNatural(valor) {
    const normalizado = String(valor ?? '').trim().replace(/[.,]+$/, '').replace(/[^\d.,-]/g, '');
    if (!normalizado) return null;
    const ultimoSeparador = Math.max(normalizado.lastIndexOf(','), normalizado.lastIndexOf('.'));
    if (ultimoSeparador < 0) {
        const precio = Number(normalizado);
        return Number.isFinite(precio) ? precio : null;
    }

    const decimales = normalizado.length - ultimoSeparador - 1;
    const enteroConSeparadores = normalizado.slice(0, ultimoSeparador);
    if (decimales === 3 && enteroConSeparadores.length <= 3) {
        const precio = Number(normalizado.replace(/[.,]/g, ''));
        return Number.isFinite(precio) ? precio : null;
    }
    if (decimales > 0 && decimales <= 2) {
        const entero = enteroConSeparadores.replace(/[.,]/g, '') || '0';
        const fraccion = normalizado.slice(ultimoSeparador + 1);
        const precio = Number(`${entero}.${fraccion}`);
        return Number.isFinite(precio) ? precio : null;
    }
    const precio = Number(normalizado.replace(/[.,]/g, ''));
    return Number.isFinite(precio) ? precio : null;
}

/** Convierte variantes dictadas de una misma prenda en líneas independientes. */
export function extraerProductosPorTalla(texto = '') {
    const contenido = String(texto);
    const indicePrimeraTalla = sinAcentos(contenido).search(/\btalla\b/);
    if (indicePrimeraTalla < 0) return null;
    const prefijo = contenido.slice(0, indicePrimeraTalla);
    const cantidadesBase = [...prefijo.matchAll(/\b(\d+)\s+([\p{L}][\p{L}\p{N}-]*)\b/giu)];
    const baseConCantidad = cantidadesBase.at(-1) || null;
    const baseSinCantidad = baseConCantidad ? null : prefijo.match(/\b(?:un|una|otra|otro|producto|productos|agrega|agregar|agregale|agrégale|anade|anadele|añade|añadir|suma|sumar|sumale|incluye|pon)\s+([\p{L}][\p{L}\p{N}-]*)\s*$/iu);
    const basePrendaConocida = baseConCantidad || baseSinCantidad
        ? null
        : prefijo.match(/\b(pijamas?|camisetas?|camisas?|pantalones?|vestidos?|blusas?|shorts?|mamelucos?|bodies?)\s*$/iu);
    const nombreOriginal = baseConCantidad?.[2] || baseSinCantidad?.[1] || basePrendaConocida?.[1];
    if (!nombreOriginal) return null;

    const nombresBase = {
        pijama: 'Pijama', pijamas: 'Pijama',
        camiseta: 'Camiseta', camisetas: 'Camiseta',
        camisa: 'Camisa', camisas: 'Camisa',
        pantalon: 'Pantalón', pantalones: 'Pantalón',
        vestido: 'Vestido', vestidos: 'Vestido',
        blusa: 'Blusa', blusas: 'Blusa',
        short: 'Short', shorts: 'Short',
        mameluco: 'Mameluco', mamelucos: 'Mameluco',
        body: 'Body', bodies: 'Body'
    };
    const nombreBase = nombresBase[sinAcentos(nombreOriginal)]
        || nombreOriginal.replace(/s$/i, '').replace(/^\p{L}/u, (letra) => letra.toLocaleUpperCase('es-CR'));
    const baseEncontrada = baseConCantidad || baseSinCantidad || basePrendaConocida;
    const indiceNombre = baseEncontrada.index + baseEncontrada[0].lastIndexOf(nombreOriginal);
    const variantesTexto = contenido.slice(indiceNombre + nombreOriginal.length);
    const variantes = [...variantesTexto.matchAll(/(?:\b(?:otra|otro|una|un)\s+)?(?:de\s+)?(?:talla\s+)?(\d{1,3}(?:\s*(?:mes(?:es)?|m|año|años|xl|xxl))?)\s+(?:en|a|por)\s*(?:₡\s*)?(\d[\d.,\s]*?)(?=\s*(?:[,;]|$|y\b|otra\b|otro\b|[?!]))/gi)];
    if (!variantes.length) return null;

    const cantidadBase = baseConCantidad ? Number(baseConCantidad[1]) : null;
    return variantes.slice(0, 20).map(([, talla, precioTexto]) => ({
        name: `${nombreBase} talla ${talla.trim()}`,
        quantity: variantes.length === 1 && Number.isSafeInteger(cantidadBase) && cantidadBase > 1 ? cantidadBase : 1,
        unit_price: parsearPrecioNatural(precioTexto)
    }));
}

const fechasRangoTexto = (texto) => {
    const rango = texto.match(/(?:desde|del)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})\s+(?:al|hasta|a)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i);
    if (!rango) return null;
    const convertir = (fecha) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
        const local = fecha.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
        return local ? `${local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}` : '';
    };
    const inicio = convertir(rango[1]);
    const fin = convertir(rango[2]);
    return esFechaISOValida(inicio) && esFechaISOValida(fin) ? { inicio, fin } : null;
};

/** Interpretador pequeño para que búsquedas básicas sigan disponibles sin el servidor Python. */
export function interpretarMensajeLocal(mensaje = '', catalogo = []) {
    const texto = String(mensaje).trim();
    const normalizado = sinAcentos(texto);
    const crearVenta = /\bventa rapida\b|\bventa de mostrador\b|\bregistrar venta\b/.test(normalizado);
    const productosPorTalla = extraerProductosPorTalla(texto);
    const verboAgregar = /\b(agrega|agregar|anadir|anade|anadele|agregale|anotar|anota|ingresar|ingresa|incluye|suma)\b/.test(normalizado);
    const crearPedido = /\b(nuevo|nueva|crear|crea|agregar|agrega|anadir|anade|añadir|añade|anotar|anota|ingresar|ingresa|registrar|registra)\b.{0,30}\bpedido\b|\bpedido nuevo\b/.test(normalizado)
        || Boolean(productosPorTalla?.length && verboAgregar);

    if (crearVenta || crearPedido) {
        const clienteNatural = valorCampo(texto, 'cliente') || extraerClienteNatural(texto, catalogo);
        const productoPedido = clienteNatural ? '' : extraerProductoDespuesDePedido(texto);
        const productoDePedido = productoPedido
            ? catalogo.find((producto) => sinAcentos(producto?.nombre) === sinAcentos(productoPedido))
            : null;
        const productoDeCatalogo = productoDePedido || productoLiteralEnTexto(normalizado, catalogo);
        const nombreProducto = valorCampo(texto, 'producto') || productoDePedido?.nombre || productoDeCatalogo?.nombre || extraerProductoLibre(texto) || productoPedido;
        const cantidad = numeroCampo(texto, 'cantidad');
        const precio = numeroCampo(texto, 'precio(?:\\s+unitario)?');
        const fechaEntrega = fechaCampo(texto) || (() => {
            const fecha = texto.match(/(?:entrega(?:\s+el)?|para\s+el)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i)?.[1];
            if (!fecha) return '';
            if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
            const local = fecha.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
            return local ? `${local[3]}-${local[2].padStart(2, '0')}-${local[1].padStart(2, '0')}` : '';
        })();
        return {
            intent: crearVenta ? 'quick_sale' : 'create_order',
            reply: 'Preparé un borrador. Revisa los datos, completa lo que falte y confirma para guardarlo.',
            draft: {
                customer: clienteNatural,
                phone: extraerTelefono(texto),
                due_date: fechaEntrega,
                products: productosPorTalla || (nombreProducto ? [{
                    name: nombreProducto,
                    quantity: extraerCantidad(texto, nombreProducto, cantidad),
                    unit_price: precio ?? (productoDeCatalogo ? productoDeCatalogo.precio_venta : null)
                }] : []),
                notes: valorCampo(texto, 'nota'),
                advance: numeroCampo(texto, 'adelanto'),
                advance_method: valorCampo(texto, 'metodo adelanto') || null,
                paid: numeroCampo(texto, 'pagado'),
                payment_method: valorCampo(texto, 'metodo pago') || null
            }
        };
    }

    if (/\b(pedidos?|ordenes?)\b/.test(normalizado)
        && /\b(primero|prioridad(?:es)?|urgentes?|sacar primero|entregar primero|producir primero)\b/.test(normalizado)) {
        return { intent: 'search_orders', query: '__prioridades__' };
    }

    const status = normalizado.includes('pendiente') ? 'Pendiente'
        : /en produccion|en proceso|fabricando/.test(normalizado) ? 'En producción'
            : /por retirar|listo para retirar|listo para recoger/.test(normalizado) ? 'Por Retirar'
                : normalizado.includes('entregado') ? 'Entregado'
                    : /cancelado|anulado/.test(normalizado) ? 'Cancelado' : null;

    if (/\b(pedidos?|ordenes?)\b/.test(normalizado)
        && /\b(cuales|qu[eé] tareas|listar|lista|muestra|mostrar|busca|buscar|que tengo que entregar)\b/.test(normalizado)
        && /\b(atrasad[oa]s?|vencid[oa]s?)\b/.test(normalizado)) {
        return { intent: 'search_orders', query: 'atrasados', status: null };
    }

    const consultaProductoPopular = /\b(producto|productos|articulo|articulos)\b/.test(normalizado)
        && /\b(mas (?:vendid[oa]s?|solicitad[oa]s?|ventas|pedid[oa]s?)|top|popular(?:es)?|tendencia|se vende mas|se vendio mas)\b/.test(normalizado);
    if (consultaProductoPopular) {
        const rangoPersonalizado = fechasRangoTexto(texto);
        const period = rangoPersonalizado ? 'personalizado'
            : /\b(historico|siempre|todo el tiempo)\b/.test(normalizado) ? 'historico'
                : /\b(30 dias|ultimos 30)\b/.test(normalizado) ? 'ultimos_30'
                    : /\b(anio|este ano)\b/.test(normalizado) ? 'este_anio'
                        : /\b(mes anterior|mes pasado)\b/.test(normalizado) ? 'mes_anterior' : 'mes_actual';
        return {
            intent: 'summary',
            summary_scope: 'business',
            period,
            range_start: rangoPersonalizado?.inicio || null,
            range_end: rangoPersonalizado?.fin || null,
            query: ''
        };
    }

    if (/\b(catalogo|producto|productos|precio|costo)\b|cuanto cuesta|cuanto sale|precio de|costo de/.test(normalizado)) {
        const query = texto.match(/(?:producto|productos|cat[aá]logo|buscar|busca|precio de|costo de|cu[aá]nto cuesta|cu[aá]nto sale)\s+(?:de\s+)?(.+)$/i)?.[1] || '';
        return { intent: 'search_catalog', query: limpiarConsulta(query) };
    }

    const solicitudDeResumen = /\b(cuanto|cuantos|total|resumen|balance|flujo|caja|ingresos|gastos|ganancia|utilidad|atrasad|debe|deuda|saldo|negocio|finanzas|bi|venta|ventas|vendi|vendimos|vendio|vendieron|pedidos activos|pedidos abiertos)\b/.test(normalizado);
    if (solicitudDeResumen) {
        const summaryScope = /\b(caja|flujo|ingresos?|entradas?|gastos?|gastar|gaste|gastamos|gastado|salidas?|ganancia|utilidad)\b/.test(normalizado)
            ? 'cash'
            : /\b(debe|deuda|saldo|por cobrar|moroso)\b/.test(normalizado)
                ? 'debts'
                : /\b(bi|negocio|finanzas|historico|historial|ventas?|vendi|vendimos|vendio|vendieron)\b/.test(normalizado)
                    ? 'business'
                    : 'active';
        const rangoPersonalizado = fechasRangoTexto(texto);
        const period = rangoPersonalizado ? 'personalizado'
            : /\b(historico|siempre|todo el tiempo)\b/.test(normalizado)
            ? 'historico'
            : /\b(30 dias|ultimos 30)\b/.test(normalizado)
                ? 'ultimos_30'
                : /\b(anio|este ano)\b/.test(normalizado)
                    ? 'este_anio'
                    : /\b(mes anterior|mes pasado)\b/.test(normalizado)
                        ? 'mes_anterior'
                        : 'mes_actual';
        const cliente = texto.match(/(?:deuda|saldo|debe)\s+(?:de\s+)?(.+)$/i)?.[1]?.trim() || '';
        const categoriasCaja = ['Telas', 'Sublimación', 'Transporte', 'Servicios Públicos', 'Alimentación', 'Gastos generales'];
        const categoriaCaja = summaryScope === 'cash' ? categoriasCaja.find((categoria) => normalizado.includes(sinAcentos(categoria))) : null;
        return {
            intent: 'summary',
            summary_scope: summaryScope,
            period,
            range_start: rangoPersonalizado?.inicio || null,
            range_end: rangoPersonalizado?.fin || null,
            query: limpiarConsulta(categoriaCaja || cliente),
            status
        };
    }

    if (/\b(cliente|clientes|historial de|compras de)\b/.test(normalizado)) {
        const query = texto.match(/(?:cliente|historial de|compras de)\s+(?:de\s+)?(.+)$/i)?.[1] || '';
        return { intent: 'search_customer', query: limpiarConsulta(query) };
    }

    if (/\b(pedido|pedidos|buscar|busca|entrega)\b/.test(normalizado)) {
        const textoBusqueda = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const query = limpiarConsulta(textoBusqueda
            .replace(/\b(buscar|busca|buscarme|encuentra|encu[eé]ntrame|mostrar|muestra|mostrame|mu[eé]strame|pedido|pedidos|cliente|producto|entrega|entregar|pendiente|pendientes|en produccion|por retirar|entregado|cancelado|qu[eé]|cu[aá]les?|son|hay|tengo|tenemos|debo|deben|necesito|quiero|mis|me|de|del|la|el|los|las|para|a)\b/gi, ' ')
            .replace(/\s+/g, ' '));
        return { intent: 'search_orders', query, status };
    }

    if (/\b(ayuda|que puedes|como funciona|asistente)\b/.test(normalizado)) {
        return {
            intent: 'help',
            reply: 'Puedo buscar pedidos, productos y clientes; resumir pedidos activos, saldos, caja y BI; y preparar pedidos o ventas rápidas para que los revises antes de guardar. Para tallas con precios distintos, dicta una línea por talla, por ejemplo: “3 pijamas, talla 8 en 8500, talla 6 en 6500 y 0 meses en 4000”.'
        };
    }

    return {
        intent: 'unknown',
        reply: 'En el modo local no reconocí la solicitud. Prueba con una búsqueda, un resumen o escribe “nuevo pedido” y completa el borrador.'
    };
}

function productoDeCatalogo(nombre, catalogo) {
    const clave = sinAcentos(nombre);
    if (!clave) return null;
    return catalogo.find((producto) => sinAcentos(producto.nombre) === clave) || null;
}

function metodoPagoPermitido(metodo, alternativo) {
    const opciones = ['Efectivo', 'Sinpe Móvil', 'Transferencia'];
    return opciones.find((opcion) => sinAcentos(opcion) === sinAcentos(metodo)) || alternativo;
}

export function normalizarBorradorAsistente(resultado, catalogo = [], solicitud = '') {
    const borrador = resultado?.draft || {};
    const mensaje = String(solicitud || '');
    const clienteDelMensaje = valorCampo(mensaje, 'cliente') || extraerClienteNatural(mensaje, catalogo);
    const clienteExplicito = Boolean(clienteDelMensaje);
    const productosCatalogoMencionados = catalogo
        .filter((producto) => String(producto?.nombre || '').trim()
            && sinAcentos(mensaje).includes(sinAcentos(producto.nombre)))
        .sort((a, b) => String(b.nombre).length - String(a.nombre).length);
    const coincidenciaMasLarga = productosCatalogoMencionados[0];
    const productoCatalogoMencionado = coincidenciaMasLarga && productosCatalogoMencionados.filter(
        (producto) => String(producto.nombre).length === String(coincidenciaMasLarga.nombre).length
    ).length === 1 ? coincidenciaMasLarga : null;
    const productoPedido = extraerProductoDespuesDePedido(mensaje)
        || (productoCatalogoMencionado && sinAcentos(productoCatalogoMencionado.nombre) !== sinAcentos(clienteDelMensaje)
            ? productoCatalogoMencionado.nombre
            : '');
    const productoPedidoCatalogo = productoPedido
        ? catalogo.find((producto) => sinAcentos(producto?.nombre) === sinAcentos(productoPedido))
        : null;
    const productosOrigen = Array.isArray(borrador.products) ? [...borrador.products] : [];
    if (productoPedido && !productosOrigen.some((producto) => sinAcentos(producto?.name) === sinAcentos(productoPedido))) {
        const linea = {
            name: productoPedidoCatalogo?.nombre || productoPedido,
            quantity: 1,
            unit_price: productoPedidoCatalogo?.precio_venta ?? null
        };
        const indiceVacio = productosOrigen.findIndex((producto) => !String(producto?.name ?? '').trim());
        if (indiceVacio >= 0) productosOrigen[indiceVacio] = linea;
        else productosOrigen.push(linea);
    }
    const productos = productosOrigen.map((linea) => {
        const nombre = String(linea?.name ?? '').trim();
        const ficha = productoDeCatalogo(nombre, catalogo);
        const precio = linea?.unit_price ?? ficha?.precio_venta ?? '';
        return {
            nombre: ficha?.nombre || nombre,
            precio_unitario: precio === '' || precio == null ? '' : String(precio),
            cantidad: Number.isSafeInteger(Number(linea?.quantity)) && Number(linea.quantity) > 0 ? Number(linea.quantity) : 1
        };
    });

    const cliente = String(clienteDelMensaje || borrador.customer || '').trim();
    const clienteEsProducto = productoPedido && (
        sinAcentos(cliente) === sinAcentos(productoPedido)
        || (productoPedidoCatalogo && sinAcentos(cliente) === sinAcentos(productoPedidoCatalogo.nombre))
    );

    return {
        tipo: resultado?.intent === 'quick_sale' ? 'venta_rapida' : 'pedido',
        cliente: clienteEsProducto && !clienteExplicito ? '' : cliente,
        telefono: borrador.phone || '',
        fecha_entrega: esFechaISOValida(borrador.due_date) ? borrador.due_date : '',
        productos: productos.length ? productos : [{ nombre: '', precio_unitario: '', cantidad: 1 }],
        descripcion: borrador.notes || '',
        adelanto: borrador.advance == null ? '' : String(borrador.advance),
        metodo_adelanto: metodoPagoPermitido(borrador.advance_method, 'Sinpe Móvil'),
        pagado: borrador.paid == null ? '' : String(borrador.paid),
        metodo_pago: metodoPagoPermitido(borrador.payment_method, 'Efectivo')
    };
}

export { sinAcentos };
