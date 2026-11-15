import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, Col, Container, Form, InputGroup, Row, Spinner, Table } from 'react-bootstrap';
import { collection } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { db } from '../config/firebase';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { interpretarSolicitudAsistente } from '../services/asistente';
import { guardarPedidoAsistente } from '../services/pedidosAsistente';
import { registrarVentaRapida } from '../utils/ventaRapida';
import { coincideConsulta, normalizarBorradorAsistente, sinAcentos } from '../utils/asistente';
import { calcularMetricas } from '../utils/metricasNegocio';
import { calcularMetricasContables } from '../utils/metricasContables';
import { clientesMorosos, obtenerHistorialCliente } from '../utils/historialClientes';
import { calcularPedidosActivos } from '../utils/metricasPedidosActivos.ts';
import { PRESETS, calcularRangoPreset } from '../utils/rangoFechas.ts';
import { esFechaISOValida, formatoFechaLegible, obtenerFechaLocal } from '../utils/fecha';
import { formatoColones } from '../utils/formato';
import { obtenerProductosPedido, calcularTotalesPedido } from '../utils/productosPedido';
import { tieneMaximoDosDecimales } from '../utils/dinero.ts';
import EstadoCarga, { EstadoError } from '../components/EstadoCarga';
import './Asistente.css';

const ESTADOS_ACTIVOS = new Set(['Pendiente', 'En producción', 'Por Retirar']);
const ESTADO_VARIANTES = {
    Pendiente: 'secondary',
    'En producción': 'info',
    'Por Retirar': 'warning',
    Entregado: 'success',
    Cancelado: 'danger'
};

const nombreMes = (rangoId, rango) => {
    if (rangoId === 'historico') return 'Todo el histórico';
    if (rangoId === 'personalizado') return `Período personalizado: ${rango.inicio} a ${rango.fin}`;
    const preset = PRESETS.find((opcion) => opcion.id === rangoId);
    if (rangoId === 'mes_actual' || rangoId === 'mes_anterior') {
        return `${preset?.label}: ${rango.inicio} a ${rango.fin}`;
    }
    return `${preset?.label || 'Período'}: ${rango.inicio} a ${rango.fin}`;
};

function buscarPedidos(pedidos, query, status) {
    const clave = sinAcentos(query);
    const fechaRelativa = fechaRelativaConsulta(clave);
    const buscaAtrasados = /\b(atrasad[oa]s?|vencid[oa]s?)\b/.test(clave);
    const textoSinFecha = String(query).replace(/\b(hoy|ma[nñ]ana|ayer)\b/gi, ' ').trim();
    const hoy = obtenerFechaLocal();
    return [...pedidos]
        .filter((pedido) => !status || sinAcentos(pedido.estado) === sinAcentos(status))
        .filter((pedido) => {
            if (fechaRelativa && pedido.fecha_entrega !== fechaRelativa) return false;
            if (buscaAtrasados && (!ESTADOS_ACTIVOS.has(pedido.estado) || !pedido.fecha_entrega || pedido.fecha_entrega >= hoy)) return false;
            if (buscaAtrasados) return true;
            return !textoSinFecha || coincideConsulta(textoSinFecha, [
                pedido.cliente,
                pedido.producto,
                pedido.estado,
                pedido.fecha_entrega,
                pedido.id,
                ...obtenerProductosPedido(pedido).map((producto) => producto.nombre)
            ]);
        })
        .sort((a, b) => String(b.fecha_solicitud || '').localeCompare(String(a.fecha_solicitud || '')));
}

function fechaRelativaConsulta(clave) {
    if (!/\b(hoy|manana|ayer)\b/.test(clave)) return '';
    const fecha = new Date(`${obtenerFechaLocal()}T12:00:00`);
    if (clave.includes('manana')) fecha.setDate(fecha.getDate() + 1);
    if (clave.includes('ayer')) fecha.setDate(fecha.getDate() - 1);
    return obtenerFechaLocal(fecha);
}

function resumirClientes(pedidos, query) {
    const clave = sinAcentos(query);
    const clientes = new Map();
    pedidos.forEach((pedido) => {
        const nombre = String(pedido.cliente || '').trim();
        if (!nombre || (clave && !coincideConsulta(clave, nombre))) return;
        const id = sinAcentos(nombre);
        if (!clientes.has(id)) clientes.set(id, { nombre, pedidos: [] });
        clientes.get(id).pedidos.push(pedido);
    });
    return [...clientes.values()].map(({ nombre, pedidos: pedidosCliente }) => {
        const historial = obtenerHistorialCliente(nombre, pedidosCliente);
        return { nombre, pedidos: pedidosCliente, ...historial };
    }).sort((a, b) => b.totalGastado - a.totalGastado);
}

