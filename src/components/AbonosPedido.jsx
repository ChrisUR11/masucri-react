import { useMemo, useState } from 'react';
import { Badge, Button, ListGroup } from 'react-bootstrap';
import { collection, query, where } from 'firebase/firestore';
import Swal from 'sweetalert2';
import { auth, db } from '../config/firebase';
import { useFirestoreCollection } from '../hooks/useFirestoreCollection';
import { aplicarCorreccionAbono } from '../services/correccionAbono';
import { historialConciliado, indicePagoEnHistorial } from '../utils/correccionAbonoDatos';
import { aCentavos, tieneMaximoDosDecimales } from '../utils/dinero.ts';
import { obtenerFechaLocal } from '../utils/fecha';
import { formatoColones } from '../utils/formato';

const METODOS = ['Sinpe Móvil', 'Efectivo', 'Transferencia'];

function conciliarPagos(historial, movimientos) {
    const utilizados = new Set();
    const vinculados = new Set();
    const clave = (movimiento) => `${movimiento.fecha}|${movimiento.metodo_pago}|${aCentavos(movimiento.monto)}`;
    const antiguosPorClave = new Map();
    movimientos.filter((movimiento) => !movimiento.anulado
        && !historial.some((pago) => pago?.movimiento_id === movimiento.id)).forEach((movimiento) => {
        const identidad = clave(movimiento);
        antiguosPorClave.set(identidad, (antiguosPorClave.get(identidad) || 0) + 1);
    });
    movimientos.forEach((movimiento) => {
        if (!movimiento.anulado && antiguosPorClave.get(clave(movimiento)) > 1
            && !historial.some((pago) => pago?.movimiento_id === movimiento.id)) return;
        const indice = indicePagoEnHistorial(historial, movimiento, utilizados);
        if (indice >= 0) {
            utilizados.add(indice);
            vinculados.add(movimiento.id);
        }
    });
    return {
        vinculados,
        sinVincular: historial.filter((_, indice) => !utilizados.has(indice))
    };
}

