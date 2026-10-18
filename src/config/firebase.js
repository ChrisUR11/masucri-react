import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

// Tus llaves de MASUCRI
const firebaseConfig = {
    apiKey: "AIzaSyD_p1cLfHMoSugrfPrCJPuHJKEMIH7AvV8",
    authDomain: "masucri-65fed.firebaseapp.com",
    projectId: "masucri-65fed",
    storageBucket: "masucri-65fed.firebasestorage.app",
    messagingSenderId: "822954372342",
    appId: "1:822954372342:web:58f8d9b6181c66ce4190d7"
};

// Inicializamos Firebase
const app = initializeApp(firebaseConfig);

// Exportamos las herramientas para usarlas en otras partes de React
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
// El caché persistente permite leer datos ya consultados y enviar escrituras
// pendientes al recuperar la conexión. Compartirlo entre pestañas evita que
// abrir una segunda ventana desactive la persistencia de Firestore.
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
