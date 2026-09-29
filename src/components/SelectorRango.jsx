import { ButtonGroup, Button, Form } from 'react-bootstrap';
import { PRESETS } from '../utils/rangoFechas';

/**
 * Botones de período rápido + rango de fechas personalizado. Por defecto
 * (al montar el Dashboard) siempre queda en "Mes actual" — el mismo
 * comportamiento de siempre — pero desde aquí se puede mirar cualquier
 * otro mes o rango sin tener que esperar a que llegue esa fecha.
 */
export default function SelectorRango({ preset, setPreset, rango, setRango }) {
    return (
        <div className="d-flex flex-wrap gap-2 align-items-center justify-content-center">
            <ButtonGroup size="sm" className="period-preset-buttons">
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
                <div className="period-custom-range d-flex gap-2 align-items-center">
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
