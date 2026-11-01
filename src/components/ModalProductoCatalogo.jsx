import { Button, Col, Form, Modal, Row } from 'react-bootstrap';

export default function ModalProductoCatalogo({ show, editando, form, guardando, onActualizar, onGuardar, onCerrar }) {
    return (
        <Modal show={show} onHide={onCerrar} centered>
            <Modal.Header closeButton>
                <Modal.Title>{editando ? 'Editar' : 'Nuevo'} Producto</Modal.Title>
            </Modal.Header>
            <Form onSubmit={onGuardar}>
                <Modal.Body>
                    <Form.Group controlId="catalogo-producto-nombre" className="mb-3">
                        <Form.Label className="fw-bold">Nombre *</Form.Label>
                        <Form.Control required value={form.nombre} onChange={onActualizar('nombre')} placeholder="Ej: Pijama talla 6" />
                    </Form.Group>
                    <Form.Group controlId="catalogo-producto-descripcion" className="mb-3">
                        <Form.Label className="fw-bold">Descripción</Form.Label>
                        <Form.Control as="textarea" rows={2} value={form.descripcion} onChange={onActualizar('descripcion')} placeholder="Detalles opcionales" />
                    </Form.Group>
                    <Row>
                        <Col md={6}>
                            <Form.Group controlId="catalogo-producto-codigo" className="mb-3">
                                <Form.Label className="fw-bold">Código (SKU)</Form.Label>
                                <Form.Control value={form.codigo} onChange={onActualizar('codigo')} placeholder="Ej: UBR-001" />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group controlId="catalogo-producto-categoria" className="mb-3">
                                <Form.Label className="fw-bold">Categoría</Form.Label>
                                <Form.Control value={form.categoria} onChange={onActualizar('categoria')} placeholder="Ej: Pijamas, Ropa" />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row>
                        <Col md={6}>
                            <Form.Group controlId="catalogo-producto-costo" className="mb-3">
                                <Form.Label className="fw-bold">Precio Costo</Form.Label>
                                <Form.Control type="number" value={form.precio_costo} onChange={onActualizar('precio_costo')} placeholder="0" />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group controlId="catalogo-producto-venta" className="mb-3">
                                <Form.Label className="fw-bold">Precio Venta</Form.Label>
                                <Form.Control type="number" value={form.precio_venta} onChange={onActualizar('precio_venta')} placeholder="0" />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Form.Group controlId="catalogo-producto-proveedor" className="mb-3">
                        <Form.Label className="fw-bold">Proveedor</Form.Label>
                        <Form.Control value={form.proveedor} onChange={onActualizar('proveedor')} placeholder="Ej: Ubora" />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={onCerrar}>Cancelar</Button>
                    <Button variant="primary" type="submit" disabled={guardando}>
                        {guardando ? 'Guardando...' : 'Guardar'}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
}
