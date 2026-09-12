import { useEffect, useState } from 'react';

const DB_NAME = 'MASUCRI_DB';
const DB_VERSION = 1;

const STORES = {
    PEDIDOS: 'pedidos',
    MOVIMIENTOS: 'movimientos',
    PRODUCTOS: 'productos',
    SYNC_QUEUE: 'sync_queue'
};

let db = null;

function initDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            // Crear stores si no existen
            if (!database.objectStoreNames.contains(STORES.PEDIDOS)) {
                database.createObjectStore(STORES.PEDIDOS, { keyPath: 'id' });
            }
            if (!database.objectStoreNames.contains(STORES.MOVIMIENTOS)) {
                database.createObjectStore(STORES.MOVIMIENTOS, { keyPath: 'id' });
            }
            if (!database.objectStoreNames.contains(STORES.PRODUCTOS)) {
                database.createObjectStore(STORES.PRODUCTOS, { keyPath: 'id' });
            }
            if (!database.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
                database.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

export function useIndexedDB() {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        initDB().then(() => setReady(true)).catch(console.error);
    }, []);

    const guardar = async (storeName, datos) => {
        const database = await initDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(datos);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    };

    const obtener = async (storeName, id) => {
        const database = await initDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(id);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    };

    const obtenerTodos = async (storeName) => {
        const database = await initDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || []);
        });
    };

    const eliminar = async (storeName, id) => {
        const database = await initDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(id);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    };

    const limpiar = async (storeName) => {
        const database = await initDB();
        return new Promise((resolve, reject) => {
            const tx = database.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.clear();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    };

    const encolarSincronizacion = async (tipo, datos) => {
        return guardar(STORES.SYNC_QUEUE, {
            tipo,
            datos,
            timestamp: new Date().toISOString(),
            sincronizado: false
        });
    };

    const obtenerColaSync = async () => {
        return obtenerTodos(STORES.SYNC_QUEUE);
    };

    const marcarSincronizado = async (id) => {
        const item = await obtener(STORES.SYNC_QUEUE, id);
        if (item) {
            item.sincronizado = true;
            await guardar(STORES.SYNC_QUEUE, item);
        }
    };

    return {
        ready,
        guardar,
        obtener,
        obtenerTodos,
        eliminar,
        limpiar,
        encolarSincronizacion,
        obtenerColaSync,
        marcarSincronizado,
        STORES
    };
}
