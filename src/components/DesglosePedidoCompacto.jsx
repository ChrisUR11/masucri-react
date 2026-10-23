import { formatoColones } from '../utils/formato';
import { calcularTotalesPedido, detalleProductosPedido, obtenerProductosPedido } from '../utils/productosPedido';

/** Desglose bajo demanda para las tablas del historial de un cliente. */
export default function DesglosePedidoCompacto({ pedido }) {
    const productos = obtenerProductosPedido(pedido);
    const subtotal = calcularTotalesPedido(productos).subtotal;
    const descuento = Math.max(0, subtotal - (Number(pedido.precio) || 0));
    const resumen = detalleProductosPedido(pedido) || pedido.producto || 'Producto no indicado';
    if (productos.length <= 1 && productos[0]?.cantidad === 1 && descuento === 0) return resumen;

    return (
        <details className="text-break">
            <summary className="fw-bold" style={{ cursor: 'pointer' }}>{resumen}</summary>
            <div className="small fw-normal mt-2">
                {productos.map((item, indice) => (
                    <div key={indice} className="d-flex flex-wrap justify-content-between gap-2 mb-1">
                        <span className="text-break">{item.cantidad} × {item.nombre} ({formatoColones(item.precio_unitario)} c/u)</span>
                        <strong className="ms-auto">{formatoColones(item.total)}</strong>
                    </div>
                ))}
                {descuento > 0 && (
                    <>
                        <div className="d-flex justify-content-between gap-2 border-top pt-1"><span>Subtotal</span><span>{formatoColones(subtotal)}</span></div>
                        <div className="d-flex justify-content-between gap-2 text-success"><span>Descuento</span><span>−{formatoColones(descuento)}</span></div>
                    </>
                )}
            </div>
        </details>
    );
}
