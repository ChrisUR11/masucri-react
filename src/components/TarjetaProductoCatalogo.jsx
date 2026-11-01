import { Badge, Button, Card, Col } from 'react-bootstrap';
import { formatoColones } from '../utils/formato';

export default function TarjetaProductoCatalogo({ producto, onEditar, onEliminar }) {
    const costoConocido = producto.precio_costo != null && producto.precio_costo !== '';
    const ventaConocida = producto.precio_venta != null && producto.precio_venta !== '';
    const margen = ventaConocida && costoConocido && Number(producto.precio_venta) > 0
        ? (((producto.precio_venta - producto.precio_costo) / producto.precio_venta) * 100).toFixed(0)
        : null;

    return (
        <Col xs={12} sm={6} md={4} lg={3}>
            <Card className="catalog-product-card shadow-sm border-0 h-100 d-flex flex-column">
                <Card.Body className="flex-grow-1">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                        <Card.Title className="catalog-product-title fw-bold small m-0">{producto.nombre}</Card.Title>
                        {producto.codigo && <Badge bg="secondary" className="catalog-product-code ms-2" style={{ fontSize: '10px' }}>{producto.codigo}</Badge>}
                    </div>
                    {producto.categoria && <Badge className="mb-2" bg="info">{producto.categoria}</Badge>}
                    {producto.descripcion && <p className="small text-muted mb-2">{producto.descripcion}</p>}
                    <div className="catalog-product-prices small">
                        <p className="mb-1"><strong>C:</strong> {costoConocido ? formatoColones(producto.precio_costo) : <span className="text-muted">Por definir</span>}</p>
                        <p className="mb-1"><strong>V:</strong> {ventaConocida ? <span className="text-success fw-bold">{formatoColones(producto.precio_venta)}</span> : <span className="text-muted">Por definir</span>}</p>
                        {margen != null && <p className="mb-2 text-info"><strong>Margen:</strong> {margen}%</p>}
                    </div>
                </Card.Body>
                <Card.Footer className="bg-white border-top-0 pt-0">
                    <div className="d-flex gap-2">
                        <Button variant="outline-primary" size="sm" className="flex-grow-1" onClick={() => onEditar(producto)} aria-label={`Editar ${producto.nombre}`}>
                            <i className="fas fa-pen"></i>
                        </Button>
                        <Button variant="outline-danger" size="sm" className="flex-grow-1" onClick={() => onEliminar(producto.id, producto.nombre)} aria-label={`Eliminar ${producto.nombre}`}>
                            <i className="fas fa-trash"></i>
                        </Button>
                    </div>
                </Card.Footer>
            </Card>
        </Col>
    );
}
