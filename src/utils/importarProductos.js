import { normalizarNombreProducto } from './nombreProducto.ts';

/**
 * Parsea un archivo CSV de productos.
 * Formato esperado: nombre,precio_costo,descripcion,categoria,proveedor,codigo (opcional)
 */
export function parsearCSV(contenido) {
    const lineas = contenido.trim().split('\n');
    if (lineas.length < 2) {
        throw new Error('El archivo está vacío o solo tiene encabezados');
    }

    const encabezados = lineas[0].split(',').map((h) => h.trim().toLowerCase());
    const columnasRequeridas = ['nombre', 'precio_costo', 'categoria', 'proveedor'];

    // Validar que existan las columnas necesarias
    for (const col of columnasRequeridas) {
        if (!encabezados.includes(col)) {
            throw new Error(`Falta la columna requerida: "${col}"`);
        }
    }

    const productos = [];
    for (let i = 1; i < lineas.length; i++) {
        const linea = lineas[i].trim();
        if (!linea) continue; // Saltar líneas vacías

        const valores = linea.split(',').map((v) => v.trim());
        const producto = {};

        encabezados.forEach((col, idx) => {
            producto[col] = valores[idx] || '';
        });

        // Validaciones básicas
        if (!producto.nombre) {
            throw new Error(`Fila ${i + 1}: El nombre es requerido`);
        }
        if (!producto.precio_costo || isNaN(parseFloat(producto.precio_costo))) {
            throw new Error(`Fila ${i + 1}: El precio_costo debe ser un número`);
        }

        // Asegurar que precio_costo sea número
        producto.precio_costo = parseFloat(producto.precio_costo);

        productos.push(producto);
    }

    return productos;
}

/**
 * Compara productos importados con los existentes.
 * Retorna { nuevos: [], existentes: [], duplicados: [] }
 */
export function compararProductos(productosImportados, productosExistentes) {
    const resultado = {
        nuevos: [],
        existentes: [],
        duplicados: []
    };

    const existentesPorNombre = new Map(productosExistentes.map((producto) => [normalizarNombreProducto(producto.nombre), producto]));
    const nuevosPorNombre = new Map();

    productosImportados.forEach((importado) => {
        const clave = normalizarNombreProducto(importado.nombre);
        const existe = existentesPorNombre.get(clave);

        if (existe) {
            resultado.existentes.push({
                importado,
                existente: existe
            });
        } else if (nuevosPorNombre.has(clave)) {
            resultado.duplicados.push({ importado, primero: nuevosPorNombre.get(clave) });
        } else {
            resultado.nuevos.push(importado);
            nuevosPorNombre.set(clave, importado);
        }
    });

    return resultado;
}

/**
 * Descarga un archivo template CSV para que el usuario lo complete.
 */
export function descargarTemplate() {
    const encabezado = 'nombre,precio_costo,descripcion,categoria,proveedor,codigo\n';
    const ejemplos = [
        'Pijama talla 6,15000,Pijama completo de algodón,Pijamas,Ubora,UBR-001',
        'Falda negra,8000,Falda casual,Faldas,Ubora,UBR-002',
        'Blusa blanca,12500,Blusa de manga larga,Blusas,Ubora,UBR-003'
    ].join('\n');

    const contenido = encabezado + ejemplos;
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(blob);
    enlace.download = 'plantilla-productos.csv';
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
}
