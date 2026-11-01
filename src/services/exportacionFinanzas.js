import { collection, getDocsFromServer } from 'firebase/firestore';
import { db } from '../config/firebase';
import { obtenerFechaLocal } from '../utils/fecha';
import { formatoColones } from '../utils/formato';
import { detalleProductosPedido, obtenerProductosPedido } from '../utils/productosPedido';

const conceptoParaReporte = (movimiento) =>
    movimiento.tipo === 'salida' && movimiento.descripcion === movimiento.categoria
        ? ''
        : movimiento.descripcion || '';

/** Consulta todo desde el servidor para evitar respaldos parciales del caché. */
export async function descargarRespaldoCompleto() {
    const [XLSX, pedidosSnap, productosSnap, movimientosSnap] = await Promise.all([
        import('xlsx'),
        getDocsFromServer(collection(db, 'pedidos')),
        getDocsFromServer(collection(db, 'productos')),
        getDocsFromServer(collection(db, 'movimientos'))
    ]);

    const pedidos = pedidosSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
    const productos = productosSnap.docs.map((d) => d.data());
    const todosMovimientos = movimientosSnap.docs.map((d) => d.data());
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
            pedidos.map((p) => ({
                'Pedido ID': p.id,
                Cliente: p.cliente,
                Teléfono: p.telefono,
                Producto: p.producto,
                Productos: detalleProductosPedido(p) || p.producto,
                Descripción: p.descripcion,
                Subtotal: p.subtotal ?? p.precio ?? 0,
                'Descuento (%)': p.descuento_porcentaje ?? 0,
                'Descuento (₡)': p.descuento_monto ?? 0,
                Precio: p.precio || 0,
                Pagado: p.monto_pagado || 0,
                Estado: p.estado,
                'Fecha Solicitud': p.fecha_solicitud,
                'Fecha Entrega': p.fecha_entrega,
                'Fecha Cierre': p.fecha_cierre
            }))
        ),
        'Pedidos'
    );

    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(pedidos.flatMap((p) => obtenerProductosPedido(p).map((item) => ({
            'Pedido ID': p.id,
            Cliente: p.cliente,
            Producto: item.nombre,
            Cantidad: item.cantidad,
            'Precio unitario': item.precio_unitario,
            'Total de línea': item.total
        })))),
        'Productos por pedido'
    );

    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
            todosMovimientos.map((m) => ({
                Fecha: m.fecha,
                Tipo: m.tipo,
                Método: m.metodo_pago,
                Concepto: m.descripcion,
                Categoría: m.tipo === 'salida' ? m.categoria || '' : '',
                Entidad: m.entidad,
                Monto: m.monto || 0
            }))
        ),
        'Movimientos'
    );

    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
            productos.map((p) => ({
                Nombre: p.nombre,
                Proveedor: p.proveedor,
                Código: p.codigo_proveedor,
                Costo: p.costo || 0,
                'Precio Venta': p.precio_venta || 0
            }))
        ),
        'Catálogo'
    );

    XLSX.writeFile(wb, `Respaldo_MASUCRI_${obtenerFechaLocal()}.xlsx`);
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
        body: movimientos.map((m) => [
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

export async function descargarExcelMovimientos(movimientos) {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(
        movimientos.map((m) => ({
            Fecha: m.fecha,
            Método: m.metodo_pago || 'Manual',
            Tipo: (m.tipo || 'DESCONOCIDO').toUpperCase(),
            Categoría: m.tipo === 'salida' ? m.categoria || '' : '',
            Concepto: conceptoParaReporte(m),
            Monto: m.monto
        }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, `Finanzas_MASUCRI_${obtenerFechaLocal()}.xlsx`);
}
