import { useState, useMemo } from 'react';
import { Container, Card, Badge, Button, Form, Modal, Row, Col, InputGroup, ButtonGroup, ListGroup } from 'react-bootstrap';
import { collection, query, orderBy, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Swal from 'sweetalert2';
import { TicketImpresion } from '../components/TicketImpresion';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import EstadoCarga, { EstadoError } from '../components/EstadoCarga';
import FichaPedidoDetalle from '../components/FichaPedidoDetalle';
import VentaRapidaModal from '../components/VentaRapidaModal';
import { registrarAbono } from '../utils/abonoPedido';
import { abrirWhatsApp, mensajePedido } from '../utils/whatsapp';
import { obtenerFechaLocal, diasHastaEntrega, formatearFechaCorta } from '../utils/fecha';
import { formatoColones, aNumeroSeguro } from '../utils/formato';

const ESTADOS_ACTIVOS = ['Pendiente', 'En producción', 'Por Retirar'];

// Columnas del Kanban armadas por datos, en vez de repetir el mismo bloque
// de JSX tres veces (una por estado). Agregar una columna nueva ahora es
// solo agregar un elemento aquí.
const COLUMNAS = [
    { estado: 'Pendiente', label: 'Pendiente', icon: 'fa-inbox', bg: '#6c757d', text: 'text-white' },
    { estado: 'En producción', label: 'En Producción', icon: 'fa-hammer', bg: '#0dcaf0', text: 'text-white' },
    { estado: 'Por Retirar', label: 'Por Retirar', icon: 'fa-box-open', bg: '#ffc107', text: 'text-dark' }
];

const FORM_PEDIDO_VACIO = {
    fSolicitud: obtenerFechaLocal(),
    fEntrega: '',
    cliente: '',
    telefono: '',
    producto: '',
    desc: '',
    precio: '',
    dejoAdelanto: false,
    adelanto: '',
    metodoAdelanto: 'Sinpe Móvil'
};

export default function Pedidos() {
    const { datos: todosPedidos, cargando, error } = useFirestoreCollection(
        () => query(collection(db, 'pedidos'), orderBy('fecha_solicitud', 'asc')),
        []
    );
    const { datos: productosCatalogo } = useFirestoreCollection(() => collection(db, 'productos'), []);

    const pedidos = useMemo(() => todosPedidos.filter((p) => ESTADOS_ACTIVOS.includes(p.estado)), [todosPedidos]);

    const [filtroTexto, setFiltroTexto] = useState('');

    // Modales
    const [showNuevo, setShowNuevo] = useState(false);
    const [showVenta, setShowVenta] = useState(false);
    const [showDetalle, setShowDetalle] = useState(false);
    const [pedidoActivoId, setPedidoActivoId] = useState(null);
    const [pedidoEdit, setPedidoEdit] = useState(null);

    const [formPedido, setFormPedido] = useState(FORM_PEDIDO_VACIO);
    const [guardandoPedido, setGuardandoPedido] = useState(false);

    // El pedido activo se busca por id en la lista en vivo, así el modal
    // siempre refleja el estado más reciente sin necesitar sincronización manual.
    const pedidoActivo = pedidoActivoId ? pedidos.find((p) => p.id === pedidoActivoId) || null : null;

    const actualizarForm = (campo) => (e) => setFormPedido((f) => ({ ...f, [campo]: e.target.value }));

    // --- API Contactos ---
    const handleSeleccionarContacto = async (setTelefonoFn, setClienteFn, clienteActual) => {
        if ('contacts' in navigator && 'ContactsManager' in window) {
            try {
                const contactos = await navigator.contacts.select(['name', 'tel'], { multiple: false });
                if (contactos.length > 0) {
                    const contacto = contactos[0];
                    if (contacto.tel?.length > 0) {
                        let num = contacto.tel[0].replace(/[\s-]/g, '');
                        if (num.startsWith('+506')) num = num.substring(4);
                        setTelefonoFn(num);
                    }
                    if (contacto.name?.length > 0 && !clienteActual) setClienteFn(contacto.name[0]);
                }
            } catch (ex) {
                console.log('Selección de contacto cancelada.');
            }
        } else {
            Swal.fire('Aviso', 'Tu dispositivo no soporta la extracción de contactos.', 'info');
        }
    };

    // --- Drag & Drop ---
    const handleDragStart = (e, id) => e.dataTransfer.setData('idPedido', id);
    const handleDrop = async (e, nuevoEstado) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('idPedido');
        const ped = pedidos.find((p) => p.id === id);
        if (ped && ped.estado !== nuevoEstado) {
            await updateDoc(doc(db, 'pedidos', id), { estado: nuevoEstado });
        }
    };

    // --- Modal de Detalle ---
    const abrirDetalle = (ped) => {
        setPedidoActivoId(ped.id);
        setShowDetalle(true);
    };

    const handleWhatsApp = () => abrirWhatsApp(pedidoActivo.telefono, mensajePedido(pedidoActivo));
    const handleImprimirTicket = () => window.print();

    const handleEntregar = async () => {
        const deuda = (pedidoActivo.precio || 0) - (pedidoActivo.monto_pagado || 0);
        const msg = deuda > 0 ? `Tiene un saldo pendiente de ${formatoColones(deuda)}. ¿Entregar de todas formas?` : '¿Marcar como entregado?';
        const res = await Swal.fire({ title: '¿Entregar Trabajo?', text: msg, icon: 'question', showCancelButton: true });
        if (res.isConfirmed) {
            try {
                await updateDoc(doc(db, 'pedidos', pedidoActivo.id), { estado: 'Entregado', fecha_cierre: obtenerFechaLocal() });
                setShowDetalle(false);
                Swal.fire({ icon: 'success', title: 'Entregado', timer: 1000, showConfirmButton: false });
            } catch (err) {
                console.error(err);
                Swal.fire('Error', 'No se pudo marcar como entregado.', 'error');
            }
        }
    };

    const handleAnular = async () => {
        const res = await Swal.fire({ title: '¿Anular Pedido?', text: 'Se moverá al historial como cancelado.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545' });
        if (res.isConfirmed) {
            try {
                await updateDoc(doc(db, 'pedidos', pedidoActivo.id), { estado: 'Cancelado', fecha_cierre: obtenerFechaLocal() });
                setShowDetalle(false);
                Swal.fire({ icon: 'success', title: 'Anulado', timer: 1000, showConfirmButton: false });
            } catch (err) {
                console.error(err);
                Swal.fire('Error', 'No se pudo anular el pedido.', 'error');
            }
        }
    };

    const handleMoverFicha = async (nuevoEstado) => {
        try {
            await updateDoc(doc(db, 'pedidos', pedidoActivo.id), { estado: nuevoEstado });
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'No se pudo mover el pedido.', 'error');
        }
    };

    const handleAbonar = async () => {
        if (!pedidoActivo) return;
        // A diferencia del código anterior, no cerramos el modal: así se puede
        // ver de inmediato el nuevo saldo reflejado en la misma ficha.
        await registrarAbono(pedidoActivo);
    };

    // --- Guardar Nuevo/Editar Pedido ---
    const handleGuardarPedido = async (e) => {
        e.preventDefault();
        const pTotal = aNumeroSeguro(formPedido.precio);
        const mAdelanto = formPedido.dejoAdelanto ? aNumeroSeguro(formPedido.adelanto) : 0;

        if (!formPedido.cliente.trim()) return Swal.fire('Falta el cliente', 'Ingresa el nombre del cliente.', 'warning');
        if (!formPedido.producto.trim()) return Swal.fire('Falta el producto', 'Ingresa el producto solicitado.', 'warning');
        if (!pedidoEdit && mAdelanto > pTotal) return Swal.fire('Adelanto inválido', 'El adelanto no puede superar el precio total.', 'warning');

        const datos = {
            fecha_solicitud: formPedido.fSolicitud,
            fecha_entrega: formPedido.fEntrega,
            cliente: formPedido.cliente.trim(),
            telefono: formPedido.telefono.trim(),
            producto: formPedido.producto.trim(),
            descripcion: formPedido.desc.trim(),
            precio: pTotal
        };

        setGuardandoPedido(true);
        try {
            if (pedidoEdit) {
                await updateDoc(doc(db, 'pedidos', pedidoEdit.id), datos);
            } else {
                datos.estado = 'Pendiente';
                datos.monto_pagado = mAdelanto;
                datos.historial_pagos = [];
                if (mAdelanto > 0) {
                    datos.ultimo_metodo_pago = formPedido.metodoAdelanto;
                    datos.historial_pagos.push({ fecha: obtenerFechaLocal(), monto: mAdelanto, metodo: formPedido.metodoAdelanto });
                    await addDoc(collection(db, 'movimientos'), {
                        tipo: 'entrada',
                        metodo_pago: formPedido.metodoAdelanto,
                        fecha: obtenerFechaLocal(),
                        descripcion: `Adelanto: ${datos.producto}`,
                        entidad: datos.cliente,
                        monto: mAdelanto,
                        timestamp: new Date()
                    });
                }
                datos.timestamp = new Date();
                await addDoc(collection(db, 'pedidos'), datos);
            }
            setShowNuevo(false);
            Swal.fire({ icon: 'success', title: 'Guardado', timer: 1000, showConfirmButton: false });
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'No se pudo guardar el pedido.', 'error');
        } finally {
            setGuardandoPedido(false);
        }
    };

    const limpiarFormularioPedido = () => {
        setPedidoEdit(null);
        setFormPedido({ ...FORM_PEDIDO_VACIO, fSolicitud: obtenerFechaLocal() });
    };

    const abrirEditar = (ped) => {
        setShowDetalle(false);
        setPedidoEdit(ped);
        setFormPedido({
            fSolicitud: ped.fecha_solicitud,
            fEntrega: ped.fecha_entrega || '',
            cliente: ped.cliente,
            telefono: ped.telefono || '',
            producto: ped.producto,
            desc: ped.descripcion || '',
            precio: ped.precio || '',
            dejoAdelanto: false,
            adelanto: '',
            metodoAdelanto: 'Sinpe Móvil'
        });
        setShowNuevo(true);
    };

    const activos = useMemo(() => {
        let lista = [...pedidos];
        if (filtroTexto) {
            const txt = filtroTexto.toLowerCase();
            lista = lista.filter((p) => p.cliente?.toLowerCase().includes(txt) || p.producto?.toLowerCase().includes(txt));
        }
        lista.sort((a, b) => new Date(a.fecha_entrega || '2099-01-01') - new Date(b.fecha_entrega || '2099-01-01'));
        return lista;
    }, [pedidos, filtroTexto]);

    const renderCard = (ped) => {
        const deuda = (ped.precio || 0) - (ped.monto_pagado || 0);
        const diff = diasHastaEntrega(ped.fecha_entrega);
        let colorAlerta = 'border-secondary';
        if (diff !== null) {
            if (diff < 0) colorAlerta = 'border-danger bg-danger-subtle';
            else if (diff === 0) colorAlerta = 'border-warning bg-warning-subtle';
        }

        return (
            <Card
                key={ped.id}
                className={`mb-2 shadow-sm border-start border-4 ${colorAlerta}`}
                draggable
                onDragStart={(e) => handleDragStart(e, ped.id)}
                style={{ cursor: 'grab' }}
            >
                <Card.Body className="p-2" onClick={() => abrirDetalle(ped)}>
                    <div className="d-flex justify-content-between">
                        <strong className="text-truncate">{ped.cliente}</strong>
                        <small className="text-muted fw-bold">{formatearFechaCorta(ped.fecha_entrega)}</small>
                    </div>
                    <p className="small mb-1 text-truncate">{ped.producto}</p>
                    <div className="d-flex justify-content-between align-items-center mt-2">
                        <Badge bg={deuda > 0 ? 'warning' : ped.precio ? 'success' : 'secondary'} className="text-dark">
                            {deuda > 0 ? `Debe ${formatoColones(deuda)}` : ped.precio ? 'Pagado' : 'Sin precio'}
                        </Badge>
                        <Button variant="light" size="sm" className="border shadow-sm" aria-label="Editar pedido">
                            <i className="fas fa-pen text-secondary"></i>
                        </Button>
                    </div>
                </Card.Body>
            </Card>
        );
    };

    return (
        <Container className="mt-4 flex-grow-1 d-flex flex-column">
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2 d-print-none">
                <h3 className="fw-bold m-0 text-primary"><i className="fas fa-tasks"></i> Tablero de Producción</h3>
                <div className="d-flex gap-2">
                    <Button variant="warning" className="fw-bold shadow-sm text-dark" onClick={() => setShowVenta(true)}>
                        <i className="fas fa-bolt"></i> Venta Rápida
                    </Button>
                    <Button variant="primary" className="fw-bold shadow-sm" onClick={() => { limpiarFormularioPedido(); setShowNuevo(true); }}>
                        <i className="fas fa-plus"></i> Nuevo Pedido
                    </Button>
                </div>
            </div>
            <Form.Control
                type="text"
                placeholder="Buscar cliente o producto..."
                className="mb-3 border-primary shadow-sm d-print-none"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                aria-label="Buscar pedido"
            />

            {error ? (
                <EstadoError texto="No se pudo cargar el tablero. Revisa tu conexión." />
            ) : cargando ? (
                <EstadoCarga texto="Cargando pedidos..." />
            ) : (
                <Row className="flex-nowrap overflow-auto pb-3 flex-grow-1 d-print-none" style={{ minHeight: '500px', scrollSnapType: 'x mandatory' }}>
                    {COLUMNAS.map((col) => {
                        const pedidosColumna = activos.filter((p) => p.estado === col.estado);
                        return (
                            <Col xs={12} md={4} key={col.estado} style={{ minWidth: '300px', scrollSnapAlign: 'start' }}>
                                <Card className="bg-light h-100 border-0 shadow-sm">
                                    <Card.Header className={`fw-bold d-flex justify-content-between ${col.text}`} style={{ backgroundColor: col.bg, borderRadius: '8px 8px 0 0' }}>
                                        <span><i className={`fas ${col.icon}`}></i> {col.label}</span>
                                        <Badge bg="white" text="dark" className="rounded-pill">{pedidosColumna.length}</Badge>
                                    </Card.Header>
                                    <Card.Body className="p-2" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, col.estado)}>
                                        {pedidosColumna.length === 0 ? (
                                            <p className="text-muted small text-center py-4 mb-0">Sin pedidos aquí.</p>
                                        ) : (
                                            pedidosColumna.map(renderCard)
                                        )}
                                    </Card.Body>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>
            )}

            <datalist id="listaCatalogo">{productosCatalogo.map((p) => <option key={p.id} value={p.nombre} />)}</datalist>

            {/* MODAL: DETALLE DEL PEDIDO */}
            <Modal show={showDetalle} onHide={() => setShowDetalle(false)} centered className="d-print-none">
                <Modal.Header closeButton className="bg-light border-bottom-0 pb-0">
                    <Modal.Title className="fw-bold fs-5"><i className="fas fa-file-invoice text-dark"></i> Detalle del Pedido</Modal.Title>
                </Modal.Header>
                {pedidoActivo && (
                    <Modal.Body className="p-0">
                        <FichaPedidoDetalle
                            pedido={pedidoActivo}
                            onWhatsApp={handleWhatsApp}
                            badgeEstado={
                                <Badge
                                    bg={pedidoActivo.estado === 'Por Retirar' ? 'warning text-dark' : pedidoActivo.estado === 'En producción' ? 'info text-white' : 'secondary'}
                                    className="fs-6 px-4 py-2 shadow-sm border mb-2"
                                >
                                    {pedidoActivo.estado === 'En producción' ? 'Produciendo' : pedidoActivo.estado}
                                </Badge>
                            }
                        >
                            <ListGroup.Item className="text-center py-3 bg-light">
                                <small className="fw-bold text-dark d-block mb-2">Mover ficha a:</small>
                                <ButtonGroup className="shadow-sm w-100">
                                    <Button variant={pedidoActivo.estado === 'Pendiente' ? 'secondary' : 'outline-secondary'} onClick={() => handleMoverFicha('Pendiente')}>Pendiente</Button>
                                    <Button variant={pedidoActivo.estado === 'En producción' ? 'info text-white' : 'outline-info'} onClick={() => handleMoverFicha('En producción')}>Produciendo</Button>
                                    <Button variant={pedidoActivo.estado === 'Por Retirar' ? 'warning text-dark' : 'outline-warning'} onClick={() => handleMoverFicha('Por Retirar')}>Por Retirar</Button>
                                </ButtonGroup>
                            </ListGroup.Item>
                        </FichaPedidoDetalle>
                    </Modal.Body>
                )}
                <Modal.Footer className="justify-content-center bg-white border-top-0 pt-0 flex-wrap gap-2">
                    <div className="d-flex w-100 gap-2 mb-2 justify-content-center">
                        <Button variant="outline-info" className="fw-bold flex-grow-1" onClick={handleImprimirTicket}><i className="fas fa-receipt"></i> Ticket</Button>
                        <Button variant="success" className="fw-bold flex-grow-1" onClick={handleEntregar}><i className="fas fa-check"></i> Entregar</Button>
                        <Button variant="outline-primary" className="fw-bold flex-grow-1" onClick={handleAbonar}><i className="fas fa-coins"></i> Abonar</Button>
                        <Button variant="outline-secondary" className="flex-grow-1" onClick={() => abrirEditar(pedidoActivo)}><i className="fas fa-pen"></i> Editar</Button>
                    </div>
                    <Button variant="outline-danger" size="sm" className="px-4 bg-white" onClick={handleAnular}><i className="fas fa-times"></i> Anular</Button>
                </Modal.Footer>
            </Modal>

            {/* MODAL NUEVO / EDITAR */}
            <Modal show={showNuevo} onHide={() => setShowNuevo(false)} backdrop="static" className="d-print-none">
                <Modal.Header closeButton className="bg-primary text-white">
                    <Modal.Title className="fw-bold">{pedidoEdit ? 'Editar Pedido' : 'Nuevo Pedido'}</Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-4">
                    <Form onSubmit={handleGuardarPedido}>
                        <Row className="mb-3">
                            <Col xs={6}>
                                <Form.Label className="small text-muted mb-1"><i className="fas fa-calendar-day me-1"></i> Solicitud</Form.Label>
                                <Form.Control type="date" value={formPedido.fSolicitud} readOnly className="bg-light" />
                            </Col>
                            <Col xs={6}>
                                <Form.Label className="small text-primary fw-bold mb-1"><i className="fas fa-truck me-1"></i> Entrega</Form.Label>
                                <Form.Control type="date" className="border-primary" value={formPedido.fEntrega} onChange={actualizarForm('fEntrega')} />
                            </Col>
                        </Row>

                        <Form.Group className="mb-3">
                            <Form.Label className="small fw-bold text-secondary mb-1">Cliente</Form.Label>
                            <InputGroup>
                                <InputGroup.Text className="bg-light"><i className="fas fa-user text-muted"></i></InputGroup.Text>
                                <Form.Control required type="text" placeholder="Ej: María Pérez" value={formPedido.cliente} onChange={actualizarForm('cliente')} />
                            </InputGroup>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="small fw-bold text-secondary mb-1">Teléfono</Form.Label>
                            <InputGroup>
                                <InputGroup.Text className="bg-light"><i className="fab fa-whatsapp text-muted"></i></InputGroup.Text>
                                <Form.Control type="text" placeholder="Ej: 8888-8888" value={formPedido.telefono} onChange={actualizarForm('telefono')} />
                                {'contacts' in navigator && (
                                    <Button
                                        variant="outline-secondary"
                                        onClick={() => handleSeleccionarContacto((v) => setFormPedido((f) => ({ ...f, telefono: v })), (v) => setFormPedido((f) => ({ ...f, cliente: v })), formPedido.cliente)}
                                        aria-label="Elegir de contactos"
                                    >
                                        <i className="fas fa-address-book"></i>
                                    </Button>
                                )}
                            </InputGroup>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="small fw-bold text-secondary mb-1">Producto</Form.Label>
                            <InputGroup>
                                <InputGroup.Text className="bg-light"><i className="fas fa-box-open text-muted"></i></InputGroup.Text>
                                <Form.Control
                                    required
                                    type="text"
                                    placeholder="Ej: Taza personalizada 11oz"
                                    list="listaCatalogo"
                                    value={formPedido.producto}
                                    onChange={actualizarForm('producto')}
                                    onBlur={(e) => {
                                        const p = productosCatalogo.find((x) => x.nombre.toLowerCase() === e.target.value.toLowerCase());
                                        if (p) setFormPedido((f) => ({ ...f, precio: p.precio_venta }));
                                    }}
                                />
                            </InputGroup>
                            <Form.Text className="text-muted">Si el nombre coincide con el catálogo, el precio se autocompleta.</Form.Text>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="small fw-bold text-secondary mb-1">Notas (opcional)</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                placeholder="Ej: sin canela, entregar en caja de regalo, color celeste..."
                                value={formPedido.desc}
                                onChange={actualizarForm('desc')}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="small fw-bold text-secondary mb-1">Precio Total</Form.Label>
                            <InputGroup>
                                <InputGroup.Text className="bg-light fw-bold">₡</InputGroup.Text>
                                <Form.Control type="number" step="0.01" min="0" placeholder="0" value={formPedido.precio} onChange={actualizarForm('precio')} />
                            </InputGroup>
                        </Form.Group>

                        {!pedidoEdit && (
                            <div className="mb-4 p-3 bg-light rounded border">
                                <Form.Check
                                    type="switch"
                                    id="switch-adelanto"
                                    label={<span className="fw-bold small">¿El cliente dejó adelanto?</span>}
                                    checked={formPedido.dejoAdelanto}
                                    onChange={(e) => setFormPedido((f) => ({ ...f, dejoAdelanto: e.target.checked, adelanto: e.target.checked ? f.adelanto : '' }))}
                                />
                                {formPedido.dejoAdelanto ? (
                                    <Row className="mt-3">
                                        <Col xs={6}>
                                            <Form.Label className="small">Monto del adelanto</Form.Label>
                                            <InputGroup size="sm">
                                                <InputGroup.Text>₡</InputGroup.Text>
                                                <Form.Control type="number" step="0.01" min="0" placeholder="0" value={formPedido.adelanto} onChange={actualizarForm('adelanto')} />
                                            </InputGroup>
                                        </Col>
                                        <Col xs={6}>
                                            <Form.Label className="small">Método</Form.Label>
                                            <Form.Select size="sm" value={formPedido.metodoAdelanto} onChange={actualizarForm('metodoAdelanto')}>
                                                <option>Sinpe Móvil</option>
                                                <option>Efectivo</option>
                                            </Form.Select>
                                        </Col>
                                    </Row>
                                ) : (
                                    <p className="small text-muted mb-0 mt-2">El pedido quedará registrado con el saldo total pendiente.</p>
                                )}
                            </div>
                        )}

                        <Button type="submit" variant="primary" className="w-100 fw-bold py-2 shadow-sm" disabled={guardandoPedido}>
                            {guardandoPedido ? 'Guardando...' : (<><i className="fas fa-save me-1"></i> Guardar Pedido</>)}
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* MODAL: VENTA RÁPIDA (antes faltaba por completo) */}
            <VentaRapidaModal show={showVenta} onHide={() => setShowVenta(false)} />

            {/* PIEZA DE IMPRESIÓN (invisible en pantalla, visible al imprimir) */}
            <TicketImpresion pedido={pedidoActivo} />
        </Container>
    );
}
