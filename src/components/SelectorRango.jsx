import { ButtonGroup, Button, Form } from 'react-bootstrap';
import { PRESETS } from '../utils/rangoFechas';

/**
 * Botones de período rápido, todo el histórico y rango personalizado.
 * El Dashboard elige el preset inicial y conserva el rango personalizado.
 */
export default function SelectorRango({ preset, setPreset, rango, setRango }) {
    return (
        <div className="d-flex flex-wrap gap-2 align-items-center justify-content-center">
            <ButtonGroup size="sm" className="period-preset-buttons" aria-label="Período del informe">
                {PRESETS.map((p) => (
                    <Button
                        key={p.id}
                        variant={preset === p.id ? 'dark' : 'outline-dark'}
                        aria-pressed={preset === p.id}
                        onClick={() => setPreset(p.id)}
                    >
                        {p.label}
                    </Button>
                ))}
            </ButtonGroup>
            {preset === 'personalizado' && (
                <div className="period-custom-range d-flex gap-2 align-items-center">
                    <Form.Control
                        size="sm"
                        type="date"
                        value={rango.inicio || ''}
                        max={rango.fin || undefined}
                        onChange={(e) => setRango((r) => ({ ...r, inicio: e.target.value }))}
                        style={{ width: '150px' }}
                        aria-label="Fecha de inicio"
                    />
                    <span className="text-muted small">a</span>
                    <Form.Control
                        size="sm"
                        type="date"
                        value={rango.fin || ''}
                        min={rango.inicio || undefined}
                        onChange={(e) => setRango((r) => ({ ...r, fin: e.target.value }))}
                        style={{ width: '150px' }}
                        aria-label="Fecha de fin"
                    />
                </div>
            )}
            {preset === 'personalizado' && !rango.inicio && !rango.fin && (
                <small className="text-muted w-100 text-center">Sin fechas se muestra todo el histórico.</small>
            )}
        </div>
    );
}
