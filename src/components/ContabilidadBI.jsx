import { Badge, Card, Col, Row } from 'react-bootstrap';
import { formatoColones } from '../utils/formato';

export default function ContabilidadBI({ metricas, alcance, periodoTexto }) {
    const hayCostos = metricas.pedidosConCosto > 0 && Number.isFinite(metricas.margenPromedio);
    const cobertura = `${metricas.pedidosConCosto} de ${metricas.pedidosEntregadosEnPeriodo}`;
    const alcanceEnFrase = alcance === 'histórico' ? 'todo el histórico' : 'el período elegido';

    return (
        <section aria-labelledby="bi-contabilidad" className="bi-accounting mb-4">
            <div className="bi-section-heading mb-3">
                <h4 id="bi-contabilidad" className="fw-bold mb-1"><i className="fas fa-book-open text-success me-2" aria-hidden="true"></i>Contabilidad · {alcance}</h4>
                <p className="small text-muted mb-0">{periodoTexto}. La caja muestra pagos y gastos registrados; el valor de pedidos entregados incluye importes aún por cobrar.</p>
            </div>

            <Row className="g-3 mb-3">
                <Col xs={12} sm={6} lg={3}>
                    <Card className="bi-accounting-kpi h-100 border-0 shadow-sm">
                        <Card.Body>
                            <small className="text-muted fw-semibold">Pedidos entregados</small>
                            <div className="bi-accounting-value fw-bold">{metricas.pedidosEntregadosEnPeriodo}</div>
                            <small className="text-muted">Cerrados en {alcanceEnFrase}</small>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={12} sm={6} lg={3}>
                    <Card className="bi-accounting-kpi h-100 border-0 shadow-sm">
                        <Card.Body>
                            <small className="text-muted fw-semibold">Valor de entregados</small>
                            <div className="bi-accounting-value fw-bold">{formatoColones(metricas.precioTotalVenta)}</div>
                            <small className="text-muted">No equivale a dinero cobrado</small>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={12} sm={6} lg={3}>
                    <Card className="bi-accounting-kpi h-100 border-0 shadow-sm">
                        <Card.Body>
                            <small className="text-muted fw-semibold">Costos de producto informados</small>
                            <div className="bi-accounting-value fw-bold">{formatoColones(metricas.costoTotal)}</div>
                            <small className="text-muted">{cobertura} entregados tienen costo</small>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={12} sm={6} lg={3}>
                    <Card className="bi-accounting-kpi h-100 border-0 shadow-sm">
                        <Card.Body>
                            <small className="text-muted fw-semibold">Margen bruto estimado</small>
                            <div className={`bi-accounting-value fw-bold ${hayCostos && metricas.gananciaTotal < 0 ? 'text-danger' : 'text-success'}`}>{hayCostos ? formatoColones(metricas.gananciaTotal) : 'Sin datos'}</div>
                            <small className="text-muted">{hayCostos ? `${metricas.margenPromedio.toFixed(1)}% sobre ${cobertura} pedidos` : 'Falta registrar costo por pedido'}</small>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Row className="g-3 mb-3">
                <Col lg={6}>
                    <Card className="border-0 shadow-sm h-100">
                        <Card.Header className="bg-white fw-bold">Movimientos de caja · {alcance}</Card.Header>
                        <Card.Body>
                            <div className="bi-accounting-line"><span>Entradas registradas</span><strong className="text-success">{formatoColones(metricas.ingresos)}</strong></div>
                            <div className="bi-accounting-line"><span>Salidas registradas</span><strong className="text-danger">{formatoColones(metricas.gastos)}</strong></div>
                            <div className="bi-accounting-line border-top pt-2"><span>Flujo neto</span><strong className={metricas.flujoCaja >= 0 ? 'text-success' : 'text-danger'}>{formatoColones(metricas.flujoCaja)}</strong></div>
                            {metricas.ingresos > 0 && <p className="small text-muted mb-0 mt-2">Gastos equivalentes al {metricas.ratioGastoIngreso.toFixed(1)}% de las entradas.</p>}
                        </Card.Body>
                    </Card>
                </Col>
                <Col lg={6}>
                    <Card className="border-0 shadow-sm h-100">
                        <Card.Header className="bg-white fw-bold">Top 5 clientes por pedidos entregados · {alcance}</Card.Header>
                        <Card.Body>
                            {metricas.topClientesPorValor.length === 0 ? (
                                <p className="text-muted small mb-0">Sin entregas en este alcance.</p>
                            ) : (
                                <ol className="bi-accounting-ranking small mb-0 ps-3">
                                    {metricas.topClientesPorValor.map((cliente) => (
                                        <li key={cliente.nombre}>
                                            <span>{cliente.nombre} <span className="text-muted">({cliente.pedidos} pedidos)</span></span>
                                            <strong>{formatoColones(cliente.valor)}</strong>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {hayCostos && (
                <Card className="border-0 shadow-sm mb-3">
                    <Card.Header className="bg-white fw-bold">Productos con margen calculable · {alcance}</Card.Header>
                    <Card.Body>
                        <p className="text-muted small">Solo se incluyen pedidos entregados con costo unitario registrado.</p>
                        <ol className="bi-accounting-ranking small mb-0 ps-3">
                            {metricas.topMargen.map((producto) => (
                                <li key={producto.nombre}>
                                    <span>{producto.nombre}</span>
                                    <strong>{producto.margen.toFixed(1)}%</strong>
                                </li>
                            ))}
                        </ol>
                    </Card.Body>
                </Card>
            )}

            <Card className="border-0 shadow-sm border-start border-4 border-warning">
                <Card.Header className="bg-white fw-bold d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <span>Saldos por cobrar de pedidos entregados</span>
                    <Badge bg="warning" text="dark" pill>{metricas.morosos.length} clientes</Badge>
                </Card.Header>
                <Card.Body>
                    <p className="small text-muted mb-3">Pedidos entregados en {alcanceEnFrase}; importes pendientes al día de hoy. Un abono parcial ya está descontado del saldo.</p>
                    {metricas.morosos.length === 0 ? (
                        <p className="text-success small mb-0">No hay saldos pendientes en los pedidos entregados de este alcance.</p>
                    ) : (
                        <div className="table-responsive mobile-card-table-wrap">
                            <table className="table table-sm mobile-card-table align-middle mb-0" aria-label="Saldos de pedidos entregados">
                                <thead className="table-light"><tr><th>Cliente</th><th>Abonado</th><th>Por cobrar</th><th>Desde entrega</th></tr></thead>
                                <tbody>
                                    {metricas.morosos.map((cliente) => (
                                        <tr key={cliente.cliente}>
                                            <td data-label="Cliente" className="fw-semibold"><span className="mobile-table-value">{cliente.cliente}</span></td>
                                            <td data-label="Abonado"><span className="mobile-table-value">{formatoColones(cliente.pagado)}</span></td>
                                            <td data-label="Por cobrar" className="fw-bold"><span className="mobile-table-value">{formatoColones(cliente.deuda)}</span></td>
                                            <td data-label="Desde entrega"><span className="mobile-table-value">{cliente.diasDeuda == null ? 'Sin fecha registrada' : `${cliente.diasDeuda} días`}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card.Body>
            </Card>
        </section>
    );
}
