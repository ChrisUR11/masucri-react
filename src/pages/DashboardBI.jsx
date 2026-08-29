import { useMemo } from 'react';
import { Container, Row, Col, Card, ProgressBar, Badge, ListGroup } from 'react-bootstrap';
import { collection, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar, Pie } from 'react-chartjs-2';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import EstadoCarga, { EstadoError } from '../components/EstadoCarga';
import { calcularMetricas } from '../utils/metricasNegocio';
import { formatoColones, formatoNumero } from '../utils/formato';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

function ListaProgreso({ dataObj, total, colorCls }) {
    const arr = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
    if (arr.length === 0) return <div className="p-3 text-muted">Sin datos.</div>;
    return arr.map(([nombre, monto], idx) => {
        const pct = total > 0 ? ((monto / total) * 100).toFixed(1) : 0;
        return (
            <div key={idx} className="mb-3 px-3">
                <div className="d-flex justify-content-between small fw-bold mb-1">
                    <span><i className="fas fa-money-check"></i> {nombre}</span>
                    <span>{formatoColones(monto)}</span>
                </div>
                <ProgressBar variant={colorCls} now={pct} style={{ height: '8px' }} />
                <div className="text-end small text-muted mt-1">{pct}% del total</div>
            </div>
        );
    });
}

