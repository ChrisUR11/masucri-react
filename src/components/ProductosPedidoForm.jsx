import { useEffect, useId, useRef, useState } from 'react';
import { Button, Form, InputGroup } from 'react-bootstrap';
import { formatoNumero } from '../utils/formato';
import './ProductosPedidoForm.css';

const LINEA_VACIA = { nombre: '', precio_unitario: '', cantidad: 1, total: 0 };
const MAX_SUGERENCIAS = 8;

const normalizar = (texto) => String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CR')
    .trim();

const precioCatalogo = (producto) => {
    if (producto?.precio_venta == null || String(producto.precio_venta).trim() === '') return '';
    const precio = Number(producto?.precio_venta);
    return Number.isFinite(precio) && precio > 0 ? precio : '';
};

const totalLinea = ({ precio_unitario, cantidad }) => {
    if (precio_unitario === '' || cantidad === '') return 0;
    const precio = Number(precio_unitario);
    const unidades = Number(cantidad);
    if (!Number.isFinite(precio) || precio < 0 || !Number.isInteger(unidades) || unidades < 1) return 0;
    const total = precio * unidades;
    return Number.isFinite(total) ? Math.round((total + Number.EPSILON) * 100) / 100 : 0;
};

const montoVisible = (monto) => `₡${formatoNumero(monto, monto % 1 ? 2 : 0)}`;

