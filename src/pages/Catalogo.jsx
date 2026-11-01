import { useState, useMemo } from 'react';
import { collection, query, updateDoc, deleteDoc, doc, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Container, Row, Col, Card, Button, Form, InputGroup } from 'react-bootstrap';
import { useDebounce } from '../hooks/useDebounce';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import EstadoCarga, { EstadoError } from '../components/EstadoCarga';
import TarjetaProductoCatalogo from '../components/TarjetaProductoCatalogo';
import ModalProductoCatalogo from '../components/ModalProductoCatalogo';
import ModalImportarCatalogo from '../components/ModalImportarCatalogo';
import ProductosDetectadosCatalogo from '../components/ProductosDetectadosCatalogo';
import { parsearCSV, compararProductos } from '../utils/importarProductos';
import { buscarProductoDuplicado, limpiarNombreProducto, normalizarNombreProducto } from '../utils/nombreProducto.ts';
import { calcularSugerenciasCatalogo } from '../utils/sugerenciasCatalogo.ts';
import { crearProductoCatalogo } from '../services/productosCatalogo';
import Swal from 'sweetalert2';

const FORM_VACIO = { nombre: '', descripcion: '', precio_costo: '', precio_venta: '', codigo: '', categoria: '', proveedor: '' };

export default function Catalogo() {
    const { datos: productos, cargando, error } = useFirestoreCollection(
        () => query(collection(db, 'productos'), orderBy('nombre', 'asc')),
        []
    );
    const [limitePedidos, setLimitePedidos] = useState(120);
    const { datos: pedidosRecientes, cargando: cargandoPedidos, error: errorPedidos } = useFirestoreCollection(
        () => query(collection(db, 'pedidos'), orderBy('fecha_solicitud', 'desc'), limit(limitePedidos)),
        [limitePedidos]
    );
    const sugerencias = useMemo(
        () => calcularSugerenciasCatalogo(pedidosRecientes, productos),
        [pedidosRecientes, productos]
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
    const [comparacion, setComparacion] = useState(null);
    const [preciosVenta, setPreciosVenta] = useState({});
    const [aplicandoImportacion, setAplicandoImportacion] = useState(false);
    const [paso, setPaso] = useState(1);

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
        const nombre = limpiarNombreProducto(form.nombre);
        if (!nombre) return Swal.fire('Error', 'El nombre es requerido.', 'error');
        const duplicado = buscarProductoDuplicado(productos, nombre, editId);
        if (duplicado) {
            return Swal.fire('Producto repetido', `"${duplicado.nombre}" ya existe en el catálogo. Edita su ficha en lugar de crear otra.`, 'warning');
        }

        const costo = form.precio_costo === '' ? null : Number(form.precio_costo);
        const venta = form.precio_venta === '' ? null : Number(form.precio_venta);
        if ((costo != null && (!Number.isFinite(costo) || costo < 0))
            || (venta != null && (!Number.isFinite(venta) || venta < 0))) {
            return Swal.fire('Error', 'Los precios deben ser números iguales o mayores a cero.', 'error');
        }

        const formGuardar = {
            ...form,
            nombre,
            precio_costo: costo,
            precio_venta: venta,
            cantidad: form.cantidad ? parseInt(form.cantidad) : 0
        };

        setGuardando(true);
        try {
            if (editId) {
                await updateDoc(doc(db, 'productos', editId), formGuardar);
                Swal.fire({ icon: 'success', title: 'Actualizado', timer: 1000, showConfirmButton: false });
            } else {
                await crearProductoCatalogo(db, formGuardar);
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
            codigo: producto.codigo || '',
            categoria: producto.categoria || '',
            proveedor: producto.proveedor || ''
        });
        setShowModal(true);
    };

    const handleCompletarSugerencia = (sugerencia) => {
        setEditId(null);
        setForm({
            ...FORM_VACIO,
            nombre: sugerencia.nombre,
            precio_venta: sugerencia.precioReferencia ?? ''
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

            const comparar = compararProductos(importados, productos);
            setComparacion(comparar);

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
        for (const nuevo of comparacion.nuevos) {
            if (!preciosVenta[nuevo.nombre] || preciosVenta[nuevo.nombre] === '') {
                return Swal.fire('Error', `Falta precio de venta para: "${nuevo.nombre}"`, 'error');
            }
        }

        setAplicandoImportacion(true);
        try {
            const nombresExistentes = new Set(productos.map((producto) => normalizarNombreProducto(producto.nombre)));
            let agregados = 0;
            let omitidos = comparacion.existentes.length + comparacion.duplicados.length;
            for (const nuevo of comparacion.nuevos) {
                const clave = normalizarNombreProducto(nuevo.nombre);
                if (nombresExistentes.has(clave)) {
                    omitidos += 1;
                    continue;
                }
                await crearProductoCatalogo(db, {
                    ...nuevo,
                    nombre: limpiarNombreProducto(nuevo.nombre),
                    precio_costo: parseFloat(nuevo.precio_costo),
                    precio_venta: parseFloat(preciosVenta[nuevo.nombre])
                });
                nombresExistentes.add(clave);
                agregados += 1;
            }

            Swal.fire({
                icon: 'success',
                title: 'Importación completada',
                html: `
                    <strong>${agregados}</strong> productos agregados<br />
                    <strong>${omitidos}</strong> productos repetidos omitidos
                `,
                timer: 2000,
                showConfirmButton: false
            });

            setShowImportar(false);
            setPaso(1);
            setArchivoSeleccionado(null);
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
        <Container className="catalog-page mt-4 pb-5">
            <div className="app-page-heading page-heading mb-4 d-flex justify-content-between align-items-center flex-wrap gap-2">
                <h3 className="fw-bold m-0">Catálogo ({filtrados.length})</h3>
                <div className="page-action-buttons d-flex gap-2">
                    <Button variant="info" size="sm" onClick={() => setShowImportar(true)}>
                        <i className="fas fa-upload me-2"></i> Importar CSV
                    </Button>
                    <Button variant="success" size="sm" onClick={() => { setEditId(null); setForm(FORM_VACIO); setShowModal(true); }}>
                        <i className="fas fa-plus me-2"></i> Nuevo Producto
                    </Button>
                </div>
            </div>

            <InputGroup className="catalog-search mb-3 shadow-sm">
                <InputGroup.Text className="catalog-search-icon"><i className="fas fa-search"></i></InputGroup.Text>
                    <Form.Control
                    type="search"
                    placeholder="Buscar por nombre, descripción, proveedor..."
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    aria-label="Buscar producto"
                />
            </InputGroup>

            <Card className="catalog-filter-card border-0 shadow-sm mb-3">
                <Card.Header className="bg-light p-0">
                    <Button
                        variant="link"
                        className="filter-toggle d-flex justify-content-between align-items-center w-100 text-start text-decoration-none text-body px-3 py-3"
                        onClick={() => setMostrarFiltros(!mostrarFiltros)}
                        aria-expanded={mostrarFiltros}
                        aria-controls="catalog-filter-options"
                    >
                        <strong><i className="fas fa-filter me-2"></i> Filtros Avanzados</strong>
                        <i className={`fas fa-chevron-${mostrarFiltros ? 'up' : 'down'}`} aria-hidden="true"></i>
                    </Button>
                </Card.Header>

                {mostrarFiltros && (
                    <Card.Body id="catalog-filter-options">
                        <Row className="g-3">
                            <Col md={3}>
                                <Form.Group controlId="catalogo-filtro-categoria">
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
                                <Form.Group controlId="catalogo-filtro-precio-minimo">
                                    <Form.Label className="small fw-bold">Precio mínimo</Form.Label>
                                    <Form.Control type="number" placeholder="0" value={filtroPrecioMin} onChange={(e) => setFiltroPrecioMin(e.target.value)} size="sm" />
                                </Form.Group>
                            </Col>
                            <Col md={3}>
                                <Form.Group controlId="catalogo-filtro-precio-maximo">
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

            <ProductosDetectadosCatalogo
                sugerencias={sugerencias}
                cargando={cargandoPedidos}
                error={errorPedidos}
                onCompletar={handleCompletarSugerencia}
                puedeAmpliar={pedidosRecientes.length === limitePedidos}
                onAmpliar={() => setLimitePedidos((actual) => actual + 120)}
            />

            {filtrados.length === 0 ? (
                <p className="text-muted text-center py-4">Sin productos que coincidan con los filtros.</p>
            ) : (
                <Row className="g-3">
                    {filtrados.map((producto) => (
                        <TarjetaProductoCatalogo key={producto.id} producto={producto} onEditar={handleEditar} onEliminar={handleEliminar} />
                    ))}
                </Row>
            )}

            <ModalProductoCatalogo
                show={showModal}
                editando={Boolean(editId)}
                form={form}
                guardando={guardando}
                onActualizar={actualizar}
                onGuardar={handleGuardar}
                onCerrar={() => setShowModal(false)}
            />

            <ModalImportarCatalogo
                show={showImportar}
                paso={paso}
                archivoSeleccionado={archivoSeleccionado}
                comparacion={comparacion}
                preciosVenta={preciosVenta}
                aplicandoImportacion={aplicandoImportacion}
                onCerrar={() => { setShowImportar(false); setPaso(1); }}
                onSeleccionarArchivo={handleSeleccionarArchivo}
                onProcesarArchivo={handleProcesarArchivo}
                onCambiarPaso={setPaso}
                onCambiarPrecio={(nombre, valor) => setPreciosVenta((actual) => ({ ...actual, [nombre]: valor }))}
                onAplicarImportacion={handleAplicarImportacion}
            />
        </Container>
    );
}
