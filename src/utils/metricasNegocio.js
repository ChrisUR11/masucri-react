import { obtenerMesDeFecha } from './fecha';

const GASTOS_AGRUPADOS_BASE = {
    'Telas y Costura': 0,
    'Suministros (Sublimación)': 0,
    'Transporte': 0,
    'Servicios Públicos': 0,
    'Alimentación': 0,
    'Gastos Generales': 0
};

/** Clasifica un gasto en una categoría amplia para el gráfico de "Fuga de Capital". */
function categorizarGasto(descripcion, entidad) {
    const txt = `${descripcion} ${entidad}`.toLowerCase();

    if (
        txt.includes('tela') || txt.includes('aracely') || txt.includes('hilo') || txt.includes('costura') ||
        txt.includes('cinta') || txt.includes('encaje') || txt.includes('encage') || txt.includes('elástico') ||
        txt.includes('elastico') || txt.includes('pasamaneria') || txt.includes('pasamanería')
    ) return 'Telas y Costura';

    if (
        txt.includes('ubora') || txt.includes('tinta') || txt.includes('papel') || txt.includes('vinil') ||
        txt.includes('sublimac') || txt.includes('fauca') || txt.includes('cameo') || txt.includes('sticker') ||
        txt.includes('sublimaci')
    ) return 'Suministros (Sublimación)';

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

    return 'Gastos Generales';
}

/** Clasifica un producto en una categoría para el gráfico de "Productos más vendidos". */
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

/** true si la fecha (YYYY-MM-DD) cae dentro del rango [inicio, fin], ambos inclusive. */
function dentroDeRango(fecha, rango) {
    if (!fecha) return false;
    if (rango.inicio && fecha < rango.inicio) return false;
    if (rango.fin && fecha > rango.fin) return false;
    return true;
}

/**
 * Calcula todas las métricas del Dashboard BI a partir de pedidos y movimientos.
 *
 * Hay dos tipos de métricas:
 * - "Del período": responden a "¿cómo me fue en [rango elegido]?" (utilidad,
 *   gastos, productos más vendidos, métodos de pago). Se recalculan según
 *   el `rango` que se les pase.
 * - "Históricas": tienen sentido solo mirando todo el negocio de una vez
 *   (mejores clientes de siempre, qué tan estables son los ingresos mes a
 *   mes, quién debe más dinero ahora mismo). Estas siempre usan todos los
 *   datos, sin importar el rango seleccionado — filtrarlas le quitaría el
 *   sentido (ej. "mejor cliente histórico" solo del mes pasado no dice mucho).
 *
 * @param {object} rango - { inicio: 'YYYY-MM-DD'|null, fin: 'YYYY-MM-DD'|null }
 */
