import { useState, useEffect } from 'react';
import { Container, Card, Table, Button, Modal, Form } from 'react-bootstrap';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Swal from 'sweetalert2';

export default function Catalogo() {
    // Estados de React (variables que al cambiar, actualizan la pantalla solas)
    const [productos, setProductos] = useState([]);
    const [filtro, setFiltro] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    
    // Estados para los campos del formulario
    const [nombre, setNombre] = useState('');
    const [proveedor, setProveedor] = useState('');
    const [codigo, setCodigo] = useState('');
    const [costo, setCosto] = useState('');
    const [venta, setVenta] = useState('');

    // Conexión en tiempo real con Firebase
    useEffect(() => {
        const q = query(collection(db, "productos"), orderBy("nombre", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const prods = [];
            snapshot.forEach((doc) => prods.push({ id: doc.id, ...doc.data() }));
            setProductos(prods);
        });
        return () => unsubscribe(); // Apaga la conexión si cambiamos de página
    }, []);

    // Funciones del Modal
    const handleClose = () => {
        setShowModal(false);
        setEditId(null);
        setNombre(''); setProveedor(''); setCodigo(''); setCosto(''); setVenta('');
    };

    const handleOpen = (p = null) => {
        if (p) {
            setEditId(p.id);
            setNombre(p.nombre);
            setProveedor(p.proveedor || '');
            setCodigo(p.codigo_proveedor || '');
            setCosto(p.costo || '');
            setVenta(p.precio_venta || '');
        }
        setShowModal(true);
    };

    // Guardar o Editar en Firebase
    const handleSave = async (e) => {
        e.preventDefault();
        const datos = {
            nombre: nombre.trim(),
            proveedor: proveedor.trim(),
            codigo_proveedor: codigo.trim(),
            costo: parseFloat(costo) || 0,
            precio_venta: parseFloat(venta) || 0
        };

        try {
            if (editId) {
                await updateDoc(doc(db, "productos", editId), datos);
            } else {
                await addDoc(collection(db, "productos"), datos);
            }
            handleClose();
            Swal.fire({ icon: 'success', title: 'Guardado', timer: 1000, showConfirmButton: false });
        } catch (err) {
            Swal.fire('Error', 'Fallo al guardar', 'error');
        }
    };

    // Borrar de Firebase
    const handleDelete = async (id) => {
        const result = await Swal.fire({ title: '¿Eliminar producto?', text: 'Esto no afectará pedidos pasados.', icon: 'warning', showCancelButton: true });
        if (result.isConfirmed) {
            await deleteDoc(doc(db, "productos", id));
        }
    };

    // Lógica del buscador en tiempo real
    const filtrados = productos.filter(p => 
        (p.nombre && p.nombre.toLowerCase().includes(filtro.toLowerCase())) || 
        (p.proveedor && p.proveedor.toLowerCase().includes(filtro.toLowerCase()))
    );

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
                    />
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
                                    <tr><td colSpan="4" className="text-center py-4 text-muted">No hay productos registrados.</td></tr>
                                ) : (
                                    filtrados.map(p => (
                                        <tr key={p.id}>
                                            <td className="fw-bold text-truncate" style={{ maxWidth: '150px' }}>{p.nombre}</td>
                                            <td className="small text-muted">{p.proveedor || 'N/A'}<br/><span style={{ fontSize: '0.7rem' }}>{p.codigo_proveedor}</span></td>
                                            <td>
                                                <span className="text-danger d-block small">C: ₡{(p.costo || 0).toLocaleString('es-CR')}</span>
                                                <span className="text-success fw-bold d-block">V: ₡{(p.precio_venta || 0).toLocaleString('es-CR')}</span>
                                            </td>
                                            <td className="text-center">
                                                <Button variant="outline-secondary" size="sm" className="me-1" onClick={() => handleOpen(p)}><i className="fas fa-pen"></i></Button>
                                                <Button variant="outline-danger" size="sm" onClick={() => handleDelete(p.id)}><i className="fas fa-trash"></i></Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </Table>
                    </div>
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
                            <Form.Control required type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Taza Blanca 11oz" />
                        </Form.Group>
                        <div className="row mb-3">
                            <div className="col-6">
                                <Form.Label className="small text-muted">Lugar de Compra</Form.Label>
                                <Form.Control type="text" value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Ej: Ubora" />
                            </div>
                            <div className="col-6">
                                <Form.Label className="small text-muted">ID / Código</Form.Label>
                                <Form.Control type="text" value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Ej: UB-405" />
                            </div>
                        </div>
                        <div className="row mb-3 bg-light p-2 rounded border">
                            <div className="col-6">
                                <Form.Label className="fw-bold text-danger">Precio Costo (₡)</Form.Label>
                                <Form.Control type="number" step="0.01" className="border-danger" value={costo} onChange={e => setCosto(e.target.value)} />
                            </div>
                            <div className="col-6">
                                <Form.Label className="fw-bold text-success">Precio Venta (₡)</Form.Label>
                                <Form.Control type="number" step="0.01" className="border-success" value={venta} onChange={e => setVenta(e.target.value)} />
                            </div>
                        </div>
                        <Button type="submit" variant="primary" className="w-100 fw-bold shadow-sm">Guardar Producto</Button>
                    </Form>
                </Modal.Body>
            </Modal>
        </Container>
    );
}