import { useState, useMemo } from 'react';
import { Container, Card, Table, Button, Form, Modal, Badge } from 'react-bootstrap';
import { collection, doc, runTransaction, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Swal from 'sweetalert2';
import { TicketImpresion } from '../components/TicketImpresion';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useDebounce } from '../hooks/useDebounce';
import EstadoCarga, { EstadoError } from '../components/EstadoCarga';
import FichaPedidoDetalle from '../components/FichaPedidoDetalle';
import { registrarAbono } from '../utils/abonoPedido';
import { borrarPedidoConTrazabilidad } from '../utils/trazabilidad';
import { abrirWhatsApp, mensajePedido } from '../utils/whatsapp';
import { compartirTicket } from '../utils/ticketImagen';
import { formatoColones } from '../utils/formato';

const ESTADOS_ACTIVOS = ['Pendiente', 'En producción', 'Por Retirar'];

export default function Historial() {
    const { datos: pedidos, cargando, error } = useFirestoreCollection(() => collection(db, 'pedidos'), []);

    const [filtroTexto, setFiltroTexto] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('con_saldo');
    const [limite, setLimite] = useState(50);

    const [showModal, setShowModal] = useState(false);
    const [pedidoActivo, setPedidoActivo] = useState(null);
    const [procesando, setProcesando] = useState(false);
    const [editando, setEditando] = useState(false);
    const [guardandoEdicion, setGuardandoEdicion] = useState(false);
    const [errorEdicion, setErrorEdicion] = useState('');
    const [formEdicion, setFormEdicion] = useState({
        cliente: '', telefono: '', producto: '', descripcion: '', fecha_entrega: '', precio: ''
    });

    const filtroTextoDebounced = useDebounce(filtroTexto, 250);

    const historialCompleto = useMemo(() => {
        let lista = pedidos.filter((p) => !ESTADOS_ACTIVOS.includes(p.estado));
        lista.sort((a, b) => new Date(b.fecha_cierre || '2000-01-01') - new Date(a.fecha_cierre || '2000-01-01'));

        if (filtroEstado === 'con_saldo') lista = lista.filter((p) => p.estado === 'Entregado' && (p.precio - (p.monto_pagado || 0)) > 0);
        else if (filtroEstado === 'entregados') lista = lista.filter((p) => p.estado === 'Entregado' && (p.precio - (p.monto_pagado || 0)) <= 0);
        else if (filtroEstado === 'anulados') lista = lista.filter((p) => p.estado === 'Cancelado');

        if (filtroTextoDebounced) {
            const txt = filtroTextoDebounced.toLowerCase();
            lista = lista.filter((p) => p.cliente?.toLowerCase().includes(txt) || p.producto?.toLowerCase().includes(txt));
        }
        return lista;
    }, [pedidos, filtroEstado, filtroTextoDebounced]);

    const total = historialCompleto.length;
    const historialCortado = historialCompleto.slice(0, limite);

    // Mantener sincronizado el pedido abierto en el modal con los cambios en tiempo real.
    const pedidoActivoActualizado = pedidoActivo ? pedidos.find((p) => p.id === pedidoActivo.id) || pedidoActivo : null;

    const handleVerDetalle = (ped) => {
        setPedidoActivo(ped);
        setEditando(false);
        setShowModal(true);
    };

    const abrirEditar = () => {
        if (pedidoActivoActualizado?.estado !== 'Entregado' || procesando) return;
        const ped = pedidoActivoActualizado;
        setFormEdicion({
            cliente: ped.cliente || '',
            telefono: ped.telefono || '',
            producto: ped.producto || '',
            descripcion: ped.descripcion || '',
            fecha_entrega: ped.fecha_entrega || '',
            precio: ped.precio ?? ''
        });
        setErrorEdicion('');
        setEditando(true);
    };

    const actualizarEdicion = (campo) => (e) => {
        setFormEdicion((actual) => ({ ...actual, [campo]: e.target.value }));
        setErrorEdicion('');
    };

    const guardarEdicion = async (e) => {
        e.preventDefault();
        if (!pedidoActivoActualizado || guardandoEdicion) return;

        const precio = Number(formEdicion.precio);
        const cliente = formEdicion.cliente.trim();
        const producto = formEdicion.producto.trim();
        if (!cliente || !producto || formEdicion.precio === '' || !Number.isFinite(precio) || precio < 0) {
            setErrorEdicion('Completa el cliente, el producto y un precio válido.');
            return;
        }

        setGuardandoEdicion(true);
        setErrorEdicion('');
        try {
            const pedidoRef = doc(db, 'pedidos', pedidoActivoActualizado.id);
            await runTransaction(db, async (transaccion) => {
                const actual = await transaccion.get(pedidoRef);
                if (!actual.exists() || actual.data().estado !== 'Entregado') {
                    throw new Error('Este pedido ya no está entregado. Vuelve a abrirlo desde el historial.');
                }
                if (precio < (Number(actual.data().monto_pagado) || 0)) {
                    throw new Error('El precio total no puede ser menor que el monto ya pagado.');
                }
                transaccion.update(pedidoRef, {
                    cliente,
                    telefono: formEdicion.telefono.trim(),
                    producto,
                    descripcion: formEdicion.descripcion.trim(),
                    fecha_entrega: formEdicion.fecha_entrega,
                    precio
                });
            });
            setEditando(false);
            Swal.fire({ icon: 'success', title: 'Pedido actualizado', timer: 1200, showConfirmButton: false });
        } catch (err) {
            console.error('Error al editar el pedido entregado:', err);
            setErrorEdicion(err.message?.startsWith('Este pedido') || err.message?.startsWith('El precio')
                ? err.message
                : 'No se pudieron guardar los cambios. Revisa tu conexión e inténtalo de nuevo.');
        } finally {
            setGuardandoEdicion(false);
        }
    };

    const handleWhatsApp = () => abrirWhatsApp(pedidoActivoActualizado.telefono, mensajePedido(pedidoActivoActualizado));

    const handleEnviarTicket = async () => {
        try {
            const resultado = await compartirTicket(pedidoActivoActualizado);
            if (resultado === 'descargado') {
                Swal.fire({
                    icon: 'info',
                    title: 'Ticket descargado',
                    text: 'Este navegador no permite compartir archivos directamente. La imagen se descargó para que la adjuntes donde quieras enviarla.',
                    timer: 3000,
                    showConfirmButton: false
                });
            }
        } catch (err) {
            console.error('Error generando el ticket:', err);
            Swal.fire('Error', 'No se pudo generar el ticket.', 'error');
        }
    };

    const handleRevertir = async () => {
        if (!pedidoActivoActualizado || procesando) return;
        setProcesando(true);
        try {
            await updateDoc(doc(db, 'pedidos', pedidoActivoActualizado.id), { estado: 'Pendiente' });
            setShowModal(false);
            Swal.fire({ icon: 'success', title: 'Devuelto al Kanban', timer: 1000, showConfirmButton: false });
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo revertir', 'error');
        } finally {
            setProcesando(false);
        }
    };

    const handleBorrar = async () => {
        if (!pedidoActivoActualizado || procesando) return;
        const result = await Swal.fire({
            title: '¿Borrar definitivo?',
            text: 'Se eliminará el pedido Y todos sus movimientos en Finanzas (abonos). No se puede deshacer.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545'
        });
        if (result.isConfirmed) {
            setProcesando(true);
            try {
                const { movimientosBorrados } = await borrarPedidoConTrazabilidad(pedidoActivoActualizado.id);
                setShowModal(false);
                Swal.fire({
                    icon: 'success',
                    title: 'Borrado',
                    text: `Se eliminó el pedido y ${movimientosBorrados} movimiento(s) de Finanzas.`,
                    timer: 1500,
                    showConfirmButton: false
                });
            } catch (err) {
                console.error(err);
                Swal.fire('Error', 'No se pudo borrar el registro.', 'error');
            } finally {
                setProcesando(false);
            }
        }
    };

    const handleAbonar = async () => {
        if (!pedidoActivoActualizado || procesando) return;
        setProcesando(true);
        try {
            const registrado = await registrarAbono(pedidoActivoActualizado);
            if (registrado) setShowModal(false);
        } finally {
            setProcesando(false);
        }
    };

    return (
        <Container className="mt-4 flex-grow-1">
            <div className="page-heading d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 d-print-none">
                <h3 className="fw-bold m-0 text-dark"><i className="fas fa-history"></i> Historial de Trabajos</h3>
                <div className="page-heading-filters d-flex gap-2 flex-wrap flex-grow-1 justify-content-end">
                    <Form.Control
                        type="search"
                        placeholder="Buscar cliente o producto..."
                        className="border-primary shadow-sm"
                        style={{ maxWidth: '250px' }}
                        value={filtroTexto}
                        onChange={(e) => setFiltroTexto(e.target.value)}
                        aria-label="Buscar en el historial"
                    />
                    <Form.Select className="w-auto border-primary fw-bold text-primary shadow-sm" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} aria-label="Filtrar historial por estado de pago">
                        <option value="con_saldo">Mostrar: Con Saldo Pendiente</option>
                        <option value="todos">Mostrar: Todos</option>
                        <option value="entregados">Mostrar: Cancelados al 100%</option>
                        <option value="anulados">Mostrar: Anulados/Eliminados</option>
                    </Form.Select>
                </div>
            </div>

            <Card className="shadow-sm border-0 d-print-none">
                <Card.Body className="p-0 mobile-card-table-wrap">
                    {error ? (
                        <EstadoError texto="No se pudo cargar el historial. Revisa tu conexión." />
                    ) : cargando ? (
                        <EstadoCarga texto="Cargando historial..." />
                    ) : (
                        <Table hover className="mobile-card-table align-middle m-0" aria-label="Pedidos finalizados">
                            <thead className="table-light sticky-top shadow-sm" style={{ zIndex: 1 }}>
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
                                                <td data-label="Estado"><Badge bg={bColor}>{txtEst}</Badge></td>
                                                <td data-label="Cliente" className="fw-bold">{ped.cliente}</td>
                                                <td data-label="Producto" className="text-truncate" style={{ maxWidth: '180px' }}>{ped.producto}</td>
                                                <td data-label="Acción" className="text-center">
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
            <Modal show={showModal} onHide={() => { if (!guardandoEdicion) { setShowModal(false); setEditando(false); } }} centered scrollable enforceFocus={false} className="d-print-none">
                <Modal.Header closeButton className="bg-light border-bottom-0 pb-0">
                    <Modal.Title className="fw-bold fs-5"><i className={`fas ${editando ? 'fa-pen' : 'fa-file-invoice'} text-dark`}></i> {editando ? 'Editar pedido entregado' : 'Detalle del Pedido'}</Modal.Title>
                </Modal.Header>
                {editando ? (
                    <>
                        <Modal.Body className="pt-3">
                            <Form id="editar-pedido-entregado" onSubmit={guardarEdicion}>
                                <p className="small text-muted">Corrige los datos del pedido o aumenta el precio si el cliente se llevó algo más. Los pagos ya registrados se conservan.</p>
                                <Form.Group controlId="historial-editar-cliente" className="mb-3">
                                    <Form.Label className="fw-bold small">Cliente</Form.Label>
                                    <Form.Control required type="text" autoComplete="name" value={formEdicion.cliente} onChange={actualizarEdicion('cliente')} />
                                </Form.Group>
                                <Form.Group controlId="historial-editar-telefono" className="mb-3">
                                    <Form.Label className="fw-bold small">Teléfono</Form.Label>
                                    <Form.Control type="tel" inputMode="tel" autoComplete="tel" value={formEdicion.telefono} onChange={actualizarEdicion('telefono')} />
                                </Form.Group>
                                <Form.Group controlId="historial-editar-producto" className="mb-3">
                                    <Form.Label className="fw-bold small">Producto</Form.Label>
                                    <Form.Control required type="text" value={formEdicion.producto} onChange={actualizarEdicion('producto')} />
                                </Form.Group>
                                <Form.Group controlId="historial-editar-descripcion" className="mb-3">
                                    <Form.Label className="fw-bold small">Notas</Form.Label>
                                    <Form.Control as="textarea" rows={2} value={formEdicion.descripcion} onChange={actualizarEdicion('descripcion')} />
                                </Form.Group>
                                <Form.Group controlId="historial-editar-fecha" className="mb-3">
                                    <Form.Label className="fw-bold small">Fecha de entrega pautada</Form.Label>
                                    <Form.Control type="date" value={formEdicion.fecha_entrega} onChange={actualizarEdicion('fecha_entrega')} />
                                </Form.Group>
                                <Form.Group controlId="historial-editar-precio" className="mb-2">
                                    <Form.Label className="fw-bold small">Precio total (₡)</Form.Label>
                                    <Form.Control required type="number" inputMode="decimal" min="0" step="0.01" value={formEdicion.precio} onChange={actualizarEdicion('precio')} />
                                </Form.Group>
                                <div className="bg-light border rounded p-2 small" aria-live="polite">
                                    Pagado: <strong>{formatoColones(pedidoActivoActualizado?.monto_pagado)}</strong><br />
                                    Nuevo saldo: <strong>{Number(formEdicion.precio) >= (pedidoActivoActualizado?.monto_pagado || 0)
                                        ? formatoColones(Number(formEdicion.precio) - (pedidoActivoActualizado?.monto_pagado || 0))
                                        : 'El total es menor que lo pagado'}</strong>
                                </div>
                                {errorEdicion && <div role="alert" className="alert alert-warning mt-3 mb-0">{errorEdicion}</div>}
                            </Form>
                        </Modal.Body>
                        <Modal.Footer className="gap-2 flex-wrap">
                            <Button variant="outline-secondary" onClick={() => setEditando(false)} disabled={guardandoEdicion}>Cancelar</Button>
                            <Button type="submit" form="editar-pedido-entregado" variant="primary" className="fw-bold" disabled={guardandoEdicion}>
                                {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
                            </Button>
                        </Modal.Footer>
                    </>
                ) : (
                    <>
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
                            <Button variant="outline-info" className="fw-bold flex-grow-1" onClick={handleEnviarTicket} disabled={procesando}>
                                <i className="fas fa-share-nodes"></i> Enviar Ticket
                            </Button>
                            {pedidoActivoActualizado && (pedidoActivoActualizado.precio || 0) - (pedidoActivoActualizado.monto_pagado || 0) > 0 && (
                                <Button variant="outline-primary" className="fw-bold flex-grow-1" onClick={handleAbonar} disabled={procesando}>
                                    <i className="fas fa-coins"></i> Abonar
                                </Button>
                            )}
                            {pedidoActivoActualizado?.estado === 'Entregado' && (
                                <Button variant="outline-secondary" className="fw-bold flex-grow-1" onClick={abrirEditar} disabled={procesando}>
                                    <i className="fas fa-pen"></i> Editar
                                </Button>
                            )}
                            <Button variant="dark" className="fw-bold flex-grow-1" onClick={handleRevertir} disabled={procesando}>
                                <i className="fas fa-undo"></i> Revertir a Pendiente
                            </Button>
                            <Button variant="outline-danger" onClick={handleBorrar} disabled={procesando} aria-label="Borrar registro definitivamente">
                                <i className="fas fa-trash"></i>
                            </Button>
                        </Modal.Footer>
                    </>
                )}
            </Modal>

            {/* TICKET DE IMPRESIÓN */}
            <TicketImpresion pedido={pedidoActivoActualizado} />
        </Container>
    );
}
