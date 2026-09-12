/**
 * Sistema de sincronización offline con IndexedDB.
 * Los datos se guardan localmente y se sincronizan con Firebase cuando hay conexión.
 */

const DB_NAME = 'MASUCRI_DB';
const DB_VERSION = 1;
const COLLECTIONS = ['pedidos', 'productos', 'movimientos'];

let db = null;

export async function initOfflineDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const newDb = event.target.result;
            COLLECTIONS.forEach((collection) => {
                if (!newDb.objectStoreNames.contains(collection)) {
                    newDb.createObjectStore(collection, { keyPath: 'id' });
                }
            });
            // Tabla para sincronización pendiente
            if (!newDb.objectStoreNames.contains('_sync_queue')) {
                newDb.createObjectStore('_sync_queue', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

/** Guarda un documento localmente */
export async function saveLocal(collection, data) {
    if (!db) await initOfflineDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(collection, 'readwrite');
        const store = tx.objectStore(collection);
        const request = store.put(data);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(data);
    });
}

/** Obtiene documentos locales de una colección */
export async function getLocal(collection) {
    if (!db) await initOfflineDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(collection, 'readonly');
        const store = tx.objectStore(collection);
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

/** Obtiene un documento local por ID */
export async function getLocalById(collection, id) {
    if (!db) await initOfflineDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(collection, 'readonly');
        const store = tx.objectStore(collection);
        const request = store.get(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

/** Borra un documento local */
export async function deleteLocal(collection, id) {
    if (!db) await initOfflineDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(collection, 'readwrite');
        const store = tx.objectStore(collection);
        const request = store.delete(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

/** Cola un cambio pendiente de sincronización */
export async function queueSync(operation, collection, data) {
    if (!db) await initOfflineDB();
    const syncItem = {
        operation, // 'create', 'update', 'delete'
        collection,
        data,
        timestamp: new Date().toISOString(),
        synced: false
    };
    return new Promise((resolve, reject) => {
        const tx = db.transaction('_sync_queue', 'readwrite');
        const store = tx.objectStore('_sync_queue');
        const request = store.add(syncItem);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

/** Obtiene los cambios pendientes de sincronizar */
export async function getPendingSync() {
    if (!db) await initOfflineDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('_sync_queue', 'readonly');
        const store = tx.objectStore('_sync_queue');
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result.filter((item) => !item.synced));
    });
}

/** Marca un cambio como sincronizado */
export async function markSynced(syncId) {
    if (!db) await initOfflineDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('_sync_queue', 'readwrite');
        const store = tx.objectStore('_sync_queue');
        const request = store.get(syncId);
        request.onsuccess = () => {
            const item = request.result;
            item.synced = true;
            const updateRequest = store.put(item);
            updateRequest.onerror = () => reject(updateRequest.error);
            updateRequest.onsuccess = () => resolve();
        };
        request.onerror = () => reject(request.error);
    });
}

/** Limpia la cola de sincronización */
export async function clearSyncQueue() {
    if (!db) await initOfflineDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('_sync_queue', 'readwrite');
        const store = tx.objectStore('_sync_queue');
        const request = store.clear();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

/** Obtiene el estado de los datos locales */
export async function getOfflineStats() {
    if (!db) await initOfflineDB();
    const stats = {};
    for (const collection of COLLECTIONS) {
        const items = await getLocal(collection);
        stats[collection] = items.length;
    }
    const pending = await getPendingSync();
    stats.pendingSync = pending.length;
    return stats;
}
