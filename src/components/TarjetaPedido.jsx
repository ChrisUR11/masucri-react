import { Badge, Button, Card } from 'react-bootstrap';
import { diasHastaEntrega, formatearFechaCorta } from '../utils/fecha';
import { formatoColones } from '../utils/formato';

function colorPorEntrega(fechaEntrega) {
    const dias = diasHastaEntrega(fechaEntrega);
    if (dias === null) return 'border-secondary';
    if (dias <= 0) return 'border-danger bg-danger-subtle';
    if (dias <= 2) return 'order-soon bg-warning-subtle';
    if (dias <= 5) return 'border-info bg-info-subtle';
    return 'border-success bg-success-subtle';
}

export default function TarjetaPedido({ pedido, onDragStart, onVerDetalle, onEditar }) {
    const deuda = (pedido.precio || 0) - (pedido.monto_pagado || 0);
    const sinCargoPorDescuento = Number(pedido.subtotal) > 0 && Number(pedido.precio) === 0;

    return (
        <Card
            className={`production-order-card mb-2 shadow-sm border-start border-4 ${colorPorEntrega(pedido.fecha_entrega)}`}
            draggable
            onDragStart={(event) => onDragStart(event, pedido.id)}
            style={{ cursor: 'grab' }}
        >
            <Card.Body className="p-2" onClick={() => onVerDetalle(pedido)}>
                <div className="d-flex justify-content-between">
                    <strong className="text-truncate">{pedido.cliente}</strong>
                    <small className="text-muted fw-bold">{formatearFechaCorta(pedido.fecha_entrega)}</small>
                </div>
                <p className="small mb-1 text-truncate">{pedido.producto}</p>
                <div className="d-flex justify-content-between align-items-center mt-2">
                    <Badge bg={deuda > 0 ? 'warning' : pedido.precio || sinCargoPorDescuento ? 'success' : 'secondary'} className="text-dark">
                        {deuda > 0 ? `Debe ${formatoColones(deuda)}` : sinCargoPorDescuento ? 'Descuento total' : pedido.precio ? 'Pagado' : 'Sin precio'}
                    </Badge>
                    <div className="d-flex gap-1">
                        <Button
                            variant="light"
                            size="sm"
                            className="border shadow-sm"
                            aria-label={`Ver detalle del pedido de ${pedido.cliente}`}
                            onClick={(event) => {
                                event.stopPropagation();
                                onVerDetalle(pedido);
                            }}
                        >
                            <i className="fas fa-eye text-primary" aria-hidden="true"></i>
                        </Button>
                        <Button
                            variant="light"
                            size="sm"
                            className="border shadow-sm"
                            aria-label={`Editar pedido de ${pedido.cliente}`}
                            onClick={(event) => {
                                event.stopPropagation();
                                onEditar(pedido);
                            }}
                        >
                            <i className="fas fa-pen text-secondary" aria-hidden="true"></i>
                        </Button>
                    </div>
                </div>
            </Card.Body>
        </Card>
    );
}
