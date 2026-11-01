import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap';
import { formatoColones } from '../utils/formato';
import { descargarTemplate } from '../utils/importarProductos';

export default function ModalImportarCatalogo({
    show, paso, archivoSeleccionado, comparacion, preciosVenta, aplicandoImportacion,
    onCerrar, onSeleccionarArchivo, onProcesarArchivo, onCambiarPaso, onCambiarPrecio, onAplicarImportacion
}) {
    return (
        <Modal show={show} onHide={onCerrar} size={paso === 2 ? 'lg' : 'sm'} centered>
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
                            <code className="d-block mt-2">nombre, precio_costo, descripcion, categoria, proveedor, codigo</code>
                        </p>
                        <Form.Group controlId="catalogo-importar-archivo" className="mb-3">
                            <Form.Label className="fw-bold">Seleccionar archivo CSV</Form.Label>
                            <Form.Control type="file" accept=".csv" onChange={onSeleccionarArchivo} />
                        </Form.Group>
                        <Button variant="outline-secondary" size="sm" className="w-100 mb-3" onClick={descargarTemplate}>
                            <i className="fas fa-download me-2"></i> Descargar Plantilla
                        </Button>
                        {archivoSeleccionado && (
                            <Alert variant="info" className="small mb-0 text-break">
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
                                <div className="table-responsive mobile-card-table-wrap">
                                    <table className="table table-sm table-striped mobile-card-table">
                                        <thead>
                                            <tr><th>Nombre</th><th>Costo</th><th>Proveedor</th></tr>
                                        </thead>
                                        <tbody>
                                            {comparacion.nuevos.map((producto, indice) => (
                                                <tr key={indice}>
                                                    <td data-label="Nombre" className="small fw-bold">{producto.nombre}</td>
                                                    <td data-label="Costo" className="small">{formatoColones(producto.precio_costo)}</td>
                                                    <td data-label="Proveedor" className="small">{producto.proveedor}</td>
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
                                    {comparacion.existentes.map((item, indice) => (
                                        <div key={indice} className="mb-1">• {item.importado.nombre}</div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {paso === 3 && comparacion && (
                    <div>
                        <p className="small text-muted mb-3">Ingresa el precio de venta para cada nuevo producto:</p>
                        <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                            {comparacion.nuevos.map((producto, indice) => (
                                <Form.Group key={indice} controlId={`catalogo-precio-importacion-${indice}`} className="mb-2">
                                    <Form.Label className="small fw-bold">{producto.nombre}</Form.Label>
                                    <div className="input-group input-group-sm">
                                        <span className="input-group-text">₡</span>
                                        <Form.Control
                                            type="number"
                                            placeholder="Precio de venta"
                                            value={preciosVenta[producto.nombre] || ''}
                                            onChange={(e) => onCambiarPrecio(producto.nombre, e.target.value)}
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
                    <Button variant="outline-secondary" onClick={() => onCambiarPaso(paso - 1)} disabled={aplicandoImportacion}>
                        Atrás
                    </Button>
                )}
                {paso < 3 && (
                    <Button
                        variant="primary"
                        onClick={paso === 1 ? onProcesarArchivo : () => onCambiarPaso(3)}
                        disabled={!archivoSeleccionado || aplicandoImportacion}
                    >
                        {paso === 1 ? 'Revisar' : 'Establecer Precios'}
                    </Button>
                )}
                {paso === 3 && (
                    <Button variant="success" onClick={onAplicarImportacion} disabled={aplicandoImportacion}>
                        {aplicandoImportacion ? <><Spinner animation="border" size="sm" className="me-2" /> Importando...</> : 'Importar'}
                    </Button>
                )}
                <Button variant="secondary" onClick={onCerrar} disabled={aplicandoImportacion}>Cerrar</Button>
            </Modal.Footer>
        </Modal>
    );
}