export function calcularMetricas(pedidos, movimientos, rango = {}) {
    const todasLasFechas = [...pedidos.map((p) => p.fecha_solicitud), ...movimientos.map((m) => m.fecha)].filter(Boolean).sort();
    const minFecha = todasLasFechas[0] || 'N/A';
    const maxFecha = todasLasFechas[todasLasFechas.length - 1] || 'N/A';

    const movimientosPeriodo = movimientos.filter((m) => dentroDeRango(m.fecha, rango));
    const pedidosPeriodo = pedidos.filter((p) => dentroDeRango(p.fecha_solicitud, rango));

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
        const monto = m.monto || 0;
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

            const categoria = categorizarGasto(desc, entidad);
            gastosAgrupados[categoria] += monto;
        }
        // Si m.tipo no es ni 'entrada' ni 'salida' (vacío, mal escrito, dato viejo),
        // no se suma a ningún lado — antes cualquier valor no-'entrada' caía aquí
        // como salida, inflando el total de gastos con datos inválidos.
    });
    Object.keys(gastosAgrupados).forEach((k) => { if (gastosAgrupados[k] === 0) delete gastosAgrupados[k]; });

    const prodMapPeriodo = {};
    const catProductos = {};
    let entregadosPeriodo = 0;
    let anuladosPeriodo = 0;

    pedidosPeriodo.forEach((p) => {
        if (p.estado === 'Cancelado') {
            anuladosPeriodo++;
            return;
        }
        if (p.estado === 'Entregado') entregadosPeriodo++;

        if (p.producto) {
            const nombre = p.producto.trim().toUpperCase();
            prodMapPeriodo[nombre] = (prodMapPeriodo[nombre] || 0) + 1;
            catProductos[categorizarProducto(nombre)] = (catProductos[categorizarProducto(nombre)] || 0) + 1;
        }
    });

    // ========== MÉTRICAS HISTÓRICAS (todo el tiempo, ignoran el rango) ==========
    const crmMap = {};
    const ingresosPorMes = {};
    const pedidosPorMes = {};
    let anuladosHist = 0;
    let entregadosHist = 0;
    let pagados100 = 0;
    let conDeuda = 0;
    const deudores = [];
    let totalTrabajosHist = 0;

    movimientos.forEach((m) => {
        if (m.tipo === 'entrada') {
            const mesMov = obtenerMesDeFecha(m.fecha);
            if (mesMov) ingresosPorMes[mesMov] = (ingresosPorMes[mesMov] || 0) + (m.monto || 0);
        }
    });

    pedidos.forEach((p) => {
        if (p.estado === 'Cancelado') {
            anuladosHist++;
            return;
        }

        totalTrabajosHist++;
        const mesPed = obtenerMesDeFecha(p.fecha_solicitud);
        if (mesPed) pedidosPorMes[mesPed] = (pedidosPorMes[mesPed] || 0) + 1;

        const deuda = (p.precio || 0) - (p.monto_pagado || 0);
        if (p.estado === 'Entregado') {
            entregadosHist++;
            if (deuda > 0) {
                conDeuda++;
                deudores.push({ cliente: p.cliente, debe: deuda });
            } else {
                pagados100++;
            }
        }

        if (p.cliente) {
            const idUnico = p.telefono ? p.telefono.replace(/[\s-]/g, '') : p.cliente.trim().toUpperCase();
            if (!crmMap[idUnico]) {
                crmMap[idUnico] = { nombre: p.cliente.trim(), telefono: p.telefono || '', compras: 0, monto: 0, ultima: '2000-01-01' };
            }
            crmMap[idUnico].compras += 1;
            crmMap[idUnico].monto += p.precio || 0;
            if (p.fecha_solicitud > crmMap[idUnico].ultima) crmMap[idUnico].ultima = p.fecha_solicitud;
        }
    });

    // --- Volatilidad de ingresos (necesita historial completo para comparar meses) ---
    const valsIngresos = Object.values(ingresosPorMes);
    const { media: volMedia, desviacion: volDesv } = estadisticasBasicas(valsIngresos);
    const hasVol = valsIngresos.length >= 2;
    // Guarda: si el promedio es 0 (meses sin ingresos), el coeficiente de
    // variación no está definido — evitamos NaN/Infinity tratándolo como alta volatilidad.
    const volCoef = hasVol && volMedia > 0 ? volDesv / volMedia : hasVol ? Infinity : 0;

    let volStatus = 'Requiere 2 meses';
    let volColor = 'secondary';
    let volMsg = '';
    if (hasVol) {
        if (volCoef > 0.4) { volStatus = 'Alta Volatilidad'; volColor = 'danger'; volMsg = 'Requiere fondo de emergencia.'; }
        else if (volCoef > 0.15) { volStatus = 'Moderada'; volColor = 'warning text-dark'; volMsg = 'Flujo de caja normal.'; }
        else { volStatus = 'Ingresos Estables'; volColor = 'success'; volMsg = 'Ventas predecibles.'; }
    }

    const valsPedidos = Object.values(pedidosPorMes);
    const { media: pedMedia, desviacion: pedDesv } = estadisticasBasicas(valsPedidos);
    const totalConsiderado = totalTrabajosHist + anuladosHist;
    const tasaCanc = totalConsiderado > 0 ? ((anuladosHist / totalConsiderado) * 100).toFixed(1) : '0.0';

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

        // --- históricas (todo el negocio, sin filtrar) ---
        topClientes: Object.entries(crmMap).sort((a, b) => b[1].monto - a[1].monto).slice(0, 5),
        volMedia, volDesv, volStatus, volColor, volMsg, hasVol,
        pagados100, conDeuda, pedMedia, pedDesv, tasaCanc,
        mayorDeudor: deudores[0] || null
    };
}
