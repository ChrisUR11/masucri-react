import { useState, useMemo } from 'react';
import { Container, Card, Badge, Button, Form, Modal, Row, Col, InputGroup, ButtonGroup, ListGroup } from 'react-bootstrap';
import { collection, query, orderBy, updateDoc, doc, writeBatch, runTransaction } from 'firebase/firestore';
import { db } from '../config/firebase';
import Swal from 'sweetalert2';
import { TicketImpresion } from '../components/TicketImpresion';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useDebounce } from '../hooks/useDebounce';
import EstadoCarga, { EstadoError } from '../components/EstadoCarga';
import FichaPedidoDetalle from '../components/FichaPedidoDetalle';
import '../components/FichaPedidoDetalle.css';
import ProductosPedidoForm from '../components/ProductosPedidoForm';
import VentaRapidaModal from '../components/VentaRapidaModal';
import { registrarAbono } from '../utils/abonoPedido';
import { entregarPedido } from '../utils/entregaPedido';
import { abrirWhatsApp, mensajePedido } from '../utils/whatsapp';
import { compartirTicket } from '../utils/ticketImagen';
import { seleccionarContacto, soportaSelectorContactos } from '../utils/contactos';
import { obtenerFechaLocal, diasHastaEntrega, formatearFechaCorta } from '../utils/fecha';
import { formatoColones } from '../utils/formato';
import { calcularTotalesPedido, obtenerProductosPedido, resumenProductos, validarProductosPedido } from '../utils/productosPedido';
import { aCentavos, deCentavos, tieneMaximoDosDecimales } from '../utils/dinero';

const ESTADOS_ACTIVOS = ['Pendiente', 'En producción', 'Por Retirar'];

// Columnas del Kanban armadas por datos, en vez de repetir el mismo bloque
// de JSX tres veces (una por estado). Agregar una columna nueva ahora es
// solo agregar un elemento aquí.
const COLUMNAS = [
    { estado: 'Pendiente', label: 'Pendiente', icon: 'fa-inbox', bg: '#6c757d', text: 'text-white' },
    { estado: 'En producción', label: 'En Producción', icon: 'fa-hammer', bg: '#0dcaf0', text: 'text-dark' },
    { estado: 'Por Retirar', label: 'Por Retirar', icon: 'fa-box-open', bg: '#ffc107', text: 'text-dark' }
];

