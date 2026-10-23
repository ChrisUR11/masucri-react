import { useState, useMemo } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Container, Row, Col, Card, Form, Badge, Table } from 'react-bootstrap';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { obtenerHistorialCliente } from '../utils/historialClientes';
import EstadoCarga, { EstadoError } from '../components/EstadoCarga';
import { formatoColones } from '../utils/formato';
import DesglosePedidoCompacto from '../components/DesglosePedidoCompacto';

export default function HistorialCliente() {
    const { datos: pedidos, cargando, error } = useFirestoreCollection(
        () => query(collection(db, 'pedidos'), orderBy('fecha_solicitud', 'desc')),
        []
    );

    const [clienteSeleccionado, setClienteSeleccionado] = useState('');
    const [filtroPedidosEstado, setFiltroPedidosEstado] = useState('');

    // Lista de clientes únicos
    const clientes = useMemo(() => {
        const clientesUnicos = new Map();
        pedidos.forEach((pedido) => {
            const cliente = String(pedido.cliente || 'Anónimo').trim().replace(/\s+/g, ' ') || 'Anónimo';
            const clave = cliente.toLocaleLowerCase('es-CR');
            if (!clientesUnicos.has(clave)) clientesUnicos.set(clave, cliente);
        });
        return [...clientesUnicos.values()].sort((a, b) => a.localeCompare(b, 'es-CR'));
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
        <Container className="history-client-page mt-4 pb-5">
            <div className="app-page-heading page-heading mb-4">
                <h3 className="fw-bold m-0"><i className="fas fa-users" aria-hidden="true"></i> Historial de Clientes</h3>
            </div>

            <Row className="mb-4">
                <Col md={6}>
                    <Form.Group controlId="historial-cliente-selector">
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
                                    <small className="text-muted d-block fw-bold">Valor de pedidos no cancelados</small>
                                    <h5 className="fw-bold text-success">{formatoColones(historial.totalGastado)}</h5>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={3}>
                            <Card className="border-0 shadow-sm bg-light">
                                <Card.Body className="text-center">
                                    <small className="text-muted d-block fw-bold">Abonado en pedidos no cancelados</small>
                                    <h5 className="fw-bold text-info">{formatoColones(historial.totalPagado)}</h5>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={3}>
                            <Card className={`border-0 shadow-sm ${historial.deudaActual > 0 ? 'bg-danger-subtle' : 'bg-light'}`}>
                                <Card.Body className="text-center">
                                    <small className="text-muted d-block fw-bold">Por cobrar de entregados</small>
                                    <h5 className={`fw-bold ${historial.deudaActual > 0 ? 'text-danger' : 'text-success'}`}>
                                        {formatoColones(historial.deudaActual)}
                                    </h5>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col md={3}>
                            <Card className="border-0 shadow-sm bg-light">
                                <Card.Body className="text-center">
                                    <small className="text-muted d-block fw-bold">Saldo de pedidos activos</small>
                                    <h5 className="fw-bold text-primary">{formatoColones(historial.saldoActivo)}</h5>
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
                                    <p className="mb-2"><strong>Pedidos registrados:</strong> {historial.totalPedidos}</p>
                                    <p className="mb-0"><strong>Promedio entre pedidos:</strong> {historial.promedioDias} días</p>
                                </Col>
                                <Col md={6}>
                                    <p className="mb-2"><strong>Último pedido:</strong> {historial.ultimaPedido?.fecha_solicitud || '-'}</p>
                                    {historial.saldoEntregado > 0 && (
                                        <p className="mb-0 text-danger fw-bold">
                                            <i className="fas fa-exclamation-circle me-1"></i>
                                            {historial.diasDeuda == null
                                                ? 'Antigüedad del saldo: falta fecha de cierre.'
                                                : `Antigüedad del saldo: ${historial.diasDeuda} días desde la entrega.`}
                                        </p>
                                    )}
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>

                    {/* FILTRO DE PEDIDOS */}
                    <div className="mb-3">
                        <Form.Group controlId="historial-cliente-filtro-estado">
                            <Form.Label className="fw-bold small">Filtrar por estado</Form.Label>
                            <Form.Select value={filtroPedidosEstado} onChange={(e) => setFiltroPedidosEstado(e.target.value)} size="sm" style={{ maxWidth: '200px' }}>
                                <option value="">Todos</option>
                                <option value="Pendiente">Pendiente</option>
                                <option value="En producción">En producción</option>
                                <option value="Por Retirar">Por Retirar</option>
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
                                <div className="table-responsive mobile-card-table-wrap">
                                    <Table hover className="mobile-card-table mb-0" size="sm">
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
                                            {pedidosFiltrados.map((p) => {
                                                const saldo = Math.max(0, (Number(p.precio) || 0) - (Number(p.monto_pagado) || 0));
                                                return (
                                                    <tr key={p.id}>
                                                        <td data-label="Fecha" className="small">{p.fecha_solicitud}</td>
                                                        <td data-label="Productos" className="small"><div className="mobile-table-value text-break"><DesglosePedidoCompacto pedido={p} /></div></td>
                                                        <td data-label="Precio" className="small">{formatoColones(p.precio)}</td>
                                                        <td data-label="Pagado" className="small text-success">{formatoColones(p.monto_pagado)}</td>
                                                        <td data-label="Saldo" className={`small fw-bold ${p.estado === 'Cancelado' ? 'text-muted' : saldo > 0 ? 'text-danger' : 'text-success'}`}>
                                                            {p.estado === 'Cancelado' ? 'No aplica (cancelado)' : formatoColones(saldo)}
                                                        </td>
                                                        <td data-label="Estado" className="small">
                                                            <Badge
                                                                bg={
                                                                    p.estado === 'Entregado' ? 'success' :
                                                                    p.estado === 'Cancelado' ? 'secondary' :
                                                                    p.estado === 'Por Retirar' ? 'warning' :
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
