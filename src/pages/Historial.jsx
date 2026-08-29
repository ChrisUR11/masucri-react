import { useState, useEffect } from 'react';
import { Container, Card, Table, Button, Form, Modal, Badge, ListGroup, Row, Col } from 'react-bootstrap';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Swal from 'sweetalert2';
import { TicketImpresion } from '../components/TicketImpresion'; // Importamos el Ticket

const ESTADOS_ACTIVOS = ['Pendiente', 'En producción', 'Por Retirar'];

const obtenerFechaLocal = () => {
    const hoy = new Date();
    const tzOffset = hoy.getTimezoneOffset() * 60000;
    return new Date(hoy.getTime() - tzOffset).toISOString().split('T')[0];
};

export default function Historial() {
    const [pedidos, setPedidos] = useState([]);
    const [filtroTexto, setFiltroTexto] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('con_saldo');
    const [limite, setLimite] = useState(50);
    
    // Estados del Modal
    const [showModal, setShowModal] = useState(false);
    const [pedidoActivo, setPedidoActivo] = useState(null);

    // Cargar datos en tiempo real
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, "pedidos"), (snapshot) => {
            const data = [];
            snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
            setPedidos(data);
        });
        return () => unsubscribe();
    }, []);

    // Lógica de filtrado
    let historial = pedidos.filter(p => !ESTADOS_ACTIVOS.includes(p.estado));
    historial.sort((a, b) => new Date(b.fecha_cierre || '2000-01-01') - new Date(a.fecha_cierre || '2000-01-01'));

    if (filtroEstado === 'con_saldo') historial = historial.filter(p => p.estado === 'Entregado' && (p.precio - (p.monto_pagado || 0)) > 0);
    else if (filtroEstado === 'entregados') historial = historial.filter(p => p.estado === 'Entregado' && (p.precio - (p.monto_pagado || 0)) <= 0);
    else if (filtroEstado === 'anulados') historial = historial.filter(p => p.estado === 'Cancelado');

    if (filtroTexto) {
        const txt = filtroTexto.toLowerCase();
        historial = historial.filter(p => (p.cliente && p.cliente.toLowerCase().includes(txt)) || (p.producto && p.producto.toLowerCase().includes(txt)));
    }

    const historialCortado = historial.slice(0, limite);
    const total = historial.length;

    // Acciones
    const handleVerDetalle = (ped) => { setPedidoActivo(ped); setShowModal(true); };

    const handleWhatsApp = () => {
        let num = pedidoActivo.telefono.replace(/[\s-]/g, '');
        if (num.length === 8) num = '506' + num;
        const saldo = (pedidoActivo.precio || 0) - (pedidoActivo.monto_pagado || 0);
        let txt = `Hola ${pedidoActivo.cliente}, te escribimos de *MASUCRI* sobre tu pedido de *${pedidoActivo.producto}*.`;
        if (saldo > 0) txt += ` Queda un saldo pendiente de ₡${saldo.toLocaleString('es-CR')}.`;
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(txt)}`, '_blank');
    };

    const handleImprimirTicket = () => window.print();

    const handleRevertir = async () => {
        if (!pedidoActivo) return;
        try {
            await updateDoc(doc(db, "pedidos", pedidoActivo.id), { estado: 'Pendiente' });
            setShowModal(false);
            Swal.fire({ icon: 'success', title: 'Devuelto al Kanban', timer: 1000, showConfirmButton: false });
        } catch (error) { Swal.fire('Error', 'No se pudo revertir', 'error'); }
    };

    const handleBorrar = async () => {
        if (!pedidoActivo) return;
        const result = await Swal.fire({ title: '¿Borrar definitivo?', text: 'Se eliminará el registro.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' });
        if (result.isConfirmed) {
            await deleteDoc(doc(db, "pedidos", pedidoActivo.id));
            setShowModal(false);
            Swal.fire('Borrado', '', 'success');
        }
    };

    const handleAbonar = async () => {
        if (!pedidoActivo) return;
        const deudaAnterior = (pedidoActivo.precio || 0) - (pedidoActivo.monto_pagado || 0);
        if (deudaAnterior <= 0) return Swal.fire('Aviso', 'Pagado en su totalidad.', 'info');

        const { value: formValues } = await Swal.fire({
            title: 'Abonar a la deuda',
            html: `
                <div class="text-start mb-2"><label>Deuda Actual: ₡${deudaAnterior.toLocaleString()}</label>
                <input id="swal-monto" type="number" class="form-control" placeholder="Monto del abono"></div>
                <select id="swal-metodo" class="form-select"><option>Efectivo</option><option>Sinpe Móvil</option><option>Transferencia</option></select>
            `,
            showCancelButton: true,
            preConfirm: () => {
                const m = parseFloat(document.getElementById('swal-monto').value);
                if (!m || m <= 0) { Swal.showValidationMessage('Monto inválido'); return false; }
                return { m, met: document.getElementById('swal-metodo').value };
            }
        });

        if (formValues) {
            const { m, met } = formValues;
            const nuevoPagado = (pedidoActivo.monto_pagado || 0) + m;
            const hoy = obtenerFechaLocal();
            let arrPagos = pedidoActivo.historial_pagos || [];
            arrPagos.push({ fecha: hoy, monto: m, metodo: met });

            await updateDoc(doc(db, "pedidos", pedidoActivo.id), { monto_pagado: nuevoPagado, ultimo_metodo_pago: met, historial_pagos: arrPagos });
            await addDoc(collection(db, "movimientos"), { tipo: 'entrada', metodo_pago: met, fecha: hoy, descripcion: `Abono: ${pedidoActivo.producto}`, entidad: pedidoActivo.cliente, monto: m, timestamp: new Date() });
            setShowModal(false);
            Swal.fire('Abono Registrado', 'El dinero ya ingresó a Caja.', 'success');
        }
    };

    const deudaActual = pedidoActivo ? (pedidoActivo.precio || 0) - (pedidoActivo.monto_pagado || 0) : 0;
    const pagos = pedidoActivo?.historial_pagos || [];

    return (
        <Container className="mt-4 flex-grow-1">
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 d-print-none">
                <h3 className="fw-bold m-0 text-dark"><i className="fas fa-history"></i> Historial de Trabajos</h3>
                <div className="d-flex gap-2 flex-wrap flex-grow-1 justify-content-end">
                    <Form.Control type="text" placeholder="Buscar cliente o producto..." className="border-primary shadow-sm" style={{ maxWidth: '250px' }} value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} />
                    <Form.Select className="w-auto border-primary fw-bold text-primary shadow-sm" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                        <option value="con_saldo">Mostrar: Con Saldo Pendiente</option>
                        <option value="todos">Mostrar: Todos</option>
                        <option value="entregados">Mostrar: Cancelados al 100%</option>
                        <option value="anulados">Mostrar: Anulados/Eliminados</option>
                    </Form.Select>
                </div>
            </div>

            <Card className="shadow-sm border-0 d-print-none">
                <Card.Body className="p-0 table-responsive" style={{ height: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                    <Table hover className="align-middle m-0 text-nowrap">
                        <thead className="table-light sticky-top shadow-sm">
                            <tr><th>Estado</th><th>Cliente</th><th>Producto</th><th className="text-center">Acción</th></tr>
                        </thead>
                        <tbody>
                            {historialCortado.length === 0 ? (
                                <tr><td colSpan="4" className="text-center py-4 text-muted">No hay registros con la opción seleccionada.</td></tr>
                            ) : (
                                historialCortado.map(ped => {
                                    const deuda = (ped.precio || 0) - (ped.monto_pagado || 0);
                                    let bColor = ped.estado === 'Entregado' ? 'success' : 'danger';
                                    let txtEst = ped.estado;
                                    if (ped.estado === 'Entregado' && deuda > 0) { bColor = 'warning text-dark'; txtEst = 'Con Saldo'; }

                                    return (
                                        <tr key={ped.id}>
                                            <td><Badge bg={bColor}>{txtEst}</Badge></td>
                                            <td className="fw-bold">{ped.cliente}</td>
                                            <td className="text-truncate" style={{ maxWidth: '180px' }}>{ped.producto}</td>
                                            <td className="text-center">
                                                <Button variant="primary" size="sm" className="rounded-pill px-3 shadow-sm fw-bold" onClick={() => handleVerDetalle(ped)}><i className="fas fa-search"></i> Ver</Button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                            {total > limite && (
                                <tr><td colSpan="4" className="text-center py-3"><Button variant="outline-secondary" size="sm" onClick={() => setLimite(l => l + 50)}>👇 Cargar más antiguos</Button></td></tr>
                            )}
                        </tbody>
                    </Table>
                </Card.Body>
            </Card>

            {/* MODAL DE DETALLE DE PEDIDO */}
            <Modal show={showModal} onHide={() => setShowModal(false)} centered className="d-print-none">
                <Modal.Header closeButton className="bg-light border-bottom-0 pb-0">
                    <Modal.Title className="fw-bold fs-5"><i className="fas fa-file-invoice text-dark"></i> Detalle del Pedido</Modal.Title>
                </Modal.Header>
                {pedidoActivo && (
                    <Modal.Body className="p-0">
                        <div className="text-center pb-3 pt-2 bg-light border-bottom">
                            <Badge bg={pedidoActivo.estado === 'Cancelado' ? 'danger' : (deudaActual > 0 ? 'warning' : 'success')} className="fs-6 px-4 py-2 shadow-sm border text-dark mb-2">
                                {pedidoActivo.estado === 'Entregado' && deudaActual > 0 ? 'Entregado - Con Saldo' : pedidoActivo.estado}
                            </Badge>
                            <p className="text-muted small mb-0">Entrega pautada: <strong>{pedidoActivo.fecha_entrega || 'Sin fecha'}</strong></p>
                        </div>
                        <ListGroup variant="flush">
                            <ListGroup.Item className="py-3">
                                <small className="text-muted d-block mb-1">Cliente</small>
                                <h5 className="fw-bold mb-1">{pedidoActivo.cliente}</h5>
                                {pedidoActivo.telefono && (
                                    <Button variant="success" size="sm" className="fw-bold rounded shadow-sm mt-1" onClick={handleWhatsApp}>
                                        <i className="fab fa-whatsapp fs-6"></i> {pedidoActivo.telefono}
                                    </Button>
                                )}
                            </ListGroup.Item>
                            <ListGroup.Item className="py-3">
                                <small className="text-muted d-block mb-1">Producto</small>
                                <h6 className="fw-bold mb-1">{pedidoActivo.producto}</h6>
                                {pedidoActivo.descripcion && <p className="small text-muted mb-0 mt-1">{pedidoActivo.descripcion}</p>}
                            </ListGroup.Item>
                            <ListGroup.Item className="py-3">
                                <Row className="text-center">
                                    <Col xs={6} className="border-end">
                                        <small className="text-muted d-block">Precio Total</small>
                                        <span className="fw-bold fs-6">₡{(pedidoActivo.precio || 0).toLocaleString('es-CR')}</span>
                                    </Col>
                                    <Col xs={6}>
                                        <small className="text-muted d-block">Total Pagado</small>
                                        <span className="fw-bold fs-6 text-success">₡{(pedidoActivo.monto_pagado || 0).toLocaleString('es-CR')}</span>
                                    </Col>
                                </Row>
                            </ListGroup.Item>
                            
                            {pagos.length > 0 && (
                                <ListGroup.Item className="bg-light py-3">
                                    <small className="fw-bold d-block mb-2 text-primary"><i className="fas fa-history"></i> Pagos Registrados</small>
                                    {pagos.map((p, idx) => (
                                        <div key={idx} className="d-flex justify-content-between small border-bottom pb-1 mb-1">
                                            <span>{p.fecha} <Badge bg="secondary" className="ms-1">{p.metodo}</Badge></span>
                                            <span className="text-success fw-bold">₡{p.monto.toLocaleString('es-CR')}</span>
                                        </div>
                                    ))}
                                </ListGroup.Item>
                            )}
                        </ListGroup>
                    </Modal.Body>
                )}
                <Modal.Footer className="justify-content-center bg-white border-top-0 pt-3 gap-2 flex-wrap">
                    <Button variant="outline-info" className="fw-bold flex-grow-1" onClick={handleImprimirTicket}>
                        <i className="fas fa-receipt"></i> Ticket
                    </Button>
                    <Button variant="dark" className="fw-bold flex-grow-1" onClick={handleRevertir}>
                        <i className="fas fa-undo"></i> Revertir a Pendiente
                    </Button>
                    <Button variant="outline-danger" onClick={handleBorrar}>
                        <i className="fas fa-trash"></i>
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* TICKET DE IMPRESIÓN */}
            <TicketImpresion pedido={pedidoActivo} />
        </Container>
    );
}