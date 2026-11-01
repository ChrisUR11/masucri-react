import { useState } from 'react';
import { Alert, Button, Card, Col, Row } from 'react-bootstrap';
import { formatoColones } from '../utils/formato';

const LIMITE_VISIBLE = 6;

export default function ProductosDetectadosCatalogo({ sugerencias, cargando, error, onCompletar, puedeAmpliar, onAmpliar }) {
    const [mostrarTodos, setMostrarTodos] = useState(false);
    const visibles = mostrarTodos ? sugerencias : sugerencias.slice(0, LIMITE_VISIBLE);

    return (
        <section className="mb-4" aria-labelledby="catalogo-detectados-titulo">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                <div>
                    <h4 id="catalogo-detectados-titulo" className="h5 fw-bold mb-1">Productos detectados en pedidos</h4>
                    <p className="small text-muted mb-0">Aparecen una sola vez por nombre. Completa su ficha para agregarlos al catálogo.</p>
                </div>
                {!cargando && !error && sugerencias.length > 0 && (
                    <span className="badge text-bg-primary">{sugerencias.length} por completar</span>
                )}
            </div>

            {cargando && <p className="small text-muted mb-0" role="status">Buscando productos recientes...</p>}
            {error && <Alert variant="warning" className="small mb-0">No se pudieron revisar los pedidos. El catálogo sigue disponible.</Alert>}
            {!cargando && !error && sugerencias.length === 0 && (
                <p className="small text-muted mb-0">Los productos de los pedidos recientes ya tienen ficha en el catálogo.</p>
            )}
            {!cargando && !error && sugerencias.length > 0 && (
                <>
                    <Row className="g-2">
                        {visibles.map((producto) => (
                            <Col xs={12} md={6} lg={4} key={producto.clave}>
                                <Card className="h-100 border-primary-subtle shadow-sm">
                                    <Card.Body className="d-flex flex-column gap-2 p-3">
                                        <strong className="text-break">{producto.nombre}</strong>
                                        <div className="small text-muted">
                                            {producto.pedidos} {producto.pedidos === 1 ? 'pedido' : 'pedidos'}
                                            {producto.precioReferencia != null && (
                                                <> · Precio usado: {formatoColones(producto.precioReferencia)}</>
                                            )}
                                        </div>
                                        <Button variant="outline-primary" size="sm" className="mt-auto align-self-start" onClick={() => onCompletar(producto)}>
                                            Completar ficha
                                        </Button>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                    {sugerencias.length > LIMITE_VISIBLE && (
                        <Button variant="link" size="sm" className="mt-2 px-0" onClick={() => setMostrarTodos((actual) => !actual)}>
                            {mostrarTodos ? 'Mostrar menos' : `Ver los ${sugerencias.length} productos detectados`}
                        </Button>
                    )}
                </>
            )}
            {!cargando && !error && puedeAmpliar && (
                <Button variant="outline-secondary" size="sm" className="mt-3" onClick={onAmpliar}>
                    Revisar pedidos anteriores
                </Button>
            )}
        </section>
    );
}