function prepararRespuesta(interpretacion, pedidos, catalogo, movimientos) {
    const { intent, query = '', status = null, period = 'mes_actual', summary_scope: summaryScope = 'business' } = interpretacion;
    if (intent === 'help') {
        return {
            text: interpretacion.reply || 'Puedo buscar pedidos, productos y clientes; calcular resúmenes de caja y pedidos; y preparar un pedido o venta rápida para que la revises antes de guardar.'
        };
    }
    if (intent === 'unknown') {
        return { text: interpretacion.reply || 'No pude reconocer esa solicitud. Prueba con una búsqueda, un resumen o un borrador de pedido.' };
    }
    if (intent === 'search_orders') {
        const resultados = buscarPedidos(pedidos, query, status);
        return {
            title: 'Pedidos encontrados',
            text: resultados.length
                ? `Encontré ${resultados.length} pedido${resultados.length === 1 ? '' : 's'}${query ? ` relacionado${resultados.length === 1 ? '' : 's'} con “${query}”` : ''}.`
                : 'No encontré pedidos que coincidan con esos datos.',
            data: { kind: 'orders', items: resultados.slice(0, 30), total: resultados.length }
        };
    }
    if (intent === 'search_catalog') {
        const clave = sinAcentos(query);
        const resultados = catalogo.filter((producto) => !clave || coincideConsulta(clave, [
            producto.nombre, producto.categoria, producto.proveedor, producto.descripcion
        ]));
        return {
            title: 'Catálogo',
            text: resultados.length ? `Encontré ${resultados.length} producto${resultados.length === 1 ? '' : 's'}.` : 'No encontré productos con ese nombre.',
            data: { kind: 'catalog', items: resultados.slice(0, 30), total: resultados.length }
        };
    }
    if (intent === 'search_customer') {
        const resultados = resumirClientes(pedidos, query);
        return {
            title: 'Historial de clientes',
            text: resultados.length ? `Encontré ${resultados.length} cliente${resultados.length === 1 ? '' : 's'} relacionado${resultados.length === 1 ? '' : 's'} con la búsqueda.` : 'No encontré un cliente con ese nombre.',
            data: { kind: 'customers', items: resultados.slice(0, 20), total: resultados.length }
        };
    }
    if (intent !== 'summary') return { text: 'La solicitud no produjo una acción que pueda ejecutar.' };

    if (summaryScope === 'active') {
        const activos = pedidos.filter((pedido) => ESTADOS_ACTIVOS.has(pedido.estado));
        const resumen = calcularPedidosActivos(status ? activos.filter((pedido) => pedido.estado === status) : activos);
        return {
            title: status ? `Pedidos: ${status}` : 'Pedidos activos ahora',
            text: `${resumen.totales.cantidad} pedidos activos, con ${formatoColones(resumen.totales.saldoPorCobrar)} por cobrar y ${resumen.totales.atrasados} entregas atrasadas.`,
            data: { kind: 'active', resumen }
        };
    }

    if (summaryScope === 'debts') {
        const resumenActivos = calcularPedidosActivos(pedidos);
        const deudasEntregadas = clientesMorosos(pedidos);
        const clave = sinAcentos(query);
        const filtradas = clave ? deudasEntregadas.filter((cliente) => coincideConsulta(clave, cliente.cliente)) : deudasEntregadas;
        const saldoEntregado = filtradas.reduce((total, cliente) => total + cliente.deuda, 0);
        const clientesCoincidentes = resumirClientes(pedidos, query);
        const saldoActivo = clave
            ? clientesCoincidentes.reduce((total, cliente) => cliente.saldoActivo + total, 0)
            : resumenActivos.totales.saldoPorCobrar;
        const clientesConSaldo = clientesCoincidentes
            .filter((cliente) => cliente.saldoActivo > 0 || cliente.deudaActual > 0)
            .map((cliente) => ({
                cliente: cliente.nombre,
                pedidos: cliente.totalPedidos,
                saldoActivo: cliente.saldoActivo,
                deuda: cliente.deudaActual
            }))
            .slice(0, 20);
        return {
            title: query ? `Saldos de ${query}` : 'Saldos por cobrar',
            text: `${formatoColones(saldoActivo)} en pedidos activos${saldoEntregado ? ` y ${formatoColones(saldoEntregado)} en pedidos entregados` : ''}.`,
            data: { kind: 'debts', activeBalance: saldoActivo, deliveredBalance: saldoEntregado, clients: clientesConSaldo }
        };
    }

    if (period === 'personalizado' && (!esFechaISOValida(interpretacion.range_start)
        || !esFechaISOValida(interpretacion.range_end)
        || interpretacion.range_start > interpretacion.range_end)) {
        return { text: 'Indica las dos fechas del período personalizado. Por ejemplo: “resumen del 2026-11-01 al 2026-11-15”.' };
    }
    const rangoPreset = period === 'historico'
        ? { inicio: null, fin: null }
        : period === 'personalizado'
            ? { inicio: interpretacion.range_start, fin: interpretacion.range_end }
            : calcularRangoPreset(period, new Date());
    const resumenPeriodo = calcularMetricas(pedidos, movimientos, rangoPreset);
    if (summaryScope === 'cash') {
        const textoFiltro = sinAcentos(query);
        const movimientosFiltrados = textoFiltro ? movimientos.filter((movimiento) => {
            if (movimiento.anulado || movimiento.tipo !== 'salida' || !movimiento.fecha) return false;
            if (rangoPreset.inicio && movimiento.fecha < rangoPreset.inicio) return false;
            if (rangoPreset.fin && movimiento.fecha > rangoPreset.fin) return false;
            return [movimiento.categoria, movimiento.descripcion, movimiento.entidad]
                .some((valor) => sinAcentos(valor).includes(textoFiltro));
        }) : [];
        const totalFiltrado = movimientosFiltrados.reduce((total, movimiento) => {
            const monto = Number(movimiento.monto);
            return Number.isFinite(monto) && monto >= 0 ? total + monto : total;
        }, 0);
        return {
            title: `Caja · ${nombreMes(period, rangoPreset)}`,
            text: query
                ? `Gastos coincidentes con “${query}”: ${formatoColones(totalFiltrado)}. Salidas totales: ${formatoColones(resumenPeriodo.totalSalidas)}.`
                : `Entradas ${formatoColones(resumenPeriodo.totalEntradas)} · salidas ${formatoColones(resumenPeriodo.totalSalidas)} · flujo neto ${formatoColones(resumenPeriodo.utilidad)}.`,
            data: { kind: 'cash', resumen: resumenPeriodo, periodo: nombreMes(period, rangoPreset), filtro: query ? { query, total: totalFiltrado, movimientos: movimientosFiltrados.slice(0, 10) } : null }
        };
    }

    const contabilidad = calcularMetricasContables(pedidos, movimientos, rangoPreset);
    const resumenActivos = calcularPedidosActivos(pedidos);
    return {
        title: `Resumen del negocio · ${nombreMes(period, rangoPreset)}`,
        text: `Flujo neto ${formatoColones(resumenPeriodo.utilidad)} y ${resumenActivos.totales.cantidad} pedidos abiertos con ${formatoColones(resumenActivos.totales.saldoPorCobrar)} por cobrar.`,
        data: { kind: 'business', flujo: resumenPeriodo, contabilidad, activos: resumenActivos, periodo: nombreMes(period, rangoPreset), topProducts: resumenPeriodo.topProd, topClients: resumenPeriodo.topClientes }
    };
}

