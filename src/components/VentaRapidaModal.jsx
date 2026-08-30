import { useState, useMemo } from 'react';
import { Modal, Form, Button, Row, Col, InputGroup } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { registrarVentaRapida } from '../utils/ventaRapida';
import { formatoColones, aNumeroSeguro } from '../utils/formato';
import { seleccionarContacto, soportaSelectorContactos } from '../utils/contactos';

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

    const handleSeleccionarContacto = async () => {
        const resultado = await seleccionarContacto();
        if (!resultado) return;
        if (resultado.telefono) setForm((f) => ({ ...f, telefono: resultado.telefono }));
        if (resultado.nombre && !form.cliente) setForm((f) => ({ ...f, cliente: resultado.nombre }));
    };

    const { precioNum, saldo } = useMemo(() => {
        const p = aNumeroSeguro(form.precio);
        const pg = aNumeroSeguro(form.pagado);
        return { precioNum: p, saldo: p - pg };
    }, [form.precio, form.pagado]);

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
        <Modal show={show} onHide={cerrar} backdrop="static" className="d-print-none" centered>
            <Modal.Header closeButton className="bg-warning">
                <Modal.Title className="fw-bold text-dark"><i className="fas fa-bolt"></i> Venta Rápida</Modal.Title>
            </Modal.Header>
            <Modal.Body className="pt-4">
                <p className="text-muted small mb-3">
                    Para ventas de mostrador: el pedido queda registrado como <strong>Entregado</strong> de una vez.
                </p>
                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                        <Form.Label className="small fw-bold text-secondary mb-1">Cliente</Form.Label>
                        <InputGroup>
                            <InputGroup.Text className="bg-light"><i className="fas fa-user text-muted"></i></InputGroup.Text>
                            <Form.Control required type="text" placeholder="Ej: Cliente de mostrador" value={form.cliente} onChange={actualizar('cliente')} />
                        </InputGroup>
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label className="small fw-bold text-secondary mb-1">Teléfono (opcional)</Form.Label>
                        <InputGroup>
                            <InputGroup.Text className="bg-light"><i className="fab fa-whatsapp text-muted"></i></InputGroup.Text>
                            <Form.Control type="text" placeholder="Ej: 8888-8888" value={form.telefono} onChange={actualizar('telefono')} />
                            {soportaSelectorContactos() && (
                                <Button variant="outline-secondary" onClick={handleSeleccionarContacto} aria-label="Elegir de contactos">
                                    <i className="fas fa-address-book"></i>
                                </Button>
                            )}
                        </InputGroup>
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label className="small fw-bold text-secondary mb-1">Producto</Form.Label>
                        <InputGroup>
                            <InputGroup.Text className="bg-light"><i className="fas fa-box-open text-muted"></i></InputGroup.Text>
                            <Form.Control required type="text" placeholder="Ej: 2 llaveros personalizados" value={form.producto} onChange={actualizar('producto')} />
                        </InputGroup>
                    </Form.Group>

                    <Row className="mb-2">
                        <Col xs={6}>
                            <Form.Label className="small fw-bold text-secondary mb-1">Precio Total</Form.Label>
                            <InputGroup>
                                <InputGroup.Text className="bg-light fw-bold">₡</InputGroup.Text>
                                <Form.Control required type="number" step="0.01" min="0.01" placeholder="0" value={form.precio} onChange={actualizar('precio')} />
                            </InputGroup>
                        </Col>
                        <Col xs={6}>
                            <Form.Label className="small fw-bold text-success mb-1">Pagado ahora</Form.Label>
                            <InputGroup>
                                <InputGroup.Text className="bg-light fw-bold text-success">₡</InputGroup.Text>
                                <Form.Control type="number" step="0.01" min="0" placeholder="0" value={form.pagado} onChange={actualizar('pagado')} />
                            </InputGroup>
                        </Col>
                    </Row>

                    {precioNum > 0 && (
                        <div className={`small text-center rounded py-2 mb-3 fw-bold ${saldo > 0 ? 'bg-warning-subtle text-dark' : 'bg-success-subtle text-success'}`}>
                            {saldo > 0 ? `Quedará un saldo pendiente de ${formatoColones(saldo)}` : '✓ Pagado en su totalidad'}
                        </div>
                    )}

                    <Form.Group className="mb-4">
                        <Form.Label className="small fw-bold text-secondary mb-1">Método de Pago</Form.Label>
                        <Form.Select value={form.metodo} onChange={actualizar('metodo')}>
                            <option>Efectivo</option>
                            <option>Sinpe Móvil</option>
                            <option>Transferencia</option>
                        </Form.Select>
                    </Form.Group>

                    <Button type="submit" variant="warning" className="w-100 fw-bold text-dark shadow-sm py-2" disabled={guardando}>
                        {guardando ? 'Guardando...' : (<><i className="fas fa-bolt me-1"></i> Registrar Venta</>)}
                    </Button>
                </Form>
            </Modal.Body>
        </Modal>
    );
}