export default function DashboardBI() {
    const { datos: pedidos, cargando: cargandoPedidos, error: errorPedidos } = useFirestoreCollection(
        () => query(collection(db, 'pedidos')),
        []
    );
    const { datos: movimientos, cargando: cargandoMovs, error: errorMovs } = useFirestoreCollection(
        () => query(collection(db, 'movimientos'), orderBy('fecha', 'desc')),
        []
    );

    const cargando = cargandoPedidos || cargandoMovs;
    const error = errorPedidos || errorMovs;

    const m = useMemo(() => calcularMetricas(pedidos, movimientos), [pedidos, movimientos]);

    if (error) {
        return (
            <Container className="mt-4 pb-5">
                <EstadoError texto="No se pudo cargar la información del negocio. Revisa tu conexión." />
            </Container>
        );
    }

    if (cargando) {
        return (
            <Container className="mt-4 pb-5">
                <EstadoCarga texto="Calculando métricas del negocio..." />
            </Container>
        );
    }

    return (
        <Container className="mt-4 pb-5">
            {/* ENCABEZADO */}
            <div className="mb-4">
                <h3 className="fw-bold m-0"><i className="fas fa-chart-line text-secondary"></i> Inteligencia de Negocios (BI)</h3>
                <small className="text-muted">
                    <i className="fas fa-calendar-alt"></i> Analizando datos del historial: desde <strong>{m.minFecha}</strong> hasta <strong>{m.maxFecha}</strong>
                </small>
            </div>

            {/* UTILIDAD NETA */}
            <Card className={`border-${m.utilidad >= 0 ? 'success' : 'danger'} mb-4 shadow-sm text-center`}>
                <Card.Body>
                    <h6 className={`text-${m.utilidad >= 0 ? 'success' : 'danger'} fw-bold`}>Utilidad Neta (Mes Actual)</h6>
                    <h1 className={`fw-bold text-${m.utilidad >= 0 ? 'success' : 'danger'}`}>{formatoColones(m.utilidad)}</h1>
                    <small className="text-muted">Ingresos: {formatoColones(m.ingresosMes)} | Gastos: {formatoColones(m.gastosMes)}</small>
                </Card.Body>
            </Card>

            {/* FILA 1: CLIENTES Y VOLATILIDAD */}
            <Row className="mb-4">
                <Col md={6} className="mb-3 mb-md-0">
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Header className="bg-white fw-bold">Top 5 Clientes Históricos</Card.Header>
                        {m.topClientes.length === 0 ? (
                            <Card.Body className="text-muted small">Aún no hay clientes registrados.</Card.Body>
                        ) : (
                            <ListGroup variant="flush">
                                {m.topClientes.map(([id, c], i) => (
                                    <ListGroup.Item key={id} className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <div className="fw-bold small">
                                                {i + 1}. {c.nombre} {c.telefono && <span className="text-muted fw-normal">- <i className="fas fa-phone"></i> {c.telefono}</span>}
                                            </div>
                                            <div style={{ fontSize: '0.75rem' }} className="text-muted">Última compra: {c.ultima} ({c.compras} pedidos)</div>
                                        </div>
                                        <Badge bg="success" pill>{formatoColones(c.monto)}</Badge>
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        )}
                    </Card>
                </Col>
                <Col md={6}>
                    <Card className="shadow-sm border-0 h-100 text-center">
                        <Card.Header className="bg-white fw-bold">Análisis de Riesgo y Volatilidad</Card.Header>
                        <Card.Body className="d-flex flex-column justify-content-center align-items-center">
                            <Badge bg={m.volColor} className="w-100 py-2 fs-6 mb-3 border shadow-sm">{m.volStatus}</Badge>
                            {m.hasVol ? (
                                <>
                                    <Row className="w-100 mb-3 text-muted small">
                                        <Col xs={6}>Promedio Mensual<br /><strong className="text-dark fs-6">{formatoColones(m.volMedia)}</strong></Col>
                                        <Col xs={6}>Desviación (Riesgo)<br /><strong className="text-dark fs-6">{formatoColones(m.volDesv)}</strong></Col>
                                    </Row>
                                    <small className="text-muted">{m.volMsg}</small>
                                </>
                            ) : (
                                <small className="text-muted mt-2">Se requieren al menos 2 meses de datos.</small>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* FILA 2: GRÁFICOS */}
            <Row className="mb-4">
                <Col lg={4} className="mb-3 mb-lg-0">
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Header className="bg-white fw-bold text-center border-0">Retención vs Cancelación</Card.Header>
                        <Card.Body style={{ height: '200px' }} className="d-flex justify-content-center">
                            {m.entregados + m.anulados > 0 ? (
                                <Pie
                                    data={{ labels: ['Éxito (Entregados)', 'Anulados'], datasets: [{ data: [m.entregados, m.anulados], backgroundColor: ['#198754', '#dc3545'] }] }}
                                    options={{ maintainAspectRatio: false }}
                                />
                            ) : (
                                <p className="text-muted align-self-center">Sin datos suficientes.</p>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
                <Col lg={4} className="mb-3 mb-lg-0">
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Header className="bg-white fw-bold text-center border-0">Productos más vendidos</Card.Header>
                        <Card.Body style={{ height: '200px' }}>
                            {Object.keys(m.catProductos).length > 0 ? (
                                <Bar
                                    data={{ labels: Object.keys(m.catProductos), datasets: [{ label: 'Trabajos Realizados', data: Object.values(m.catProductos), backgroundColor: '#0d6efd' }] }}
                                    options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                                />
                            ) : (
                                <p className="text-muted text-center mt-4">Sin datos suficientes.</p>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
                <Col lg={4}>
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Header className="bg-white fw-bold text-center border-0">Fuga de Capital (Gastos)</Card.Header>
                        <Card.Body style={{ height: '200px' }} className="d-flex justify-content-center">
                            {Object.keys(m.gastosAgrupados).length > 0 ? (
                                <Doughnut
                                    data={{
                                        labels: Object.keys(m.gastosAgrupados),
                                        datasets: [{ data: Object.values(m.gastosAgrupados), backgroundColor: ['#e83e8c', '#0dcaf0', '#fd7e14', '#20c997', '#6c757d', '#0d6efd'] }]
                                    }}
                                    options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } }}
                                />
                            ) : (
                                <p className="text-muted align-self-center">Sin gastos registrados.</p>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* FILA 3: TOPS */}
            <Row className="mb-4">
                <Col md={6} className="mb-3 mb-md-0">
                    <Card className="shadow-sm border-0">
                        <Card.Header className="bg-danger text-white fw-bold"><i className="fas fa-fire"></i> Top 3 Fugas de Capital (Lugares)</Card.Header>
                        {m.topGastos.length === 0 ? (
                            <Card.Body className="text-muted small">Sin gastos registrados aún.</Card.Body>
                        ) : (
                            <ListGroup variant="flush">
                                {m.topGastos.map(([lugar, monto], i) => (
                                    <ListGroup.Item key={lugar} className="d-flex justify-content-between align-items-center py-3">
                                        <div className="fw-bold text-truncate"><span className="fs-5 me-2">{['🥇', '🥈', '🥉'][i]}</span> {lugar}</div>
                                        <Badge bg="danger" pill className="fs-6 shadow-sm">{formatoColones(monto)}</Badge>
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        )}
                    </Card>
                </Col>
                <Col md={6}>
                    <Card className="shadow-sm border-0">
                        <Card.Header className="bg-primary text-white fw-bold"><i className="fas fa-star"></i> Top 5 Productos Más Pedidos</Card.Header>
                        {m.topProd.length === 0 ? (
                            <Card.Body className="text-muted small">Sin pedidos registrados aún.</Card.Body>
                        ) : (
                            <ListGroup variant="flush">
                                {m.topProd.map(([nombre, cantidad], i) => (
                                    <ListGroup.Item key={nombre} className="d-flex justify-content-between align-items-center py-2">
                                        <div className="fw-bold small text-truncate text-uppercase">{i + 1}. {nombre}</div>
                                        <Badge bg="primary" pill className="shadow-sm">{cantidad} pedidos</Badge>
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        )}
                    </Card>
                </Col>
            </Row>

            {/* FILA 4: MÉTODOS DE PAGO */}
            <Row className="mb-4">
                <Col md={6} className="mb-3 mb-md-0">
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Header className="bg-success text-white fw-bold"><i className="fas fa-arrow-down"></i> Ingresos por Método de Pago</Card.Header>
                        <div className="pt-3"><ListaProgreso dataObj={m.entradasPorMetodo} total={m.totalEntradas} colorCls="success" /></div>
                    </Card>
                </Col>
                <Col md={6}>
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Header className="bg-danger text-white fw-bold"><i className="fas fa-arrow-up"></i> Gastos por Método de Pago</Card.Header>
                        <div className="pt-3"><ListaProgreso dataObj={m.salidasPorMetodo} total={m.totalSalidas} colorCls="danger" /></div>
                    </Card>
                </Col>
            </Row>

            {/* FILA 5: RADIOGRAFÍA */}
            <Card className="shadow-sm border-0 mb-4">
                <Card.Header className="bg-dark text-white fw-bold"><i className="fas fa-microscope"></i> Radiografía del Negocio</Card.Header>
                <Card.Body>
                    <Row>
                        <Col md={6} className="border-end mb-3 mb-md-0">
                            <h6 className="fw-bold"><i className="fas fa-chart-bar"></i> Volumen de Trabajo</h6>
                            <div className="d-flex justify-content-between border-bottom pb-2 mb-2 small">
                                <span className="text-muted">Promedio (Mes):</span><strong className="text-primary">{formatoNumero(m.pedMedia, 1)} pedidos</strong>
                            </div>
                            <div className="d-flex justify-content-between border-bottom pb-2 mb-2 small">
                                <span className="text-muted">Variabilidad:</span><strong className="text-secondary">± {formatoNumero(m.pedDesv, 1)} pedidos</strong>
                            </div>
                            <div className="d-flex justify-content-between small">
                                <span className="text-muted">Tasa Cancelación:</span><strong className="text-danger">{m.tasaCanc}%</strong>
                            </div>
                        </Col>
                        <Col md={6}>
                            <h6 className="fw-bold"><i className="fas fa-hand-holding-usd"></i> Cobros (Entregados)</h6>
                            <div className="d-flex justify-content-between mb-2 small">
                                <span><i className="fas fa-circle text-success small"></i> Pagados 100%:</span> <strong>{m.pagados100}</strong>
                            </div>
                            <div className="d-flex justify-content-between mb-3 small">
                                <span><i className="fas fa-circle text-warning small"></i> Con Saldo:</span> <strong>{m.conDeuda}</strong>
                            </div>
                            {m.mayorDeudor ? (
                                <div className="alert alert-warning py-2 mb-0 d-flex justify-content-between align-items-center border-warning">
                                    <span><i className="fas fa-exclamation-triangle"></i> <strong>Mayor Deuda:</strong> {m.mayorDeudor.cliente}</span>
                                    <span className="fs-5 fw-bold text-danger">{formatoColones(m.mayorDeudor.debe)}</span>
                                </div>
                            ) : (
                                <div className="alert alert-success py-2 mb-0 text-center border-success"><i className="fas fa-check-circle"></i> No hay deudas pendientes.</div>
                            )}
                        </Col>
                    </Row>
                </Card.Body>
            </Card>
        </Container>
    );
}
