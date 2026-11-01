import { doc, setDoc } from 'firebase/firestore';
import { idDocumentoProducto, limpiarNombreProducto } from '../utils/nombreProducto.ts';

/** Crea una ficha nueva con ID estable; campos vacíos no pisan otra alta simultánea. */
export async function crearProductoCatalogo(db, producto) {
    const nombre = limpiarNombreProducto(producto.nombre);
    const id = await idDocumentoProducto(nombre);
    const datos = { nombre };

    for (const [campo, valor] of Object.entries(producto)) {
        if (campo !== 'id' && campo !== 'nombre' && valor !== '' && valor != null && !(campo === 'cantidad' && valor === 0)) {
            datos[campo] = valor;
        }
    }

    await setDoc(doc(db, 'productos', id), datos, { merge: true });
    return id;
}
