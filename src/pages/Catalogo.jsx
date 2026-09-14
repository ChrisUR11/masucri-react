import { useState, useMemo } from 'react';
import { collection, query, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Container, Row, Col, Card, Button, Form, Modal, InputGroup, Badge, Alert, Spinner } from 'react-bootstrap';
import { useDebounce } from '../hooks/useDebounce';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import EstadoCarga, { EstadoError } from '../components/EstadoCarga';
import { parsearCSV, compararProductos, descargarTemplate } from '../utils/importarProductos';
import Swal from 'sweetalert2';
import { formatoColones } from '../utils/formato';

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

    // IMPORTACIÓN
    const [showImportar, setShowImportar] = useState(false);
    const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
    const [productosImportados, setProductosImportados] = useState([]);
    const [comparacion, setComparacion] = useState(null);
    const [preciosVenta, setPreciosVenta] = useState({});
    const [aplicandoImportacion, setAplicandoImportacion] = useState(false);
    const [paso, setPaso] = useState(1); // 1: seleccionar, 2: revisar, 3: precios

    // Extrae categorías únicas
    const categorias = useMemo(() => {
        const cats = new Set(productos.map((p) => p.categoria).filter(Boolean));
        return Array.from(cats).sort();
    }, [productos]);

    const filtrados = useMemo(() => {
        let lista = productos;

        if (filtroBuscador) {
            const texto = filtroBuscador.toLowerCase();
            lista = lista.filter(
                (p) =>
                    (p.nombre && p.nombre.toLowerCase().includes(texto)) ||
                    (p.descripcion && p.descripcion.toLowerCase().includes(texto)) ||
                    (p.proveedor && p.proveedor.toLowerCase().includes(texto))
            );
        }

        if (filtroCategoria) {
            lista = lista.filter((p) => p.categoria === filtroCategoria);
        }

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

    // MANEJO DE IMPORTACIÓN
    const handleSeleccionarArchivo = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setArchivoSeleccionado(file);
    };

    const handleProcesarArchivo = async () => {
        if (!archivoSeleccionado) return;

        try {
            const contenido = await archivoSeleccionado.text();
            const importados = parsearCSV(contenido);
            setProductosImportados(importados);

            const comparar = compararProductos(importados, productos);
            setComparacion(comparar);

            // Inicializar precios de venta
            const precios = {};
            comparar.nuevos.forEach((p) => {
                precios[p.nombre] = '';
            });
            setPreciosVenta(precios);

            setPaso(2);
        } catch (err) {
            Swal.fire('Error al procesar el archivo', err.message, 'error');
        }
    };

    const handleAplicarImportacion = async () => {
        // Validar que todos los nuevos productos tengan precio de venta
        for (const nuevo of comparacion.nuevos) {
            if (!preciosVenta[nuevo.nombre] || preciosVenta[nuevo.nombre] === '') {
                return Swal.fire('Error', `Falta precio de venta para: "${nuevo.nombre}"`, 'error');
            }
        }

        setAplicandoImportacion(true);
        try {
            // Agregar nuevos productos
            for (const nuevo of comparacion.nuevos) {
                await addDoc(collection(db, 'productos'), {
                    ...nuevo,
                    precio_costo: parseFloat(nuevo.precio_costo),
                    precio_venta: parseFloat(preciosVenta[nuevo.nombre])
                });
            }

            Swal.fire({
                icon: 'success',
                title: 'Importación completada',
                html: `
                    <strong>${comparacion.nuevos.length}</strong> productos agregados<br />
                    <strong>${comparacion.existentes.length}</strong> productos ya existían
                `,
                timer: 2000,
                showConfirmButton: false
            });

            // Resetear
            setShowImportar(false);
            setPaso(1);
            setArchivoSeleccionado(null);
            setProductosImportados([]);
            setComparacion(null);
            setPreciosVenta({});
        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        } finally {
            setAplicandoImportacion(false);
        }
    };

    if (error) return <EstadoError texto="No se pudo cargar el catálogo." />;
    if (cargando) return <EstadoCarga texto="Cargando catálogo..." />;

    return (
        <Container className="pb-5">
            <div className="mb-4 d-flex justify-content-between align-items-center flex-wrap gap-2">
                <h3 className="fw-bold m-0">Catálogo ({filtrados.length})</h3>
                <div className="d-flex gap-2">
                    <Button variant="info" size="sm" onClick={() => setShowImportar(true)}>
                        <i className="fas fa-upload me-2"></i> Importar CSV
                    </Button>
                    <Button variant="success" size="sm" onClick={() => { setEditId(null); setForm(FORM_VACIO); setShowModal(true); }}>
                        <i className="fas fa-plus me-2"></i> Nuevo Producto
                    </Button>
                </div>
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

            {/* MODAL CREAR/EDITAR */}
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

            {/* MODAL IMPORTAR */}
            <Modal show={showImportar} onHide={() => { setShowImportar(false); setPaso(1); }} size={paso === 2 ? 'lg' : 'sm'} centered>
                <Modal.Header closeButton>
                    <Modal.Title>
                        {paso === 1 ? 'Importar Productos' : paso === 2 ? 'Revisar Importación' : 'Establecer Precios'}
                    </Modal.Title>
                </Modal.Header>

                <Modal.Body>
                    {paso === 1 && (
                        <div>
                            <p className="text-muted mb-3">
                                Sube un archivo CSV con los productos de un proveedor. El archivo debe tener las columnas:
                                <code className="d-block mt-2">nombre, precio_costo, descripcion, categoria, proveedor</code>
                            </p>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">Seleccionar archivo CSV</Form.Label>
                                <Form.Control type="file" accept=".csv" onChange={handleSeleccionarArchivo} />
                            </Form.Group>
                            <Button variant="outline-secondary" size="sm" className="w-100 mb-3" onClick={descargarTemplate}>
                                <i className="fas fa-download me-2"></i> Descargar Plantilla
                            </Button>
                            {archivoSeleccionado && (
                                <Alert variant="info" className="small mb-0">
                                    <i className="fas fa-check me-2"></i> {archivoSeleccionado.name} ({(archivoSeleccionado.size / 1024).toFixed(1)} KB)
                                </Alert>
                            )}
                        </div>
                    )}

                    {paso === 2 && comparacion && (
                        <div>
                            <Alert variant="info" className="small mb-3">
                                <strong>Nuevos: {comparacion.nuevos.length}</strong> productos para agregar<br />
                                <strong>Existentes: {comparacion.existentes.length}</strong> ya están en el catálogo
                            </Alert>

                            {comparacion.nuevos.length > 0 && (
                                <div className="mb-3">
                                    <h6 className="fw-bold text-success">✓ Nuevos productos:</h6>
                                    <div className="table-responsive">
                                        <table className="table table-sm table-striped">
                                            <thead>
                                                <tr>
                                                    <th>Nombre</th>
                                                    <th>Costo</th>
                                                    <th>Proveedor</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {comparacion.nuevos.map((p, i) => (
                                                    <tr key={i}>
                                                        <td className="small fw-bold">{p.nombre}</td>
                                                        <td className="small">{formatoColones(p.precio_costo)}</td>
                                                        <td className="small">{p.proveedor}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {comparacion.existentes.length > 0 && (
                                <div>
                                    <h6 className="fw-bold text-warning">⚠️ Productos que ya existen:</h6>
                                    <div className="small text-muted" style={{ maxHeight: '150px', overflow: 'auto' }}>
                                        {comparacion.existentes.map((item, i) => (
                                            <div key={i} className="mb-1">
                                                • {item.importado.nombre}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {paso === 3 && comparacion && (
                        <div>
                            <p className="small text-muted mb-3">
                                Ingresa el precio de venta para cada nuevo producto:
                            </p>
                            <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                                {comparacion.nuevos.map((p, i) => (
                                    <Form.Group key={i} className="mb-2">
                                        <Form.Label className="small fw-bold">{p.nombre}</Form.Label>
                                        <div className="input-group input-group-sm">
                                            <span className="input-group-text">₡</span>
                                            <Form.Control
                                                type="number"
                                                placeholder="Precio de venta"
                                                value={preciosVenta[p.nombre] || ''}
                                                onChange={(e) => setPreciosVenta({ ...preciosVenta, [p.nombre]: e.target.value })}
                                            />
                                        </div>
                                    </Form.Group>
                                ))}
                            </div>
                        </div>
                    )}
                </Modal.Body>

                <Modal.Footer>
                    {paso > 1 && (
                        <Button variant="outline-secondary" onClick={() => setPaso(paso - 1)} disabled={aplicandoImportacion}>
                            Atrás
                        </Button>
                    )}
                    {paso < 3 && (
                        <Button
                            variant="primary"
                            onClick={paso === 1 ? handleProcesarArchivo : () => setPaso(3)}
                            disabled={!archivoSeleccionado || aplicandoImportacion}
                        >
                            {paso === 1 ? 'Revisar' : 'Establecer Precios'}
                        </Button>
                    )}
                    {paso === 3 && (
                        <Button
                            variant="success"
                            onClick={handleAplicarImportacion}
                            disabled={aplicandoImportacion}
                        >
                            {aplicandoImportacion ? <><Spinner animation="border" size="sm" className="me-2" /> Importando...</> : 'Importar'}
                        </Button>
                    )}
                    <Button variant="secondary" onClick={() => { setShowImportar(false); setPaso(1); }} disabled={aplicandoImportacion}>
                        Cerrar
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}