function interpretarSeguimientoLocal(texto, mensajes) {
    const normalizado = sinAcentos(texto);
    const mencionaContexto = /\b(ella|el|ese|esa|eso|su|sus|le|les|tambien|ahora|y)\b/.test(normalizado);
    if (!mencionaContexto) return null;
    const ultimoCliente = [...mensajes].reverse().find((item) =>
        item.role === 'assistant' && item.data?.kind === 'customers' && item.data.items?.length === 1
    )?.data.items[0];
    if (!ultimoCliente) return null;

    if (/\b(pedido|pedidos|compra|compras|historial)\b/.test(normalizado)) {
        if (/\b(crea|crear|agrega|agregar|nuevo|nueva|hazle|hacer)\b/.test(normalizado)) {
            return {
                intent: 'create_order',
                reply: `Preparé un borrador para ${ultimoCliente.nombre}. Completa los productos y confirma para guardar.`,
                draft: { customer: ultimoCliente.nombre, products: [] }
            };
        }
        return { intent: 'search_orders', query: ultimoCliente.nombre };
    }
    if (/\b(saldo|debe|deuda|cobrar|pagado|abonado)\b/.test(normalizado)) {
        return { intent: 'summary', summary_scope: 'debts', query: ultimoCliente.nombre };
    }
    return null;
}