/** Filas de productos controladas por el formulario de pedido o venta rápida. */
export default function ProductosPedidoForm({ productos = [], onChange, catalogo = [], idPrefix }) {
    const idGenerado = useId().replace(/[^a-zA-Z0-9_-]/g, '');
    const baseId = idPrefix || `productos-pedido-${idGenerado}`;
    const lineas = productos.length ? productos : [LINEA_VACIA];
    const [filaAbierta, setFilaAbierta] = useState(null);
    const [sugerenciaActiva, setSugerenciaActiva] = useState(0);
    const temporizadorBlur = useRef(null);
    const entradasNombre = useRef([]);
    const filaNuevaParaEnfocar = useRef(null);

    useEffect(() => () => clearTimeout(temporizadorBlur.current), []);
    useEffect(() => {
        const indice = filaNuevaParaEnfocar.current;
        if (indice === null || indice >= lineas.length) return;
        filaNuevaParaEnfocar.current = null;
        entradasNombre.current[indice]?.focus();
    }, [lineas.length]);

    const encontrarExacto = (nombre) => {
        const buscado = normalizar(nombre);
        return buscado ? catalogo.find((item) => normalizar(item.nombre) === buscado) : null;
    };

    const cambiarLinea = (indice, cambios) => {
        onChange(lineas.map((linea, i) => {
            if (i !== indice) return linea;
            const siguiente = { ...linea, ...cambios };
            return { ...siguiente, total: totalLinea(siguiente) };
        }));
    };

    const cambiarNombre = (indice, nombre) => {
        const productoExacto = encontrarExacto(nombre);
        const nombreAnterior = lineas[indice].nombre;
        const anterior = encontrarExacto(nombreAnterior);
        const precioActual = lineas[indice].precio_unitario;
        const cambios = { nombre };
        if (productoExacto) {
            const cambioDeProducto = normalizar(nombreAnterior) !== normalizar(nombre);
            const precioAutomaticoAnterior = anterior && Number(precioActual) === precioCatalogo(anterior);
            if (cambioDeProducto && (precioActual === '' || precioAutomaticoAnterior)) {
                cambios.precio_unitario = precioCatalogo(productoExacto);
            }
        } else {
            // Si se reemplaza un producto elegido del catálogo, se limpia su precio
            // automático para evitar guardar el precio del artículo anterior.
            if (anterior && Number(precioActual) === precioCatalogo(anterior)) {
                cambios.precio_unitario = '';
            }
        }
        cambiarLinea(indice, cambios);
        setFilaAbierta(indice);
        setSugerenciaActiva(0);
    };

    const seleccionarProducto = (indice, producto) => {
        clearTimeout(temporizadorBlur.current);
        cambiarLinea(indice, { nombre: producto.nombre, precio_unitario: precioCatalogo(producto) });
        setFilaAbierta(null);
    };

    const cerrarTrasBlur = () => {
        clearTimeout(temporizadorBlur.current);
        // Deja que el clic o toque en una sugerencia se procese antes de cerrarla.
        temporizadorBlur.current = setTimeout(() => setFilaAbierta(null), 150);
    };

    const agregarProducto = () => {
        clearTimeout(temporizadorBlur.current);
        filaNuevaParaEnfocar.current = lineas.length;
        onChange([...lineas, { ...LINEA_VACIA }]);
        setFilaAbierta(null);
    };

    const quitarProducto = (indice) => {
        clearTimeout(temporizadorBlur.current);
        onChange(lineas.filter((_, i) => i !== indice));
        setFilaAbierta(null);
    };

    return (
        <section className="productos-pedido" aria-label="Productos del pedido">
            <div className="productos-pedido-encabezado">
                <h3 className="h6 fw-bold mb-0">Productos</h3>
                <Button type="button" variant="outline-primary" size="sm" onClick={agregarProducto}>
                    <i className="fas fa-plus me-1" aria-hidden="true" /> Agregar producto
                </Button>
            </div>

            <div className="productos-pedido-lista">
                {lineas.map((linea, indice) => {
                    const nombreId = `${baseId}-nombre-${indice}`;
                    const listaId = `${baseId}-sugerencias-${indice}`;
                    const consulta = normalizar(linea.nombre);
                    const sugerencias = consulta
                        ? catalogo.filter((item) => normalizar(item.nombre).includes(consulta)).slice(0, MAX_SUGERENCIAS)
                        : [];
                    const mostrarSugerencias = filaAbierta === indice && sugerencias.length > 0;
                    const activa = Math.min(sugerenciaActiva, sugerencias.length - 1);

                    const tecladoNombre = (evento) => {
                        if (evento.key === 'Escape') {
                            setFilaAbierta(null);
                        } else if (evento.key === 'ArrowDown' && sugerencias.length) {
                            evento.preventDefault();
                            setFilaAbierta(indice);
                            setSugerenciaActiva((actual) => filaAbierta === indice ? (actual + 1) % sugerencias.length : 0);
                        } else if (evento.key === 'ArrowUp' && sugerencias.length) {
                            evento.preventDefault();
                            setFilaAbierta(indice);
                            setSugerenciaActiva((actual) => filaAbierta === indice
                                ? (actual - 1 + sugerencias.length) % sugerencias.length
                                : sugerencias.length - 1);
                        } else if (evento.key === 'Enter' && mostrarSugerencias) {
                            evento.preventDefault();
                            seleccionarProducto(indice, sugerencias[activa]);
                        }
                    };

                    return (
                        <div className="productos-pedido-fila" key={indice}>
                            <div className="productos-pedido-nombre">
                                <Form.Label htmlFor={nombreId} className="small fw-bold mb-1">Producto {indice + 1}</Form.Label>
                                <div className="productos-pedido-busqueda">
                                    <Form.Control
                                        ref={(elemento) => { entradasNombre.current[indice] = elemento; }}
                                        id={nombreId}
                                        type="text"
                                        required
                                        autoComplete="off"
                                        role="combobox"
                                        aria-autocomplete="list"
                                        aria-expanded={mostrarSugerencias}
                                        aria-controls={mostrarSugerencias ? listaId : undefined}
                                        aria-activedescendant={mostrarSugerencias ? `${listaId}-opcion-${activa}` : undefined}
                                        placeholder="Escribe o busca un producto"
                                        value={linea.nombre ?? ''}
                                        onChange={(evento) => cambiarNombre(indice, evento.target.value)}
                                        onFocus={() => {
                                            clearTimeout(temporizadorBlur.current);
                                            setFilaAbierta(indice);
                                            setSugerenciaActiva(0);
                                        }}
                                        onBlur={cerrarTrasBlur}
                                        onKeyDown={tecladoNombre}
                                    />
                                    {mostrarSugerencias && (
                                        <ul id={listaId} className="productos-pedido-sugerencias" role="listbox" aria-label={`Sugerencias para producto ${indice + 1}`}>
                                            {sugerencias.map((item, opcion) => (
                                                <li key={item.id ?? `${item.nombre}-${opcion}`} role="presentation">
                                                    <button
                                                        id={`${listaId}-opcion-${opcion}`}
                                                        type="button"
                                                        role="option"
                                                        aria-selected={opcion === activa}
                                                        className={`productos-pedido-sugerencia ${opcion === activa ? 'activa' : ''}`}
                                                        onMouseDown={(evento) => evento.preventDefault()}
                                                        onClick={() => seleccionarProducto(indice, item)}
                                                    >
                                                        <span>{item.nombre}</span>
                                                        <small>{precioCatalogo(item) === '' ? 'Sin precio' : montoVisible(precioCatalogo(item))}</small>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>

                            <div className="productos-pedido-precio">
                                <Form.Label htmlFor={`${baseId}-precio-${indice}`} className="small fw-bold mb-1">Precio unitario</Form.Label>
                                <InputGroup>
                                    <InputGroup.Text>₡</InputGroup.Text>
                                    <Form.Control
                                        id={`${baseId}-precio-${indice}`}
                                        type="number"
                                        inputMode="decimal"
                                        min="0"
                                        step="0.01"
                                        required
                                        value={linea.precio_unitario ?? ''}
                                        onChange={(evento) => cambiarLinea(indice, { precio_unitario: evento.target.value })}
                                    />
                                </InputGroup>
                            </div>

                            <div className="productos-pedido-cantidad">
                                <Form.Label htmlFor={`${baseId}-cantidad-${indice}`} className="small fw-bold mb-1">Cantidad</Form.Label>
                                <Form.Control
                                    id={`${baseId}-cantidad-${indice}`}
                                    type="number"
                                    inputMode="numeric"
                                    min="1"
                                    step="1"
                                    required
                                    value={linea.cantidad ?? ''}
                                    onChange={(evento) => cambiarLinea(indice, { cantidad: evento.target.value })}
                                />
                            </div>

                            <div className="productos-pedido-total">
                                <Form.Label htmlFor={`${baseId}-total-${indice}`} className="small fw-bold mb-1">Total</Form.Label>
                                <Form.Control
                                    id={`${baseId}-total-${indice}`}
                                    type="text"
                                    readOnly
                                    value={montoVisible(totalLinea(linea))}
                                    aria-label={`Total del producto ${indice + 1}`}
                                />
                            </div>

                            <div className="productos-pedido-quitar">
                                {lineas.length > 1 && (
                                    <Button
                                        type="button"
                                        variant="outline-danger"
                                        size="sm"
                                        onClick={() => quitarProducto(indice)}
                                        aria-label={`Quitar producto ${indice + 1}`}
                                        title={`Quitar producto ${indice + 1}`}
                                    >
                                        <i className="fas fa-trash" aria-hidden="true" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

        </section>
    );
}
