import { createContext, useContext, useState, useEffect } from 'react';

const ModoOscuroContext = createContext();

export function ModoOscuroProvider({ children }) {
    const [oscuro, setOscuro] = useState(() => {
        // Leer del localStorage la preferencia guardada
        const guardado = localStorage.getItem('masucri_modo_oscuro');
        if (guardado !== null) return JSON.parse(guardado);
        // Si no hay preferencia, usar la preferencia del sistema
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        // Guardar en localStorage
        localStorage.setItem('masucri_modo_oscuro', JSON.stringify(oscuro));

        // Aplicar al documento
        if (oscuro) {
            document.documentElement.setAttribute('data-bs-theme', 'dark');
            document.body.style.backgroundColor = '#212529';
            document.body.style.color = '#ffffff';
        } else {
            document.documentElement.setAttribute('data-bs-theme', 'light');
            document.body.style.backgroundColor = '#ffffff';
            document.body.style.color = '#000000';
        }
    }, [oscuro]);

    const toggle = () => setOscuro(!oscuro);

    return (
        <ModoOscuroContext.Provider value={{ oscuro, toggle }}>
            {children}
        </ModoOscuroContext.Provider>
    );
}

export function useModoOscuro() {
    const context = useContext(ModoOscuroContext);
    if (!context) {
        throw new Error('useModoOscuro debe usarse dentro de ModoOscuroProvider');
    }
    return context;
}
