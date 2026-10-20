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
    const [mostrarSaldos, setMostrarSaldos] = useState(false);

    // Obtener lista única de clientes
    const clientes = useMemo(() => {
        const clientesUnicos = new Map();
        pedidos.forEach((p) => {
            const cliente = String(p.cliente || 'Anónimo').trim().replace(/\s+/g, ' ') || 'Anónimo';
            const clave = cliente.toLocaleLowerCase('es-CR');
            if (!clientesUnicos.has(clave)) {
                clientesUnicos.set(clave, { cliente, pedidos: [] });
            }
            clientesUnicos.get(clave).pedidos.push(p);
        });
        return [...clientesUnicos.values()]
            .map(({ cliente, pedidos: pedidosCliente }) => obtenerHistorialCliente(cliente, pedidosCliente))
            .sort((a, b) => b.totalGastado - a.totalGastado);
    }, [pedidos]);

    // Filtro por búsqueda
    const clientesFiltrados = useMemo(() => {
        if (!filtroDebouncido.trim()) return clientes;
        const busqueda = filtroDebouncido.toLowerCase();
        return clientes.filter((c) => c.cliente.toLowerCase().includes(busqueda));
    }, [clientes, filtroDebouncido]);

    const conSaldoEntregado = useMemo(() => clientesMorosos(pedidos), [pedidos]);
    const saldosFiltrados = useMemo(() => {
        if (!filtroDebouncido.trim()) return conSaldoEntregado;
        const busqueda = filtroDebouncido.trim().toLocaleLowerCase('es-CR');
        return conSaldoEntregado.filter((c) => c.cliente.toLocaleLowerCase('es-CR').includes(busqueda));
    }, [conSaldoEntregado, filtroDebouncido]);

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
                                <p className="mb-1 opacity-75">Con saldo entregado</p>
                                <h3 className="m-0">{conSaldoEntregado.length}</h3>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col sm={6} md={3}>
                        <Card className="border-0 bg-warning text-dark">
                            <Card.Body className="small">
                                <p className="mb-1 opacity-75">Saldo en pedidos activos</p>
                                <h4 className="m-0">{formatoColones(clientes.reduce((sum, c) => sum + c.saldoActivo, 0))}</h4>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col sm={6} md={3}>
                        <Card className="border-0 bg-danger text-white">
                            <Card.Body className="small">
                                <p className="mb-1 opacity-75">Por cobrar de entregados</p>
                                <h4 className="m-0">{formatoColones(conSaldoEntregado.reduce((sum, m) => sum + m.deuda, 0))}</h4>
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
                                variant={mostrarSaldos ? 'danger' : 'outline-danger'}
                                size="sm"
                                onClick={() => setMostrarSaldos(!mostrarSaldos)}
                            >
                                Ver saldos entregados ({conSaldoEntregado.length})
                            </Button>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {/* TABLA DE CLIENTES O SALDOS ENTREGADOS */}
            {mostrarSaldos ? (
                <Card className="border-0 shadow-sm">
                    <Card.Header className="bg-danger text-white fw-bold">Clientes con saldo por cobrar ({saldosFiltrados.length})</Card.Header>
                    <Card.Body className="p-0">
                        {saldosFiltrados.length === 0 ? (
                            <p className="p-3 text-muted small mb-0">No hay clientes con saldo entregado para esta búsqueda.</p>
                        ) : (
                            <div className="table-responsive mobile-card-table-wrap">
                                <Table striped hover className="mobile-card-table mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Cliente</th>
                                            <th>Saldo por cobrar</th>
                                            <th>Desde entrega</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {saldosFiltrados.map((m) => (
                                            <tr key={m.cliente}>
                                                <td data-label="Cliente" className="fw-bold">{m.cliente}</td>
                                                <td data-label="Saldo por cobrar" className="text-danger fw-bold">{formatoColones(m.deuda)}</td>
                                                <td data-label="Desde entrega">
                                                    <Badge
                                                        bg={m.diasDeuda > 30 ? 'danger' : m.diasDeuda > 14 ? 'warning' : 'info'}
                                                        className={m.diasDeuda > 30 || m.diasDeuda > 14 ? '' : 'text-dark'}
                                                    >
                                                        {m.diasDeuda == null ? 'Sin fecha de cierre' : `${m.diasDeuda} días`}
                                                    </Badge>
                                                </td>
                                                <td data-label="Acción">
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
                            <div className="table-responsive mobile-card-table-wrap">
                                <Table striped hover className="mobile-card-table mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Cliente</th>
                                            <th>Pedidos</th>
                                            <th>Valor de pedidos</th>
                                            <th>Abonado</th>
                                            <th>Saldo entregado</th>
                                            <th>Saldo activo</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {clientesFiltrados.map((c, i) => (
                                            <tr key={i}>
                                                <td data-label="Cliente" className="fw-bold">{c.cliente}</td>
                                                <td data-label="Pedidos">{c.totalPedidos}</td>
                                                <td data-label="Valor de pedidos no cancelados" className="text-success">{formatoColones(c.totalGastado)}</td>
                                                <td data-label="Abonado en pedidos no cancelados" className="text-info">{formatoColones(c.totalPagado)}</td>
                                                <td data-label="Saldo entregado"
                                                    className={`fw-bold ${
                                                        c.deudaActual > 0 ? 'text-danger' : 'text-success'
                                                    }`}
                                                >
                                                    {formatoColones(c.saldoEntregado)}
                                                </td>
                                                <td data-label="Saldo activo" className={`fw-bold ${c.saldoActivo > 0 ? 'text-warning-emphasis' : 'text-success'}`}>
                                                    {formatoColones(c.saldoActivo)}
                                                </td>
                                                <td data-label="Acción">
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
