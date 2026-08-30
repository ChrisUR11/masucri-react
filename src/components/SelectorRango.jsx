import { ButtonGroup, Button, Form } from 'react-bootstrap';
import { obtenerFechaLocal, primerDiaMes, ultimoDiaMes, restarDias, primerDiaAnio } from '../utils/fecha';

export const PRESETS = [
    { id: 'mes_actual', label: 'Mes actual' },
    { id: 'mes_anterior', label: 'Mes anterior' },
    { id: 'ultimos_30', label: '30 días' },
    { id: 'este_anio', label: 'Este año' },
    { id: 'personalizado', label: 'Personalizado' }
];

/** Calcula el rango { inicio, fin } (YYYY-MM-DD) para un preset dado. */
export function calcularRangoPreset(presetId) {
    const hoy = new Date();
    switch (presetId) {
        case 'mes_anterior': {
            const base = new Date(hoy);
            base.setMonth(base.getMonth() - 1);
            return { inicio: primerDiaMes(base), fin: ultimoDiaMes(base) };
        }
        case 'ultimos_30':
            return { inicio: restarDias(30), fin: obtenerFechaLocal() };
        case 'este_anio':
            return { inicio: primerDiaAnio(hoy), fin: obtenerFechaLocal() };
        case 'mes_actual':
        default:
            return { inicio: primerDiaMes(hoy), fin: ultimoDiaMes(hoy) };
    }
}

/**
 * Botones de período rápido + rango de fechas personalizado. Por defecto
 * (al montar el Dashboard) siempre queda en "Mes actual" — el mismo
 * comportamiento de siempre — pero desde aquí se puede mirar cualquier
 * otro mes o rango sin tener que esperar a que llegue esa fecha.
 */
export default function SelectorRango({ preset, setPreset, rango, setRango }) {
    return (
        <div className="d-flex flex-wrap gap-2 align-items-center justify-content-center">
            <ButtonGroup size="sm">
                {PRESETS.map((p) => (
                    <Button
                        key={p.id}
                        variant={preset === p.id ? 'dark' : 'outline-dark'}
                        onClick={() => setPreset(p.id)}
                    >
                        {p.label}
                    </Button>
                ))}
            </ButtonGroup>
            {preset === 'personalizado' && (
                <div className="d-flex gap-2 align-items-center">
                    <Form.Control
                        size="sm"
                        type="date"
                        value={rango.inicio}
                        max={rango.fin}
                        onChange={(e) => setRango((r) => ({ ...r, inicio: e.target.value }))}
                        style={{ width: '150px' }}
                        aria-label="Fecha de inicio"
                    />
                    <span className="text-muted small">a</span>
                    <Form.Control
                        size="sm"
                        type="date"
                        value={rango.fin}
                        min={rango.inicio}
                        onChange={(e) => setRango((r) => ({ ...r, fin: e.target.value }))}
                        style={{ width: '150px' }}
                        aria-label="Fecha de fin"
                    />
                </div>
            )}
        </div>
    );
}
