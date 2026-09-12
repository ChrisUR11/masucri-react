import { useState, useMemo } from 'react';
import { collection, query, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Container, Row, Col, Card, Button, Form, Modal, InputGroup, Badge } from 'react-bootstrap';
import { useDebounce } from '../hooks/useDebounce';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import EstadoCarga, { EstadoError } from '../components/EstadoCarga';
import Swal from 'sweetalert2';
import { formatoColones } from '../utils/formato';
import { obtenerFechaLocal } from '../utils/fecha';

const FORM_VACIO = { nombre: '', descripcion: '', precio_costo: '', precio_venta: '', cantidad: '', categoria: '', proveedor: '' };

export default function Catalogo() {
    const { datos: productos, cargando, error } = useFirestoreCollection(
        () => query(collection(db, 'productos'), orderBy('nombre', 'asc')),
        []
    );

    const [filtro, setFiltro] = useState('');
    const [filtroCategoria, setFiltroCategoria] = useState('');
    const [filtroPrecioMin, setFiltroPrecioMin] = useState('');
    const [filtroPrecioMax, setFiltroPrecioMax] = useState('');
    const [mostrarFiltros, setMostrarFiltros] = useState(false);

    const filtroBuscador = useDebounce(filtro, 250);

    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState(FORM_VACIO);
    const [guardando, setGuardando] = useState(false);

    // Extrae categorías únicas
    const categorias = useMemo(() => {
        const cats = new Set(productos.map((p) => p.categoria).filter(Boolean));
        return Array.from(cats).sort();
    }, [productos]);

    const filtrados = useMemo(() => {
        let lista = productos;

        // Filtro por texto (nombre, descripción, proveedor)
        if (filtroBuscador) {
            const texto = filtroBuscador.toLowerCase();
            lista = lista.filter(
                (p) =>
                    (p.nombre && p.nombre.toLowerCase().includes(texto)) ||
                    (p.descripcion && p.descripcion.toLowerCase().includes(texto)) ||
                    (p.proveedor && p.proveedor.toLowerCase().includes(texto))
            );
        }

        // Filtro por categoría
        if (filtroCategoria) {
            lista = lista.filter((p) => p.categoria === filtroCategoria);
        }

        // Filtro por precio
        if (filtroPrecioMin) {
            const min = parseFloat(filtroPrecioMin);
            lista = lista.filter((p) => (p.precio_venta || 0) >= min);
        }
        if (filtroPrecioMax) {
            const max = parseFloat(filtroPrecioMax);
            lista = lista.filter((p) => (p.precio_venta || 0) <= max);
        }

        return lista;
    }, [productos, filtroBuscador, filtroCategoria, filtroPrecioMin, filtroPrecioMax]);

    const actualizar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

    const handleGuardar = async (e) => {
        e.preventDefault();
        if (!form.nombre.trim()) return Swal.fire('Error', 'El nombre es requerido.', 'error');

        setGuardando(true);
        try {
            if (editId) {
                await updateDoc(doc(db, 'productos', editId), form);
                Swal.fire({ icon: 'success', title: 'Actualizado', timer: 1000, showConfirmButton: false });
            } else {
                await addDoc(collection(db, 'productos'), form);
                Swal.fire({ icon: 'success', title: 'Creado', timer: 1000, showConfirmButton: false });
            }
            setShowModal(false);
            setForm(FORM_VACIO);
            setEditId(null);
        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        } finally {
            setGuardando(false);
        }
    };

    const handleEditar = (producto) => {
        setEditId(producto.id);
        setForm({
            nombre: producto.nombre || '',
            descripcion: producto.descripcion || '',
            precio_costo: producto.precio_costo ?? '',
            precio_venta: producto.precio_venta ?? '',
            cantidad: producto.cantidad ?? '',
            categoria: producto.categoria || '',
            proveedor: producto.proveedor || ''
        });
        setShowModal(true);
    };

    const handleEliminar = async (id, nombre) => {
        const result = await Swal.fire({
            title: '¿Eliminar?',
            text: `"${nombre}"`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545'
        });
        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, 'productos', id));
                Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1000, showConfirmButton: false });
            } catch (err) {
                Swal.fire('Error', err.message, 'error');
            }
        }
    };

    const handleLimpiarFiltros = () => {
        setFiltro('');
        setFiltroCategoria('');
        setFiltroPrecioMin('');
        setFiltroPrecioMax('');
        setMostrarFiltros(false);
    };

    if (error) return <EstadoError texto="No se pudo cargar el catálogo." />;
    if (cargando) return <EstadoCarga texto="Cargando catálogo..." />;

    return (
        <Container className="pb-5">
            <div className="mb-4 d-flex justify-content-between align-items-center">
                <h3 className="fw-bold m-0">Catálogo ({filtrados.length})</h3>
                <Button variant="success" size="sm" onClick={() => { setEditId(null); setForm(FORM_VACIO); setShowModal(true); }}>
                    <i className="fas fa-plus me-2"></i> Nuevo Producto
                </Button>
            </div>

            {/* BUSCADOR */}
            <InputGroup className="mb-3 border-primary shadow-sm">
                <InputGroup.Text className="bg-primary text-white"><i className="fas fa-search"></i></InputGroup.Text>
                <Form.Control
                    placeholder="Buscar por nombre, descripción, proveedor..."
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    aria-label="Buscar producto"
                />
            </InputGroup>

            {/* FILTROS AVANZADOS */}
            <Card className="border-0 shadow-sm mb-3">
                <Card.Header className="bg-light d-flex justify-content-between align-items-center cursor-pointer" onClick={() => setMostrarFiltros(!mostrarFiltros)} style={{ cursor: 'pointer' }}>
                    <strong><i className={`fas fa-filter me-2`}></i> Filtros Avanzados</strong>
                    <i className={`fas fa-chevron-${mostrarFiltros ? 'up' : 'down'}`}></i>
                </Card.Header>

                {mostrarFiltros && (
                    <Card.Body>
                        <Row className="g-3">
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label className="small fw-bold">Categoría</Form.Label>
                                    <Form.Select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} size="sm">
                                        <option value="">Todas</option>
                                        {categorias.map((cat) => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label className="small fw-bold">Precio mínimo</Form.Label>
                                    <Form.Control type="number" placeholder="0" value={filtroPrecioMin} onChange={(e) => setFiltroPrecioMin(e.target.value)} size="sm" />
                                </Form.Group>
                            </Col>
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label className="small fw-bold">Precio máximo</Form.Label>
                                    <Form.Control type="number" placeholder="999999" value={filtroPrecioMax} onChange={(e) => setFiltroPrecioMax(e.target.value)} size="sm" />
                                </Form.Group>
                            </Col>
                            <Col md={3} className="d-flex align-items-end">
                                <Button variant="outline-secondary" size="sm" className="w-100" onClick={handleLimpiarFiltros}>
                                    Limpiar
                                </Button>
                            </Col>
                        </Row>
                    </Card.Body>
                )}
            </Card>

            {/* PRODUCTOS */}
            {filtrados.length === 0 ? (
                <p className="text-muted text-center py-4">Sin productos que coincidan con los filtros.</p>
            ) : (
                <Row className="g-3">
                    {filtrados.map((p) => {
                        const margen = p.precio_venta && p.precio_costo ? (((p.precio_venta - p.precio_costo) / p.precio_venta) * 100).toFixed(0) : 0;
                        return (
                            <Col key={p.id} xs={12} sm={6} md={4} lg={3}>
                                <Card className="shadow-sm border-0 h-100 d-flex flex-column">
                                    <Card.Body className="flex-grow-1">
                                        <Card.Title className="fw-bold small mb-2">{p.nombre}</Card.Title>
                                        {p.categoria && <Badge className="mb-2" bg="info">{p.categoria}</Badge>}
                                        {p.descripcion && <p className="small text-muted mb-2">{p.descripcion}</p>}
                                        <div className="small">
                                            {p.precio_costo && <p className="mb-1"><strong>C:</strong> {formatoColones(p.precio_costo)}</p>}
                                            {p.precio_venta && <p className="mb-1"><strong>V:</strong> <span className="text-success fw-bold">{formatoColones(p.precio_venta)}</span></p>}
                                            {p.precio_venta && p.precio_costo && <p className="mb-2 text-info"><strong>Margen:</strong> {margen}%</p>}
                                            {p.cantidad && <p className="text-muted"><strong>Stock:</strong> {p.cantidad}</p>}
                                        </div>
                                    </Card.Body>
                                    <Card.Footer className="bg-white border-top-0 pt-0">
                                        <div className="d-flex gap-2">
                                            <Button variant="outline-primary" size="sm" className="flex-grow-1" onClick={() => handleEditar(p)}>
                                                <i className="fas fa-pen"></i>
                                            </Button>
                                            <Button variant="outline-danger" size="sm" className="flex-grow-1" onClick={() => handleEliminar(p.id, p.nombre)}>
                                                <i className="fas fa-trash"></i>
                                            </Button>
                                        </div>
                                    </Card.Footer>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>
            )}

            {/* MODAL */}
            <Modal show={showModal} onHide={() => setShowModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>{editId ? 'Editar' : 'Nuevo'} Producto</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleGuardar}>
                    <Modal.Body>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold">Nombre *</Form.Label>
                            <Form.Control value={form.nombre} onChange={actualizar('nombre')} placeholder="Ej: Pijama talla 6" />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold">Descripción</Form.Label>
                            <Form.Control as="textarea" rows={2} value={form.descripcion} onChange={actualizar('descripcion')} placeholder="Detalles opcionales" />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold">Categoría</Form.Label>
                            <Form.Control value={form.categoria} onChange={actualizar('categoria')} placeholder="Ej: Pijamas, Ropa" />
                        </Form.Group>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="fw-bold">Precio Costo</Form.Label>
                                    <Form.Control type="number" value={form.precio_costo} onChange={actualizar('precio_costo')} placeholder="0" />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="fw-bold">Precio Venta</Form.Label>
                                    <Form.Control type="number" value={form.precio_venta} onChange={actualizar('precio_venta')} placeholder="0" />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="fw-bold">Cantidad en Stock</Form.Label>
                                    <Form.Control type="number" value={form.cantidad} onChange={actualizar('cantidad')} placeholder="0" />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="fw-bold">Proveedor</Form.Label>
                                    <Form.Control value={form.proveedor} onChange={actualizar('proveedor')} placeholder="Ej: Ubora" />
                                </Form.Group>
                            </Col>
                        </Row>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
                        <Button variant="primary" type="submit" disabled={guardando}>
                            {guardando ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </Container>
    );
}
