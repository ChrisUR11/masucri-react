import { useState, useMemo } from 'react';
import { Container, Card, Table, Button, Form, Modal, Badge } from 'react-bootstrap';
import { collection, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Swal from 'sweetalert2';
import { TicketImpresion } from '../components/TicketImpresion';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import EstadoCarga, { EstadoError } from '../components/EstadoCarga';
import FichaPedidoDetalle from '../components/FichaPedidoDetalle';
import { registrarAbono } from '../utils/abonoPedido';
import { abrirWhatsApp, mensajePedido } from '../utils/whatsapp';

const ESTADOS_ACTIVOS = ['Pendiente', 'En producción', 'Por Retirar'];

export default function Historial() {
    const { datos: pedidos, cargando, error } = useFirestoreCollection(() => collection(db, 'pedidos'), []);

    const [filtroTexto, setFiltroTexto] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('con_saldo');
    const [limite, setLimite] = useState(50);

    const [showModal, setShowModal] = useState(false);
    const [pedidoActivo, setPedidoActivo] = useState(null);

    const historialCompleto = useMemo(() => {
        let lista = pedidos.filter((p) => !ESTADOS_ACTIVOS.includes(p.estado));
        lista.sort((a, b) => new Date(b.fecha_cierre || '2000-01-01') - new Date(a.fecha_cierre || '2000-01-01'));

        if (filtroEstado === 'con_saldo') lista = lista.filter((p) => p.estado === 'Entregado' && (p.precio - (p.monto_pagado || 0)) > 0);
        else if (filtroEstado === 'entregados') lista = lista.filter((p) => p.estado === 'Entregado' && (p.precio - (p.monto_pagado || 0)) <= 0);
        else if (filtroEstado === 'anulados') lista = lista.filter((p) => p.estado === 'Cancelado');

        if (filtroTexto) {
            const txt = filtroTexto.toLowerCase();
            lista = lista.filter((p) => p.cliente?.toLowerCase().includes(txt) || p.producto?.toLowerCase().includes(txt));
        }
        return lista;
    }, [pedidos, filtroEstado, filtroTexto]);

    const total = historialCompleto.length;
    const historialCortado = historialCompleto.slice(0, limite);

    // Mantener sincronizado el pedido abierto en el modal con los cambios en tiempo real.
    const pedidoActivoActualizado = pedidoActivo ? pedidos.find((p) => p.id === pedidoActivo.id) || pedidoActivo : null;

    const handleVerDetalle = (ped) => {
        setPedidoActivo(ped);
        setShowModal(true);
    };

    const handleWhatsApp = () => abrirWhatsApp(pedidoActivoActualizado.telefono, mensajePedido(pedidoActivoActualizado));

    const handleImprimirTicket = () => window.print();

    const handleRevertir = async () => {
        if (!pedidoActivoActualizado) return;
        try {
            await updateDoc(doc(db, 'pedidos', pedidoActivoActualizado.id), { estado: 'Pendiente' });
            setShowModal(false);
            Swal.fire({ icon: 'success', title: 'Devuelto al Kanban', timer: 1000, showConfirmButton: false });
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo revertir', 'error');
        }
    };

    const handleBorrar = async () => {
        if (!pedidoActivoActualizado) return;
        const result = await Swal.fire({
            title: '¿Borrar definitivo?',
            text: 'Se eliminará el registro permanentemente.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545'
        });
        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, 'pedidos', pedidoActivoActualizado.id));
                setShowModal(false);
                Swal.fire({ icon: 'success', title: 'Borrado', timer: 1000, showConfirmButton: false });
            } catch (err) {
                console.error(err);
                Swal.fire('Error', 'No se pudo borrar el registro.', 'error');
            }
        }
    };

    const handleAbonar = async () => {
        if (!pedidoActivoActualizado) return;
        const registrado = await registrarAbono(pedidoActivoActualizado);
        if (registrado) setShowModal(false);
    };

    return (
        <Container className="mt-4 flex-grow-1">
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 d-print-none">
                <h3 className="fw-bold m-0 text-dark"><i className="fas fa-history"></i> Historial de Trabajos</h3>
                <div className="d-flex gap-2 flex-wrap flex-grow-1 justify-content-end">
                    <Form.Control
                        type="text"
                        placeholder="Buscar cliente o producto..."
                        className="border-primary shadow-sm"
                        style={{ maxWidth: '250px' }}
                        value={filtroTexto}
                        onChange={(e) => setFiltroTexto(e.target.value)}
                        aria-label="Buscar en el historial"
                    />
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
                    {error ? (
                        <EstadoError texto="No se pudo cargar el historial. Revisa tu conexión." />
                    ) : cargando ? (
                        <EstadoCarga texto="Cargando historial..." />
                    ) : (
                        <Table hover className="align-middle m-0 text-nowrap">
                            <thead className="table-light sticky-top shadow-sm">
                                <tr><th>Estado</th><th>Cliente</th><th>Producto</th><th className="text-center">Acción</th></tr>
                            </thead>
                            <tbody>
                                {historialCortado.length === 0 ? (
                                    <tr><td colSpan="4" className="text-center py-4 text-muted">No hay registros con la opción seleccionada.</td></tr>
                                ) : (
                                    historialCortado.map((ped) => {
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
                                                    <Button variant="primary" size="sm" className="rounded-pill px-3 shadow-sm fw-bold" onClick={() => handleVerDetalle(ped)}>
                                                        <i className="fas fa-search"></i> Ver
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                                {total > limite && (
                                    <tr>
                                        <td colSpan="4" className="text-center py-3">
                                            <Button variant="outline-secondary" size="sm" onClick={() => setLimite((l) => l + 50)}>👇 Cargar más antiguos</Button>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </Table>
                    )}
                </Card.Body>
            </Card>

            {/* MODAL DE DETALLE DE PEDIDO */}
            <Modal show={showModal} onHide={() => setShowModal(false)} centered className="d-print-none">
                <Modal.Header closeButton className="bg-light border-bottom-0 pb-0">
                    <Modal.Title className="fw-bold fs-5"><i className="fas fa-file-invoice text-dark"></i> Detalle del Pedido</Modal.Title>
                </Modal.Header>
                {pedidoActivoActualizado && (
                    <Modal.Body className="p-0">
                        <FichaPedidoDetalle
                            pedido={pedidoActivoActualizado}
                            onWhatsApp={handleWhatsApp}
                            mostrarHistorialPagos
                            badgeEstado={
                                <Badge
                                    bg={pedidoActivoActualizado.estado === 'Cancelado' ? 'danger' : ((pedidoActivoActualizado.precio || 0) - (pedidoActivoActualizado.monto_pagado || 0) > 0 ? 'warning' : 'success')}
                                    className="fs-6 px-4 py-2 shadow-sm border text-dark mb-2"
                                >
                                    {pedidoActivoActualizado.estado === 'Entregado' && (pedidoActivoActualizado.precio || 0) - (pedidoActivoActualizado.monto_pagado || 0) > 0
                                        ? 'Entregado - Con Saldo'
                                        : pedidoActivoActualizado.estado}
                                </Badge>
                            }
                        />
                    </Modal.Body>
                )}
                <Modal.Footer className="justify-content-center bg-white border-top-0 pt-3 gap-2 flex-wrap">
                    <Button variant="outline-info" className="fw-bold flex-grow-1" onClick={handleImprimirTicket}>
                        <i className="fas fa-receipt"></i> Ticket
                    </Button>
                    {pedidoActivoActualizado && (pedidoActivoActualizado.precio || 0) - (pedidoActivoActualizado.monto_pagado || 0) > 0 && (
                        <Button variant="outline-primary" className="fw-bold flex-grow-1" onClick={handleAbonar}>
                            <i className="fas fa-coins"></i> Abonar
                        </Button>
                    )}
                    <Button variant="dark" className="fw-bold flex-grow-1" onClick={handleRevertir}>
                        <i className="fas fa-undo"></i> Revertir a Pendiente
                    </Button>
                    <Button variant="outline-danger" onClick={handleBorrar} aria-label="Borrar registro definitivamente">
                        <i className="fas fa-trash"></i>
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* TICKET DE IMPRESIÓN */}
            <TicketImpresion pedido={pedidoActivoActualizado} />
        </Container>
    );
}
