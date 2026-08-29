import { useState, useEffect } from 'react';
import { Container, Card, Badge, Button, Form, Modal, Row, Col, InputGroup, ButtonGroup, ListGroup } from 'react-bootstrap';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Swal from 'sweetalert2';
import { TicketImpresion } from '../components/TicketImpresion'; // Importamos el Ticket

const ESTADOS_ACTIVOS = ['Pendiente', 'En producción', 'Por Retirar'];

const obtenerFechaLocal = () => {
    const hoy = new Date();
    const tzOffset = hoy.getTimezoneOffset() * 60000;
    return new Date(hoy.getTime() - tzOffset).toISOString().split('T')[0];
};

export default function Pedidos() {
    const [pedidos, setPedidos] = useState([]);
    const [filtroTexto, setFiltroTexto] = useState('');
    const [productosCatalogo, setProductosCatalogo] = useState([]);

    // Estados de Modales
    const [showNuevo, setShowNuevo] = useState(false);
    const [showVenta, setShowVenta] = useState(false);
    const [showDetalle, setShowDetalle] = useState(false); // Nuevo estado para el modal de detalle
    const [pedidoActivo, setPedidoActivo] = useState(null); // Pedido seleccionado para ver detalle
    const [pedidoEdit, setPedidoEdit] = useState(null); // Pedido para el formulario de editar

    // Formulario Nuevo/Editar Pedido
    const [fSolicitud, setFSolicitud] = useState(obtenerFechaLocal());
    const [fEntrega, setFEntrega] = useState('');
    const [cliente, setCliente] = useState('');
    const [telefono, setTelefono] = useState('');
    const [producto, setProducto] = useState('');
    const [desc, setDesc] = useState('');
    const [precio, setPrecio] = useState('');
    const [adelanto, setAdelanto] = useState('');
    const [metodoAdelanto, setMetodoAdelanto] = useState('Sinpe Móvil');

    // Formulario Venta Rápida
    const [vrCliente, setVrCliente] = useState('');
    const [vrTelefono, setVrTelefono] = useState('');
    const [vrProducto, setVrProducto] = useState('');
    const [vrPrecio, setVrPrecio] = useState('');
    const [vrPagado, setVrPagado] = useState('');
    const [vrMetodo, setVrMetodo] = useState('Efectivo');

    // Cargar Datos
    useEffect(() => {
        const qPedidos = query(collection(db, "pedidos"), orderBy("fecha_solicitud", "asc"));
        const unPedidos = onSnapshot(qPedidos, (snapshot) => {
            const data = [];
            snapshot.forEach(d => data.push({ id: d.id, ...d.data() }));
            setPedidos(data.filter(p => ESTADOS_ACTIVOS.includes(p.estado)));
            
            // Actualizar el pedido activo en tiempo real si el modal está abierto
            setPedidoActivo(prev => {
                if (prev) {
                    const actualizado = data.find(p => p.id === prev.id);
                    return actualizado || prev;
                }
                return prev;
            });
        });

        const unCatalogo = onSnapshot(collection(db, "productos"), (snapshot) => {
            const cat = []; snapshot.forEach(d => cat.push(d.data())); setProductosCatalogo(cat);
        });

        return () => { unPedidos(); unCatalogo(); };
    }, []);

    // API Contactos
    const handleSeleccionarContacto = async (setTelefonoFn, setClienteFn, clienteActual) => {
        if ('contacts' in navigator && 'ContactsManager' in window) {
            try {
                const contactos = await navigator.contacts.select(['name', 'tel'], { multiple: false });
                if (contactos.length > 0) {
                    const contacto = contactos[0];
                    if (contacto.tel && contacto.tel.length > 0) {
                        let num = contacto.tel[0].replace(/[\s-]/g, '');
                        if (num.startsWith('+506')) num = num.substring(4);
                        setTelefonoFn(num);
                    }
                    if (contacto.name && contacto.name.length > 0 && !clienteActual) setClienteFn(contacto.name[0]);
                }
            } catch (ex) { console.log("Selección cancelada."); }
        } else { Swal.fire('Aviso', 'Tu dispositivo no soporta la extracción de contactos.', 'info'); }
    };

    // Drag & Drop
    const handleDragStart = (e, id) => e.dataTransfer.setData('idPedido', id);
    const handleDrop = async (e, nuevoEstado) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('idPedido');
        const ped = pedidos.find(p => p.id === id);
        if (ped && ped.estado !== nuevoEstado) {
            await updateDoc(doc(db, "pedidos", id), { estado: nuevoEstado });
        }
    };

    // ==========================================
    // FUNCIONES DEL MODAL DE DETALLE
    // ==========================================
    const abrirDetalle = (ped) => { setPedidoActivo(ped); setShowDetalle(true); };

    const handleWhatsApp = () => {
        let num = pedidoActivo.telefono.replace(/[\s-]/g, '');
        if (num.length === 8) num = '506' + num;
        const saldo = (pedidoActivo.precio || 0) - (pedidoActivo.monto_pagado || 0);
        
        let txt = `Hola ${pedidoActivo.cliente}, somos *MASUCRI*. `;
        if (pedidoActivo.estado === 'Por Retirar') txt += `Te avisamos que tu pedido de *${pedidoActivo.producto}* ya está listo para retirar.`;
        else txt += `Te contactamos sobre tu pedido de *${pedidoActivo.producto}*.`;
        
        if (saldo > 0) txt += ` Queda un saldo pendiente de ₡${saldo.toLocaleString('es-CR')}.`;
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(txt)}`, '_blank');
    };

    const handleImprimirTicket = () => {
        window.print(); // Dispara la impresora (el CSS ocultará todo menos el ticket)
    };

    const handleEntregar = async () => {
        const deuda = (pedidoActivo.precio || 0) - (pedidoActivo.monto_pagado || 0);
        let msg = deuda > 0 ? `Tiene un saldo pendiente de ₡${deuda}. ¿Entregar de todas formas?` : '¿Marcar como entregado?';
        const res = await Swal.fire({ title: '¿Entregar Trabajo?', text: msg, icon: 'question', showCancelButton: true });
        if (res.isConfirmed) {
            await updateDoc(doc(db, "pedidos", pedidoActivo.id), { estado: 'Entregado', fecha_cierre: obtenerFechaLocal() });
            setShowDetalle(false);
            Swal.fire({ icon: 'success', title: 'Entregado', timer: 1000, showConfirmButton: false });
        }
    };

    const handleAnular = async () => {
        const res = await Swal.fire({ title: '¿Anular Pedido?', text: 'Se moverá al historial como cancelado.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545' });
        if (res.isConfirmed) {
            await updateDoc(doc(db, "pedidos", pedidoActivo.id), { estado: 'Cancelado', fecha_cierre: obtenerFechaLocal() });
            setShowDetalle(false);
            Swal.fire({ icon: 'success', title: 'Anulado', timer: 1000, showConfirmButton: false });
        }
    };

    const handleMoverFicha = async (nuevoEstado) => {
        await updateDoc(doc(db, "pedidos", pedidoActivo.id), { estado: nuevoEstado });
    };

    const handleAbonar = async () => {
        const deudaAnterior = (pedidoActivo.precio || 0) - (pedidoActivo.monto_pagado || 0);
        if (deudaAnterior <= 0) return Swal.fire('Aviso', 'Pagado en su totalidad.', 'info');

        const { value: formValues } = await Swal.fire({
            title: 'Abonar a la deuda',
            html: `
                <div class="text-start mb-2"><label>Deuda Actual: ₡${deudaAnterior.toLocaleString()}</label>
                <input id="swal-monto" type="number" class="form-control border-primary" placeholder="Monto a abonar"></div>
                <select id="swal-metodo" class="form-select border-primary"><option>Sinpe Móvil</option><option>Efectivo</option><option>Transferencia</option></select>
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
            Swal.fire('Abono Registrado', 'Dinero ingresado a Caja.', 'success');
        }
    };

    // ==========================================
    // FUNCIONES GUARDAR (NUEVO/EDITAR/VENTA)
    // ==========================================
    const handleGuardarPedido = async (e) => {
        e.preventDefault();
        const pTotal = parseFloat(precio) || 0; const mAdelanto = parseFloat(adelanto) || 0;
        const datos = { fecha_solicitud: fSolicitud, fecha_entrega: fEntrega, cliente: cliente.trim(), telefono: telefono.trim(), producto: producto.trim(), descripcion: desc.trim(), precio: pTotal };

        if (pedidoEdit) {
            await updateDoc(doc(db, "pedidos", pedidoEdit.id), datos);
        } else {
            datos.estado = 'Pendiente'; datos.monto_pagado = mAdelanto; datos.historial_pagos = [];
            if (mAdelanto > 0) {
                datos.ultimo_metodo_pago = metodoAdelanto;
                datos.historial_pagos.push({ fecha: obtenerFechaLocal(), monto: mAdelanto, metodo: metodoAdelanto });
                await addDoc(collection(db, "movimientos"), { tipo: 'entrada', metodo_pago: metodoAdelanto, fecha: obtenerFechaLocal(), descripcion: `Adelanto: ${datos.producto}`, entidad: datos.cliente, monto: mAdelanto, timestamp: new Date() });
            }
            datos.timestamp = new Date();
            await addDoc(collection(db, "pedidos"), datos);
        }
        setShowNuevo(false); Swal.fire({ icon: 'success', title: 'Guardado', timer: 1000, showConfirmButton: false });
    };

    const handleVentaRapida = async (e) => {
        e.preventDefault();
        const precioTotal = parseFloat(vrPrecio) || 0; const pagado = parseFloat(vrPagado) || 0;
        if (pagado > precioTotal) return Swal.fire('Error', 'El pago no supera el total', 'error');
        const hoy = obtenerFechaLocal();
        const datos = { fecha_solicitud: hoy, fecha_entrega: hoy, fecha_cierre: hoy, cliente: vrCliente.trim(), telefono: vrTelefono.trim(), producto: vrProducto.trim(), descripcion: 'Venta rápida', precio: precioTotal, monto_pagado: pagado, estado: 'Entregado', ultimo_metodo_pago: pagado > 0 ? vrMetodo : 'Pendiente', historial_pagos: pagado > 0 ? [{ fecha: hoy, monto: pagado, metodo: vrMetodo }] : [], timestamp: new Date() };

        await addDoc(collection(db, "pedidos"), datos);
        if (pagado > 0) await addDoc(collection(db, "movimientos"), { tipo: 'entrada', metodo_pago: vrMetodo, fecha: hoy, descripcion: `Venta Rápida: ${datos.producto}`, entidad: datos.cliente, monto: pagado, timestamp: new Date() });
        
        setShowVenta(false); setVrCliente(''); setVrTelefono(''); setVrProducto(''); setVrPrecio(''); setVrPagado('');
        Swal.fire({ icon: 'success', title: '¡Venta Registrada!' });
    };

    const limpiarFormularioPedido = () => {
        setPedidoEdit(null); setFSolicitud(obtenerFechaLocal()); setFEntrega(''); setCliente(''); setTelefono(''); setProducto(''); setDesc(''); setPrecio(''); setAdelanto('');
    };

    const abrirEditar = (ped) => {
        setShowDetalle(false);
        setPedidoEdit(ped); setFSolicitud(ped.fecha_solicitud); setFEntrega(ped.fecha_entrega || ''); setCliente(ped.cliente); setTelefono(ped.telefono || ''); setProducto(ped.producto); setDesc(ped.descripcion || ''); setPrecio(ped.precio || '');
        setShowNuevo(true);
    };

    let activos = [...pedidos];
    if (filtroTexto) activos = activos.filter(p => p.cliente?.toLowerCase().includes(filtroTexto.toLowerCase()) || p.producto?.toLowerCase().includes(filtroTexto.toLowerCase()));
    activos.sort((a, b) => new Date(a.fecha_entrega || '2099-01-01') - new Date(b.fecha_entrega || '2099-01-01'));
    
    const renderCard = (ped) => {
        const deuda = (ped.precio || 0) - (ped.monto_pagado || 0);
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        let colorAlerta = 'border-secondary';
        
        if (ped.fecha_entrega) {
            const f = new Date(ped.fecha_entrega + 'T00:00:00'); const diff = Math.ceil((f - hoy) / 86400000);
            if (diff < 0) colorAlerta = 'border-danger bg-danger-subtle'; else if (diff === 0) colorAlerta = 'border-warning bg-warning-subtle';
        }

        return (
            <Card key={ped.id} className={`mb-2 shadow-sm border-start border-4 ${colorAlerta}`} draggable onDragStart={(e) => handleDragStart(e, ped.id)} style={{ cursor: 'grab' }}>
                <Card.Body className="p-2" onClick={() => abrirDetalle(ped)}>
                    <div className="d-flex justify-content-between"><strong className="text-truncate">{ped.cliente}</strong><small className="text-muted fw-bold">{ped.fecha_entrega ? ped.fecha_entrega.slice(5) : 'S/F'}</small></div>
                    <p className="small mb-1 text-truncate">{ped.producto}</p>
                    <div className="d-flex justify-content-between align-items-center mt-2">
                        <Badge bg={deuda > 0 ? 'warning' : (ped.precio ? 'success' : 'secondary')} className="text-dark">
                            {deuda > 0 ? `Debe ₡${deuda.toLocaleString()}` : (ped.precio ? 'Pagado' : 'Sin precio')}
                        </Badge>
                        <Button variant="light" size="sm" className="border shadow-sm"><i className="fas fa-pen text-secondary"></i></Button>
                    </div>
                </Card.Body>
            </Card>
        );
    };

    return (
        <Container className="mt-4 flex-grow-1 d-flex flex-column">
            {/* ENCABEZADO Y CONTROLES */}
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2 d-print-none">
                <h3 className="fw-bold m-0 text-primary"><i className="fas fa-tasks"></i> Tablero de Producción</h3>
                <div className="d-flex gap-2">
                    <Button variant="warning" className="fw-bold shadow-sm text-dark" onClick={() => setShowVenta(true)}><i className="fas fa-bolt"></i> Venta Rápida</Button>
                    <Button variant="primary" className="fw-bold shadow-sm" onClick={() => { limpiarFormularioPedido(); setShowNuevo(true); }}><i className="fas fa-plus"></i> Nuevo Pedido</Button>
                </div>
            </div>
            <Form.Control type="text" placeholder="Buscar cliente o producto..." className="mb-3 border-primary shadow-sm d-print-none" value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} />

            {/* TABLERO KANBAN */}
            <Row className="flex-nowrap overflow-auto pb-3 flex-grow-1 d-print-none" style={{ minHeight: '500px', scrollSnapType: 'x mandatory' }}>
                <Col xs={12} md={4} style={{ minWidth: '300px', scrollSnapAlign: 'start' }}>
                    <Card className="bg-light h-100 border-0 shadow-sm">
                        <Card.Header className="text-white fw-bold d-flex justify-content-between" style={{ backgroundColor: '#6c757d', borderRadius: '8px 8px 0 0' }}>
                            <span><i className="fas fa-inbox"></i> Pendiente</span><Badge bg="white" text="dark" className="rounded-pill">{activos.filter(p => p.estado === 'Pendiente').length}</Badge>
                        </Card.Header>
                        <Card.Body className="p-2" onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, 'Pendiente')}>{activos.filter(p => p.estado === 'Pendiente').map(renderCard)}</Card.Body>
                    </Card>
                </Col>
                <Col xs={12} md={4} style={{ minWidth: '300px', scrollSnapAlign: 'start' }}>
                    <Card className="bg-light h-100 border-0 shadow-sm">
                        <Card.Header className="text-white fw-bold d-flex justify-content-between" style={{ backgroundColor: '#0dcaf0', borderRadius: '8px 8px 0 0' }}>
                            <span><i className="fas fa-hammer"></i> En Producción</span><Badge bg="white" text="dark" className="rounded-pill">{activos.filter(p => p.estado === 'En producción').length}</Badge>
                        </Card.Header>
                        <Card.Body className="p-2" onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, 'En producción')}>{activos.filter(p => p.estado === 'En producción').map(renderCard)}</Card.Body>
                    </Card>
                </Col>
                <Col xs={12} md={4} style={{ minWidth: '300px', scrollSnapAlign: 'start' }}>
                    <Card className="bg-light h-100 border-0 shadow-sm">
                        <Card.Header className="text-dark fw-bold d-flex justify-content-between" style={{ backgroundColor: '#ffc107', borderRadius: '8px 8px 0 0' }}>
                            <span><i className="fas fa-box-open"></i> Por Retirar</span><Badge bg="white" text="dark" className="rounded-pill">{activos.filter(p => p.estado === 'Por Retirar').length}</Badge>
                        </Card.Header>
                        <Card.Body className="p-2" onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, 'Por Retirar')}>{activos.filter(p => p.estado === 'Por Retirar').map(renderCard)}</Card.Body>
                    </Card>
                </Col>
            </Row>

            <datalist id="listaCatalogo">{productosCatalogo.map(p => <option key={p.id} value={p.nombre} />)}</datalist>

            {/* =========================================================
                MODAL: DETALLE DEL PEDIDO (El que faltaba)
               ========================================================= */}
            <Modal show={showDetalle} onHide={() => setShowDetalle(false)} centered className="d-print-none">
                <Modal.Header closeButton className="bg-light border-bottom-0 pb-0">
                    <Modal.Title className="fw-bold fs-5"><i className="fas fa-file-invoice text-dark"></i> Detalle del Pedido</Modal.Title>
                </Modal.Header>
                {pedidoActivo && (
                    <Modal.Body className="p-0">
                        <div className="text-center pb-3 pt-2 bg-light border-bottom">
                            <Badge bg={pedidoActivo.estado === 'Por Retirar' ? 'warning text-dark' : (pedidoActivo.estado === 'En producción' ? 'info text-white' : 'secondary')} className="fs-6 px-4 py-2 shadow-sm border mb-2">
                                {pedidoActivo.estado === 'En producción' ? 'Produciendo' : pedidoActivo.estado}
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

                            {((pedidoActivo.precio || 0) - (pedidoActivo.monto_pagado || 0)) > 0 ? (
                                <ListGroup.Item className="text-center bg-warning text-dark py-2">
                                    <h5 className="fw-bold m-0">Debe: ₡{((pedidoActivo.precio || 0) - (pedidoActivo.monto_pagado || 0)).toLocaleString('es-CR')}</h5>
                                </ListGroup.Item>
                            ) : (
                                <ListGroup.Item className="text-center bg-success text-white py-2">
                                    <h5 className="fw-bold m-0"><i className="fas fa-check"></i> Pagado</h5>
                                </ListGroup.Item>
                            )}
                            
                            <ListGroup.Item className="text-center py-3 bg-light">
                                <small className="fw-bold text-dark d-block mb-2">Mover ficha a:</small>
                                <ButtonGroup className="shadow-sm w-100">
                                    <Button variant={pedidoActivo.estado === 'Pendiente' ? 'secondary' : 'outline-secondary'} onClick={() => handleMoverFicha('Pendiente')}>Pendiente</Button>
                                    <Button variant={pedidoActivo.estado === 'En producción' ? 'info text-white' : 'outline-info'} onClick={() => handleMoverFicha('En producción')}>Produciendo</Button>
                                    <Button variant={pedidoActivo.estado === 'Por Retirar' ? 'warning text-dark' : 'outline-warning'} onClick={() => handleMoverFicha('Por Retirar')}>Por Retirar</Button>
                                </ButtonGroup>
                            </ListGroup.Item>
                        </ListGroup>
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
                 {/* ... (Todo el código del formulario que ya estaba bien) ... */}
                 <Modal.Header closeButton className="bg-primary text-white">
                    <Modal.Title className="fw-bold">{pedidoEdit ? 'Editar Pedido' : 'Nuevo Pedido'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleGuardarPedido}>
                        <Row className="mb-3">
                            <Col xs={6}><Form.Label className="small text-muted">Solicitud</Form.Label><Form.Control type="date" value={fSolicitud} readOnly /></Col>
                            <Col xs={6}><Form.Label className="small text-primary fw-bold">Entrega</Form.Label><Form.Control type="date" className="border-primary" value={fEntrega} onChange={e => setFEntrega(e.target.value)} /></Col>
                        </Row>
                        <Form.Group className="mb-3">
                            <Form.Label>Cliente</Form.Label>
                            <Form.Control required type="text" value={cliente} onChange={e => setCliente(e.target.value)} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Teléfono</Form.Label>
                            <InputGroup>
                                <Form.Control type="text" value={telefono} onChange={e => setTelefono(e.target.value)} />
                                {'contacts' in navigator && <Button variant="outline-secondary" onClick={() => handleSeleccionarContacto(setTelefono, setCliente, cliente)}><i className="fas fa-address-book"></i></Button>}
                            </InputGroup>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Producto</Form.Label>
                            <Form.Control required type="text" list="listaCatalogo" value={producto} onChange={e => setProducto(e.target.value)} onBlur={(e) => { const p = productosCatalogo.find(x => x.nombre.toLowerCase() === e.target.value.toLowerCase()); if(p) setPrecio(p.precio_venta); }} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Notas</Form.Label>
                            <Form.Control as="textarea" rows={2} value={desc} onChange={e => setDesc(e.target.value)} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold">Precio Total</Form.Label>
                            <Form.Control type="number" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)} />
                        </Form.Group>
                        {!pedidoEdit && (
                            <Row className="mb-3 p-3 bg-light rounded mx-0">
                                <Col xs={6}><Form.Label className="small">Adelanto (₡)</Form.Label><Form.Control type="number" step="0.01" value={adelanto} onChange={e => setAdelanto(e.target.value)} /></Col>
                                <Col xs={6}><Form.Label className="small">Método</Form.Label><Form.Select value={metodoAdelanto} onChange={e => setMetodoAdelanto(e.target.value)}><option>Sinpe Móvil</option><option>Efectivo</option></Form.Select></Col>
                            </Row>
                        )}
                        <Button type="submit" variant="primary" className="w-100 fw-bold">Guardar</Button>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* MODAL VENTA RAPIDA ... (Omitido para ahorrar espacio en la vista, asume que es el mismo de antes) ... */}

            {/* =========================================================
                PIEZA DE IMPRESIÓN (Invisible en pantalla, visible al imprimir)
               ========================================================= */}
            <TicketImpresion pedido={pedidoActivo} />

        </Container>
    );
}