import { useState, useEffect } from 'react';

/**
 * Devuelve una versión "retrasada" del valor: solo se actualiza cuando el
 * usuario deja de escribir por `delay` ms. El input sigue viéndose instantáneo
 * (se liga al estado real), pero el filtrado pesado espera a que termine de teclear.
 */
export function useDebounce(valor, delay = 300) {
    const [debounced, setDebounced] = useState(valor);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(valor), delay);
        return () => clearTimeout(timer);
    }, [valor, delay]);

    return debounced;
}
