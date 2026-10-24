import { useMemo, useState } from 'react';
import { Container, Row, Col, Card, ProgressBar, Badge, ListGroup } from 'react-bootstrap';
import { collection, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar, Pie } from 'react-chartjs-2';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import EstadoCarga, { EstadoError } from '../components/EstadoCarga';
import SelectorRango from '../components/SelectorRango';
import ContabilidadBI from '../components/ContabilidadBI';
import { calcularRangoPreset } from '../utils/rangoFechas';
import { calcularMetricas } from '../utils/metricasNegocio';
import { calcularMetricasContables } from '../utils/metricasContables';
import { calcularPedidosActivos } from '../utils/metricasPedidosActivos';
import { formatoColones, formatoNumero } from '../utils/formato';
import { formatoFechaLegible } from '../utils/fecha';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const COLORES_GASTOS = {
    Luz: '#e9a100', Agua: '#0d8ed0', Maquinaria: '#596579', Telas: '#9355bf',
    Sublimación: '#d64884', Transporte: '#198a77', Alimentación: '#db682e',
    Varios: '#6654bf', 'Gastos generales': '#5f6f7d', Otros: '#a07559',
    'Servicios Públicos': '#0d8ed0'
};

function ListaProgreso({ dataObj, total, colorCls }) {
    const arr = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
    if (arr.length === 0) return <div className="p-3 text-muted">Sin datos.</div>;
    return arr.map(([nombre, monto]) => {
        const pct = total > 0 ? ((monto / total) * 100).toFixed(1) : 0;
        return (
            <div key={nombre} className="mb-3 px-3">
                <div className="bi-list-entry d-flex justify-content-between small fw-bold mb-1">
                    <span><i className="fas fa-money-check"></i> {nombre}</span>
                    <span>{formatoColones(monto)}</span>
                </div>
                <ProgressBar variant={colorCls} now={pct} aria-label={`${nombre}: ${pct}% del total`} style={{ height: '8px' }} />
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

    // El informe abre en el mes actual; el selector también permite ver todo el histórico.
    const [preset, setPreset] = useState('mes_actual');
    const [rango, setRango] = useState(() => calcularRangoPreset('mes_actual'));

    const cambiarPreset = (nuevoPreset) => {
        setPreset(nuevoPreset);
        if (nuevoPreset !== 'personalizado') setRango(calcularRangoPreset(nuevoPreset));
    };

    const m = useMemo(() => calcularMetricas(pedidos, movimientos, rango), [pedidos, movimientos, rango]);
    const mc = useMemo(() => calcularMetricasContables(pedidos, movimientos, rango), [pedidos, movimientos, rango]);
    const activos = useMemo(() => calcularPedidosActivos(pedidos), [pedidos]);
    const categoriasGasto = Object.keys(m.gastosAgrupados);
    const esHistorico = preset === 'historico';
    const alcance = esHistorico ? 'histórico' : 'período';
    const alcanceEnFrase = esHistorico ? 'todo el histórico' : 'el período';
    const periodoTexto = esHistorico
        ? 'Todo el histórico'
        : `${formatoFechaLegible(rango.inicio) || 'Sin fecha inicial'} — ${formatoFechaLegible(rango.fin) || 'Sin fecha final'}`;

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
        <Container className="bi-page mt-4 pb-5">
            {/* ENCABEZADO */}
            <div className="app-page-heading page-heading mb-4">
                <div>
                    <h3 className="fw-bold m-0"><i className="fas fa-chart-line text-secondary"></i> Inteligencia de Negocios (BI)</h3>
                    <small className="text-muted">
                        <i className="fas fa-calendar-alt"></i> {m.minFecha === 'N/A'
                            ? 'Aún no hay pedidos ni movimientos registrados.'
                            : <>Datos disponibles: <strong>{m.minFecha}</strong> a <strong>{m.maxFecha}</strong></>}
                    </small>
                </div>
            </div>

            {/* SELECTOR DE PERÍODO */}
            <Card className="bi-range-card border-0 shadow-sm mb-3">
                <Card.Body className="py-3">
                    <SelectorRango preset={preset} setPreset={cambiarPreset} rango={rango} setRango={setRango} />
                </Card.Body>
            </Card>

            <p className="bi-period-note small text-muted mb-4">
                <strong>{periodoTexto}.</strong> Los pedidos solicitados se agrupan por fecha de solicitud, los finalizados por cierre y la caja por fecha del movimiento. Estados y saldos reflejan lo actual.
            </p>

            {/* CAJA DEL PERÍODO O DEL HISTÓRICO */}
            <Card className={`bi-profit-card border-${m.utilidad >= 0 ? 'success' : 'danger'} mb-4 shadow-sm text-center`}>
                <Card.Body>
                    <h6 className={`text-${m.utilidad >= 0 ? 'success' : 'danger'} fw-bold`}>Flujo neto de caja · {alcance}</h6>
                    <h1 className={`fw-bold text-${m.utilidad >= 0 ? 'success' : 'danger'}`}>{formatoColones(m.utilidad)}</h1>
                    <small className="text-muted d-block">Entradas registradas: {formatoColones(m.ingresosPeriodo)} · Salidas registradas: {formatoColones(m.gastosPeriodo)}</small>
                    <small className="text-muted">{periodoTexto}</small>
                </Card.Body>
            </Card>

            <section aria-labelledby="bi-pedidos-activos" className="mb-4">
                <div className="bi-section-heading d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
                    <div>
                        <h4 id="bi-pedidos-activos" className="fw-bold mb-1">Pedidos activos ahora</h4>
                        <p className="small text-muted mb-0">Incluye todos los pedidos abiertos, aunque se hayan creado antes del período elegido.</p>
                    </div>
                    <Badge bg="primary" pill>{activos.totales.cantidad} pedidos</Badge>
                </div>
                <Row className="g-3">
                    {activos.estados.map((grupo, index) => (
                        <Col key={grupo.estado} xs={12} md={4}>
                            <Card className={`bi-active-card bi-active-card--${index} border-0 shadow-sm h-100`}>
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                                        <h5 className="fw-bold mb-0">{grupo.estado}</h5>
                                        <span className="bi-active-count">{grupo.cantidad}</span>
                                    </div>
                                    <div className="bi-active-amount fw-bold">{formatoColones(grupo.valorTotal)}</div>
                                    <small className="text-muted">Valor total de pedidos</small>
                                    <div className="bi-active-breakdown mt-3 pt-2 border-top small">
                                        <div><span>Abonado</span><strong className="text-success">{formatoColones(grupo.abonado)}</strong></div>
                                        <div><span>Por cobrar</span><strong>{formatoColones(grupo.saldoPorCobrar)}</strong></div>
                                    </div>
                                    {grupo.atrasados > 0 && <div className="small text-danger fw-semibold mt-2">{grupo.atrasados} con entrega atrasada</div>}
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                </Row>
                <div className="bi-active-total small mt-3">
                    <strong>Total activo: {formatoColones(activos.totales.valorTotal)}</strong>
                    <span>Abonado: {formatoColones(activos.totales.abonado)}</span>
                    <span>Por cobrar: {formatoColones(activos.totales.saldoPorCobrar)}</span>
                    {activos.totales.atrasados > 0 && <span className="text-danger fw-semibold">Entregas atrasadas: {activos.totales.atrasados}</span>}
                </div>
            </section>

            <ContabilidadBI metricas={mc} alcance={alcance} periodoTexto={periodoTexto} />

            {/* FILA 1: CLIENTES Y VOLATILIDAD */}
            <Row className="mb-4">
                <Col md={6} className="mb-3 mb-md-0">
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Header className="bg-white fw-bold">Top 5 clientes por valor de pedidos <small className="text-muted fw-normal">({alcance})</small></Card.Header>
                        {m.topClientes.length === 0 ? (
                            <Card.Body className="text-muted small">Aún no hay clientes registrados.</Card.Body>
                        ) : (
                            <ListGroup variant="flush">
                                {m.topClientes.map(([id, c], i) => (
                                    <ListGroup.Item key={id} className="bi-list-entry d-flex justify-content-between align-items-center">
                                        <div>
                                            <div className="fw-bold small">
                                                {i + 1}. {c.nombre} {c.telefono && <span className="text-muted fw-normal">- <i className="fas fa-phone"></i> {c.telefono}</span>}
                                            </div>
                                            <div style={{ fontSize: '0.75rem' }} className="text-muted">Último pedido: {c.ultima} ({c.compras} pedidos)</div>
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
                        <Card.Header className="bg-white fw-bold">Variación entre meses con entradas <small className="text-muted fw-normal">({alcance})</small></Card.Header>
                        <Card.Body className="d-flex flex-column justify-content-center align-items-center">
                            <Badge bg={m.volColor} className="w-100 py-2 fs-6 mb-3 border shadow-sm">{m.volStatus}</Badge>
                            {m.hasVol ? (
                                <>
                                    <Row className="w-100 mb-3 text-muted small">
                                        <Col xs={6}>Promedio por mes con entradas<br /><strong className="text-dark fs-6">{formatoColones(m.volMedia)}</strong></Col>
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
                        <Card.Header className="bg-white fw-bold text-center border-0">Pedidos entregados y cancelados <small className="text-muted fw-normal">({alcance}, por cierre)</small></Card.Header>
                        <Card.Body style={{ height: '200px' }} className="d-flex justify-content-center">
                            {m.entregadosPeriodo + m.anuladosPeriodo > 0 ? (
                                <>
                                    <p className="visually-hidden">Pedidos cerrados: {m.entregadosPeriodo} entregados y {m.anuladosPeriodo} cancelados.</p>
                                    <Pie
                                        data={{ labels: ['Entregados', 'Cancelados'], datasets: [{ data: [m.entregadosPeriodo, m.anuladosPeriodo], backgroundColor: ['#198754', '#dc3545'] }] }}
                                        options={{ maintainAspectRatio: false }}
                                    />
                                </>
                            ) : (
                                <p className="text-muted align-self-center">Sin cierres en este alcance.</p>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
                <Col lg={4} className="mb-3 mb-lg-0">
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Header className="bg-white fw-bold text-center border-0">Pedidos no cancelados por tipo de producto <small className="text-muted fw-normal">({alcance}, por solicitud)</small></Card.Header>
                        <Card.Body style={{ height: '200px' }}>
                            {Object.keys(m.catProductos).length > 0 ? (
                                <>
                                    <p className="visually-hidden">Pedidos por tipo: {Object.entries(m.catProductos).map(([categoria, cantidad]) => `${categoria}: ${cantidad}`).join('; ')}.</p>
                                    <Bar
                                        data={{ labels: Object.keys(m.catProductos), datasets: [{ label: 'Pedidos', data: Object.values(m.catProductos), backgroundColor: '#0d6efd' }] }}
                                        options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                                    />
                                </>
                            ) : (
                                <p className="text-muted text-center mt-4">Sin datos suficientes.</p>
                            )}
                        </Card.Body>
                        <Card.Footer className="bg-white border-0 small text-muted">Un pedido con varias categorías cuenta en cada una.</Card.Footer>
                    </Card>
                </Col>
                <Col lg={4}>
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Header className="bg-white fw-bold text-center border-0">Gastos por categoría <small className="text-muted fw-normal">({alcance})</small></Card.Header>
                        <Card.Body style={{ height: `${Math.max(200, categoriasGasto.length * 24)}px` }} className="d-flex justify-content-center">
                            {categoriasGasto.length > 0 ? (
                                <>
                                    <p className="visually-hidden">Gastos por categoría: {Object.entries(m.gastosAgrupados).map(([categoria, monto]) => `${categoria}: ${formatoColones(monto)}`).join('; ')}.</p>
                                    <Doughnut
                                        data={{
                                            labels: categoriasGasto,
                                            datasets: [{ data: Object.values(m.gastosAgrupados), backgroundColor: categoriasGasto.map((categoria) => COLORES_GASTOS[categoria] || '#768391') }]
                                        }}
                                        options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } }}
                                    />
                                </>
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
                        <Card.Header className="bg-danger text-white fw-bold"><i className="fas fa-arrow-up"></i> Mayores gastos por entidad ({alcance})</Card.Header>
                        {m.topGastos.length === 0 ? (
                            <Card.Body className="text-muted small">Sin gastos registrados aún.</Card.Body>
                        ) : (
                            <ListGroup variant="flush">
                                {m.topGastos.map(([lugar, monto], i) => (
                                    <ListGroup.Item key={lugar} className="bi-list-entry d-flex justify-content-between align-items-center py-3">
                                        <div className="bi-entry-title fw-bold"><span className="fs-5 me-2">{['🥇', '🥈', '🥉'][i]}</span> {lugar}</div>
                                        <Badge bg="danger" pill className="fs-6 shadow-sm">{formatoColones(monto)}</Badge>
                                    </ListGroup.Item>
                                ))}
                            </ListGroup>
                        )}
                    </Card>
                </Col>
                <Col md={6}>
                    <Card className="shadow-sm border-0">
                        <Card.Header className="bg-primary text-white fw-bold"><i className="fas fa-star"></i> Productos más pedidos, sin cancelados ({alcance})</Card.Header>
                        {m.topProd.length === 0 ? (
                            <Card.Body className="text-muted small">Sin pedidos registrados aún.</Card.Body>
                        ) : (
                            <ListGroup variant="flush">
                                {m.topProd.map(([nombre, cantidad], i) => (
                                    <ListGroup.Item key={nombre} className="bi-list-entry d-flex justify-content-between align-items-center py-2">
                                        <div className="bi-entry-title fw-bold small text-uppercase">{i + 1}. {nombre}</div>
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
                        <Card.Header className="bg-success text-white fw-bold"><i className="fas fa-arrow-down"></i> Entradas por método de pago ({alcance})</Card.Header>
                        <div className="pt-3"><ListaProgreso dataObj={m.entradasPorMetodo} total={m.totalEntradas} colorCls="success" /></div>
                    </Card>
                </Col>
                <Col md={6}>
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Header className="bg-danger text-white fw-bold"><i className="fas fa-arrow-up"></i> Gastos por método de pago ({alcance})</Card.Header>
                        <div className="pt-3"><ListaProgreso dataObj={m.salidasPorMetodo} total={m.totalSalidas} colorCls="danger" /></div>
                    </Card>
                </Col>
            </Row>

            {/* FILA 5: RADIOGRAFÍA */}
            <Card className="shadow-sm border-0 mb-4">
                <Card.Header className="bg-dark text-white fw-bold"><i className="fas fa-microscope"></i> Radiografía del negocio <small className="text-white-50 fw-normal">({alcance})</small></Card.Header>
                <Card.Body>
                    <Row>
                        <Col md={6} className="border-end mb-3 mb-md-0">
                            <h6 className="fw-bold"><i className="fas fa-chart-bar"></i> Volumen de Trabajo</h6>
                            <div className="d-flex justify-content-between border-bottom pb-2 mb-2 small">
                                <span className="text-muted">Promedio por mes con pedidos:</span><strong className="text-primary">{formatoNumero(m.pedMedia, 1)} pedidos</strong>
                            </div>
                            <div className="d-flex justify-content-between border-bottom pb-2 mb-2 small">
                                <span className="text-muted">Variabilidad:</span><strong className="text-secondary">± {formatoNumero(m.pedDesv, 1)} pedidos</strong>
                            </div>
                            <div className="d-flex justify-content-between small">
                                <span className="text-muted">Cancelados entre cerrados:</span><strong className="text-danger">{m.entregadosPeriodo + m.anuladosPeriodo > 0 ? `${m.tasaCanc}%` : 'Sin cierres'}</strong>
                            </div>
                        </Col>
                        <Col md={6}>
                            <h6 className="fw-bold"><i className="fas fa-hand-holding-usd"></i> Saldo actual de entregados cerrados en {alcanceEnFrase}</h6>
                            <div className="d-flex justify-content-between mb-2 small">
                                <span><i className="fas fa-circle text-success small"></i> Pagados 100%:</span> <strong>{m.pagados100}</strong>
                            </div>
                            <div className="d-flex justify-content-between mb-3 small">
                                <span><i className="fas fa-circle text-warning small"></i> Con Saldo:</span> <strong>{m.conDeuda}</strong>
                            </div>
                            {m.mayorDeudor ? (
                                <div className="bi-list-entry alert alert-warning py-2 mb-0 d-flex justify-content-between align-items-center border-warning">
                                    <span><i className="fas fa-exclamation-triangle"></i> <strong>Mayor saldo individual:</strong> {m.mayorDeudor.cliente}</span>
                                    <span className="fs-5 fw-bold text-danger">{formatoColones(m.mayorDeudor.debe)}</span>
                                </div>
                            ) : (
                                <div className="alert alert-success py-2 mb-0 text-center border-success"><i className="fas fa-check-circle"></i> No hay saldos pendientes en este alcance.</div>
                            )}
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

        </Container>
    );
}
