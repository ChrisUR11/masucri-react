import { useState, useMemo } from 'react';
import { Modal, Form, Button, Row, Col, InputGroup } from 'react-bootstrap';
import Swal from 'sweetalert2';
import { registrarVentaRapida } from '../utils/ventaRapida';
import ProductosPedidoForm from './ProductosPedidoForm';
import { formatoColones, aNumeroSeguro } from '../utils/formato';
import { calcularTotalesPedido } from '../utils/productosPedido';
import { seleccionarContacto, soportaSelectorContactos } from '../utils/contactos';

const estadoInicial = () => ({
    cliente: '', telefono: '',
    productos: [{ nombre: '', precio_unitario: '', cantidad: 1, total: 0 }],
    descripcion: '', aplicarDescuento: false, descuento_tipo: 'monto', descuento_valor: '',
    pagado: '', metodo: 'Efectivo'
});

/**
 * Modal de "Venta Rápida": registra en un solo paso un pedido ya entregado
 * y pagado (o parcialmente pagado). Este modal no existía en el código
 * original — el botón "Venta Rápida" del tablero no tenía a dónde apuntar.
 */
export default function VentaRapidaModal({ show, onHide, catalogo = [] }) {
    const [form, setForm] = useState(estadoInicial);
    const [guardando, setGuardando] = useState(false);

    const actualizar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

    const handleSeleccionarContacto = async () => {
        const resultado = await seleccionarContacto();
        if (!resultado) return;
        if (resultado.telefono) setForm((f) => ({ ...f, telefono: resultado.telefono }));
        if (resultado.nombre && !form.cliente) setForm((f) => ({ ...f, cliente: resultado.nombre }));
    };

    const totales = useMemo(() => {
        let descuento = {};
        if (form.aplicarDescuento) {
            descuento = form.descuento_tipo === 'porcentaje'
                ? { descuento_porcentaje: form.descuento_valor }
                : { descuento_monto: form.descuento_valor };
        }
        return calcularTotalesPedido(form.productos, descuento);
    }, [form.productos, form.aplicarDescuento, form.descuento_tipo, form.descuento_valor]);
    const saldo = totales.precio - aNumeroSeguro(form.pagado);
    const descuentoPorcentajeVisible = form.descuento_tipo === 'porcentaje'
        ? form.descuento_valor : (form.descuento_valor === '' ? '' : totales.descuento_porcentaje);
    const descuentoMontoVisible = form.descuento_tipo === 'monto'
        ? form.descuento_valor : (form.descuento_valor === '' ? '' : totales.descuento_monto);

    const cerrar = () => {
        setForm(estadoInicial());
        onHide();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
            await registrarVentaRapida({
                ...form,
                descuento_valor: form.aplicarDescuento ? form.descuento_valor : ''
            });
            cerrar();
            Swal.fire({ icon: 'success', title: '¡Venta Registrada!', timer: 1200, showConfirmButton: false });
        } catch (err) {
            Swal.fire('Revisa el formulario', err.message || 'No se pudo registrar la venta.', 'warning');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Modal show={show} onHide={cerrar} backdrop="static" className="d-print-none" centered size="lg">
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
                            <Form.Control required name="cliente" type="text" autoComplete="name" placeholder="Ej: Cliente de mostrador" value={form.cliente} onChange={actualizar('cliente')} />
                        </InputGroup>
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label className="small fw-bold text-secondary mb-1">Teléfono (opcional)</Form.Label>
                        <InputGroup>
                            <InputGroup.Text className="bg-light"><i className="fab fa-whatsapp text-muted"></i></InputGroup.Text>
                            <Form.Control name="telefono" type="tel" inputMode="tel" autoComplete="tel" placeholder="Ej: 8888-8888" value={form.telefono} onChange={actualizar('telefono')} />
                            {soportaSelectorContactos() && (
                                <Button variant="outline-secondary" onClick={handleSeleccionarContacto} aria-label="Elegir de contactos">
                                    <i className="fas fa-address-book"></i>
                                </Button>
                            )}
                        </InputGroup>
                    </Form.Group>

                    <ProductosPedidoForm
                        productos={form.productos}
                        onChange={(productos) => setForm((f) => ({ ...f, productos }))}
                        catalogo={catalogo}
                        idPrefix="venta"
                    />

                    <div className="mb-3 p-3 bg-light rounded border">
                        <div className="d-flex justify-content-between flex-wrap gap-2 mb-3">
                            <span>Subtotal de productos</span>
                            <strong>{formatoColones(totales.subtotal)}</strong>
                        </div>
                        <Form.Check
                            type="switch"
                            id="venta-aplicar-descuento"
                            className="mb-3"
                            label={<span className="fw-bold small">¿Se aplicará descuento?</span>}
                            checked={form.aplicarDescuento}
                            onChange={(e) => setForm((f) => ({
                                ...f,
                                aplicarDescuento: e.target.checked,
                                descuento_tipo: e.target.checked ? f.descuento_tipo : 'monto',
                                descuento_valor: e.target.checked ? f.descuento_valor : ''
                            }))}
                        />
                        {form.aplicarDescuento && (
                            <Row className="g-2 mb-3">
                                <Col xs={12} sm={6}>
                                    <Form.Label htmlFor="venta-descuento-porcentaje" className="small fw-bold">Descuento (%)</Form.Label>
                                    <InputGroup>
                                        <Form.Control id="venta-descuento-porcentaje" type="number" min="0" max="100" step="any" placeholder="0" value={descuentoPorcentajeVisible} onChange={(e) => setForm((f) => ({ ...f, descuento_tipo: 'porcentaje', descuento_valor: e.target.value }))} />
                                        <InputGroup.Text>%</InputGroup.Text>
                                    </InputGroup>
                                </Col>
                                <Col xs={12} sm={6}>
                                    <Form.Label htmlFor="venta-descuento-monto" className="small fw-bold">Descuento (₡)</Form.Label>
                                    <InputGroup>
                                        <InputGroup.Text>₡</InputGroup.Text>
                                        <Form.Control id="venta-descuento-monto" type="number" min="0" max={totales.subtotal} step="0.01" placeholder="0" value={descuentoMontoVisible} onChange={(e) => setForm((f) => ({ ...f, descuento_tipo: 'monto', descuento_valor: e.target.value }))} />
                                    </InputGroup>
                                </Col>
                            </Row>
                        )}
                        <div className="d-flex justify-content-between flex-wrap gap-2 border-top pt-2 fs-5">
                            <strong>Total de la venta</strong>
                            <strong className="text-primary">{formatoColones(totales.precio)}</strong>
                        </div>
                    </div>

                    <Form.Group className="mb-3">
                        <Form.Label htmlFor="venta-descripcion" className="small fw-bold text-secondary mb-1">Descripción / notas internas (opcional)</Form.Label>
                        <Form.Control id="venta-descripcion" as="textarea" rows={2} placeholder="Ej: personalización o instrucciones de entrega" value={form.descripcion} onChange={actualizar('descripcion')} />
                        <Form.Text>No aparece en el ticket del cliente.</Form.Text>
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label htmlFor="venta-pagado" className="small fw-bold text-success mb-1">Pagado ahora (opcional)</Form.Label>
                        <InputGroup>
                            <InputGroup.Text className="bg-light fw-bold text-success">₡</InputGroup.Text>
                            <Form.Control id="venta-pagado" type="number" step="0.01" min="0" max={totales.precio} placeholder="0" value={form.pagado} onChange={actualizar('pagado')} />
                        </InputGroup>
                    </Form.Group>

                    {totales.precio > 0 && (
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
