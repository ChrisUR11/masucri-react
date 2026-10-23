import { ListGroup, Row, Col, Badge, Button } from 'react-bootstrap';
import { formatoColones } from '../utils/formato';
import { calcularTotalesPedido, obtenerProductosPedido } from '../utils/productosPedido';
import './FichaPedidoDetalle.css';

/**
 * Cuerpo del modal "Detalle del Pedido": cliente, producto, montos y estado de pago.
 * Antes este bloque (~60 líneas de JSX) estaba duplicado, prácticamente idéntico,
 * en Pedidos.jsx e Historial.jsx. Ahora vive en un solo lugar.
 *
 * `children` permite que cada página agregue sus propios controles adicionales
 * dentro del mismo ListGroup (ej. "Mover ficha a:" solo aplica en el tablero).
 */
export default function FichaPedidoDetalle({ pedido, badgeEstado, onWhatsApp, mostrarHistorialPagos = false, children }) {
    const deuda = (pedido.precio || 0) - (pedido.monto_pagado || 0);
    const pagos = pedido.historial_pagos || [];
    const productos = obtenerProductosPedido(pedido);
    const subtotal = calcularTotalesPedido(productos).subtotal;
    const descuentoMonto = Math.max(0, subtotal - (Number(pedido.precio) || 0));
    const descuentoPorcentaje = subtotal > 0 ? descuentoMonto / subtotal * 100 : 0;

    return (
        <>
            <div className="pedido-ficha__status text-center pb-3 pt-2 bg-light border-bottom">
                {badgeEstado}
                <p className="text-muted small mb-0">
                    Entrega pautada: <strong>{pedido.fecha_entrega || 'Sin fecha'}</strong>
                </p>
            </div>

            <ListGroup variant="flush" className="pedido-ficha__lista">
                <ListGroup.Item className="pedido-ficha__cliente py-3">
                    <div className="pedido-ficha__cliente-linea">
                        <div className="pedido-ficha__cliente-nombre">
                            <small className="text-muted d-block mb-1">Cliente</small>
                            <h5 className="fw-bold mb-1">{pedido.cliente}</h5>
                        </div>
                        {pedido.telefono && (
                            <Button
                                variant="success"
                                size="sm"
                                className="pedido-ficha__whatsapp fw-bold rounded shadow-sm mt-1"
                                onClick={onWhatsApp}
                                aria-label={`Escribir por WhatsApp a ${pedido.cliente}`}
                            >
                                <i className="fab fa-whatsapp fs-6"></i> {pedido.telefono}
                            </Button>
                        )}
                    </div>
                </ListGroup.Item>

                <ListGroup.Item className="pedido-ficha__producto py-3">
                    <small className="text-muted d-block mb-2">Productos</small>
                    {productos.map((producto, indice) => (
                        <div key={indice} className="pedido-ficha__producto-linea">
                            <div className="pedido-ficha__producto-datos">
                                <span className="fw-semibold">{producto.nombre}</span>
                                <small className="text-muted d-block">{producto.cantidad} × {formatoColones(producto.precio_unitario)}</small>
                            </div>
                            <strong>{formatoColones(producto.total)}</strong>
                        </div>
                    ))}
                    {pedido.descripcion && (
                        <div className="mt-2 pt-2 border-top">
                            <small className="text-muted d-block">Descripción interna</small>
                            <p className="small mb-0 text-break">{pedido.descripcion}</p>
                        </div>
                    )}
                </ListGroup.Item>

                <ListGroup.Item className="pedido-ficha__resumen py-3">
                    {descuentoMonto > 0 && (
                        <div className="pedido-ficha__descuento mb-2 pb-2 border-bottom small">
                            <div className="d-flex justify-content-between gap-2">
                                <span>Subtotal</span><strong>{formatoColones(subtotal)}</strong>
                            </div>
                            <div className="d-flex justify-content-between gap-2 text-success">
                                <span>Descuento ({descuentoPorcentaje.toLocaleString('es-CR', { maximumFractionDigits: 6 })}%)</span>
                                <strong>−{formatoColones(descuentoMonto)}</strong>
                            </div>
                        </div>
                    )}
                    <Row className="text-center">
                        <Col xs={6} className="border-end">
                            <small className="text-muted d-block">Total del pedido</small>
                            <span className="fw-bold fs-6">{formatoColones(pedido.precio)}</span>
                        </Col>
                        <Col xs={6}>
                            <small className="text-muted d-block">Total Pagado</small>
                            <span className="fw-bold fs-6 text-success">{formatoColones(pedido.monto_pagado)}</span>
                        </Col>
                    </Row>
                </ListGroup.Item>

                {pedido.estado === 'Cancelado' ? (
                    <ListGroup.Item className="pedido-ficha__saldo text-center bg-secondary text-white py-2">
                        <h5 className="fw-bold m-0">Pedido cancelado · saldo no aplicable</h5>
                    </ListGroup.Item>
                ) : deuda > 0 ? (
                    <ListGroup.Item className="pedido-ficha__saldo text-center bg-warning text-dark py-2">
                        <h5 className="fw-bold m-0">Debe: {formatoColones(deuda)}</h5>
                    </ListGroup.Item>
                ) : (
                    <ListGroup.Item className="pedido-ficha__saldo text-center bg-success text-white py-2">
                        <h5 className="fw-bold m-0"><i className="fas fa-check"></i> {Number(pedido.precio) > 0 ? 'Pagado' : 'Sin saldo pendiente'}</h5>
                    </ListGroup.Item>
                )}

                {mostrarHistorialPagos && pagos.length > 0 && (
                    <ListGroup.Item className="bg-light py-3">
                        <small className="fw-bold d-block mb-2 text-primary"><i className="fas fa-history"></i> Pagos Registrados</small>
                        {pagos.map((p, idx) => (
                            <div key={idx} className="d-flex flex-wrap justify-content-between gap-2 small border-bottom pb-1 mb-1">
                                <span className="text-break">{p.fecha} <Badge bg="secondary" className="ms-1">{p.metodo}</Badge></span>
                                <span className="text-success fw-bold ms-auto">{formatoColones(p.monto)}</span>
                            </div>
                        ))}
                    </ListGroup.Item>
                )}

                {children}
            </ListGroup>
        </>
    );
}
