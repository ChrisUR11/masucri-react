import { useState, useMemo } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Container, Row, Col, Card, Button, Form, Badge, Table } from 'react-bootstrap';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { obtenerHistorialCliente } from '../utils/historialClientes';
import EstadoCarga, { EstadoError } from '../components/EstadoCarga';
import { formatoColones } from '../utils/formato';

export default function HistorialCliente() {
    const { datos: pedidos, cargando, error } = useFirestoreCollection(
        () => query(collection(db, 'pedidos'), orderBy('fecha_solicitud', 'desc')),
        []
    );

    const [clienteSeleccionado, setClienteSeleccionado] = useState('');
    const [filtroPedidosEstado, setFiltroPedidosEstado] = useState('');

    // Lista de clientes únicos
    const clientes = useMemo(() => {
        const clientesSet = new Set(pedidos.map((p) => p.cliente).filter(Boolean));
        return Array.from(clientesSet).sort();
    }, [pedidos]);

    // Obtener historial del cliente seleccionado
    const historial = useMemo(() => {
        if (!clienteSeleccionado) return null;
        return obtenerHistorialCliente(clienteSeleccionado, pedidos);
    }, [clienteSeleccionado, pedidos]);

    // Filtrar pedidos del cliente
    const pedidosFiltrados = useMemo(() => {
        if (!historial) return [];
        let lista = historial.pedidosCliente;
        if (filtroPedidosEstado) {
            lista = lista.filter((p) => p.estado === filtroPedidosEstado);
        }
        return lista;
    }, [historial, filtroPedidosEstado]);

    if (error) return <EstadoError texto="No se pudo cargar el historial." />;
    if (cargando) return <EstadoCarga texto="Cargando pedidos..." />;

    return (
        <Container className="pb-5">
            <h3 className="fw-bold mb-4">Historial de Clientes</h3>

            <Row className="mb-4">
                <Col md={6}>
                    <Form.Group>
                        <Form.Label className="fw-bold">Seleccionar Cliente</Form.Label>
                        <Form.Select value={clienteSeleccionado} onChange={(e) => { setClienteSeleccionado(e.target.value); setFiltroPedidosEstado(''); }} size="sm">
                            <option value="">-- Elige un cliente --</option>
                            {clientes.map((cliente) => (
                                <option key={cliente} value={cliente}>{cliente}</option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                </Col>
            </Row>

            {clienteSeleccionado && historial ? (
                <>
                    {/* RESUMEN DEL CLIENTE */}
                    <Row className="mb-4 g-3">
                        <Col md={3}>
                            <Card className="border-0 shadow-sm bg-light">
                                <Card.Body className="text-center">
                                    <small className="text-muted d-block fw-bold">Total Gastado</small>
                                    <h5 className="fw-bold text-success">{formatoColones(historial.totalGastado)}</h5>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={3}>
                            <Card className="border-0 shadow-sm bg-light">
                                <Card.Body className="text-center">
                                    <small className="text-muted d-block fw-bold">Total Pagado</small>
                                    <h5 className="fw-bold text-info">{formatoColones(historial.totalPagado)}</h5>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={3}>
                            <Card className={`border-0 shadow-sm ${historial.deudaActual > 0 ? 'bg-danger-subtle' : 'bg-light'}`}>
                                <Card.Body className="text-center">
                                    <small className="text-muted d-block fw-bold">Deuda Actual</small>
                                    <h5 className={`fw-bold ${historial.deudaActual > 0 ? 'text-danger' : 'text-success'}`}>
                                        {formatoColones(historial.deudaActual)}
                                    </h5>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={3}>
                            <Card className="border-0 shadow-sm bg-light">
                                <Card.Body className="text-center">
                                    <small className="text-muted d-block fw-bold">Total Pedidos</small>
                                    <h5 className="fw-bold text-primary">{historial.totalPedidos}</h5>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>

                    {/* INFO ADICIONAL */}
                    <Card className="border-0 shadow-sm mb-4">
                        <Card.Body>
                            <Row>
                                <Col md={6}>
                                    <p className="mb-2"><strong>Primer pedido:</strong> {historial.primerPedido?.fecha_solicitud || '-'}</p>
                                    <p className="mb-0"><strong>Promedio entre pedidos:</strong> {historial.promedioDias} días</p>
                                </Col>
                                <Col md={6}>
                                    <p className="mb-2"><strong>Último pedido:</strong> {historial.ultimaPedido?.fecha_solicitud || '-'}</p>
                                    {historial.deudaActual > 0 && (
                                        <p className="mb-0 text-danger fw-bold">
                                            <i className="fas fa-exclamation-circle me-1"></i>
                                            Lleva {historial.diasDeuda} días sin pagar
                                        </p>
                                    )}
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>

                    {/* FILTRO DE PEDIDOS */}
                    <div className="mb-3">
                        <Form.Group>
                            <Form.Label className="fw-bold small">Filtrar por estado</Form.Label>
                            <Form.Select value={filtroPedidosEstado} onChange={(e) => setFiltroPedidosEstado(e.target.value)} size="sm" style={{ maxWidth: '200px' }}>
                                <option value="">Todos</option>
                                <option value="Pendiente">Pendiente</option>
                                <option value="En Proceso">En Proceso</option>
                                <option value="Listo para Retirar">Listo para Retirar</option>
                                <option value="Entregado">Entregado</option>
                                <option value="Cancelado">Cancelado</option>
                            </Form.Select>
                        </Form.Group>
                    </div>

                    {/* TABLA DE PEDIDOS */}
                    <Card className="border-0 shadow-sm">
                        <Card.Header className="bg-light fw-bold">Pedidos ({pedidosFiltrados.length})</Card.Header>
                        <Card.Body className="p-0">
                            {pedidosFiltrados.length === 0 ? (
                                <p className="text-muted text-center py-4 mb-0">Sin pedidos en este estado.</p>
                            ) : (
                                <div className="table-responsive">
                                    <Table hover className="mb-0" size="sm">
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
                                            {pedidosFiltrados.map((p) => {
                                                const saldo = (p.precio || 0) - (p.monto_pagado || 0);
                                                return (
                                                    <tr key={p.id}>
                                                        <td className="small">{p.fecha_solicitud}</td>
                                                        <td className="small fw-bold">{p.producto}</td>
                                                        <td className="small">{formatoColones(p.precio)}</td>
                                                        <td className="small text-success">{formatoColones(p.monto_pagado)}</td>
                                                        <td className={`small fw-bold ${saldo > 0 ? 'text-danger' : 'text-success'}`}>
                                                            {formatoColones(saldo)}
                                                        </td>
                                                        <td className="small">
                                                            <Badge
                                                                bg={
                                                                    p.estado === 'Entregado' ? 'success' :
                                                                    p.estado === 'Cancelado' ? 'secondary' :
                                                                    p.estado === 'Listo para Retirar' ? 'warning' :
                                                                    'info'
                                                                }
                                                            >
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
                        </Card.Body>
                    </Card>
                </>
            ) : (
                <p className="text-muted text-center py-4">Selecciona un cliente para ver su historial.</p>
            )}
        </Container>
    );
}
