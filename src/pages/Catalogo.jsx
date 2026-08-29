import { useState, useMemo } from 'react';
import { Container, Card, Table, Button, Modal, Form } from 'react-bootstrap';
import { collection, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Swal from 'sweetalert2';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { useDebounce } from '../hooks/useDebounce';
import EstadoCarga, { EstadoError } from '../components/EstadoCarga';
import { formatoColones, aNumeroSeguro } from '../utils/formato';

const FORM_VACIO = { nombre: '', proveedor: '', codigo: '', costo: '', venta: '' };

export default function Catalogo() {
    const { datos: productos, cargando, error } = useFirestoreCollection(
        () => query(collection(db, 'productos'), orderBy('nombre', 'asc')),
        []
    );

    const [filtro, setFiltro] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState(FORM_VACIO);
    const [guardando, setGuardando] = useState(false);

    const actualizar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

    const handleClose = () => {
        setShowModal(false);
        setEditId(null);
        setForm(FORM_VACIO);
    };

    const handleOpen = (p = null) => {
        if (p) {
            setEditId(p.id);
            setForm({
                nombre: p.nombre || '',
                proveedor: p.proveedor || '',
                codigo: p.codigo_proveedor || '',
                costo: p.costo ?? '',
                venta: p.precio_venta ?? ''
            });
        } else {
            setForm(FORM_VACIO);
        }
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();

        const costo = aNumeroSeguro(form.costo);
        const venta = aNumeroSeguro(form.venta);

        if (!form.nombre.trim()) {
            return Swal.fire('Falta el nombre', 'Ingresa el nombre del producto.', 'warning');
        }
        if (venta > 0 && venta < costo) {
            const confirmar = await Swal.fire({
                title: '¿Precio de venta menor al costo?',
                text: `Venta: ${formatoColones(venta)} — Costo: ${formatoColones(costo)}. ¿Seguro que quieres guardarlo así?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, guardar igual'
            });
            if (!confirmar.isConfirmed) return;
        }

        const datos = {
            nombre: form.nombre.trim(),
            proveedor: form.proveedor.trim(),
            codigo_proveedor: form.codigo.trim(),
            costo,
            precio_venta: venta
        };

        setGuardando(true);
        try {
            if (editId) {
                await updateDoc(doc(db, 'productos', editId), datos);
            } else {
                await addDoc(collection(db, 'productos'), datos);
            }
            handleClose();
            Swal.fire({ icon: 'success', title: 'Guardado', timer: 1000, showConfirmButton: false });
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'Fallo al guardar. Intenta de nuevo.', 'error');
        } finally {
            setGuardando(false);
        }
    };

    const handleDelete = async (id) => {
        const producto = productos.find((p) => p.id === id);
        const proveedor = producto?.proveedor?.trim();
        const esUltimoDelProveedor =
            proveedor && productos.filter((p) => p.id !== id && p.proveedor?.trim().toLowerCase() === proveedor.toLowerCase()).length === 0;

        const result = await Swal.fire({
            title: '¿Eliminar producto?',
            text: esUltimoDelProveedor
                ? `Este es el último producto registrado de "${proveedor}". Esto no afectará pedidos pasados.`
                : 'Esto no afectará pedidos pasados.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545'
        });
        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, 'productos', id));
            } catch (err) {
                console.error(err);
                Swal.fire('Error', 'No se pudo eliminar el producto.', 'error');
            }
        }
    };

    const filtroDebounced = useDebounce(filtro, 250);

    const filtrados = useMemo(() => {
        const texto = filtroDebounced.trim().toLowerCase();
        if (!texto) return productos;
        return productos.filter(
            (p) => p.nombre?.toLowerCase().includes(texto) || p.proveedor?.toLowerCase().includes(texto)
        );
    }, [productos, filtroDebounced]);

    return (
        <Container className="mt-4 flex-grow-1">
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <h3 className="fw-bold m-0 text-primary"><i className="fas fa-tags"></i> Catálogo de Productos</h3>
                <Button variant="primary" className="fw-bold shadow-sm" onClick={() => handleOpen()}>
                    <i className="fas fa-plus"></i> Nuevo Producto
                </Button>
            </div>

            <Card className="shadow-sm border-0">
                <Card.Body>
                    <Form.Control
                        type="text"
                        placeholder="Buscar por nombre o proveedor..."
                        className="mb-3 border-primary shadow-sm"
                        value={filtro}
                        onChange={(e) => setFiltro(e.target.value)}
                        aria-label="Buscar producto"
                    />

                    {error ? (
                        <EstadoError texto="No se pudo cargar el catálogo. Revisa tu conexión." />
                    ) : cargando ? (
                        <EstadoCarga texto="Cargando catálogo..." />
                    ) : (
                        <div className="table-responsive" style={{ height: 'calc(100vh - 240px)', overflowY: 'auto' }}>
                            <Table hover className="align-middle m-0 text-nowrap">
                                <thead className="table-light sticky-top">
                                    <tr>
                                        <th>Producto</th>
                                        <th>Proveedor (Lugar)</th>
                                        <th>Costo / Venta</th>
                                        <th className="text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtrados.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="text-center py-4 text-muted">
                                                {productos.length === 0 ? 'No hay productos registrados.' : 'Sin resultados para tu búsqueda.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filtrados.map((p) => (
                                            <tr key={p.id}>
                                                <td className="fw-bold text-truncate" style={{ maxWidth: '150px' }}>{p.nombre}</td>
                                                <td className="small text-muted">
                                                    {p.proveedor || 'N/A'}
                                                    <br />
                                                    <span style={{ fontSize: '0.7rem' }}>{p.codigo_proveedor}</span>
                                                </td>
                                                <td>
                                                    <span className="text-danger d-block small">C: {formatoColones(p.costo)}</span>
                                                    <span className="text-success fw-bold d-block">V: {formatoColones(p.precio_venta)}</span>
                                                </td>
                                                <td className="text-center">
                                                    <Button variant="outline-secondary" size="sm" className="me-1" onClick={() => handleOpen(p)} aria-label={`Editar ${p.nombre}`}>
                                                        <i className="fas fa-pen"></i>
                                                    </Button>
                                                    <Button variant="outline-danger" size="sm" onClick={() => handleDelete(p.id)} aria-label={`Eliminar ${p.nombre}`}>
                                                        <i className="fas fa-trash"></i>
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Card.Body>
            </Card>

            {/* MODAL DE NUEVO/EDITAR PRODUCTO */}
            <Modal show={showModal} onHide={handleClose} backdrop="static">
                <Modal.Header closeButton className="bg-primary text-white">
                    <Modal.Title className="fw-bold"><i className="fas fa-tag"></i> {editId ? 'Editar' : 'Nuevo'} Producto</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleSave}>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold">Nombre del Producto <span className="text-danger">*</span></Form.Label>
                            <Form.Control required type="text" value={form.nombre} onChange={actualizar('nombre')} placeholder="Ej: Taza Blanca 11oz" />
                        </Form.Group>
                        <div className="row mb-3">
                            <div className="col-6">
                                <Form.Label className="small text-muted">Lugar de Compra</Form.Label>
                                <Form.Control type="text" value={form.proveedor} onChange={actualizar('proveedor')} placeholder="Ej: Ubora" />
                            </div>
                            <div className="col-6">
                                <Form.Label className="small text-muted">ID / Código</Form.Label>
                                <Form.Control type="text" value={form.codigo} onChange={actualizar('codigo')} placeholder="Ej: UB-405" />
                            </div>
                        </div>
                        <div className="row mb-3 bg-light p-2 rounded border">
                            <div className="col-6">
                                <Form.Label className="fw-bold text-danger">Precio Costo (₡)</Form.Label>
                                <Form.Control type="number" step="0.01" min="0" className="border-danger" value={form.costo} onChange={actualizar('costo')} />
                            </div>
                            <div className="col-6">
                                <Form.Label className="fw-bold text-success">Precio Venta (₡)</Form.Label>
                                <Form.Control type="number" step="0.01" min="0" className="border-success" value={form.venta} onChange={actualizar('venta')} />
                            </div>
                        </div>
                        <Button type="submit" variant="primary" className="w-100 fw-bold shadow-sm" disabled={guardando}>
                            {guardando ? 'Guardando...' : 'Guardar Producto'}
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>
        </Container>
    );
}
