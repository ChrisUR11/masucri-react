import { ListGroup, Row, Col, Badge, Button } from 'react-bootstrap';
import { formatoColones } from '../utils/formato';

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

    return (
        <>
            <div className="text-center pb-3 pt-2 bg-light border-bottom">
                {badgeEstado}
                <p className="text-muted small mb-0">
                    Entrega pautada: <strong>{pedido.fecha_entrega || 'Sin fecha'}</strong>
                </p>
            </div>

            <ListGroup variant="flush">
                <ListGroup.Item className="py-3">
                    <small className="text-muted d-block mb-1">Cliente</small>
                    <h5 className="fw-bold mb-1">{pedido.cliente}</h5>
                    {pedido.telefono && (
                        <Button
                            variant="success"
                            size="sm"
                            className="fw-bold rounded shadow-sm mt-1"
                            onClick={onWhatsApp}
                            aria-label={`Escribir por WhatsApp a ${pedido.cliente}`}
                        >
                            <i className="fab fa-whatsapp fs-6"></i> {pedido.telefono}
                        </Button>
                    )}
                </ListGroup.Item>

                <ListGroup.Item className="py-3">
                    <small className="text-muted d-block mb-1">Producto</small>
                    <h6 className="fw-bold mb-1">{pedido.producto}</h6>
                    {pedido.descripcion && <p className="small text-muted mb-0 mt-1">{pedido.descripcion}</p>}
                </ListGroup.Item>

                <ListGroup.Item className="py-3">
                    <Row className="text-center">
                        <Col xs={6} className="border-end">
                            <small className="text-muted d-block">Precio Total</small>
                            <span className="fw-bold fs-6">{formatoColones(pedido.precio)}</span>
                        </Col>
                        <Col xs={6}>
                            <small className="text-muted d-block">Total Pagado</small>
                            <span className="fw-bold fs-6 text-success">{formatoColones(pedido.monto_pagado)}</span>
                        </Col>
                    </Row>
                </ListGroup.Item>

                {deuda > 0 ? (
                    <ListGroup.Item className="text-center bg-warning text-dark py-2">
                        <h5 className="fw-bold m-0">Debe: {formatoColones(deuda)}</h5>
                    </ListGroup.Item>
                ) : (
                    <ListGroup.Item className="text-center bg-success text-white py-2">
                        <h5 className="fw-bold m-0"><i className="fas fa-check"></i> Pagado</h5>
                    </ListGroup.Item>
                )}

                {mostrarHistorialPagos && pagos.length > 0 && (
                    <ListGroup.Item className="bg-light py-3">
                        <small className="fw-bold d-block mb-2 text-primary"><i className="fas fa-history"></i> Pagos Registrados</small>
                        {pagos.map((p, idx) => (
                            <div key={idx} className="d-flex justify-content-between small border-bottom pb-1 mb-1">
                                <span>{p.fecha} <Badge bg="secondary" className="ms-1">{p.metodo}</Badge></span>
                                <span className="text-success fw-bold">{formatoColones(p.monto)}</span>
                            </div>
                        ))}
                    </ListGroup.Item>
                )}

                {children}
            </ListGroup>
        </>
    );
}
