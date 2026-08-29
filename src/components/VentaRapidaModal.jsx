import { useState } from 'react';
import { Modal, Form, Button, Row, Col } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { registrarVentaRapida } from '../utils/ventaRapida';

const ESTADO_INICIAL = { cliente: '', telefono: '', producto: '', precio: '', pagado: '', metodo: 'Efectivo' };

/**
 * Modal de "Venta Rápida": registra en un solo paso un pedido ya entregado
 * y pagado (o parcialmente pagado). Este modal no existía en el código
 * original — el botón "Venta Rápida" del tablero no tenía a dónde apuntar.
 */
export default function VentaRapidaModal({ show, onHide }) {
    const [form, setForm] = useState(ESTADO_INICIAL);
    const [guardando, setGuardando] = useState(false);

    const actualizar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

    const cerrar = () => {
        setForm(ESTADO_INICIAL);
        onHide();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
            await registrarVentaRapida(form);
            cerrar();
            Swal.fire({ icon: 'success', title: '¡Venta Registrada!', timer: 1200, showConfirmButton: false });
        } catch (err) {
            Swal.fire('Revisa el formulario', err.message || 'No se pudo registrar la venta.', 'warning');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Modal show={show} onHide={cerrar} backdrop="static" className="d-print-none">
            <Modal.Header closeButton className="bg-warning">
                <Modal.Title className="fw-bold text-dark"><i className="fas fa-bolt"></i> Venta Rápida</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                        <Form.Label>Cliente</Form.Label>
                        <Form.Control required type="text" value={form.cliente} onChange={actualizar('cliente')} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Teléfono (opcional)</Form.Label>
                        <Form.Control type="text" value={form.telefono} onChange={actualizar('telefono')} />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Producto</Form.Label>
                        <Form.Control required type="text" value={form.producto} onChange={actualizar('producto')} />
                    </Form.Group>
                    <Row className="mb-3">
                        <Col xs={6}>
                            <Form.Label className="fw-bold">Precio Total (₡)</Form.Label>
                            <Form.Control required type="number" step="0.01" min="0.01" value={form.precio} onChange={actualizar('precio')} />
                        </Col>
                        <Col xs={6}>
                            <Form.Label className="fw-bold text-success">Pagado (₡)</Form.Label>
                            <Form.Control type="number" step="0.01" min="0" value={form.pagado} onChange={actualizar('pagado')} />
                        </Col>
                    </Row>
                    <Form.Group className="mb-4">
                        <Form.Label className="small">Método de Pago</Form.Label>
                        <Form.Select value={form.metodo} onChange={actualizar('metodo')}>
                            <option>Efectivo</option>
                            <option>Sinpe Móvil</option>
                            <option>Transferencia</option>
                        </Form.Select>
                    </Form.Group>
                    <Button type="submit" variant="warning" className="w-100 fw-bold text-dark shadow-sm" disabled={guardando}>
                        {guardando ? 'Guardando...' : 'Registrar Venta'}
                    </Button>
                </Form>
            </Modal.Body>
        </Modal>
    );
}
