import { Modal, Row, Col, Card, Badge, Table } from 'react-bootstrap';
import { obtenerHistorialCliente } from '../utils/historialClientes';
import { formatoColones } from '../utils/formato';

export default function ModalHistorialCliente({ show, cliente, pedidos, onHide }) {
    if (!cliente || !show) return null;

    const historial = obtenerHistorialCliente(cliente, pedidos);
    if (!historial) return null;

    const { totalPedidos, totalGastado, totalPagado, deudaActual, ultimaPedido, primerPedido, promedioDias, diasDeuda, pedidosCliente } = historial;

    return (
        <Modal show={show} onHide={onHide} size="lg" centered>
            <Modal.Header closeButton>
                <Modal.Title>👤 Historial: {cliente}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {/* RESUMEN DE MÉTRICAS */}
                <Row className="mb-4">
                    <Col sm={6} className="mb-3">
                        <Card className="border-0 bg-light">
                            <Card.Body className="small">
                                <p className="text-muted mb-1">Pedidos Totales</p>
                                <h4 className="fw-bold text-primary m-0">{totalPedidos}</h4>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col sm={6} className="mb-3">
                        <Card className="border-0 bg-light">
                            <Card.Body className="small">
                                <p className="text-muted mb-1">Total Gastado</p>
                                <h4 className="fw-bold text-success m-0">{formatoColones(totalGastado)}</h4>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col sm={6} className="mb-3">
                        <Card className="border-0 bg-light">
                            <Card.Body className="small">
                                <p className="text-muted mb-1">Total Pagado</p>
                                <h4 className="fw-bold text-info m-0">{formatoColones(totalPagado)}</h4>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col sm={6} className="mb-3">
                        <Card className="border-0 bg-light">
                            <Card.Body className="small">
                                <p className="text-muted mb-1">Deuda Actual</p>
                                <h4 className={`fw-bold m-0 ${deudaActual > 0 ? 'text-danger' : 'text-success'}`}>
                                    {formatoColones(deudaActual)}
                                </h4>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>

                {/* INFORMACIÓN DE COMPORTAMIENTO */}
                <Card className="border-0 bg-light mb-4">
                    <Card.Body className="small">
                        <Row>
                            <Col md={6}>
                                <p className="text-muted mb-2">
                                    <strong>Promedio entre pedidos:</strong> {promedioDias} días
                                </p>
                                <p className="text-muted mb-0">
                                    <strong>Primer pedido:</strong> {primerPedido?.fecha_solicitud || '-'}
                                </p>
                            </Col>
                            <Col md={6}>
                                <p className="text-muted mb-2">
                                    <strong>Último pedido:</strong> {ultimaPedido?.fecha_solicitud || '-'}
                                </p>
                                {deudaActual > 0 && (
                                    <p className="text-danger mb-0">
                                        <strong>Días sin pagar:</strong> {diasDeuda} días
                                    </p>
                                )}
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {/* LISTA DE PEDIDOS */}
                <h6 className="fw-bold mb-3">Todos los Pedidos ({pedidosCliente.length})</h6>
                {pedidosCliente.length === 0 ? (
                    <p className="text-muted small">Sin pedidos registrados.</p>
                ) : (
                    <div className="table-responsive">
                        <Table striped hover size="sm" className="mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th>Fecha</th>
                                    <th>Producto</th>
                                    <th>Precio</th>
                                    <th>Pagado</th>
                                    <th>Saldo</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pedidosCliente.map((p) => {
                                    const saldo = (p.precio || 0) - (p.monto_pagado || 0);
                                    return (
                                        <tr key={p.id}>
                                            <td className="small">{p.fecha_solicitud}</td>
                                            <td className="small fw-bold">{p.producto}</td>
                                            <td className="small">{formatoColones(p.precio || 0)}</td>
                                            <td className="small text-success">{formatoColones(p.monto_pagado || 0)}</td>
                                            <td className={`small fw-bold ${saldo > 0 ? 'text-danger' : 'text-success'}`}>
                                                {formatoColones(saldo)}
                                            </td>
                                            <td className="small">
                                                <Badge bg={p.estado === 'Entregado' ? 'success' : p.estado === 'Pendiente' ? 'warning' : 'secondary'}>
                                                    {p.estado}
                                                </Badge>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </Table>
                    </div>
                )}
            </Modal.Body>
        </Modal>
    );
}
