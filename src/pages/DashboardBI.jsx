import { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Card, ProgressBar, Badge, ListGroup } from 'react-bootstrap';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar, Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const obtenerMesActual = () => {
    const hoy = new Date();
    const tzOffset = hoy.getTimezoneOffset() * 60000;
    return new Date(hoy.getTime() - tzOffset).toISOString().substring(0, 7);
};

export default function DashboardBI() {
    const [pedidos, setPedidos] = useState([]);
    const [movimientos, setMovimientos] = useState([]);

    useEffect(() => {
        const unPedidos = onSnapshot(query(collection(db, "pedidos")), (snap) => {
            const data = []; snap.forEach(d => data.push(d.data())); setPedidos(data);
        });
        const unMovs = onSnapshot(query(collection(db, "movimientos"), orderBy("fecha", "desc")), (snap) => {
            const data = []; snap.forEach(d => data.push(d.data())); setMovimientos(data);
        });
        return () => { unPedidos(); unMovs(); };
    }, []);

    const metricas = useMemo(() => {
        const mesActual = obtenerMesActual();
        
        // 1. Rango de Fechas
        let todasLasFechas = [...pedidos.map(p => p.fecha_solicitud), ...movimientos.map(m => m.fecha)].filter(f => f);
        todasLasFechas.sort();
        const minFecha = todasLasFechas[0] || 'N/A';
        const maxFecha = todasLasFechas[todasLasFechas.length - 1] || 'N/A';

        // Variables de Finanzas
        let ingresosMes = 0; let gastosMes = 0;
        let entradasPorMetodo = {}; let salidasPorMetodo = {};
        let totalEntradas = 0; let totalSalidas = 0;
        let gastosMap = {}; let ingresosPorMes = {};
        let gastosAgrupados = { 'Telas y Costura': 0, 'Suministros (Sublimación)': 0, 'Transporte': 0, 'Servicios Públicos': 0, 'Alimentación': 0, 'Gastos Generales': 0 };

        movimientos.forEach(m => {
            const mesMov = m.fecha ? m.fecha.substring(0, 7) : '';
            if (m.fecha && mesMov === mesActual) {
                if (m.tipo === 'entrada') ingresosMes += m.monto;
                else gastosMes += m.monto;
            }

            let metodo = m.metodo_pago || 'Desconocido';
            if (m.tipo === 'entrada') {
                entradasPorMetodo[metodo] = (entradasPorMetodo[metodo] || 0) + m.monto;
                totalEntradas += m.monto;
                ingresosPorMes[mesMov] = (ingresosPorMes[mesMov] || 0) + m.monto;
            } else {
                salidasPorMetodo[metodo] = (salidasPorMetodo[metodo] || 0) + m.monto;
                totalSalidas += m.monto;

                let entidad = (m.entidad || '').trim().toUpperCase();
                let desc = (m.descripcion || '').toLowerCase();
                if (!entidad) {
                    if (desc.includes('ubora')) entidad = 'UBORA';
                    else if (desc.includes('aracely') || desc.includes('tela')) entidad = 'ARACELY';
                    else if (desc.includes('transporte') || desc.includes('bus') || desc.includes('uber')) entidad = 'TRANSPORTE PÚBLICO';
                    else if (desc.includes('ice') || desc.includes('agua') || desc.includes('luz')) entidad = 'SERVICIOS PÚBLICOS';
                    else entidad = 'OTROS';
                }
                gastosMap[entidad] = (gastosMap[entidad] || 0) + m.monto;

                // Agrupación para gráfico Doughnut
                let txt = desc + " " + entidad.toLowerCase();
                if (txt.includes('tela') || txt.includes('aracely') || txt.includes('hilo')) gastosAgrupados['Telas y Costura'] += m.monto;
                else if (txt.includes('ubora') || txt.includes('tinta') || txt.includes('papel') || txt.includes('vinil')) gastosAgrupados['Suministros (Sublimación)'] += m.monto;
                else if (txt.includes('bus') || txt.includes('uber') || txt.includes('gasolina')) gastosAgrupados['Transporte'] += m.monto;
                else if (txt.includes('ice') || txt.includes('luz') || txt.includes('agua')) gastosAgrupados['Servicios Públicos'] += m.monto;
                else if (txt.includes('comida') || txt.includes('almuerzo')) gastosAgrupados['Alimentación'] += m.monto;
                else gastosAgrupados['Gastos Generales'] += m.monto;
            }
        });

        // Variables de Pedidos
        let prodMap = {}; let crmMap = {}; let catProductos = {};
        let anulados = 0; let entregados = 0; let pagados100 = 0; let conDeuda = 0;
        let deudores = []; let pedidosPorMes = {}; let totalTrabajos = 0;

        pedidos.forEach(p => {
            if (p.estado === 'Cancelado') {
                anulados++;
            } else {
                totalTrabajos++;
                const mesPed = p.fecha_solicitud ? p.fecha_solicitud.substring(0, 7) : '';
                if (mesPed) pedidosPorMes[mesPed] = (pedidosPorMes[mesPed] || 0) + 1;

                const deuda = (p.precio || 0) - (p.monto_pagado || 0);
                if (p.estado === 'Entregado') {
                    entregados++;
                    if (deuda > 0) {
                        conDeuda++;
                        deudores.push({ cliente: p.cliente, debe: deuda });
                    } else {
                        pagados100++;
                    }
                }

                if (p.producto) {
                    const nombre = p.producto.trim().toUpperCase();
                    prodMap[nombre] = (prodMap[nombre] || 0) + 1;

                    // Categorías para gráfico de barras
                    const n = nombre.toLowerCase();
                    let cat = 'Otros Diseños';
                    if (n.includes('pijama') || n.includes('camis') || n.includes('talla')) cat = 'Ropa y Textiles';
                    else if (n.includes('llavero') || n.includes('placa')) cat = 'Llaveros y Placas';
                    else if (n.includes('relicario') || n.includes('retablo')) cat = 'Regalos Especiales';
                    else if (n.includes('taza') || n.includes('vaso')) cat = 'Tazas y Vasos';
                    else if (n.includes('sticker') || n.includes('vinil')) cat = 'Vinil y Stickers';
                    catProductos[cat] = (catProductos[cat] || 0) + 1;
                }

                if (p.cliente) {
                    const idUnico = p.telefono ? p.telefono.replace(/[\s-]/g, '') : p.cliente.trim().toUpperCase();
                    if (!crmMap[idUnico]) crmMap[idUnico] = { nombre: p.cliente.trim(), telefono: p.telefono || '', compras: 0, monto: 0, ultima: '2000-01-01' };
                    crmMap[idUnico].compras += 1;
                    crmMap[idUnico].monto += (p.precio || 0);
                    if (p.fecha_solicitud > crmMap[idUnico].ultima) crmMap[idUnico].ultima = p.fecha_solicitud;
                }
            }
        });

        // Cálculos de Volatilidad (Riesgo)
        const valsIngresos = Object.values(ingresosPorMes);
        let volMedia = 0, volDesv = 0, volCoef = 0, volStatus = 'Requiere 2 meses', volColor = 'secondary', volMsg = '';
        if (valsIngresos.length >= 2) {
            volMedia = valsIngresos.reduce((a, b) => a + b, 0) / valsIngresos.length;
            volDesv = Math.sqrt(valsIngresos.reduce((acc, val) => acc + Math.pow(val - volMedia, 2), 0) / valsIngresos.length);
            volCoef = volDesv / volMedia;
            if (volCoef > 0.4) { volStatus = 'Alta Volatilidad'; volColor = 'danger'; volMsg = 'Requiere fondo de emergencia.'; }
            else if (volCoef > 0.15) { volStatus = 'Moderada'; volColor = 'warning text-dark'; volMsg = 'Flujo de caja normal.'; }
            else { volStatus = 'Ingresos Estables'; volColor = 'success'; volMsg = 'Ventas predecibles.'; }
        }

        // Estadísticas de Trabajo
        const valsPedidos = Object.values(pedidosPorMes);
        let pedMedia = 0, pedDesv = 0, tasaCanc = 0;
        if (valsPedidos.length > 0) {
            pedMedia = valsPedidos.reduce((a, b) => a + b, 0) / valsPedidos.length;
            pedDesv = Math.sqrt(valsPedidos.reduce((acc, val) => acc + Math.pow(val - pedMedia, 2), 0) / valsPedidos.length);
            tasaCanc = totalTrabajos > 0 ? ((anulados / (totalTrabajos + anulados)) * 100).toFixed(1) : 0;
        }

        // Limpiar Gastos Agrupados (quitar ceros)
        Object.keys(gastosAgrupados).forEach(k => { if (gastosAgrupados[k] === 0) delete gastosAgrupados[k]; });

        deudores.sort((a, b) => b.debe - a.debe);

        return {
            minFecha, maxFecha, utilidad: ingresosMes - gastosMes, ingresosMes, gastosMes,
            entradasPorMetodo, salidasPorMetodo, totalEntradas, totalSalidas,
            topGastos: Object.entries(gastosMap).sort((a, b) => b[1] - a[1]).slice(0, 3),
            topProd: Object.entries(prodMap).sort((a, b) => b[1] - a[1]).slice(0, 5),
            topClientes: Object.entries(crmMap).sort((a, b) => b[1].monto - a[1].monto).slice(0, 5),
            volMedia, volDesv, volStatus, volColor, volMsg, hasVol: valsIngresos.length >= 2,
            catProductos, gastosAgrupados, entregados, anulados, pagados100, conDeuda,
            pedMedia, pedDesv, tasaCanc, mayorDeudor: deudores[0] || null
        };
    }, [pedidos, movimientos]);

    const renderProgressList = (dataObj, total, colorCls) => {
        const arr = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
        if (arr.length === 0) return <div className="p-3 text-muted">Sin datos.</div>;
        return arr.map((item, idx) => {
            const pct = total > 0 ? ((item[1] / total) * 100).toFixed(1) : 0;
            return (
                <div key={idx} className="mb-3 px-3">
                    <div className="d-flex justify-content-between small fw-bold mb-1">
                        <span><i className="fas fa-money-check"></i> {item[0]}</span>
                        <span>₡{item[1].toLocaleString('es-CR')}</span>
                    </div>
                    <ProgressBar variant={colorCls} now={pct} style={{ height: '8px' }} />
                    <div className="text-end small text-muted mt-1">{pct}% del total</div>
                </div>
            );
        });
    };

    return (
        <Container className="mt-4 pb-5">
            {/* ENCABEZADO */}
            <div className="mb-4">
                <h3 className="fw-bold m-0"><i className="fas fa-chart-line text-secondary"></i> Inteligencia de Negocios (BI)</h3>
                <small className="text-muted"><i className="fas fa-calendar-alt"></i> Analizando datos del historial: desde <strong>{metricas.minFecha}</strong> hasta <strong>{metricas.maxFecha}</strong></small>
            </div>

            {/* UTILIDAD NETA (CUADRO PRINCIPAL) */}
            <Card className={`border-${metricas.utilidad >= 0 ? 'success' : 'danger'} mb-4 shadow-sm text-center`}>
                <Card.Body>
                    <h6 className={`text-${metricas.utilidad >= 0 ? 'success' : 'danger'} fw-bold`}>Utilidad Neta (Mes Actual)</h6>
                    <h1 className={`fw-bold text-${metricas.utilidad >= 0 ? 'success' : 'danger'}`}>₡{metricas.utilidad.toLocaleString('es-CR')}</h1>
                    <small className="text-muted">Ingresos: ₡{metricas.ingresosMes.toLocaleString()} | Gastos: ₡{metricas.gastosMes.toLocaleString()}</small>
                </Card.Body>
            </Card>

            {/* FILA 1: CLIENTES Y VOLATILIDAD */}
            <Row className="mb-4">
                <Col md={6} className="mb-3 mb-md-0">
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Header className="bg-white fw-bold">Top 5 Clientes Históricos</Card.Header>
                        <ListGroup variant="flush">
                            {metricas.topClientes.map((c, i) => (
                                <ListGroup.Item key={i} className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <div className="fw-bold small">{i+1}. {c[1].nombre} {c[1].telefono && <span className="text-muted fw-normal">- <i className="fas fa-phone"></i> {c[1].telefono}</span>}</div>
                                        <div style={{ fontSize: '0.75rem' }} className="text-muted">Última compra: {c[1].ultima} ({c[1].compras} pedidos)</div>
                                    </div>
                                    <Badge bg="success" pill>₡{c[1].monto.toLocaleString('es-CR')}</Badge>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    </Card>
                </Col>
                <Col md={6}>
                    <Card className="shadow-sm border-0 h-100 text-center">
                        <Card.Header className="bg-white fw-bold">Análisis de Riesgo y Volatilidad</Card.Header>
                        <Card.Body className="d-flex flex-column justify-content-center align-items-center">
                            <Badge bg={metricas.volColor} className="w-100 py-2 fs-6 mb-3 border shadow-sm">{metricas.volStatus}</Badge>
                            {metricas.hasVol ? (
                                <>
                                    <Row className="w-100 mb-3 text-muted small">
                                        <Col xs={6}>Promedio Mensual<br/><strong className="text-dark fs-6">₡{Math.round(metricas.volMedia).toLocaleString('es-CR')}</strong></Col>
                                        <Col xs={6}>Desviación (Riesgo)<br/><strong className="text-dark fs-6">₡{Math.round(metricas.volDesv).toLocaleString('es-CR')}</strong></Col>
                                    </Row>
                                    <small className="text-muted">{metricas.volMsg}</small>
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
                            <Pie data={{ labels: ['Éxito (Entregados)', 'Anulados'], datasets: [{ data: [metricas.entregados, metricas.anulados], backgroundColor: ['#198754', '#dc3545'] }] }} options={{ maintainAspectRatio: false }} />
                        </Card.Body>
                    </Card>
                </Col>
                <Col lg={4} className="mb-3 mb-lg-0">
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Header className="bg-white fw-bold text-center border-0">Productos más vendidos</Card.Header>
                        <Card.Body style={{ height: '200px' }}>
                            <Bar data={{ labels: Object.keys(metricas.catProductos), datasets: [{ label: 'Trabajos Realizados', data: Object.values(metricas.catProductos), backgroundColor: '#0d6efd' }] }} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                        </Card.Body>
                    </Card>
                </Col>
                <Col lg={4}>
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Header className="bg-white fw-bold text-center border-0">Fuga de Capital (Gastos)</Card.Header>
                        <Card.Body style={{ height: '200px' }} className="d-flex justify-content-center">
                            <Doughnut data={{ labels: Object.keys(metricas.gastosAgrupados), datasets: [{ data: Object.values(metricas.gastosAgrupados), backgroundColor: ['#e83e8c', '#0dcaf0', '#fd7e14', '#20c997', '#6c757d', '#0d6efd'] }] }} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } }} />
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* FILA 3: TOPS */}
            <Row className="mb-4">
                <Col md={6} className="mb-3 mb-md-0">
                    <Card className="shadow-sm border-0">
                        <Card.Header className="bg-danger text-white fw-bold"><i className="fas fa-fire"></i> Top 3 Fugas de Capital (Lugares)</Card.Header>
                        <ListGroup variant="flush">
                            {metricas.topGastos.map((g, i) => (
                                <ListGroup.Item key={i} className="d-flex justify-content-between align-items-center py-3">
                                    <div className="fw-bold text-truncate"><span className="fs-5 me-2">{['🥇','🥈','🥉'][i]}</span> {g[0]}</div>
                                    <Badge bg="danger" pill className="fs-6 shadow-sm">₡{g[1].toLocaleString('es-CR')}</Badge>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    </Card>
                </Col>
                <Col md={6}>
                    <Card className="shadow-sm border-0">
                        <Card.Header className="bg-primary text-white fw-bold"><i className="fas fa-star"></i> Top 5 Productos Más Pedidos</Card.Header>
                        <ListGroup variant="flush">
                            {metricas.topProd.map((p, i) => (
                                <ListGroup.Item key={i} className="d-flex justify-content-between align-items-center py-2">
                                    <div className="fw-bold small text-truncate text-uppercase">{(i+1)}. {p[0]}</div>
                                    <Badge bg="primary" pill className="shadow-sm">{p[1]} pedidos</Badge>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    </Card>
                </Col>
            </Row>

            {/* FILA 4: MÉTODOS DE PAGO */}
            <Row className="mb-4">
                <Col md={6} className="mb-3 mb-md-0">
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Header className="bg-success text-white fw-bold"><i className="fas fa-arrow-down"></i> Ingresos por Método de Pago</Card.Header>
                        <div className="pt-3">{renderProgressList(metricas.entradasPorMetodo, metricas.totalEntradas, 'success')}</div>
                    </Card>
                </Col>
                <Col md={6}>
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Header className="bg-danger text-white fw-bold"><i className="fas fa-arrow-up"></i> Gastos por Método de Pago</Card.Header>
                        <div className="pt-3">{renderProgressList(metricas.salidasPorMetodo, metricas.totalSalidas, 'danger')}</div>
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
                                <span className="text-muted">Promedio (Mes):</span><strong className="text-primary">{metricas.pedMedia.toFixed(1)} pedidos</strong>
                            </div>
                            <div className="d-flex justify-content-between border-bottom pb-2 mb-2 small">
                                <span className="text-muted">Variabilidad:</span><strong className="text-secondary">± {metricas.pedDesv.toFixed(1)} pedidos</strong>
                            </div>
                            <div className="d-flex justify-content-between small">
                                <span className="text-muted">Tasa Cancelación:</span><strong className="text-danger">{metricas.tasaCanc}%</strong>
                            </div>
                        </Col>
                        <Col md={6}>
                            <h6 className="fw-bold"><i className="fas fa-hand-holding-usd"></i> Cobros (Entregados)</h6>
                            <div className="d-flex justify-content-between mb-2 small">
                                <span><i className="fas fa-circle text-success small"></i> Pagados 100%:</span> <strong>{metricas.pagados100}</strong>
                            </div>
                            <div className="d-flex justify-content-between mb-3 small">
                                <span><i className="fas fa-circle text-warning small"></i> Con Saldo:</span> <strong>{metricas.conDeuda}</strong>
                            </div>
                            {metricas.mayorDeudor ? (
                                <div className="alert alert-warning py-2 mb-0 d-flex justify-content-between align-items-center border-warning">
                                    <span><i className="fas fa-exclamation-triangle"></i> <strong>Mayor Deuda:</strong> {metricas.mayorDeudor.cliente}</span>
                                    <span className="fs-5 fw-bold text-danger">₡{metricas.mayorDeudor.debe.toLocaleString('es-CR')}</span>
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