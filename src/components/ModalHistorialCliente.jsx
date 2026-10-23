import { Modal, Row, Col, Card, Badge, Table } from 'react-bootstrap';
import { obtenerHistorialCliente } from '../utils/historialClientes';
import { formatoColones } from '../utils/formato';
import DesglosePedidoCompacto from './DesglosePedidoCompacto';

export default function ModalHistorialCliente({ show, cliente, pedidos, onHide }) {
    if (!cliente || !show) return null;

    const historial = obtenerHistorialCliente(cliente, pedidos);
    if (!historial) return null;

    const { totalPedidos, totalGastado, totalPagado, saldoEntregado, saldoActivo, ultimaPedido, primerPedido, promedioDias, diasDeuda, pedidosCliente } = historial;

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
                                <p className="text-muted mb-1">Valor de pedidos no cancelados</p>
                                <h4 className="fw-bold text-primary m-0">{formatoColones(totalGastado)}</h4>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col sm={6} className="mb-3">
                        <Card className="border-0 bg-light">
                            <Card.Body className="small">
                                <p className="text-muted mb-1">Abonado en pedidos no cancelados</p>
                                <h4 className="fw-bold text-success m-0">{formatoColones(totalPagado)}</h4>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col sm={6} className="mb-3">
                        <Card className="border-0 bg-light">
                            <Card.Body className="small">
                                <p className="text-muted mb-1">Por cobrar de entregados</p>
                                <h4 className={`fw-bold m-0 ${saldoEntregado > 0 ? 'text-danger' : 'text-success'}`}>{formatoColones(saldoEntregado)}</h4>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col sm={6} className="mb-3">
                        <Card className="border-0 bg-light">
                            <Card.Body className="small">
                                <p className="text-muted mb-1">Saldo de pedidos activos</p>
                                <h4 className="fw-bold text-primary m-0">{formatoColones(saldoActivo)}</h4>
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
                                <p className="text-muted mb-2">
                                    <strong>Pedidos registrados:</strong> {totalPedidos}
                                </p>
                                <p className="text-muted mb-0">
                                    <strong>Primer pedido:</strong> {primerPedido?.fecha_solicitud || '-'}
                                </p>
                            </Col>
                            <Col md={6}>
                                <p className="text-muted mb-2">
                                    <strong>Último pedido:</strong> {ultimaPedido?.fecha_solicitud || '-'}
                                </p>
                                {saldoEntregado > 0 && (
                                    <p className="text-danger mb-0">
                                        <strong>Antigüedad del saldo:</strong>{' '}
                                        {diasDeuda == null ? 'falta fecha de cierre' : `${diasDeuda} días desde la entrega`}
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
                    <div className="table-responsive mobile-card-table-wrap">
                        <Table striped hover size="sm" className="mobile-card-table mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th>Fecha</th>
                                    <th>Productos</th>
                                    <th>Precio</th>
                                    <th>Pagado</th>
                                    <th>Saldo</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pedidosCliente.map((p) => {
                                    const saldo = Math.max(0, (Number(p.precio) || 0) - (Number(p.monto_pagado) || 0));
                                    return (
                                        <tr key={p.id}>
                                            <td data-label="Fecha" className="small">{p.fecha_solicitud}</td>
                                            <td data-label="Productos" className="small"><div className="mobile-table-value text-break"><DesglosePedidoCompacto pedido={p} /></div></td>
                                            <td data-label="Precio" className="small">{formatoColones(p.precio || 0)}</td>
                                            <td data-label="Pagado" className="small text-success">{formatoColones(p.monto_pagado || 0)}</td>
                                            <td data-label="Saldo" className={`small fw-bold ${p.estado === 'Cancelado' ? 'text-muted' : saldo > 0 ? 'text-danger' : 'text-success'}`}>
                                                {p.estado === 'Cancelado' ? 'No aplica (cancelado)' : formatoColones(saldo)}
                                            </td>
                                            <td data-label="Estado" className="small">
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
