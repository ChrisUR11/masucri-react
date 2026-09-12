import { useState, useMemo } from 'react';
import { Container, Row, Col, Card, Button, InputGroup, Form, Badge, Table } from 'react-bootstrap';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { collection, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import EstadoCarga, { EstadoError } from '../components/EstadoCarga';
import ModalHistorialCliente from '../components/ModalHistorialCliente';
import { obtenerHistorialCliente, clientesMorosos } from '../utils/historialClientes';
import { formatoColones } from '../utils/formato';
import { useDebounce } from '../hooks/useDebounce';

export default function Clientes() {
    const { datos: pedidos, cargando, error } = useFirestoreCollection(
        () => query(collection(db, 'pedidos'), orderBy('fecha_solicitud', 'desc')),
        []
    );

    const [filtro, setFiltro] = useState('');
    const filtroDebouncido = useDebounce(filtro, 250);
    const [mostrarModal, setMostrarModal] = useState(false);
    const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
    const [mostrarMorosos, setMostrarMorosos] = useState(false);

    // Obtener lista única de clientes
    const clientes = useMemo(() => {
        const clientesUnicos = {};
        pedidos.forEach((p) => {
            const cliente = p.cliente || 'Anónimo';
            if (!clientesUnicos[cliente]) {
                const historial = obtenerHistorialCliente(cliente, pedidos);
                clientesUnicos[cliente] = historial;
            }
        });
        return Object.values(clientesUnicos)
            .filter((c) => c !== null)
            .sort((a, b) => b.totalGastado - a.totalGastado);
    }, [pedidos]);

    // Filtro por búsqueda
    const clientesFiltrados = useMemo(() => {
        if (!filtroDebouncido.trim()) return clientes;
        const busqueda = filtroDebouncido.toLowerCase();
        return clientes.filter((c) => c.cliente.toLowerCase().includes(busqueda));
    }, [clientes, filtroDebouncido]);

    // Clientes morosos
    const morosos = useMemo(() => clientesMorosos(pedidos), [pedidos]);

    const abrirDetalle = (cliente) => {
        setClienteSeleccionado(cliente);
        setMostrarModal(true);
    };

    if (cargando) return <EstadoCarga texto="Cargando clientes..." />;
    if (error) return <EstadoError texto="Error al cargar clientes." />;

    return (
        <Container className="mt-4 pb-5">
            <div className="mb-4">
                <h3 className="fw-bold mb-3">👥 Base de Clientes</h3>
                <Row className="g-2">
                    <Col sm={6} md={3}>
                        <Card className="border-0 bg-primary text-white">
                            <Card.Body className="small">
                                <p className="mb-1 opacity-75">Total de Clientes</p>
                                <h3 className="m-0">{clientes.length}</h3>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col sm={6} md={3}>
                        <Card className="border-0 bg-danger text-white">
                            <Card.Body className="small">
                                <p className="mb-1 opacity-75">En Mora</p>
                                <h3 className="m-0">{morosos.length}</h3>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col sm={6} md={3}>
                        <Card className="border-0 bg-success text-white">
                            <Card.Body className="small">
                                <p className="mb-1 opacity-75">Sin Deuda</p>
                                <h3 className="m-0">{clientes.length - morosos.length}</h3>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col sm={6} md={3}>
                        <Card className="border-0 bg-warning text-dark">
                            <Card.Body className="small">
                                <p className="mb-1 opacity-75">Deuda Total</p>
                                <h4 className="m-0">{formatoColones(morosos.reduce((sum, m) => sum + m.deuda, 0))}</h4>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </div>

            {/* Filtro y toggle */}
            <Card className="border-0 shadow-sm mb-4">
                <Card.Body>
                    <Row className="align-items-center">
                        <Col>
                            <InputGroup>
                                <InputGroup.Text><i className="fas fa-search"></i></InputGroup.Text>
                                <Form.Control
                                    placeholder="Buscar cliente..."
                                    value={filtro}
                                    onChange={(e) => setFiltro(e.target.value)}
                                />
                            </InputGroup>
                        </Col>
                        <Col md="auto">
                            <Button
                                variant={mostrarMorosos ? 'danger' : 'outline-danger'}
                                size="sm"
                                onClick={() => setMostrarMorosos(!mostrarMorosos)}
                            >
                                ⚠️ Morosos ({morosos.length})
                            </Button>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {/* TABLA DE CLIENTES O MOROSOS */}
            {mostrarMorosos ? (
                <Card className="border-0 shadow-sm">
                    <Card.Header className="bg-danger text-white fw-bold">Clientes en Mora</Card.Header>
                    <Card.Body className="p-0">
                        {morosos.length === 0 ? (
                            <p className="p-3 text-muted small mb-0">¡Sin clientes morosos! 🎉</p>
                        ) : (
                            <div className="table-responsive">
                                <Table striped hover className="mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Cliente</th>
                                            <th>Deuda</th>
                                            <th>Días Sin Pagar</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {morosos.map((m, i) => (
                                            <tr key={i}>
                                                <td className="fw-bold">{m.cliente}</td>
                                                <td className="text-danger fw-bold">{formatoColones(m.deuda)}</td>
                                                <td>
                                                    <Badge
                                                        bg={m.diasDeuda > 30 ? 'danger' : m.diasDeuda > 14 ? 'warning' : 'info'}
                                                        className={m.diasDeuda > 30 || m.diasDeuda > 14 ? '' : 'text-dark'}
                                                    >
                                                        {m.diasDeuda} días
                                                    </Badge>
                                                </td>
                                                <td>
                                                    <Button
                                                        variant="outline-primary"
                                                        size="sm"
                                                        onClick={() => abrirDetalle(m.cliente)}
                                                    >
                                                        Ver
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </div>
                        )}
                    </Card.Body>
                </Card>
            ) : (
                <Card className="border-0 shadow-sm">
                    <Card.Header className="bg-primary text-white fw-bold">
                        Todos los Clientes ({clientesFiltrados.length})
                    </Card.Header>
                    <Card.Body className="p-0">
                        {clientesFiltrados.length === 0 ? (
                            <p className="p-3 text-muted small mb-0">No hay clientes que coincidan.</p>
                        ) : (
                            <div className="table-responsive">
                                <Table striped hover className="mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Cliente</th>
                                            <th>Pedidos</th>
                                            <th>Total Gastado</th>
                                            <th>Total Pagado</th>
                                            <th>Deuda</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {clientesFiltrados.map((c, i) => (
                                            <tr key={i}>
                                                <td className="fw-bold">{c.cliente}</td>
                                                <td>{c.totalPedidos}</td>
                                                <td className="text-success">{formatoColones(c.totalGastado)}</td>
                                                <td className="text-info">{formatoColones(c.totalPagado)}</td>
                                                <td
                                                    className={`fw-bold ${
                                                        c.deudaActual > 0 ? 'text-danger' : 'text-success'
                                                    }`}
                                                >
                                                    {formatoColones(c.deudaActual)}
                                                </td>
                                                <td>
                                                    <Button
                                                        variant="outline-primary"
                                                        size="sm"
                                                        onClick={() => abrirDetalle(c.cliente)}
                                                    >
                                                        Ver Detalle
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </div>
                        )}
                    </Card.Body>
                </Card>
            )}

            {/* MODAL DE DETALLE */}
            <ModalHistorialCliente
                show={mostrarModal}
                cliente={clienteSeleccionado}
                pedidos={pedidos}
                onHide={() => setMostrarModal(false)}
            />
        </Container>
    );
}