const FORM_PEDIDO_VACIO = {
    fSolicitud: obtenerFechaLocal(),
    fEntrega: '',
    cliente: '',
    telefono: '',
    productos: [{ nombre: '', precio_unitario: '', cantidad: 1, total: 0 }],
    desc: '',
    aplicaDescuento: false,
    descuento_tipo: 'monto',
    descuento_valor: '',
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
    const [nombreTicket, setNombreTicket] = useState(null);
    const [procesandoDetalle, setProcesandoDetalle] = useState(false);
    const [pedidoEdit, setPedidoEdit] = useState(null);

    const [formPedido, setFormPedido] = useState(FORM_PEDIDO_VACIO);
    const [guardandoPedido, setGuardandoPedido] = useState(false);

    const totalesPedido = useMemo(() => calcularTotalesPedido(
        formPedido.productos,
        !formPedido.aplicaDescuento
            ? { descuento_monto: 0 }
            : formPedido.descuento_tipo === 'porcentaje'
            ? { descuento_porcentaje: formPedido.descuento_valor }
            : { descuento_monto: formPedido.descuento_valor }
    ), [formPedido.productos, formPedido.aplicaDescuento, formPedido.descuento_tipo, formPedido.descuento_valor]);

    const descuentoPorcentajeVisible = formPedido.descuento_tipo === 'porcentaje'
        ? formPedido.descuento_valor : (formPedido.descuento_valor === '' ? '' : totalesPedido.descuento_porcentaje);
    const descuentoMontoVisible = formPedido.descuento_tipo === 'monto'
        ? formPedido.descuento_valor : (formPedido.descuento_valor === '' ? '' : totalesPedido.descuento_monto);

    // El pedido activo se busca por id en la lista en vivo, así el modal
    // siempre refleja el estado más reciente sin necesitar sincronización manual.
    const pedidoActivo = pedidoActivoId ? pedidos.find((p) => p.id === pedidoActivoId) || null : null;

    const actualizarForm = (campo) => (e) => setFormPedido((f) => ({ ...f, [campo]: e.target.value }));

    // --- API Contactos ---
    const handleSeleccionarContacto = async () => {
        const resultado = await seleccionarContacto();
        if (!resultado) return;
        if (resultado.telefono) setFormPedido((f) => ({ ...f, telefono: resultado.telefono }));
        if (resultado.nombre && !formPedido.cliente) setFormPedido((f) => ({ ...f, cliente: resultado.nombre }));
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
        setNombreTicket(null);
        setShowDetalle(true);
    };

    const handleWhatsApp = () => abrirWhatsApp(pedidoActivo.telefono, mensajePedido(pedidoActivo));

    const handleEnviarTicket = async () => {
        if (!pedidoActivo || procesandoDetalle) return;
        setProcesandoDetalle(true);
        try {
            const resultado = await compartirTicket(pedidoActivo, { onNombreConfirmado: setNombreTicket });
            if (resultado === 'descargado') {
                Swal.fire({
                    icon: 'info',
                    title: 'Ticket descargado',
                    text: 'La imagen se descargó. Podés adjuntarla en WhatsApp o guardarla.',
                    timer: 3000,
                    showConfirmButton: false
                });
            }
        } catch (err) {
            console.error('Error generando el ticket:', err);
            Swal.fire('Error', 'No se pudo generar el ticket.', 'error');
        } finally {
            setProcesandoDetalle(false);
        }
    };

    const handleEntregar = async () => {
        setProcesandoDetalle(true);
        const entregado = await entregarPedido(pedidoActivo);
        setProcesandoDetalle(false);
        if (entregado) setShowDetalle(false);
    };

    const handleAnular = async () => {
        const res = await Swal.fire({ title: '¿Anular Pedido?', text: 'Se moverá al historial como cancelado.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545' });
        if (res.isConfirmed) {
            setProcesandoDetalle(true);
            try {
                await updateDoc(doc(db, 'pedidos', pedidoActivo.id), { estado: 'Cancelado', fecha_cierre: obtenerFechaLocal() });
                setProcesandoDetalle(false);
                setShowDetalle(false);
                Swal.fire({ icon: 'success', title: 'Anulado', timer: 1000, showConfirmButton: false });
            } catch (err) {
                setProcesandoDetalle(false);
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
        setProcesandoDetalle(true);
        try {
            // A diferencia del código anterior, no cerramos el modal: así se puede
            // ver de inmediato el nuevo saldo reflejado en la misma ficha.
            await registrarAbono(pedidoActivo);
        } finally {
            setProcesandoDetalle(false);
        }
    };

    // --- Guardar Nuevo/Editar Pedido ---
    const handleGuardarPedido = async (e) => {
        e.preventDefault();
        let productos;
        try {
            productos = validarProductosPedido(formPedido.productos);
        } catch (err) {
            return Swal.fire('Revisa los productos', err.message, 'warning');
        }
        const adelantoIndicado = formPedido.dejoAdelanto ? Number(formPedido.adelanto) : 0;
        const descuentoValor = !formPedido.aplicaDescuento || formPedido.descuento_valor === '' ? 0 : Number(formPedido.descuento_valor);

        if (!formPedido.cliente.trim()) return Swal.fire('Falta el cliente', 'Ingresa el nombre del cliente.', 'warning');
        if (!Number.isFinite(descuentoValor) || descuentoValor < 0 || (formPedido.descuento_tipo === 'porcentaje'
            ? descuentoValor > 100
            : !tieneMaximoDosDecimales(descuentoValor) || descuentoValor > totalesPedido.subtotal)) {
            return Swal.fire('Descuento inválido', 'El descuento debe estar entre cero y el subtotal del pedido (o entre 0 % y 100 %).', 'warning');
        }
        if (!tieneMaximoDosDecimales(adelantoIndicado) || adelantoIndicado < 0 || (formPedido.dejoAdelanto && formPedido.adelanto === '')) {
            return Swal.fire('Adelanto inválido', 'Ingresa un adelanto válido con máximo dos decimales.', 'warning');
        }
        const mAdelanto = deCentavos(aCentavos(adelantoIndicado));
        if (!pedidoEdit && aCentavos(mAdelanto) > aCentavos(totalesPedido.precio)) return Swal.fire('Adelanto inválido', 'El adelanto no puede superar el total con descuento.', 'warning');
        if (pedidoEdit && aCentavos(pedidoEdit.monto_pagado || 0) > aCentavos(totalesPedido.precio)) {
            return Swal.fire('Total insuficiente', 'El nuevo total no puede ser menor que los pagos ya registrados.', 'warning');
        }

        const datos = {
            fecha_solicitud: formPedido.fSolicitud,
            fecha_entrega: formPedido.fEntrega,
            cliente: formPedido.cliente.trim(),
            telefono: formPedido.telefono.trim(),
            producto: resumenProductos(productos),
            productos,
            descripcion: formPedido.desc.trim(),
            ...totalesPedido
        };

        setGuardandoPedido(true);
        try {
            if (pedidoEdit) {
                const pedidoRef = doc(db, 'pedidos', pedidoEdit.id);
                await runTransaction(db, async (transaccion) => {
                    const actual = await transaccion.get(pedidoRef);
                    if (!actual.exists() || !ESTADOS_ACTIVOS.includes(actual.data().estado)) {
                        throw new Error('El pedido cambió de estado. Vuelve a abrirlo para editarlo.');
                    }
                    if (aCentavos(actual.data().monto_pagado || 0) > aCentavos(totalesPedido.precio)) {
                        throw new Error('El nuevo total no puede ser menor que los pagos ya registrados.');
                    }
                    transaccion.update(pedidoRef, datos);
                });
            } else {
                datos.estado = 'Pendiente';
                datos.monto_pagado = mAdelanto;
                datos.historial_pagos = [];
                const fechaAdelanto = mAdelanto > 0 ? obtenerFechaLocal() : null;
                if (mAdelanto > 0) {
                    datos.ultimo_metodo_pago = formPedido.metodoAdelanto;
                    datos.historial_pagos.push({ fecha: fechaAdelanto, monto: mAdelanto, metodo: formPedido.metodoAdelanto });
                }
                datos.timestamp = new Date();
                const pedidoRef = doc(collection(db, 'pedidos'));
                const batch = writeBatch(db);
                batch.set(pedidoRef, datos);

                if (mAdelanto > 0) {
                    const movimientoRef = doc(collection(db, 'movimientos'));
                    batch.set(movimientoRef, {
                        tipo: 'entrada',
                        metodo_pago: formPedido.metodoAdelanto,
                        fecha: fechaAdelanto,
                        descripcion: `Adelanto: ${datos.producto}`,
                        entidad: datos.cliente,
                        monto: mAdelanto,
                        pedido_id: pedidoRef.id,
                        timestamp: new Date()
                    });
                }
                await batch.commit();
            }
            setShowNuevo(false);
            Swal.fire({ icon: 'success', title: 'Guardado', timer: 1000, showConfirmButton: false });
        } catch (err) {
            console.error(err);
            const mensaje = err.message?.startsWith('El pedido cambió') || err.message?.startsWith('El nuevo total')
                ? err.message
                : pedidoEdit && (err.code === 'unavailable' || !navigator.onLine)
                    ? 'Conéctate a internet para editar el pedido y comprobar sus pagos vigentes.'
                    : 'No se pudo guardar el pedido.';
            Swal.fire('Error', mensaje, 'error');
        } finally {
            setGuardandoPedido(false);
        }
    };

    const limpiarFormularioPedido = () => {
        setPedidoEdit(null);
        setFormPedido({ ...FORM_PEDIDO_VACIO, productos: [{ nombre: '', precio_unitario: '', cantidad: 1, total: 0 }], fSolicitud: obtenerFechaLocal() });
    };

    const abrirEditar = (ped) => {
        const productos = obtenerProductosPedido(ped);
        const subtotal = calcularTotalesPedido(productos).subtotal;
        const descuentoMonto = ped.descuento_monto ?? Math.max(0, subtotal - (Number(ped.precio) || 0));
        setShowDetalle(false);
        setPedidoEdit(ped);
        setFormPedido({
            fSolicitud: ped.fecha_solicitud,
            fEntrega: ped.fecha_entrega || '',
            cliente: ped.cliente,
            telefono: ped.telefono || '',
            productos: productos.length ? productos : [{ nombre: '', precio_unitario: '', cantidad: 1, total: 0 }],
            desc: ped.descripcion || '',
            aplicaDescuento: descuentoMonto > 0,
            descuento_tipo: 'monto',
            descuento_valor: descuentoMonto > 0 ? String(descuentoMonto) : '',
            dejoAdelanto: false,
            adelanto: '',
            metodoAdelanto: 'Sinpe Móvil'
        });
        setShowNuevo(true);
    };

    const filtroTextoDebounced = useDebounce(filtroTexto, 250);

    const activos = useMemo(() => {
        let lista = [...pedidos];
        if (filtroTextoDebounced) {
            const txt = filtroTextoDebounced.toLowerCase();
            lista = lista.filter((p) => p.cliente?.toLowerCase().includes(txt)
                || p.producto?.toLowerCase().includes(txt)
                || p.productos?.some((item) => item.nombre?.toLowerCase().includes(txt)));
        }
        lista.sort((a, b) => new Date(a.fecha_entrega || '2099-01-01') - new Date(b.fecha_entrega || '2099-01-01'));
        return lista;
    }, [pedidos, filtroTextoDebounced]);

    const renderCard = (ped) => {
        const deuda = (ped.precio || 0) - (ped.monto_pagado || 0);
        const sinCargoPorDescuento = Number(ped.subtotal) > 0 && Number(ped.precio) === 0;
        const diff = diasHastaEntrega(ped.fecha_entrega);
        let colorAlerta = 'border-secondary'; // Por defecto, sin fecha
        if (diff !== null) {
            if (diff < 0) {
                // Vencido: bien rojo
                colorAlerta = 'border-danger bg-danger-subtle';
            } else if (diff === 0) {
                // Hoy: rojo también pero quizá con tonalidad distinta
                colorAlerta = 'border-danger bg-danger-subtle';
            } else if (diff <= 2) {
                // 1-2 días: naranja/warning
                colorAlerta = 'order-soon bg-warning-subtle';
            } else if (diff <= 5) {
                // 3-5 días: info/azul (requiere atención pero no urgente)
                colorAlerta = 'border-info bg-info-subtle';
            } else {
                // 6+ días: verde/success (hay tiempo)
                colorAlerta = 'border-success bg-success-subtle';
            }
        }

        return (
            <Card
                key={ped.id}
                className={`production-order-card mb-2 shadow-sm border-start border-4 ${colorAlerta}`}
                draggable
                onDragStart={(e) => handleDragStart(e, ped.id)}
                style={{ cursor: 'grab' }}
            >
                <Card.Body
                    className="p-2"
                    onClick={() => abrirDetalle(ped)}
                >
                    <div className="d-flex justify-content-between">
                        <strong className="text-truncate">{ped.cliente}</strong>
                        <small className="text-muted fw-bold">{formatearFechaCorta(ped.fecha_entrega)}</small>
                    </div>
                    <p className="small mb-1 text-truncate">{ped.producto}</p>
                    <div className="d-flex justify-content-between align-items-center mt-2">
                        <Badge bg={deuda > 0 ? 'warning' : ped.precio || sinCargoPorDescuento ? 'success' : 'secondary'} className="text-dark">
                            {deuda > 0 ? `Debe ${formatoColones(deuda)}` : sinCargoPorDescuento ? 'Descuento total' : ped.precio ? 'Pagado' : 'Sin precio'}
                        </Badge>
                        <div className="d-flex gap-1">
                            <Button
                                variant="light"
                                size="sm"
                                className="border shadow-sm"
                                aria-label={`Ver detalle del pedido de ${ped.cliente}`}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    abrirDetalle(ped);
                                }}
                            >
                                <i className="fas fa-eye text-primary" aria-hidden="true"></i>
                            </Button>
                            <Button
                                variant="light"
                                size="sm"
                                className="border shadow-sm"
                                aria-label={`Editar pedido de ${ped.cliente}`}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    abrirEditar(ped);
                                }}
                            >
                                <i className="fas fa-pen text-secondary" aria-hidden="true"></i>
                            </Button>
                        </div>
                    </div>
                </Card.Body>
            </Card>
        );
    };

    return (
            <Container className="orders-page mt-4 flex-grow-1 d-flex flex-column">
            <div className="app-page-heading page-heading d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2 d-print-none">
                <h3 className="fw-bold m-0 text-primary"><i className="fas fa-tasks"></i> Tablero de Producción</h3>
                <div className="page-action-buttons d-flex gap-2">
                    <Button variant="warning" className="fw-bold shadow-sm text-dark" onClick={() => setShowVenta(true)}>
                        <i className="fas fa-bolt"></i> Venta Rápida
                    </Button>
                    <Button variant="primary" className="fw-bold shadow-sm" onClick={() => { limpiarFormularioPedido(); setShowNuevo(true); }}>
                        <i className="fas fa-plus"></i> Nuevo Pedido
                    </Button>
                </div>
            </div>
            <Form.Control
                type="search"
                placeholder="Buscar cliente o producto..."
                className="app-page-search mb-3 shadow-sm d-print-none"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                aria-label="Buscar pedido"
            />

            {/* LEYENDA DE COLORES */}
            <div className="order-legend mb-3 p-3 bg-white rounded border shadow-sm d-print-none">
                <small className="fw-bold d-block mb-2">Código de colores por fecha de entrega:</small>
                <div className="d-flex flex-wrap gap-3">
                    <div className="d-flex align-items-center gap-2">
                        <div className="rounded-circle" style={{ width: '12px', height: '12px', backgroundColor: '#dc3545' }}></div>
                        <small><strong>Rojo:</strong> Hoy o vencido</small>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <div className="rounded-circle" style={{ width: '12px', height: '12px', backgroundColor: '#fd7e14' }}></div>
                        <small><strong>Naranja:</strong> 1-2 días</small>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <div className="rounded-circle" style={{ width: '12px', height: '12px', backgroundColor: '#0dcaf0' }}></div>
                        <small><strong>Azul:</strong> 3-5 días</small>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <div className="rounded-circle" style={{ width: '12px', height: '12px', backgroundColor: '#198754' }}></div>
                        <small><strong>Verde:</strong> 6+ días</small>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <div className="rounded-circle" style={{ width: '12px', height: '12px', backgroundColor: '#6c757d' }}></div>
                        <small><strong>Gris:</strong> Sin fecha</small>
                    </div>
                </div>
            </div>

            {error ? (
                <EstadoError texto="No se pudo cargar el tablero. Revisa tu conexión." />
            ) : cargando ? (
                <EstadoCarga texto="Cargando pedidos..." />
            ) : (
                <Row className="production-board g-3 pb-3 flex-grow-1 d-print-none">
                    {COLUMNAS.map((col) => {
                        const pedidosColumna = activos.filter((p) => p.estado === col.estado);
                        return (
                            <Col xs={12} sm={6} lg={4} key={col.estado}>
                                <Card className="production-column bg-light h-100 border-0 shadow-sm">
                                    <Card.Header className={`fw-bold d-flex justify-content-between align-items-center ${col.text}`} style={{ backgroundColor: col.bg, borderRadius: '8px 8px 0 0' }}>
                                        <span className="text-truncate mx-1"><i className={`fas ${col.icon}`}></i> {col.label}</span>

                                        <div className="d-flex align-items-center gap-1">
                                            <Badge bg="white" text="dark" className="rounded-pill">{pedidosColumna.length}</Badge>
                                        </div>
                                    </Card.Header>
                                    <Card.Body className="production-column-body p-2" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, col.estado)}>
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

            {/* MODAL: DETALLE DEL PEDIDO */}
            <Modal show={showDetalle} onHide={() => setShowDetalle(false)} centered scrollable enforceFocus={false} className="pedido-detail-modal d-print-none">
                <Modal.Header closeButton className="pedido-detail-modal__header">
                    <Modal.Title className="fw-bold fs-5"><i className="fas fa-file-invoice text-dark"></i> Detalle del Pedido</Modal.Title>
                </Modal.Header>
                {pedidoActivo && (
                    <Modal.Body className="p-0">
                        <FichaPedidoDetalle
                            pedido={pedidoActivo}
                            onWhatsApp={handleWhatsApp}
                            badgeEstado={
                                <Badge
                                    bg={pedidoActivo.estado === 'Por Retirar' ? 'warning text-dark' : pedidoActivo.estado === 'En producción' ? 'info text-dark' : 'secondary'}
                                    className="fs-6 px-4 py-2 shadow-sm border mb-2"
                                >
                                    {pedidoActivo.estado === 'En producción' ? 'Produciendo' : pedidoActivo.estado}
                                </Badge>
                            }
                        >
                            <ListGroup.Item className="pedido-ficha__estado text-center py-3 bg-light">
                                <small className="pedido-ficha__estado-etiqueta fw-bold text-dark d-block mb-2">Mover ficha a:</small>
                                <ButtonGroup className="pedido-state-actions shadow-sm w-100" aria-label="Estado del pedido">
                                    <Button variant={pedidoActivo.estado === 'Pendiente' ? 'secondary' : 'outline-secondary'} aria-pressed={pedidoActivo.estado === 'Pendiente'} onClick={() => handleMoverFicha('Pendiente')}>Pendiente</Button>
                                    <Button variant={pedidoActivo.estado === 'En producción' ? 'info text-dark' : 'outline-info'} aria-pressed={pedidoActivo.estado === 'En producción'} onClick={() => handleMoverFicha('En producción')}>Produciendo</Button>
                                    <Button variant={pedidoActivo.estado === 'Por Retirar' ? 'warning text-dark' : 'outline-warning'} aria-pressed={pedidoActivo.estado === 'Por Retirar'} onClick={() => handleMoverFicha('Por Retirar')}>Por Retirar</Button>
                                </ButtonGroup>
                            </ListGroup.Item>
                        </FichaPedidoDetalle>
                    </Modal.Body>
                )}
                <Modal.Footer className="pedido-detail-modal__footer bg-white">
                    <div className="pedido-detail-actions d-flex w-100 gap-2 justify-content-center">
                        <Button variant="outline-primary" className="pedido-detail-action fw-bold flex-grow-1" onClick={handleEnviarTicket} disabled={procesandoDetalle}><i className="fas fa-share-nodes"></i> Enviar Ticket</Button>
                        <Button variant="success" className="pedido-detail-action fw-bold flex-grow-1" onClick={handleEntregar} disabled={procesandoDetalle}><i className="fas fa-check"></i> Entregar</Button>
                        <Button variant="outline-primary" className="pedido-detail-action fw-bold flex-grow-1" onClick={handleAbonar} disabled={procesandoDetalle}><i className="fas fa-coins"></i> Abonar</Button>
                        <Button variant="outline-secondary" className="pedido-detail-action flex-grow-1" onClick={() => abrirEditar(pedidoActivo)} disabled={procesandoDetalle}><i className="fas fa-pen"></i> Editar</Button>
                    </div>
                    <Button variant="outline-danger" size="sm" className="pedido-detail-anular" onClick={handleAnular} disabled={procesandoDetalle}><i className="fas fa-times"></i> Anular</Button>
                </Modal.Footer>
            </Modal>

            {/* MODAL NUEVO / EDITAR */}
            <Modal show={showNuevo} onHide={() => setShowNuevo(false)} backdrop="static" size="lg" className="d-print-none">
                <Modal.Header closeButton className="bg-primary text-white">
                    <Modal.Title className="fw-bold">{pedidoEdit ? 'Editar Pedido' : 'Nuevo Pedido'}</Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-4">
                    <Form onSubmit={handleGuardarPedido}>
                        <Row className="mb-3">
                            <Col xs={12} sm={6} className="mb-3 mb-sm-0">
                                <Form.Label htmlFor="pedido-fecha-solicitud" className="small text-muted mb-1"><i className="fas fa-calendar-day me-1"></i> Solicitud</Form.Label>
                                <Form.Control id="pedido-fecha-solicitud" type="date" value={formPedido.fSolicitud} readOnly className="bg-light" />
                            </Col>
                            <Col xs={12} sm={6}>
                                <Form.Label htmlFor="pedido-fecha-entrega" className="small text-primary fw-bold mb-1"><i className="fas fa-truck me-1"></i> Entrega</Form.Label>
                                <Form.Control id="pedido-fecha-entrega" type="date" className="border-primary" value={formPedido.fEntrega} onChange={actualizarForm('fEntrega')} />
                            </Col>
                        </Row>

                        <Form.Group controlId="pedido-cliente" className="mb-3">
                            <Form.Label className="small fw-bold text-secondary mb-1">Cliente</Form.Label>
                            <InputGroup>
                                <InputGroup.Text className="bg-light"><i className="fas fa-user text-muted"></i></InputGroup.Text>
                                <Form.Control required name="cliente" type="text" autoComplete="name" placeholder="Ej: María Pérez" value={formPedido.cliente} onChange={actualizarForm('cliente')} />
                            </InputGroup>
                        </Form.Group>

                        <Form.Group controlId="pedido-telefono" className="mb-3">
                            <Form.Label className="small fw-bold text-secondary mb-1">Teléfono</Form.Label>
                            <InputGroup>
                                <InputGroup.Text className="bg-light"><i className="fab fa-whatsapp text-muted"></i></InputGroup.Text>
                                <Form.Control name="telefono" type="tel" inputMode="tel" autoComplete="tel" placeholder="Ej: 8888-8888" value={formPedido.telefono} onChange={actualizarForm('telefono')} />
                                {soportaSelectorContactos() && (
                                    <Button
                                        variant="outline-secondary"
                                        onClick={handleSeleccionarContacto}
                                        aria-label="Elegir de contactos"
                                    >
                                        <i className="fas fa-address-book"></i>
                                    </Button>
                                )}
                            </InputGroup>
                        </Form.Group>

                        <ProductosPedidoForm
                            productos={formPedido.productos}
                            onChange={(productos) => setFormPedido((f) => ({ ...f, productos }))}
                            catalogo={productosCatalogo}
                            idPrefix="pedido"
                        />

                        <div className="mb-3 p-3 bg-light rounded border">
                            <div className="d-flex justify-content-between flex-wrap gap-2 mb-3">
                                <span>Subtotal de productos</span>
                                <strong>{formatoColones(totalesPedido.subtotal)}</strong>
                            </div>
                            <Form.Check
                                type="switch"
                                id="switch-descuento-pedido"
                                className="mb-3"
                                label={<span className="fw-bold small">¿Se aplicará descuento?</span>}
                                checked={formPedido.aplicaDescuento}
                                onChange={(e) => setFormPedido((f) => ({
                                    ...f,
                                    aplicaDescuento: e.target.checked,
                                    descuento_valor: e.target.checked ? f.descuento_valor : ''
                                }))}
                            />
                            {formPedido.aplicaDescuento && <Row className="g-2 mb-3">
                                <Col xs={12} sm={6}>
                                    <Form.Label htmlFor="pedido-descuento-porcentaje" className="small fw-bold">Descuento (%)</Form.Label>
                                    <InputGroup>
                                        <Form.Control id="pedido-descuento-porcentaje" type="number" min="0" max="100" step="any" placeholder="0" value={descuentoPorcentajeVisible} onChange={(e) => setFormPedido((f) => ({ ...f, descuento_tipo: 'porcentaje', descuento_valor: e.target.value }))} />
                                        <InputGroup.Text>%</InputGroup.Text>
                                    </InputGroup>
                                </Col>
                                <Col xs={12} sm={6}>
                                    <Form.Label htmlFor="pedido-descuento-monto" className="small fw-bold">Descuento (₡)</Form.Label>
                                    <InputGroup>
                                        <InputGroup.Text>₡</InputGroup.Text>
                                        <Form.Control id="pedido-descuento-monto" type="number" min="0" max={totalesPedido.subtotal} step="0.01" placeholder="0" value={descuentoMontoVisible} onChange={(e) => setFormPedido((f) => ({ ...f, descuento_tipo: 'monto', descuento_valor: e.target.value }))} />
                                    </InputGroup>
                                </Col>
                            </Row>}
                            <div className="d-flex justify-content-between flex-wrap gap-2 border-top pt-2 fs-5">
                                <strong>Total del pedido</strong>
                                <strong className="text-primary">{formatoColones(totalesPedido.precio)}</strong>
                            </div>
                        </div>

                        <Form.Group controlId="pedido-notas" className="mb-3">
                            <Form.Label className="small fw-bold text-secondary mb-1">Descripción / notas internas (opcional)</Form.Label>
                            <Form.Control as="textarea" rows={2} placeholder="Ej: color, tamaño, personalización o instrucciones de entrega" value={formPedido.desc} onChange={actualizarForm('desc')} />
                            <Form.Text>No aparece en el ticket del cliente.</Form.Text>
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
                                        <Col xs={12} sm={6} className="mb-3 mb-sm-0">
                                            <Form.Label htmlFor="pedido-adelanto" className="small">Monto del adelanto</Form.Label>
                                            <InputGroup size="sm">
                                                <InputGroup.Text>₡</InputGroup.Text>
                                                <Form.Control id="pedido-adelanto" type="number" step="0.01" min="0" placeholder="0" value={formPedido.adelanto} onChange={actualizarForm('adelanto')} />
                                            </InputGroup>
                                        </Col>
                                        <Col xs={12} sm={6}>
                                            <Form.Label htmlFor="pedido-metodo-adelanto" className="small">Método</Form.Label>
                                            <Form.Select id="pedido-metodo-adelanto" size="sm" value={formPedido.metodoAdelanto} onChange={actualizarForm('metodoAdelanto')}>
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
            <VentaRapidaModal show={showVenta} onHide={() => setShowVenta(false)} catalogo={productosCatalogo} />

            {/* PIEZA DE IMPRESIÓN (invisible en pantalla, visible al imprimir) */}
            <TicketImpresion pedido={pedidoActivo} nombreCliente={nombreTicket} />
        </Container>
    );
}
