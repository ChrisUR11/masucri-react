import { obtenerMesDeFecha } from './fecha.js';
import { obtenerProductosPedido } from './productosPedido.js';
import { esCategoriaGastoValida } from './categoriasGasto.js';

const GASTOS_AGRUPADOS_BASE = {
    'Telas': 0,
    'Sublimación': 0,
    'Transporte': 0,
    'Servicios Públicos': 0,
    'Alimentación': 0,
    'Gastos generales': 0
};

/** Clasifica un gasto en una categoría amplia para el gráfico de "Fuga de Capital". */
function categorizarGasto(descripcion, entidad) {
    const txt = `${descripcion} ${entidad}`.toLowerCase();

    if (
        txt.includes('tela') || txt.includes('aracely') || txt.includes('hilo') || txt.includes('costura') ||
        txt.includes('cinta') || txt.includes('encaje') || txt.includes('encage') || txt.includes('elástico') ||
        txt.includes('elastico') || txt.includes('pasamaneria') || txt.includes('pasamanería')
    ) return 'Telas';

    if (
        txt.includes('ubora') || txt.includes('tinta') || txt.includes('papel') || txt.includes('vinil') ||
        txt.includes('sublimac') || txt.includes('fauca') || txt.includes('cameo') || txt.includes('sticker') ||
        txt.includes('sublimaci')
    ) return 'Sublimación';

    // OJO: "transporte" y "bomba" (gasolinera) se agregaron después de revisar
    // datos reales — muchos movimientos dicen solo "Transporte" sin la palabra
    // "bus", así que antes se colaban en Gastos Generales por error.
    if (
        txt.includes('transporte') || txt.includes('bus') || txt.includes('uber') || txt.includes('gasolina') ||
        txt.includes('tren') || txt.includes('bomba')
    ) return 'Transporte';

    if (
        txt.includes('ice') || txt.includes('luz') || txt.includes('agua') || txt.includes('kolbi') ||
        txt.includes('internet') || txt.includes('municipalidad')
    ) return 'Servicios Públicos';

    // Igual que con Transporte: "alimentación" sin más palabras se estaba
    // clasificando mal porque solo se buscaba "comida" o "almuerzo".
    if (
        txt.includes('aliment') || txt.includes('comida') || txt.includes('almuerzo') || txt.includes('soda') ||
        txt.includes('macdonalds') || txt.includes('mcdonalds') || txt.includes('taco bell') || txt.includes('tacobell')
    ) return 'Alimentación';

    return 'Gastos generales';
}

/** Clasifica un producto en una categoría para el gráfico de productos solicitados. */
function categorizarProducto(nombreProducto) {
    const n = nombreProducto.toLowerCase();
    if (n.includes('pijama') || n.includes('camis') || n.includes('talla')) return 'Ropa y Textiles';
    if (n.includes('llavero') || n.includes('placa')) return 'Llaveros y Placas';
    if (n.includes('relicario') || n.includes('retablo')) return 'Regalos Especiales';
    if (n.includes('taza') || n.includes('vaso')) return 'Tazas y Vasos';
    if (n.includes('sticker') || n.includes('vinil')) return 'Vinil y Stickers';
    return 'Otros Diseños';
}

/** Media y desviación estándar poblacional de un arreglo de números. */
function estadisticasBasicas(valores) {
    if (valores.length === 0) return { media: 0, desviacion: 0 };
    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    const desviacion = Math.sqrt(valores.reduce((acc, v) => acc + (v - media) ** 2, 0) / valores.length);
    return { media, desviacion };
}

