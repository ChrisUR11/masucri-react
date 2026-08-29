import { useState, useEffect } from 'react';
import { Container, Card, Table, Button, Modal, Form, Row, Col, Badge } from 'react-bootstrap';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import Swal from 'sweetalert2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as XLSX from 'xlsx';

ChartJS.register(ArcElement, Tooltip, Legend);

// Función para obtener fecha local en formato YYYY-MM-DD
const obtenerFechaLocal = () => {
    const hoy = new Date();
    const tzOffset = hoy.getTimezoneOffset() * 60000;
    return new Date(hoy.getTime() - tzOffset).toISOString().split('T')[0];
};

export default function Finanzas() {
    const [movimientos, setMovimientos] = useState([]);
    const [filtroModo, setFiltroModo] = useState('ambos');
    const [filtroInicio, setFiltroInicio] = useState('');
    const [filtroFin, setFiltroFin] = useState('');

    // Estados para el Modal de Registro/Edición
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [tipo, setTipo] = useState('entrada');
    const [fecha, setFecha] = useState(obtenerFechaLocal());
    const [metodoPago, setMetodoPago] = useState('Efectivo');
    const [descripcion, setDescripcion] = useState('');
    const [entidad, setEntidad] = useState('');
    const [monto, setMonto] = useState('');

    // Conexión a Firebase
    useEffect(() => {
        const q = query(collection(db, "movimientos"), orderBy("fecha", "desc"), limit(200));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const movs = [];
            snapshot.forEach((doc) => movs.push({ id: doc.id, ...doc.data() }));
            setMovimientos(movs);
        });
        return () => unsubscribe();
    }, []);

    // Lógica de Filtros
    let filtrados = movimientos;
    if (filtroInicio) filtrados = filtrados.filter(m => m.fecha >= filtroInicio);
    if (filtroFin) filtrados = filtrados.filter(m => m.fecha <= filtroFin);
    if (filtroModo !== 'ambos') filtrados = filtrados.filter(m => m.tipo === (filtroModo === 'entradas' ? 'entrada' : 'salida'));

    // Cálculos Rápidos
    let totalEntradas = 0;
    let totalSalidas = 0;
    filtrados.forEach(m => {
        if (m.tipo === 'entrada') totalEntradas += m.monto;
        else totalSalidas += m.monto;
    });

    // Configuración del Gráfico
    const chartData = {
        labels: filtroModo === 'ambos' ? ['Ingresos', 'Gastos'] : filtroModo === 'entradas' ? ['Ingresos'] : ['Gastos'],
        datasets: [{
            data: filtroModo === 'ambos' ? [totalEntradas, totalSalidas] : filtroModo === 'entradas' ? [totalEntradas] : [totalSalidas],
            backgroundColor: filtroModo === 'ambos' ? ['#198754', '#dc3545'] : filtroModo === 'entradas' ? ['#198754'] : ['#dc3545']
        }]
    };

    // Funciones del Modal
    const handleClose = () => {
        setShowModal(false); setEditId(null);
        setTipo('entrada'); setFecha(obtenerFechaLocal()); setMetodoPago('Efectivo');
        setDescripcion(''); setEntidad(''); setMonto('');
    };

    const handleOpen = (m = null) => {
        if (m) {
            setEditId(m.id); setTipo(m.tipo); setFecha(m.fecha);
            setMetodoPago(m.metodo_pago || 'Efectivo'); setDescripcion(m.descripcion);
            setEntidad(m.entidad || ''); setMonto(m.monto);
        } else {
            setFecha(obtenerFechaLocal()); // Resetea a hoy para nuevos
        }
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const datos = {
            tipo, fecha, metodo_pago: metodoPago, descripcion: descripcion.trim(),
            entidad: entidad.trim(), monto: parseFloat(monto) || 0, timestamp: new Date()
        };

        try {
            if (editId) await updateDoc(doc(db, "movimientos", editId), datos);
            else await addDoc(collection(db, "movimientos"), datos);
            handleClose();
            Swal.fire({ icon: 'success', title: 'Registrado', timer: 1000, showConfirmButton: false });
        } catch (err) {
            Swal.fire('Error', 'Fallo al guardar', 'error');
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({ title: '¿Eliminar movimiento?', text: 'Esto alterará tu balance.', icon: 'warning', showCancelButton: true });
        if (result.isConfirmed) await deleteDoc(doc(db, "movimientos", id));
    };

    // Exportaciones
    const exportarPDF = () => {
        if (filtrados.length === 0) return Swal.fire('Aviso', 'No hay datos', 'warning');
        const docPDF = new jsPDF();
        docPDF.text("Reporte Contable - MASUCRI", 14, 15);
        docPDF.autoTable({
            head: [["Fecha", "Método", "Tipo", "Concepto", "Monto"]],
            body: filtrados.map(m => [m.fecha, m.metodo_pago || 'Manual', m.tipo.toUpperCase(), m.descripcion, `₡${m.monto.toLocaleString('es-CR')}`]),
            startY: 28
        });
        docPDF.save("Finanzas_MASUCRI.pdf");
    };

    const exportarExcel = () => {
        if (filtrados.length === 0) return Swal.fire('Aviso', 'No hay datos', 'warning');
        const ws = XLSX.utils.json_to_sheet(filtrados.map(m => ({
            "Fecha": m.fecha, "Método": m.metodo_pago || 'Manual', "Tipo": m.tipo.toUpperCase(),
            "Concepto": m.descripcion, "Monto": m.monto
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Datos");
        XLSX.writeFile(wb, "Finanzas_MASUCRI.xlsx");
    };

    return (
        <Container className="mt-4 flex-grow-1">
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <h3 className="fw-bold m-0 text-success"><i className="fas fa-wallet"></i> Finanzas y Caja</h3>
                <Button variant="success" className="fw-bold shadow-sm" onClick={() => handleOpen()}>
                    <i className="fas fa-plus"></i> Registrar Movimiento
                </Button>
            </div>

            {/* Tarjetas de Resumen */}
            <Row className="mb-4">
                <Col md={4} className="mb-3">
                    <Card className="text-bg-success shadow-sm text-center h-100 border-0">
                        <Card.Body><h6>Entradas</h6><h3>₡{totalEntradas.toLocaleString('es-CR')}</h3></Card.Body>
                    </Card>
                </Col>
                <Col md={4} className="mb-3">
                    <Card className="text-bg-danger shadow-sm text-center h-100 border-0">
                        <Card.Body><h6>Salidas</h6><h3>₡{totalSalidas.toLocaleString('es-CR')}</h3></Card.Body>
                    </Card>
                </Col>
                <Col md={4} className="mb-3">
                    <Card className="text-bg-info text-white shadow-sm text-center h-100 border-0">
                        <Card.Body><h6>Balance Neto</h6><h3>₡{(totalEntradas - totalSalidas).toLocaleString('es-CR')}</h3></Card.Body>
                    </Card>
                </Col>
            </Row>

            <Row>
                {/* Panel Lateral: Filtros y Gráfico */}
                <Col lg={4} className="mb-4">
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Header className="bg-white fw-bold">Filtros y Resumen</Card.Header>
                        <Card.Body>
                            <Form.Select className="mb-3" value={filtroModo} onChange={e => setFiltroModo(e.target.value)}>
                                <option value="ambos">Ver Todo</option>
                                <option value="entradas">Solo Entradas</option>
                                <option value="salidas">Solo Salidas</option>
                            </Form.Select>
                            <Form.Control type="date" className="mb-3" value={filtroInicio} onChange={e => setFiltroInicio(e.target.value)} />
                            <Form.Control type="date" className="mb-4" value={filtroFin} onChange={e => setFiltroFin(e.target.value)} />

                            <div className="d-flex justify-content-center" style={{ maxHeight: '250px' }}>
                                {(totalEntradas > 0 || totalSalidas > 0) ? <Doughnut data={chartData} options={{ maintainAspectRatio: false }} /> : <p className="text-muted mt-4">Sin datos para graficar</p>}
                            </div>
                        </Card.Body>
                    </Card>
                </Col>

                {/* Tabla de Registros */}
                <Col lg={8} className="mb-4">
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Header className="bg-white fw-bold d-flex justify-content-between align-items-center">
                            <span>Libro Diario</span>
                            <div>
                                <Button variant="danger" size="sm" className="me-2 px-3" onClick={exportarPDF}><i className="fas fa-file-pdf"></i> PDF</Button>
                                <Button variant="success" size="sm" className="px-3" onClick={exportarExcel}><i className="fas fa-file-excel"></i> Excel</Button>
                            </div>
                        </Card.Header>
                        <Card.Body className="p-0 table-responsive" style={{ height: '500px', overflowY: 'auto' }}>
                            <Table hover className="align-middle m-0 text-nowrap">
                                <thead className="table-light sticky-top shadow-sm">
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
                                        filtrados.map(m => (
                                            <tr key={m.id}>
                                                <td>{m.fecha}</td>
                                                <td>
                                                    <strong>{m.descripcion}</strong> <Badge bg="secondary">{m.metodo_pago || 'Manual'}</Badge><br />
                                                    <small className="text-muted">{m.entidad || ''}</small>
                                                </td>
                                                <td className={`fw-bold ${m.tipo === 'entrada' ? 'text-success' : 'text-danger'}`}>
                                                    ₡{m.monto.toLocaleString('es-CR')}
                                                </td>
                                                <td className="text-center">
                                                    <Button variant="outline-secondary" size="sm" className="me-1" onClick={() => handleOpen(m)}><i className="fas fa-pen"></i></Button>
                                                    <Button variant="outline-danger" size="sm" onClick={() => handleDelete(m.id)}><i className="fas fa-trash"></i></Button>
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

            {/* MODAL DE REGISTRO / EDICIÓN */}
            <Modal show={showModal} onHide={handleClose} backdrop="static">
                <Modal.Header closeButton className={tipo === 'entrada' ? 'bg-success text-white' : 'bg-danger text-white'}>
                    <Modal.Title className="fw-bold"><i className="fas fa-cash-register"></i> {editId ? 'Editar' : 'Registrar'} Movimiento</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleSave}>
                        <Row className="mb-3">
                            <Col md={6}>
                                <Form.Label className="fw-bold">Tipo</Form.Label>
                                <Form.Select value={tipo} onChange={e => setTipo(e.target.value)}>
                                    <option value="entrada">Entrada (Ingreso)</option>
                                    <option value="salida">Salida (Gasto)</option>
                                </Form.Select>
                            </Col>
                            <Col md={6}>
                                <Form.Label className="fw-bold">Fecha</Form.Label>
                                <Form.Control type="date" required value={fecha} onChange={e => setFecha(e.target.value)} />
                            </Col>
                        </Row>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold">Método de Pago</Form.Label>
                            <Form.Select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
                                <option value="Efectivo">Efectivo</option>
                                <option value="Sinpe Móvil">Sinpe Móvil</option>
                                <option value="Transferencia">Transferencia</option>
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold">Concepto</Form.Label>
                            <Form.Control type="text" required placeholder="Ej: Compra de tintas" value={descripcion} onChange={e => setDescripcion(e.target.value)} />
                        </Form.Group>
                        <Row className="mb-4">
                            <Col md={6}>
                                <Form.Label className="fw-bold">Entidad (Opcional)</Form.Label>
                                <Form.Control type="text" placeholder="Ej: Ubora" value={entidad} onChange={e => setEntidad(e.target.value)} />
                            </Col>
                            <Col md={6}>
                                <Form.Label className="fw-bold">Monto (₡)</Form.Label>
                                <Form.Control type="number" step="0.01" min="1" required value={monto} onChange={e => setMonto(e.target.value)} />
                            </Col>
                        </Row>
                        <Button type="submit" variant={tipo === 'entrada' ? 'success' : 'danger'} className="w-100 fw-bold shadow-sm">
                            Guardar en Caja
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>
        </Container>
    );
}