export default function AbonosPedido({ pedido }) {
    const { datos, cargando, error } = useFirestoreCollection(
        () => query(collection(db, 'movimientos'), where('pedido_id', '==', pedido.id)),
        [pedido.id]
    );
    const [procesandoId, setProcesandoId] = useState(null);
    const saldoConciliado = historialConciliado(pedido);
    const movimientos = useMemo(() => datos.filter((movimiento) => movimiento.pedido_id === pedido.id
        && movimiento.tipo === 'entrada').sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || ''))), [datos, pedido.id]);
    const { vinculados, sinVincular } = useMemo(() => conciliarPagos(
        Array.isArray(pedido.historial_pagos) ? pedido.historial_pagos : [], movimientos
    ), [pedido.historial_pagos, movimientos]);

    const ejecutar = async (movimiento, nuevoPago, motivo) => {
        setProcesandoId(movimiento.id);
        try {
            await aplicarCorreccionAbono(db, pedido.id, movimiento.id, nuevoPago, {
                motivo,
                usuario: auth.currentUser?.email || ''
            });
            await Swal.fire({
                icon: 'success', title: nuevoPago ? 'Abono corregido' : 'Abono anulado',
                text: 'El saldo del pedido y Caja ya están actualizados.', timer: 1700,
                showConfirmButton: false
            });
        } catch (err) {
            console.error('Error corrigiendo abono:', err);
            const mensaje = err.code === 'unavailable' || !navigator.onLine
                ? 'Conéctate a internet para corregir abonos y verificar el saldo vigente.'
                : err.message || 'No se pudo corregir el abono.';
            await Swal.fire('No se pudo corregir', mensaje, 'error');
        } finally {
            setProcesandoId(null);
        }
    };

    const editar = async (movimiento) => {
        const resultado = await Swal.fire({
            title: 'Editar abono',
            html: `
                <div class="text-start">
                    <label for="abono-monto" class="form-label">Monto (₡)</label>
                    <input id="abono-monto" type="number" step="0.01" min="0.01" class="form-control mb-2">
                    <label for="abono-fecha" class="form-label">Fecha del pago</label>
                    <input id="abono-fecha" type="date" class="form-control mb-2">
                    <label for="abono-metodo" class="form-label">Método de pago</label>
                    <select id="abono-metodo" class="form-select mb-2"></select>
                    <label for="abono-motivo" class="form-label">Motivo de la corrección</label>
                    <input id="abono-motivo" type="text" maxlength="200" class="form-control" placeholder="Ej.: monto digitado incorrectamente">
                </div>`,
            didOpen: () => {
                document.getElementById('abono-monto').value = movimiento.monto;
                document.getElementById('abono-fecha').value = movimiento.fecha || obtenerFechaLocal();
                const selector = document.getElementById('abono-metodo');
                [...new Set([...METODOS, movimiento.metodo_pago].filter(Boolean))]
                    .forEach((metodo) => selector.add(new Option(metodo, metodo)));
                selector.value = movimiento.metodo_pago || METODOS[0];
            },
            showCancelButton: true,
            confirmButtonText: 'Guardar corrección',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const monto = Number(document.getElementById('abono-monto').value);
                const fecha = document.getElementById('abono-fecha').value;
                const metodo = document.getElementById('abono-metodo').value;
                const motivo = document.getElementById('abono-motivo').value.trim();
                if (!tieneMaximoDosDecimales(monto) || monto <= 0 || !fecha || !metodo) {
                    Swal.showValidationMessage('Ingresa un monto, fecha y método válidos.');
                    return false;
                }
                return { nuevoPago: { monto, fecha, metodo }, motivo };
            }
        });
        if (resultado.isConfirmed && resultado.value) {
            await ejecutar(movimiento, resultado.value.nuevoPago, resultado.value.motivo);
        }
    };

    const anular = async (movimiento) => {
        const resultado = await Swal.fire({
            title: '¿Anular este abono?',
            text: `Se descontarán ${formatoColones(movimiento.monto)} del pedido y de Caja. El registro original quedará en el historial.`,
            icon: 'warning',
            input: 'text',
            inputLabel: 'Motivo (opcional)',
            inputPlaceholder: 'Ej.: pago registrado dos veces',
            inputAttributes: { maxLength: '200' },
            showCancelButton: true,
            confirmButtonText: 'Anular abono',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc3545'
        });
        if (resultado.isConfirmed) await ejecutar(movimiento, null, resultado.value);
    };

    if (!cargando && !error && movimientos.length === 0 && sinVincular.length === 0) return null;

    return (
        <ListGroup.Item className="pedido-ficha__abonos bg-light py-3">
            <details>
                <summary className="fw-bold text-primary">Abonos registrados ({movimientos.filter((m) => !m.anulado).length + sinVincular.filter((p) => !p.anulado).length})</summary>
                <div className="pedido-ficha__abonos-lista mt-3">
                    {cargando && movimientos.length === 0 && <small className="text-muted">Cargando abonos...</small>}
                    {error && <small className="text-danger">No se pudo consultar Caja. Comprueba tu conexión para editar abonos.</small>}
                    {!saldoConciliado && <small className="text-danger">El total pagado no coincide con el historial. Estos abonos requieren conciliación antes de corregirse.</small>}
                    {movimientos.map((movimiento) => (
                        <div key={movimiento.id} className={`pedido-ficha__abono ${movimiento.anulado ? 'pedido-ficha__abono--anulado' : ''}`}>
                            <div className="pedido-ficha__abono-datos">
                                <span>{movimiento.fecha || 'Sin fecha'} <Badge bg={movimiento.anulado ? 'secondary' : 'light'} text={movimiento.anulado ? undefined : 'dark'}>{movimiento.metodo_pago || 'Pago'}</Badge></span>
                                {movimiento.anulado && <small className="text-muted d-block">Anulado: {movimiento.motivo_anulacion || 'Corrección de registro'}</small>}
                                {!movimiento.anulado && !vinculados.has(movimiento.id) && <small className="text-muted d-block">Sin historial verificable; no se puede corregir aquí.</small>}
                            </div>
                            <strong className={movimiento.anulado ? 'text-muted text-decoration-line-through' : 'text-success'}>{formatoColones(movimiento.monto)}</strong>
                            {!movimiento.anulado && saldoConciliado && vinculados.has(movimiento.id) && !error && (
                                <div className="pedido-ficha__abono-acciones">
                                    <Button size="sm" variant="outline-primary" disabled={procesandoId !== null} onClick={() => editar(movimiento)} aria-label={`Editar abono de ${formatoColones(movimiento.monto)}`}>Editar</Button>
                                    <Button size="sm" variant="outline-danger" disabled={procesandoId !== null} onClick={() => anular(movimiento)} aria-label={`Anular abono de ${formatoColones(movimiento.monto)}`}>Anular</Button>
                                </div>
                            )}
                        </div>
                    ))}
                    {sinVincular.map((pago, indice) => (
                        <div key={`legacy-${indice}`} className={`pedido-ficha__abono ${pago.anulado ? 'pedido-ficha__abono--anulado' : ''}`}>
                            <div className="pedido-ficha__abono-datos">
                                <span>{pago.fecha || 'Sin fecha'} <Badge bg="secondary">{pago.metodo || 'Pago'}</Badge></span>
                                <small className="text-muted d-block">Registro antiguo sin movimiento vinculado</small>
                            </div>
                            <strong className={pago.anulado ? 'text-muted text-decoration-line-through' : 'text-success'}>{formatoColones(pago.monto)}</strong>
                        </div>
                    ))}
                </div>
            </details>
        </ListGroup.Item>
    );
}