function BorradorAsistente({ id, borrador, catalogo, onChange, onGuardar, guardando, error }) {
    const total = useMemo(() => calcularTotalesPedido(
        borrador.productos,
        borrador.aplica_descuento
            ? borrador.descuento_tipo === 'porcentaje'
                ? { descuento_porcentaje: borrador.descuento_valor }
                : { descuento_monto: borrador.descuento_valor }
            : { descuento_monto: 0 }
    ), [borrador.productos, borrador.aplica_descuento, borrador.descuento_tipo, borrador.descuento_valor]);

    const actualizar = (campo, valor) => onChange({ ...borrador, [campo]: valor });
    const actualizarProducto = (indice, campo, valor) => {
        const productos = borrador.productos.map((producto, index) => index === indice
            ? { ...producto, [campo]: valor }
            : producto);
        onChange({ ...borrador, productos });
    };
    const cambiarNombreProducto = (indice, valor) => {
        const ficha = catalogo.find((producto) => sinAcentos(producto.nombre) === sinAcentos(valor));
        const productos = borrador.productos.map((producto, index) => index === indice
            ? { ...producto, nombre: valor, ...(ficha ? { precio_unitario: String(ficha.precio_venta ?? '') } : {}) }
            : producto);
        onChange({ ...borrador, productos });
    };

    const totalPagado = Number(borrador.tipo === 'venta_rapida' ? borrador.pagado : borrador.adelanto) || 0;
    const monedaPagadaValida = tieneMaximoDosDecimales(totalPagado) && totalPagado >= 0 && totalPagado <= total.precio;

    return (
        <Card className="asistente-draft mt-3 border-primary">
            <Card.Header className="d-flex align-items-center justify-content-between gap-2 bg-primary text-white">
                <strong><i className={`fas ${borrador.tipo === 'venta_rapida' ? 'fa-bolt' : 'fa-clipboard-list'} me-2`} aria-hidden="true"></i>{borrador.tipo === 'venta_rapida' ? 'Borrador de venta rápida' : 'Borrador de pedido'}</strong>
                <Badge bg={borrador.tipo === 'venta_rapida' ? 'warning' : 'light'} text={borrador.tipo === 'venta_rapida' ? 'dark' : 'primary'}>
                    {borrador.tipo === 'venta_rapida' ? 'Quedará entregado' : 'Quedará pendiente'}
                </Badge>
            </Card.Header>
            <Card.Body>
                <p className="small text-muted">Confirma productos, cantidades y precios. Al guardar se aplican las validaciones normales; cualquier adelanto se registra junto con su entrada en Caja.</p>
                <Row className="g-2 mb-3">
                    <Col md={6}>
                        <Form.Label htmlFor={`assistant-customer-${id}`} className="small fw-bold">Cliente</Form.Label>
                        <Form.Control id={`assistant-customer-${id}`} value={borrador.cliente} onChange={(event) => actualizar('cliente', event.target.value)} placeholder="Nombre del cliente" />
                    </Col>
                    <Col md={6}>
                        <Form.Label htmlFor={`assistant-phone-${id}`} className="small fw-bold">Teléfono (opcional)</Form.Label>
                        <Form.Control id={`assistant-phone-${id}`} type="tel" value={borrador.telefono} onChange={(event) => actualizar('telefono', event.target.value)} placeholder="8888-8888" />
                    </Col>
                    {borrador.tipo === 'pedido' && (
                        <Col md={6}>
                            <Form.Label htmlFor={`assistant-due-${id}`} className="small fw-bold">Fecha de entrega (opcional)</Form.Label>
                            <Form.Control id={`assistant-due-${id}`} type="date" value={borrador.fecha_entrega} onChange={(event) => actualizar('fecha_entrega', event.target.value)} />
                        </Col>
                    )}
                </Row>

                <div className="d-flex justify-content-between align-items-center mb-2">
                    <strong>Productos</strong>
                    <Button size="sm" variant="outline-primary" onClick={() => onChange({ ...borrador, productos: [...borrador.productos, { nombre: '', precio_unitario: '', cantidad: 1 }] })}>
                        <i className="fas fa-plus me-1" aria-hidden="true"></i>Agregar producto
                    </Button>
                </div>
                <datalist id={`assistant-catalog-${id}`}>
                    {catalogo.map((producto) => <option key={producto.id || producto.nombre} value={producto.nombre}>{formatoColones(producto.precio_venta || 0)}</option>)}
                </datalist>
                {borrador.productos.map((producto, indice) => (
                    <Row className="g-2 align-items-end assistant-product-row mb-2" key={`${id}-product-${indice}`}>
                        <Col xs={12} md={6}>
                            <Form.Label className="small">Producto {indice + 1}</Form.Label>
                            <Form.Control list={`assistant-catalog-${id}`} value={producto.nombre} onChange={(event) => cambiarNombreProducto(indice, event.target.value)} placeholder="Nombre del producto" />
                        </Col>
                        <Col xs={5} md={2}>
                            <Form.Label className="small">Precio unitario</Form.Label>
                            <Form.Control type="number" min="0" step="0.01" value={producto.precio_unitario} onChange={(event) => actualizarProducto(indice, 'precio_unitario', event.target.value)} />
                        </Col>
                        <Col xs={4} md={2}>
                            <Form.Label className="small">Cantidad</Form.Label>
                            <Form.Control type="number" min="1" step="1" value={producto.cantidad} onChange={(event) => actualizarProducto(indice, 'cantidad', event.target.value)} />
                        </Col>
                        <Col xs={3} md={2} className="d-flex justify-content-end">
                            <Button variant="outline-danger" aria-label={`Quitar producto ${indice + 1}`} disabled={borrador.productos.length === 1} onClick={() => onChange({ ...borrador, productos: borrador.productos.filter((_, index) => index !== indice) })}>
                                <i className="fas fa-trash" aria-hidden="true"></i>
                            </Button>
                        </Col>
                    </Row>
                ))}

                <div className="p-3 bg-light rounded border mt-3 mb-3">
                    <div className="d-flex justify-content-between mb-2"><span>Subtotal</span><strong>{formatoColones(total.subtotal)}</strong></div>
                    <Form.Check
                        type="switch"
                        id={`assistant-discount-${id}`}
                        label="Aplicar descuento"
                        checked={borrador.aplica_descuento}
                        onChange={(event) => onChange({ ...borrador, aplica_descuento: event.target.checked, descuento_valor: event.target.checked ? borrador.descuento_valor : '' })}
                    />
                    {borrador.aplica_descuento && (
                        <Row className="g-2 mt-1">
                            <Col xs={5}>
                                <Form.Label className="small">Tipo de descuento</Form.Label>
                                <Form.Select value={borrador.descuento_tipo} onChange={(event) => onChange({ ...borrador, descuento_tipo: event.target.value, descuento_valor: '' })}>
                                    <option value="monto">Monto (₡)</option>
                                    <option value="porcentaje">Porcentaje (%)</option>
                                </Form.Select>
                            </Col>
                            <Col xs={7}>
                                <Form.Label className="small">{borrador.descuento_tipo === 'porcentaje' ? 'Porcentaje' : 'Monto'}</Form.Label>
                                <Form.Control type="number" min="0" max={borrador.descuento_tipo === 'porcentaje' ? 100 : total.subtotal} step="0.01" value={borrador.descuento_valor} onChange={(event) => actualizar('descuento_valor', event.target.value)} />
                            </Col>
                        </Row>
                    )}
                    <div className="d-flex justify-content-between align-items-center border-top pt-2 mt-3 fs-5">
                        <strong>Total</strong><strong className="text-primary">{formatoColones(total.precio)}</strong>
                    </div>
                </div>

                <Row className="g-2 mb-3">
                    <Col md={6}>
                        <Form.Label htmlFor={`assistant-payment-${id}`} className="small fw-bold">{borrador.tipo === 'venta_rapida' ? 'Pagado ahora (opcional)' : 'Adelanto (opcional)'}</Form.Label>
                        <InputGroup>
                            <InputGroup.Text>₡</InputGroup.Text>
                            <Form.Control id={`assistant-payment-${id}`} type="number" min="0" max={total.precio} step="0.01" value={borrador.tipo === 'venta_rapida' ? borrador.pagado : borrador.adelanto} onChange={(event) => actualizar(borrador.tipo === 'venta_rapida' ? 'pagado' : 'adelanto', event.target.value)} />
                        </InputGroup>
                    </Col>
                    {totalPagado > 0 && (
                        <Col md={6}>
                            <Form.Label htmlFor={`assistant-method-${id}`} className="small fw-bold">Método de pago</Form.Label>
                            <Form.Select id={`assistant-method-${id}`} value={borrador.tipo === 'venta_rapida' ? borrador.metodo_pago : borrador.metodo_adelanto} onChange={(event) => actualizar(borrador.tipo === 'venta_rapida' ? 'metodo_pago' : 'metodo_adelanto', event.target.value)}>
                                <option>Efectivo</option>
                                <option>Sinpe Móvil</option>
                                <option>Transferencia</option>
                            </Form.Select>
                        </Col>
                    )}
                </Row>
                <Form.Group className="mb-3">
                    <Form.Label htmlFor={`assistant-notes-${id}`} className="small fw-bold">Descripción / notas internas</Form.Label>
                    <Form.Control id={`assistant-notes-${id}`} as="textarea" rows={2} value={borrador.descripcion} onChange={(event) => actualizar('descripcion', event.target.value)} />
                </Form.Group>

                {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
                {!monedaPagadaValida && <div className="alert alert-warning py-2">El pago debe estar entre ₡0 y el total del pedido y tener máximo dos decimales.</div>}
                <Button variant={borrador.tipo === 'venta_rapida' ? 'warning' : 'primary'} className="w-100 fw-bold" disabled={guardando || !monedaPagadaValida} onClick={() => onGuardar(borrador, total)}>
                    {guardando ? <><Spinner size="sm" className="me-2" />Guardando...</> : <><i className={`fas ${borrador.tipo === 'venta_rapida' ? 'fa-bolt' : 'fa-save'} me-2`} aria-hidden="true"></i>Confirmar y guardar {borrador.tipo === 'venta_rapida' ? 'venta' : 'pedido'}</>}
                </Button>
            </Card.Body>
        </Card>
    );
}

function ResultadoAsistente({ data }) {
    if (!data) return null;
    if (data.kind === 'orders') return (
        <div className="table-responsive mt-2">
            <Table size="sm" hover className="mb-0 assistant-results-table">
                <thead><tr><th>Cliente</th><th>Productos</th><th>Entrega</th><th>Estado</th><th className="text-end">Saldo</th></tr></thead>
                <tbody>{data.items.map((pedido) => <tr key={pedido.id}>
                    <td>{pedido.cliente || 'Sin cliente'}</td>
                    <td>{obtenerProductosPedido(pedido).map((producto) => `${producto.cantidad} × ${producto.nombre}`).join(', ') || pedido.producto}</td>
                    <td>{formatoFechaLegible(pedido.fecha_entrega) || 'Sin fecha'}</td>
                    <td><Badge bg={ESTADO_VARIANTES[pedido.estado] || 'secondary'} text={pedido.estado === 'En producción' || pedido.estado === 'Por Retirar' ? 'dark' : undefined}>{pedido.estado || 'Sin estado'}</Badge></td>
                    <td className="text-end">{formatoColones(Math.max(0, Number(pedido.precio || 0) - Number(pedido.monto_pagado || 0)))}</td>
                </tr>)}</tbody>
            </Table>
            {data.total > data.items.length && <p className="small text-muted mt-2 mb-0">Se muestran {data.items.length} de {data.total} resultados.</p>}
        </div>
    );

    if (data.kind === 'catalog') return (
        <div className="table-responsive mt-2">
            <Table size="sm" hover className="mb-0 assistant-results-table">
        <thead><tr><th>Producto</th><th>Categoría</th><th>Proveedor</th><th className="text-end">Precio</th><th className="text-end">Costo</th></tr></thead>
                <tbody>{data.items.map((producto) => <tr key={producto.id || producto.nombre}>
                    <td>{producto.nombre || 'Sin nombre'}</td><td>{producto.categoria || '—'}</td><td>{producto.proveedor || '—'}</td>
                    <td className="text-end">{producto.precio_venta == null ? 'Por definir' : formatoColones(producto.precio_venta)}</td><td className="text-end">{producto.precio_costo == null ? 'Por definir' : formatoColones(producto.precio_costo)}</td>
                </tr>)}</tbody>
            </Table>
        </div>
    );

    if (data.kind === 'customers') return (
        <div className="table-responsive mt-2">
            <Table size="sm" hover className="mb-0 assistant-results-table">
                <thead><tr><th>Cliente</th><th>Pedidos</th><th className="text-end">Total gastado</th><th className="text-end">Saldo activo</th><th className="text-end">Deuda entregada</th></tr></thead>
                <tbody>{data.items.map((cliente) => <tr key={cliente.nombre}>
                    <td>{cliente.nombre}</td><td>{cliente.totalPedidos}</td><td className="text-end">{formatoColones(cliente.totalGastado)}</td>
                    <td className="text-end">{formatoColones(cliente.saldoActivo)}</td><td className="text-end">{formatoColones(cliente.deudaActual)}</td>
                </tr>)}</tbody>
            </Table>
        </div>
    );

    if (data.kind === 'active') return (
        <div className="row g-2 mt-1">
            {data.resumen.estados.map((estado) => <div className="col-12 col-md-4" key={estado.estado}>
                <div className="assistant-stat"><span>{estado.estado}</span><strong>{estado.cantidad} pedidos</strong><small>{formatoColones(estado.saldoPorCobrar)} por cobrar · {estado.atrasados} atrasados</small></div>
            </div>)}
            <div className="col-12"><div className="assistant-total"><span>Total activo</span><strong>{formatoColones(data.resumen.totales.valorTotal)}</strong><span>Abonado {formatoColones(data.resumen.totales.abonado)} · por cobrar {formatoColones(data.resumen.totales.saldoPorCobrar)}</span></div></div>
        </div>
    );

    if (data.kind === 'debts') return (
        <div className="row g-2 mt-1">
            <div className="col-sm-6"><div className="assistant-stat"><span>Pedidos activos</span><strong>{formatoColones(data.activeBalance)}</strong><small>Saldo por cobrar</small></div></div>
            <div className="col-sm-6"><div className="assistant-stat"><span>Pedidos entregados</span><strong>{formatoColones(data.deliveredBalance)}</strong><small>Deuda vigente de entregas</small></div></div>
            {data.clients.length > 0 && <div className="col-12"><div className="table-responsive mt-2"><Table size="sm" className="mb-0"><thead><tr><th>Cliente</th><th className="text-end">Activo</th><th className="text-end">Entregado</th></tr></thead><tbody>{data.clients.map((cliente) => <tr key={cliente.cliente}><td>{cliente.cliente} · {cliente.pedidos} pedido(s)</td><td className="text-end">{formatoColones(cliente.saldoActivo)}</td><td className="text-end">{formatoColones(cliente.deuda)}</td></tr>)}</tbody></Table></div></div>}
        </div>
    );

    if (data.kind === 'cash') return (
        <div className="row g-2 mt-1">
            <div className="col-md-4"><div className="assistant-stat"><span>Entradas registradas</span><strong>{formatoColones(data.resumen.totalEntradas)}</strong></div></div>
            <div className="col-md-4"><div className="assistant-stat"><span>Salidas registradas</span><strong>{formatoColones(data.resumen.totalSalidas)}</strong></div></div>
            <div className="col-md-4"><div className="assistant-stat"><span>Flujo neto</span><strong className={data.resumen.utilidad >= 0 ? 'text-success' : 'text-danger'}>{formatoColones(data.resumen.utilidad)}</strong></div></div>
            {data.filtro && <div className="col-12"><div className="assistant-stat"><span>Gasto: {data.filtro.query}</span><strong>{formatoColones(data.filtro.total)}</strong><small>Coincidencias en descripción, categoría o entidad.</small></div></div>}
            <div className="col-12"><small className="text-muted">{data.periodo}. Se excluyen movimientos anulados.</small></div>
        </div>
    );

    if (data.kind === 'business') return (
        <div className="row g-2 mt-1">
            <div className="col-md-4"><div className="assistant-stat"><span>Flujo neto de caja</span><strong>{formatoColones(data.flujo.utilidad)}</strong><small>Entradas {formatoColones(data.flujo.totalEntradas)} · salidas {formatoColones(data.flujo.totalSalidas)}</small></div></div>
            <div className="col-md-4"><div className="assistant-stat"><span>Pedidos entregados</span><strong>{data.contabilidad.pedidosEntregadosEnPeriodo}</strong><small>Venta registrada {formatoColones(data.contabilidad.precioTotalVenta)}</small></div></div>
            <div className="col-md-4"><div className="assistant-stat"><span>Pedidos activos</span><strong>{data.activos.totales.cantidad}</strong><small>{formatoColones(data.activos.totales.saldoPorCobrar)} pendientes de cobro</small></div></div>
            {data.topProducts?.length > 0 && <div className="col-md-6"><div className="assistant-stat"><span>Productos más solicitados</span>{data.topProducts.map(([nombre, cantidad]) => <small key={nombre}>{nombre} · {cantidad} pedido(s)</small>)}</div></div>}
            {data.topClients?.length > 0 && <div className="col-md-6"><div className="assistant-stat"><span>Clientes principales</span>{data.topClients.map(([id, cliente]) => <small key={id}>{cliente.nombre} · {formatoColones(cliente.monto)}</small>)}</div></div>}
            <div className="col-12"><small className="text-muted">{data.periodo}. Caja se agrupa por fecha de movimiento; entregas por fecha de cierre; los saldos activos muestran el estado actual.</small></div>
        </div>
    );
    return null;
}

export default function Asistente() {
    const { datos: pedidos, cargando: cargandoPedidos, error: errorPedidos } = useFirestoreCollection(() => collection(db, 'pedidos'), []);
    const { datos: catalogo, cargando: cargandoCatalogo, error: errorCatalogo } = useFirestoreCollection(() => collection(db, 'productos'), []);
    const { datos: movimientos, cargando: cargandoMovimientos, error: errorMovimientos } = useFirestoreCollection(() => collection(db, 'movimientos'), []);
    const [mensaje, setMensaje] = useState('');
    const [mensajes, setMensajes] = useState([]);
    const [procesando, setProcesando] = useState(false);
    const [guardandoId, setGuardandoId] = useState(null);
    const [erroresBorrador, setErroresBorrador] = useState({});
    const mensajesFinalRef = useRef(null);
    const modoIA = Boolean(import.meta.env.VITE_ASISTENTE_API_URL)
        && String(import.meta.env.VITE_ASISTENTE_REMOTO || '').toLowerCase() === 'true';

    const cargandoDatos = cargandoPedidos || cargandoCatalogo || cargandoMovimientos;
    const errorDatos = errorPedidos || errorCatalogo || errorMovimientos;

    useEffect(() => {
        mensajesFinalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [mensajes, procesando]);

    const procesarMensaje = async (texto) => {
        const solicitud = String(texto || '').trim();
        if (!solicitud || procesando) return;
        if (/^(limpiar|limpiar chat|limpiar conversacion|reiniciar conversacion|empezar de nuevo)$/.test(sinAcentos(solicitud))) {
            await limpiarConversacion();
            return;
        }
        const idUsuario = `user-${Date.now()}`;
        const idRespuesta = `assistant-${Date.now() + 1}`;
        setMensajes((actuales) => [...actuales, { id: idUsuario, role: 'user', text: solicitud }]);
        setMensaje('');
        setProcesando(true);
        try {
            const seguimiento = modoIA ? null : interpretarSeguimientoLocal(solicitud, mensajes);
            const interpretacion = seguimiento || await interpretarSolicitudAsistente(solicitud, catalogo);
            const respuesta = prepararRespuesta(interpretacion, pedidos, catalogo, movimientos);
            const assistantMessage = {
                id: idRespuesta,
                role: 'assistant',
                text: respuesta.text,
                title: respuesta.title,
                data: respuesta.data,
                notice: interpretacion.warning,
                mode: interpretacion.source
            };
            if (['create_order', 'quick_sale'].includes(interpretacion.intent)) {
                assistantMessage.draft = normalizarBorradorAsistente(interpretacion, catalogo);
                assistantMessage.text = interpretacion.reply || 'Revisa este borrador. Completa los datos faltantes y confírmalo para guardarlo.';
            }
            setMensajes((actuales) => [...actuales, assistantMessage]);
        } catch (error) {
            setMensajes((actuales) => [...actuales, {
                id: idRespuesta,
                role: 'assistant',
                text: error.message || 'No se pudo atender la solicitud. Inténtalo de nuevo.'
            }]);
        } finally {
            setProcesando(false);
        }
    };

    const actualizarBorrador = (id, borrador) => {
        setMensajes((actuales) => actuales.map((item) => item.id === id ? { ...item, draft: borrador } : item));
        setErroresBorrador((actuales) => ({ ...actuales, [id]: '' }));
    };

    const guardarBorrador = async (id, borrador, totales) => {
        const confirmacion = await Swal.fire({
            title: borrador.tipo === 'venta_rapida' ? '¿Registrar esta venta rápida?' : '¿Guardar este pedido?',
            text: `Cliente: ${borrador.cliente || 'Sin nombre'}\nProductos: ${borrador.productos.length}\nTotal: ${formatoColones(totales.precio)}\n\nLos pagos asociados se registrarán en Caja.`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: borrador.tipo === 'venta_rapida' ? 'Registrar venta' : 'Guardar pedido',
            cancelButtonText: 'Seguir revisando',
            confirmButtonColor: borrador.tipo === 'venta_rapida' ? '#ffc107' : '#0d6efd'
        });
        if (!confirmacion.isConfirmed) return;

        setGuardandoId(id);
        setErroresBorrador((actuales) => ({ ...actuales, [id]: '' }));
        try {
            if (borrador.tipo === 'venta_rapida') {
                await registrarVentaRapida({
                    cliente: borrador.cliente,
                    telefono: borrador.telefono,
                    productos: borrador.productos,
                    descripcion: borrador.descripcion,
                    descuento_tipo: borrador.descuento_tipo,
                    descuento_valor: borrador.aplica_descuento ? borrador.descuento_valor : '',
                    pagado: borrador.pagado,
                    metodo: borrador.metodo_pago
                });
            } else {
                await guardarPedidoAsistente(borrador);
            }
            setMensajes((actuales) => actuales.map((item) => item.id === id
                ? { ...item, draft: null, saved: true, text: borrador.tipo === 'venta_rapida' ? 'Venta rápida registrada. Quedó como entregada y el pago se reflejó en Caja.' : 'Pedido guardado como Pendiente. El adelanto, si lo agregaste, quedó vinculado a Caja.' }
                : item));
        } catch (error) {
            setErroresBorrador((actuales) => ({ ...actuales, [id]: error.message || 'No se pudo guardar el borrador.' }));
        } finally {
            setGuardandoId(null);
        }
    };

    const enviar = (event) => {
        event.preventDefault();
        procesarMensaje(mensaje);
    };

    async function limpiarConversacion() {
        if (procesando || guardandoId) return;
        const tieneBorradores = mensajes.some((item) => item.draft);
        if (tieneBorradores) {
            const confirmacion = await Swal.fire({
                title: '¿Limpiar la conversación?',
                text: 'Se descartarán los borradores que todavía no guardaste. Los pedidos ya guardados no se afectan.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Limpiar',
                cancelButtonText: 'Seguir revisando',
                confirmButtonColor: '#6c757d'
            });
            if (!confirmacion.isConfirmed) return;
        }
        setMensajes([]);
        setMensaje('');
        setErroresBorrador({});
    }

    return (
        <Container className="py-4 assistant-page">
            <div className="assistant-heading mb-4">
                <div>
                    <h1><i className="fas fa-wand-magic-sparkles me-2" aria-hidden="true"></i>Asistente MASUCRI</h1>
                    <p className="mb-0 text-muted">Busca pedidos, clientes y productos; consulta Caja; prepara pedidos para revisar y confirmar.</p>
                </div>
                <div className="assistant-heading-actions">
                    {mensajes.length > 0 && <Button size="sm" variant="outline-secondary" onClick={limpiarConversacion} disabled={procesando || Boolean(guardandoId)} title="Limpiar la conversación">
                        <i className="fas fa-broom me-1" aria-hidden="true"></i>Limpiar
                    </Button>}
                    <Badge bg={modoIA ? 'success' : 'secondary'} className="assistant-mode">{modoIA ? 'IA remota activa' : 'Asistente local'}</Badge>
                </div>
            </div>

            {errorDatos && <EstadoError texto={errorDatos.message || 'No se pudieron cargar los datos del asistente.'} />}
            {!errorDatos && cargandoDatos && <EstadoCarga texto="Cargando pedidos, catálogo y movimientos para el asistente..." />}
            {!errorDatos && !cargandoDatos && (
                <>
                    {!modoIA && <div className="alert alert-info py-2 small"><i className="fas fa-circle-info me-2" aria-hidden="true"></i>Asistente local, sin proveedor de IA. Calcula con los datos de MASUCRI; los pedidos nuevos siempre se revisan antes de guardarse.</div>}
                    <Card className="assistant-chat-card">
                        <Card.Body className="assistant-chat-body">
                            {mensajes.length === 0 ? (
                                <div className="assistant-empty text-center py-4">
                                    <div className="assistant-empty-icon"><i className="fas fa-comments" aria-hidden="true"></i></div>
                                    <h2 className="h5 fw-bold">¿Qué necesitas revisar?</h2>
                                    <p className="text-muted">Los cálculos se hacen con las mismas reglas que el módulo de BI y Finanzas.</p>
                                    <div className="assistant-prompts d-flex flex-wrap justify-content-center gap-2 mt-3">
                                        {[
                                            '¿Cuántos pedidos activos están atrasados?',
                                            '¿Cómo va la caja este mes?',
                                            'Lista pedidos atrasados',
                                            '¿Cuánto gasté en transporte este mes?',
                                            'Mostrar pedidos pendientes',
                                            'Mostrar catálogo',
                                            'Historial de clientes',
                                            'Nuevo pedido'
                                        ].map((prompt) => <Button key={prompt} size="sm" variant="outline-primary" onClick={() => procesarMensaje(prompt)} disabled={procesando}>{prompt}</Button>)}
                                    </div>
                                </div>
                            ) : (
                                <div className="assistant-message-list">
                                    {mensajes.map((item) => (
                                        <div className={`assistant-message assistant-message-${item.role}`} key={item.id}>
                                            <div className="assistant-message-bubble">
                                                {item.title && <h2 className="h6 fw-bold mb-2">{item.title}</h2>}
                                                <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{item.text}</p>
                                                {item.notice && <div className="small text-warning-emphasis mt-2"><i className="fas fa-triangle-exclamation me-1" aria-hidden="true"></i>{item.notice}</div>}
                                                {item.mode === 'local_fallback' && <div className="small text-muted mt-2">Respondí con las funciones locales disponibles.</div>}
                                                {item.data && <ResultadoAsistente data={item.data} />}
                                                {item.saved && <Badge bg="success" className="mt-2"><i className="fas fa-check me-1" aria-hidden="true"></i>Registrado</Badge>}
                                                {item.draft && (
                                                    <BorradorAsistente
                                                        id={item.id}
                                                        borrador={item.draft}
                                                        catalogo={catalogo}
                                                        onChange={(borrador) => actualizarBorrador(item.id, borrador)}
                                                        onGuardar={(borrador, totales) => guardarBorrador(item.id, borrador, totales)}
                                                        guardando={guardandoId === item.id}
                                                        error={erroresBorrador[item.id]}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {procesando && <div className="assistant-thinking"><Spinner size="sm" className="me-2" />Revisando la solicitud...</div>}
                                    <div ref={mensajesFinalRef} />
                                </div>
                            )}
                        </Card.Body>
                        <Card.Footer className="bg-white p-3">
                            <Form onSubmit={enviar}>
                                <InputGroup>
                                    <Form.Control
                                        as="textarea"
                                        rows={1}
                                        maxLength={2000}
                                        aria-label="Escribe una solicitud para el asistente"
                                        placeholder="Ej.: ¿Cuánto queda por cobrar en pedidos activos?"
                                        value={mensaje}
                                        onChange={(event) => setMensaje(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' && !event.shiftKey) {
                                                event.preventDefault();
                                                procesarMensaje(mensaje);
                                            }
                                        }}
                                        disabled={procesando}
                                    />
                                    <Button type="submit" variant="primary" disabled={!mensaje.trim() || procesando} aria-label="Enviar solicitud">
                                        {procesando ? <Spinner size="sm" /> : <i className="fas fa-paper-plane" aria-hidden="true"></i>}
                                    </Button>
                                </InputGroup>
                                <div className="d-flex justify-content-between flex-wrap gap-2 mt-2 small text-muted">
                                    <span>Enter para enviar · Shift + Enter para una nueva línea</span>
                                    <span>Pedidos {pedidos.length} · productos {catalogo.length} · movimientos {movimientos.length}</span>
                                </div>
                            </Form>
                        </Card.Footer>
                    </Card>
                </>
            )}
        </Container>
    );
}
