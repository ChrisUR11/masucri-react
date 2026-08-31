import { useState, useMemo } from 'react';
import { Container, Card, Table, Button, Modal, Form, Row, Col, Badge } from 'react-bootstrap';
import { collection, query, orderBy, addDoc, updateDoc, deleteDoc, doc, limit, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import Swal from 'sweetalert2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import EstadoCarga, { EstadoError } from '../components/EstadoCarga';
import { obtenerFechaLocal } from '../utils/fecha';
import { formatoColones, aNumeroSeguro } from '../utils/formato';

ChartJS.register(ArcElement, Tooltip, Legend);

const LIMITE_CONSULTA = 200;
const FORM_VACIO = { tipo: 'entrada', fecha: obtenerFechaLocal(), metodoPago: 'Efectivo', descripcion: '', entidad: '', monto: '' };

export default function Finanzas() {
    const { datos: movimientos, cargando, error } = useFirestoreCollection(
        () => query(collection(db, 'movimientos'), orderBy('fecha', 'desc'), limit(LIMITE_CONSULTA)),
        []
    );

    const [filtroModo, setFiltroModo] = useState('ambos');
    const [filtroInicio, setFiltroInicio] = useState('');
    const [filtroFin, setFiltroFin] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState(FORM_VACIO);
    const [guardando, setGuardando] = useState(false);
    const [generandoRespaldo, setGenerandoRespaldo] = useState(false);

    const actualizar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

    const filtrados = useMemo(() => {
        let lista = movimientos;
        if (filtroInicio) lista = lista.filter((m) => m.fecha >= filtroInicio);
        if (filtroFin) lista = lista.filter((m) => m.fecha <= filtroFin);
        if (filtroModo !== 'ambos') lista = lista.filter((m) => m.tipo === (filtroModo === 'entradas' ? 'entrada' : 'salida'));
        return lista;
    }, [movimientos, filtroInicio, filtroFin, filtroModo]);

    const { totalEntradas, totalSalidas } = useMemo(() => {
        let entradas = 0;
        let salidas = 0;
        filtrados.forEach((m) => {
            if (m.tipo === 'entrada') entradas += m.monto || 0;
            else salidas += m.monto || 0;
        });
        return { totalEntradas: entradas, totalSalidas: salidas };
    }, [filtrados]);

    // Aviso suave si el usuario filtra fuera del rango de los últimos LIMITE_CONSULTA
    // movimientos: los totales podrían no reflejar el histórico completo.
    const posibleDatosIncompletos =
        movimientos.length === LIMITE_CONSULTA && filtroInicio && filtroInicio < (movimientos[movimientos.length - 1]?.fecha || '');

    const chartData = {
        labels: filtroModo === 'ambos' ? ['Ingresos', 'Gastos'] : filtroModo === 'entradas' ? ['Ingresos'] : ['Gastos'],
        datasets: [
            {
                data: filtroModo === 'ambos' ? [totalEntradas, totalSalidas] : filtroModo === 'entradas' ? [totalEntradas] : [totalSalidas],
                backgroundColor: filtroModo === 'ambos' ? ['#198754', '#dc3545'] : filtroModo === 'entradas' ? ['#198754'] : ['#dc3545']
            }
        ]
    };

    const handleClose = () => {
        setShowModal(false);
        setEditId(null);
        setForm({ ...FORM_VACIO, fecha: obtenerFechaLocal() });
    };

    const handleOpen = (m = null) => {
        if (m) {
            setEditId(m.id);
            setForm({
                tipo: m.tipo,
                fecha: m.fecha,
                metodoPago: m.metodo_pago || 'Efectivo',
                descripcion: m.descripcion || '',
                entidad: m.entidad || '',
                monto: m.monto ?? ''
            });
        } else {
            setForm({ ...FORM_VACIO, fecha: obtenerFechaLocal() });
        }
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const monto = aNumeroSeguro(form.monto);
        if (monto <= 0) return Swal.fire('Monto inválido', 'Ingresa un monto mayor a cero.', 'warning');
        if (!form.descripcion.trim()) return Swal.fire('Falta el concepto', 'Describe brevemente el movimiento.', 'warning');

        const datos = {
            tipo: form.tipo,
            fecha: form.fecha,
            metodo_pago: form.metodoPago,
            descripcion: form.descripcion.trim(),
            entidad: form.entidad.trim(),
            monto,
            timestamp: new Date()
        };

        setGuardando(true);
        try {
            if (editId) await updateDoc(doc(db, 'movimientos', editId), datos);
            else await addDoc(collection(db, 'movimientos'), datos);
            handleClose();
            Swal.fire({ icon: 'success', title: 'Registrado', timer: 1000, showConfirmButton: false });
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Fallo al guardar. Intenta de nuevo.', 'error');
        } finally {
            setGuardando(false);
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: '¿Eliminar movimiento?',
            text: 'Esto alterará tu balance.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545'
        });
        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, 'movimientos', id));
            } catch (err) {
                console.error(err);
                Swal.fire('Error', 'No se pudo eliminar el movimiento.', 'error');
            }
        }
    };

    /**
     * Descarga TODO el negocio (pedidos, movimientos y catálogo completos —
     * no solo lo que se ve filtrado en pantalla ni los últimos 200
     * movimientos) en un solo Excel con 3 pestañas. Es una red de seguridad
     * manual: si algo se borra por error, queda esta copia.
     */
    const handleRespaldoCompleto = async () => {
        setGenerandoRespaldo(true);
        try {
            const [pedidosSnap, productosSnap, movimientosSnap] = await Promise.all([
                getDocs(collection(db, 'pedidos')),
                getDocs(collection(db, 'productos')),
                getDocs(collection(db, 'movimientos'))
            ]);

            const pedidos = pedidosSnap.docs.map((d) => d.data());
            const productos = productosSnap.docs.map((d) => d.data());
            const todosMovimientos = movimientosSnap.docs.map((d) => d.data());

            const wb = XLSX.utils.book_new();

            XLSX.utils.book_append_sheet(
                wb,
                XLSX.utils.json_to_sheet(
                    pedidos.map((p) => ({
                        Cliente: p.cliente,
                        Teléfono: p.telefono,
                        Producto: p.producto,
                        Descripción: p.descripcion,
                        Precio: p.precio || 0,
                        Pagado: p.monto_pagado || 0,
                        Estado: p.estado,
                        'Fecha Solicitud': p.fecha_solicitud,
                        'Fecha Entrega': p.fecha_entrega,
                        'Fecha Cierre': p.fecha_cierre
                    }))
                ),
                'Pedidos'
            );

            XLSX.utils.book_append_sheet(
                wb,
                XLSX.utils.json_to_sheet(
                    todosMovimientos.map((m) => ({
                        Fecha: m.fecha,
                        Tipo: m.tipo,
                        Método: m.metodo_pago,
                        Concepto: m.descripcion,
                        Entidad: m.entidad,
                        Monto: m.monto || 0
                    }))
                ),
                'Movimientos'
            );

            XLSX.utils.book_append_sheet(
                wb,
                XLSX.utils.json_to_sheet(
                    productos.map((p) => ({
                        Nombre: p.nombre,
                        Proveedor: p.proveedor,
                        Código: p.codigo_proveedor,
                        Costo: p.costo || 0,
                        'Precio Venta': p.precio_venta || 0
                    }))
                ),
                'Catálogo'
            );

            XLSX.writeFile(wb, `Respaldo_MASUCRI_${obtenerFechaLocal()}.xlsx`);
            Swal.fire({ icon: 'success', title: 'Respaldo descargado', timer: 1200, showConfirmButton: false });
        } catch (err) {
            console.error('Error generando respaldo:', err);
            Swal.fire('Error', 'No se pudo generar el respaldo. Revisa tu conexión e intenta de nuevo.', 'error');
        } finally {
            setGenerandoRespaldo(false);
        }
    };

    const exportarPDF = () => {
        if (filtrados.length === 0) return Swal.fire('Aviso', 'No hay datos para exportar.', 'warning');
        try {
            const docPDF = new jsPDF();
            docPDF.text('Reporte Contable - MASUCRI', 14, 15);
            autoTable(docPDF, {
                head: [['Fecha', 'Método', 'Tipo', 'Concepto', 'Monto']],
                body: filtrados.map((m) => [m.fecha, m.metodo_pago || 'Manual', m.tipo.toUpperCase(), m.descripcion, formatoColones(m.monto)]),
                startY: 28
            });
            docPDF.save(`Finanzas_MASUCRI_${obtenerFechaLocal()}.pdf`);
        } catch (err) {
            console.error('Error generando PDF:', err);
            Swal.fire('Error', 'No se pudo generar el PDF. Intenta de nuevo.', 'error');
        }
    };

    const exportarExcel = () => {
        if (filtrados.length === 0) return Swal.fire('Aviso', 'No hay datos para exportar.', 'warning');
        try {
            const ws = XLSX.utils.json_to_sheet(
                filtrados.map((m) => ({
                    Fecha: m.fecha,
                    Método: m.metodo_pago || 'Manual',
                    Tipo: m.tipo.toUpperCase(),
                    Concepto: m.descripcion,
                    Monto: m.monto
                }))
            );
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Datos');
            XLSX.writeFile(wb, `Finanzas_MASUCRI_${obtenerFechaLocal()}.xlsx`);
        } catch (err) {
            console.error('Error generando Excel:', err);
            Swal.fire('Error', 'No se pudo generar el Excel. Intenta de nuevo.', 'error');
        }
    };

    return (
        <Container className="mt-4 flex-grow-1">
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <h3 className="fw-bold m-0 text-success"><i className="fas fa-wallet"></i> Finanzas y Caja</h3>
                <Button variant="success" className="fw-bold shadow-sm" onClick={() => handleOpen()}>
                    <i className="fas fa-plus"></i> Registrar Movimiento
                </Button>
            </div>

            {error ? (
                <EstadoError texto="No se pudo cargar Caja. Revisa tu conexión." />
            ) : cargando ? (
                <EstadoCarga texto="Cargando movimientos..." />
            ) : (
                <>
                    <Row className="mb-4">
                        <Col md={4} className="mb-3">
                            <Card className="text-bg-success shadow-sm text-center h-100 border-0">
                                <Card.Body><h6>Entradas</h6><h3>{formatoColones(totalEntradas)}</h3></Card.Body>
                            </Card>
                        </Col>
                        <Col md={4} className="mb-3">
                            <Card className="text-bg-danger shadow-sm text-center h-100 border-0">
                                <Card.Body><h6>Salidas</h6><h3>{formatoColones(totalSalidas)}</h3></Card.Body>
                            </Card>
                        </Col>
                        <Col md={4} className="mb-3">
                            <Card className="text-bg-info text-white shadow-sm text-center h-100 border-0">
                                <Card.Body><h6>Balance Neto</h6><h3>{formatoColones(totalEntradas - totalSalidas)}</h3></Card.Body>
                            </Card>
                        </Col>
                    </Row>

                    {posibleDatosIncompletos && (
                        <div className="alert alert-warning small">
                            <i className="fas fa-triangle-exclamation"></i> Solo se consultan los últimos {LIMITE_CONSULTA} movimientos.
                            Si filtras fechas muy antiguas, los totales podrían no incluir todo el histórico.
                        </div>
                    )}

                    <Row>
                        <Col lg={4} className="mb-4">
                            <Card className="shadow-sm border-0 h-100">
                                <Card.Header className="bg-white fw-bold">Filtros y Resumen</Card.Header>
                                <Card.Body>
                                    <Form.Select className="mb-3" value={filtroModo} onChange={(e) => setFiltroModo(e.target.value)}>
                                        <option value="ambos">Ver Todo</option>
                                        <option value="entradas">Solo Entradas</option>
                                        <option value="salidas">Solo Salidas</option>
                                    </Form.Select>
                                    <Form.Control type="date" className="mb-3" value={filtroInicio} onChange={(e) => setFiltroInicio(e.target.value)} aria-label="Fecha inicio" />
                                    <Form.Control type="date" className="mb-4" value={filtroFin} onChange={(e) => setFiltroFin(e.target.value)} aria-label="Fecha fin" />

                                    <div className="d-flex justify-content-center" style={{ maxHeight: '250px' }}>
                                        {totalEntradas > 0 || totalSalidas > 0 ? (
                                            <Doughnut data={chartData} options={{ maintainAspectRatio: false }} />
                                        ) : (
                                            <p className="text-muted mt-4">Sin datos para graficar</p>
                                        )}
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>

                        <Col lg={8} className="mb-4">
                            <Card className="shadow-sm border-0 h-100">
                                <Card.Header className="bg-white fw-bold d-flex justify-content-between align-items-center">
                                    <span>Libro Diario</span>
                                    <div>
                                        <Button variant="danger" size="sm" className="me-2 px-3" onClick={exportarPDF}><i className="fas fa-file-pdf"></i> PDF</Button>
                                        <Button variant="success" size="sm" className="me-2 px-3" onClick={exportarExcel}><i className="fas fa-file-excel"></i> Excel</Button>
                                        <Button variant="dark" size="sm" className="px-3" onClick={handleRespaldoCompleto} disabled={generandoRespaldo} title="Descarga TODOS los pedidos, movimientos y catálogo (no solo lo filtrado aquí)">
                                            <i className="fas fa-shield-halved"></i> {generandoRespaldo ? 'Generando...' : 'Respaldo Total'}
                                        </Button>
                                    </div>
                                </Card.Header>
                                <Card.Body className="p-0 table-responsive" style={{ height: '500px', overflowY: 'auto' }}>
                                    <Table hover className="align-middle m-0 text-nowrap">
                                        <thead className="table-light sticky-top shadow-sm" style={{ zIndex: 1 }}>
                                            <tr>
                                                <th>Fecha</th>
                                                <th>Detalle / Método</th>
                                                <th>Monto</th>
                                                <th className="text-center">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtrados.length === 0 ? (
                                                <tr><td colSpan="4" className="text-center py-4 text-muted">No hay registros.</td></tr>
                                            ) : (
                                                filtrados.map((m) => (
                                                    <tr key={m.id}>
                                                        <td>{m.fecha}</td>
                                                        <td>
                                                            <strong>{m.descripcion}</strong> <Badge bg="secondary">{m.metodo_pago || 'Manual'}</Badge><br />
                                                            <small className="text-muted">{m.entidad || ''}</small>
                                                        </td>
                                                        <td className={`fw-bold ${m.tipo === 'entrada' ? 'text-success' : 'text-danger'}`}>
                                                            {formatoColones(m.monto)}
                                                        </td>
                                                        <td className="text-center">
                                                            <Button variant="outline-secondary" size="sm" className="me-1" onClick={() => handleOpen(m)} aria-label="Editar movimiento">
                                                                <i className="fas fa-pen"></i>
                                                            </Button>
                                                            <Button variant="outline-danger" size="sm" onClick={() => handleDelete(m.id)} aria-label="Eliminar movimiento">
                                                                <i className="fas fa-trash"></i>
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </Table>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </>
            )}

            {/* MODAL DE REGISTRO / EDICIÓN */}
            <Modal show={showModal} onHide={handleClose} backdrop="static">
                <Modal.Header closeButton className={form.tipo === 'entrada' ? 'bg-success text-white' : 'bg-danger text-white'}>
                    <Modal.Title className="fw-bold"><i className="fas fa-cash-register"></i> {editId ? 'Editar' : 'Registrar'} Movimiento</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleSave}>
                        <Row className="mb-3">
                            <Col md={6}>
                                <Form.Label className="fw-bold">Tipo</Form.Label>
                                <Form.Select value={form.tipo} onChange={actualizar('tipo')}>
                                    <option value="entrada">Entrada (Ingreso)</option>
                                    <option value="salida">Salida (Gasto)</option>
                                </Form.Select>
                            </Col>
                            <Col md={6}>
                                <Form.Label className="fw-bold">Fecha</Form.Label>
                                <Form.Control type="date" required value={form.fecha} onChange={actualizar('fecha')} />
                            </Col>
                        </Row>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold">Método de Pago</Form.Label>
                            <Form.Select value={form.metodoPago} onChange={actualizar('metodoPago')}>
                                <option value="Efectivo">Efectivo</option>
                                <option value="Sinpe Móvil">Sinpe Móvil</option>
                                <option value="Transferencia">Transferencia</option>
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold">Concepto</Form.Label>
                            <Form.Control required name="concepto" type="text" placeholder="Ej: Compra de tintas" value={form.descripcion} onChange={actualizar('descripcion')} />
                        </Form.Group>
                        <Row className="mb-4">
                            <Col md={6}>
                                <Form.Label className="fw-bold">Entidad (Opcional)</Form.Label>
                                <Form.Control name="entidad" type="text" placeholder="Ej: Ubora" value={form.entidad} onChange={actualizar('entidad')} />
                            </Col>
                            <Col md={6}>
                                <Form.Label className="fw-bold">Monto (₡)</Form.Label>
                                <Form.Control type="number" step="0.01" min="1" required value={form.monto} onChange={actualizar('monto')} />
                            </Col>
                        </Row>
                        <Button type="submit" variant={form.tipo === 'entrada' ? 'success' : 'danger'} className="w-100 fw-bold shadow-sm" disabled={guardando}>
                            {guardando ? 'Guardando...' : 'Guardar en Caja'}
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>
        </Container>
    );
}