/** Un monto vacío, negativo o no finito no debe alterar la caja. */
function numeroFinito(valor) {
    if (typeof valor !== 'number' && typeof valor !== 'string') return null;
    if (typeof valor === 'string' && !valor.trim()) return null;
    const numero = Number(valor);
    return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

/** true si la fecha (YYYY-MM-DD) cae dentro del rango [inicio, fin], ambos inclusive. */
function dentroDeRango(fecha, rango) {
    // Sin fecha no es posible ubicar el registro ni siquiera en el histórico.
    if (!fecha) return false;
    if (rango.inicio && fecha < rango.inicio) return false;
    if (rango.fin && fecha > rango.fin) return false;
    return true;
}

/** Los pedidos anteriores al registro de fecha_cierre usan fecha_solicitud. */
function fechaCierrePedido(pedido) {
    return pedido.fecha_cierre || pedido.fecha_solicitud;
}

/**
 * Calcula todas las métricas del Dashboard BI a partir de pedidos y movimientos.
 *
 * Todas las métricas respetan el rango elegido. Los pedidos solicitados se
 * agrupan por fecha_solicitud; los entregados y cancelados, por fecha_cierre
 * (o fecha_solicitud si el pedido antiguo no tiene fecha_cierre). Los saldos
 * de los entregados representan el saldo actual de esa cohorte de cierres.
 * Un rango sin límites muestra todos los registros fechados del histórico.
 *
 * @param {object} rango - { inicio: 'YYYY-MM-DD'|null, fin: 'YYYY-MM-DD'|null }
 */
export function calcularMetricas(pedidos, movimientos, rango = {}) {
    const todasLasFechas = [
        ...pedidos.flatMap((p) => [p.fecha_solicitud, p.fecha_cierre]),
        ...movimientos.map((m) => m.fecha)
    ].filter(Boolean).sort();
    const minFecha = todasLasFechas[0] || 'N/A';
    const maxFecha = todasLasFechas[todasLasFechas.length - 1] || 'N/A';

    const movimientosPeriodo = movimientos.filter((m) => dentroDeRango(m.fecha, rango));
    const pedidosCreadosPeriodo = pedidos.filter((p) => dentroDeRango(p.fecha_solicitud, rango));
    const pedidosCerradosPeriodo = pedidos.filter(
        (p) => (p.estado === 'Entregado' || p.estado === 'Cancelado') &&
            dentroDeRango(fechaCierrePedido(p), rango)
    );

    // ========== MÉTRICAS DEL PERÍODO SELECCIONADO ==========
    let ingresosPeriodo = 0;
    let gastosPeriodo = 0;
    const entradasPorMetodo = {};
    const salidasPorMetodo = {};
    let totalEntradas = 0;
    let totalSalidas = 0;
    const gastosMap = {};
    const gastosAgrupados = { ...GASTOS_AGRUPADOS_BASE };

    movimientosPeriodo.forEach((m) => {
        const monto = numeroFinito(m.monto);
        if (monto === null) return;
        const metodo = m.metodo_pago || 'Desconocido';

        if (m.tipo === 'entrada') {
            ingresosPeriodo += monto;
            entradasPorMetodo[metodo] = (entradasPorMetodo[metodo] || 0) + monto;
            totalEntradas += monto;
        } else if (m.tipo === 'salida') {
            gastosPeriodo += monto;
            salidasPorMetodo[metodo] = (salidasPorMetodo[metodo] || 0) + monto;
            totalSalidas += monto;

            let entidad = (m.entidad || '').trim().toUpperCase();
            const desc = (m.descripcion || '').toLowerCase();
            if (!entidad) {
                if (desc.includes('ubora')) entidad = 'UBORA';
                else if (desc.includes('aracely') || desc.includes('tela')) entidad = 'ARACELY';
                else if (desc.includes('transporte') || desc.includes('bus') || desc.includes('uber')) entidad = 'TRANSPORTE PÚBLICO';
                else if (desc.includes('ice') || desc.includes('agua') || desc.includes('luz')) entidad = 'SERVICIOS PÚBLICOS';
                else entidad = 'OTROS';
            }
            gastosMap[entidad] = (gastosMap[entidad] || 0) + monto;

            // Las salidas nuevas llevan categoría explícita. Para los registros
            // anteriores al selector conservamos la clasificación por texto.
            const categoria = esCategoriaGastoValida(m.categoria)
                ? m.categoria
                : esCategoriaGastoValida(m.descripcion)
                    ? m.descripcion
                    : categorizarGasto(desc, entidad);
            gastosAgrupados[categoria] = (gastosAgrupados[categoria] || 0) + monto;
        }
        // Si m.tipo no es ni 'entrada' ni 'salida' (vacío, mal escrito, dato viejo),
        // no se suma a ningún lado — antes cualquier valor no-'entrada' caía aquí
        // como salida, inflando el total de gastos con datos inválidos.
    });
    Object.keys(gastosAgrupados).forEach((k) => { if (gastosAgrupados[k] === 0) delete gastosAgrupados[k]; });

    const prodMapPeriodo = {};
    const catProductos = {};
    pedidosCreadosPeriodo.forEach((p) => {
        // Los productos anulados no cuentan como pedidos vigentes o entregados.
        if (p.estado === 'Cancelado') return;
        // Cada producto y categoría cuentan una vez por pedido, incluso si
        // hay varias líneas iguales. Los pedidos anteriores usan p.producto.
        const nombres = new Set(obtenerProductosPedido(p)
            .map(({ nombre }) => nombre.replace(/\s+/g, ' ').trim().toUpperCase())
            .filter(Boolean));
        const categorias = new Set();
        nombres.forEach((nombre) => {
            prodMapPeriodo[nombre] = (prodMapPeriodo[nombre] || 0) + 1;
            categorias.add(categorizarProducto(nombre));
        });
        categorias.forEach((categoria) => {
            catProductos[categoria] = (catProductos[categoria] || 0) + 1;
        });
    });

    const entregadosPeriodo = pedidosCerradosPeriodo.filter((p) => p.estado === 'Entregado').length;
    const anuladosPeriodo = pedidosCerradosPeriodo.length - entregadosPeriodo;

    // ========== MÉTRICAS DE CLIENTES Y EVOLUCIÓN DEL PERÍODO ==========
    const crmMap = {};
    const ingresosPorMes = {};
    const pedidosPorMes = {};
    let pagados100 = 0;
    let conDeuda = 0;
    const deudores = [];

    movimientosPeriodo.forEach((m) => {
        if (m.tipo === 'entrada') {
            const monto = numeroFinito(m.monto);
            if (monto === null) return;
            const mesMov = obtenerMesDeFecha(m.fecha);
            if (mesMov) ingresosPorMes[mesMov] = (ingresosPorMes[mesMov] || 0) + monto;
        }
    });

    pedidosCreadosPeriodo.forEach((p) => {
        if (p.estado === 'Cancelado') return;
        const mesPed = obtenerMesDeFecha(p.fecha_solicitud);
        if (mesPed) pedidosPorMes[mesPed] = (pedidosPorMes[mesPed] || 0) + 1;

        if (p.cliente) {
            const idUnico = p.telefono ? p.telefono.replace(/[\s-]/g, '') : p.cliente.trim().toUpperCase();
            if (!crmMap[idUnico]) {
                crmMap[idUnico] = { nombre: p.cliente.trim(), telefono: p.telefono || '', compras: 0, monto: 0, ultima: '' };
            }
            crmMap[idUnico].compras += 1;
            crmMap[idUnico].monto += (numeroFinito(p.precio) ?? 0);
            if (p.fecha_solicitud > crmMap[idUnico].ultima) crmMap[idUnico].ultima = p.fecha_solicitud;
        }
    });

    pedidosCerradosPeriodo.forEach((p) => {
        if (p.estado !== 'Entregado') return;
        const precio = numeroFinito(p.precio);
        if (precio === null) return;
        const deuda = precio - (numeroFinito(p.monto_pagado) ?? 0);
        if (deuda > 0) {
            conDeuda++;
            deudores.push({ cliente: p.cliente, debe: deuda });
        } else {
            pagados100++;
        }
    });

    // --- Volatilidad de ingresos del período seleccionado ---
    const valsIngresos = Object.values(ingresosPorMes);
    const { media: volMedia, desviacion: volDesv } = estadisticasBasicas(valsIngresos);
    const hasVol = valsIngresos.length >= 2;
    const volCoef = hasVol && volMedia > 0 ? volDesv / volMedia : 0;

    let volStatus = 'Requiere 2 meses';
    let volColor = 'secondary';
    let volMsg = '';
    if (hasVol) {
        if (volMedia <= 0) { volStatus = 'Sin entradas'; volColor = 'secondary'; volMsg = 'No hay entradas positivas para comparar.'; }
        else if (volCoef > 0.4) { volStatus = 'Variación alta'; volColor = 'danger'; volMsg = 'Las entradas cambian mucho entre meses.'; }
        else if (volCoef > 0.15) { volStatus = 'Variación moderada'; volColor = 'warning text-dark'; volMsg = 'Las entradas muestran cambios moderados.'; }
        else { volStatus = 'Variación baja'; volColor = 'success'; volMsg = 'Las entradas muestran poca variación.'; }
    }

    const valsPedidos = Object.values(pedidosPorMes);
    const { media: pedMedia, desviacion: pedDesv } = estadisticasBasicas(valsPedidos);
    const totalCerrados = entregadosPeriodo + anuladosPeriodo;
    const tasaCanc = totalCerrados > 0 ? ((anuladosPeriodo / totalCerrados) * 100).toFixed(1) : '0.0';

    deudores.sort((a, b) => b.debe - a.debe);

    return {
        minFecha, maxFecha,

        // --- del período seleccionado ---
        utilidad: ingresosPeriodo - gastosPeriodo, ingresosPeriodo, gastosPeriodo,
        entradasPorMetodo, salidasPorMetodo, totalEntradas, totalSalidas,
        topGastos: Object.entries(gastosMap).sort((a, b) => b[1] - a[1]).slice(0, 3),
        topProd: Object.entries(prodMapPeriodo).sort((a, b) => b[1] - a[1]).slice(0, 5),
        catProductos, gastosAgrupados,
        entregadosPeriodo, anuladosPeriodo,

        // --- clientes, evolución y saldos de la cohorte del período ---
        topClientes: Object.entries(crmMap).sort((a, b) => b[1].monto - a[1].monto).slice(0, 5),
        volMedia, volDesv, volStatus, volColor, volMsg, hasVol,
        pagados100, conDeuda, pedMedia, pedDesv, tasaCanc,
        mayorDeudor: deudores[0] || null
    };
}
