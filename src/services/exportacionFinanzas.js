import { collection, getDocsFromServer } from 'firebase/firestore';
import { db } from '../config/firebase';
import { obtenerFechaLocal } from '../utils/fecha';
import { formatoColones } from '../utils/formato';
import { detalleProductosPedido, obtenerProductosPedido } from '../utils/productosPedido';

const conceptoParaReporte = (movimiento) =>
    movimiento.tipo === 'salida' && movimiento.descripcion === movimiento.categoria
        ? ''
        : movimiento.descripcion || '';

const valorCelda = (valor) => {
    if (valor == null) return null;
    if (typeof valor.toDate === 'function') return valor.toDate().toISOString();
    if (valor instanceof Date) return valor.toISOString();
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
    if (typeof valor === 'string' || typeof valor === 'boolean') return valor;
    return String(valor);
};

const crearHoja = (sheet, columnas, filas) => ({
    sheet,
    data: [columnas, ...filas.map((fila) => fila.map(valorCelda))]
});

/** Prepara las hojas sin consultar Firestore ni iniciar una descarga. */
export function construirHojasRespaldo(pedidos, productos, todosMovimientos) {
    const movimientosActivos = todosMovimientos.filter((movimiento) => !movimiento.anulado);
    const movimientosAnulados = todosMovimientos.filter((movimiento) => movimiento.anulado);

    return [
        crearHoja('Pedidos', [
            'Pedido ID', 'Cliente', 'Teléfono', 'Producto', 'Productos', 'Descripción',
            'Subtotal', 'Descuento (%)', 'Descuento (₡)', 'Precio', 'Pagado', 'Estado',
            'Fecha Solicitud', 'Fecha Entrega', 'Fecha Cierre'
        ], pedidos.map((p) => [
            p.id, p.cliente, p.telefono, p.producto,
            detalleProductosPedido(p) || p.producto, p.descripcion,
            p.subtotal ?? p.precio ?? 0, p.descuento_porcentaje ?? 0,
            p.descuento_monto ?? 0, p.precio || 0, p.monto_pagado || 0,
            p.estado, p.fecha_solicitud, p.fecha_entrega, p.fecha_cierre
        ])),
        crearHoja('Productos por pedido', [
            'Pedido ID', 'Cliente', 'Producto', 'Cantidad', 'Precio unitario', 'Total de línea'
        ], pedidos.flatMap((p) => obtenerProductosPedido(p).map((item) => [
            p.id, p.cliente, item.nombre, item.cantidad, item.precio_unitario, item.total
        ]))),
        crearHoja('Movimientos', [
            'Fecha', 'Tipo', 'Método', 'Concepto', 'Categoría', 'Entidad', 'Monto'
        ], movimientosActivos.map((m) => [
            m.fecha, m.tipo, m.metodo_pago, m.descripcion,
            m.tipo === 'salida' ? m.categoria || '' : '', m.entidad, m.monto || 0
        ])),
        crearHoja('Abonos anulados', [
            'Movimiento ID', 'Pedido ID', 'Fecha', 'Método', 'Concepto',
            'Monto original', 'Motivo', 'Anulado en', 'Anulado por', 'Reemplazado por'
        ], movimientosAnulados.map((m) => [
            m.id, m.pedido_id || '', m.fecha, m.metodo_pago, m.descripcion,
            m.monto, m.motivo_anulacion || '', m.anulado_en || null,
            m.anulado_por || '', m.reemplazado_por || ''
        ])),
        crearHoja('Catálogo', [
            'Nombre', 'Proveedor', 'Código', 'Costo', 'Precio Venta'
        ], productos.map((p) => [
            p.nombre, p.proveedor, p.codigo_proveedor,
            p.precio_costo ?? p.costo ?? null, p.precio_venta ?? null
        ]))
    ];
}

/** Consulta todo desde el servidor para evitar respaldos parciales del caché. */
export async function descargarRespaldoCompleto() {
    const [{ default: writeExcelFile }, pedidosSnap, productosSnap, movimientosSnap] = await Promise.all([
        import('write-excel-file/browser'),
        getDocsFromServer(collection(db, 'pedidos')),
        getDocsFromServer(collection(db, 'productos')),
        getDocsFromServer(collection(db, 'movimientos'))
    ]);

    const pedidos = pedidosSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
    const productos = productosSnap.docs.map((d) => d.data());
    const todosMovimientos = movimientosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const hojas = construirHojasRespaldo(pedidos, productos, todosMovimientos);
    await writeExcelFile(hojas).toFile(`Respaldo_MASUCRI_${obtenerFechaLocal()}.xlsx`);
}

export async function descargarPDFMovimientos(movimientos) {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
    ]);
    const docPDF = new jsPDF();
    docPDF.text('Reporte Contable - MASUCRI', 14, 15);
    autoTable(docPDF, {
        head: [['Fecha', 'Método', 'Tipo', 'Categoría', 'Concepto', 'Monto']],
        body: movimientos.filter((m) => !m.anulado).map((m) => [
            m.fecha,
            m.metodo_pago || 'Manual',
            (m.tipo || 'DESCONOCIDO').toUpperCase(),
            m.tipo === 'salida' ? m.categoria || '' : '',
            conceptoParaReporte(m),
            formatoColones(m.monto)
        ]),
        startY: 28
    });
    docPDF.save(`Finanzas_MASUCRI_${obtenerFechaLocal()}.pdf`);
}

export function construirHojaExcelMovimientos(movimientos) {
    return crearHoja('Datos', [
        'Fecha', 'Método', 'Tipo', 'Categoría', 'Concepto', 'Monto'
    ], movimientos.filter((m) => !m.anulado).map((m) => [
        m.fecha,
        m.metodo_pago || 'Manual',
        (m.tipo || 'DESCONOCIDO').toUpperCase(),
        m.tipo === 'salida' ? m.categoria || '' : '',
        conceptoParaReporte(m),
        m.monto
    ]));
}

export async function descargarExcelMovimientos(movimientos) {
    const { default: writeExcelFile } = await import('write-excel-file/browser');
    const hoja = construirHojaExcelMovimientos(movimientos);
    await writeExcelFile(hoja.data, { sheet: hoja.sheet })
        .toFile(`Finanzas_MASUCRI_${obtenerFechaLocal()}.xlsx`);
}
