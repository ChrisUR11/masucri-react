import { useState, useEffect } from 'react';
import { auth, googleProvider } from './config/firebase';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { Button, Card, Container, Spinner } from 'react-bootstrap';
import Swal from 'sweetalert2';
import NavBar from './components/NavBar';
import ActualizacionPWA from './components/ActualizacionPWA';
import BotonSubir from './components/BotonSubir';
import EstadoConexion from './components/EstadoConexion';
import { HashRouter, Routes, Route } from "react-router-dom";

// Importamos nuestras páginas
import Pedidos from './pages/Pedidos';
import Catalogo from './pages/Catalogo';
import Finanzas from './pages/Finanzas';
import Historial from './pages/Historial';
import DashboardBI from './pages/DashboardBI';

export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const CORREOS_PERMITIDOS = ["ulloarodriguezchris@gmail.com", "anisrmj5@gmail.com"];

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser && CORREOS_PERMITIDOS.includes(currentUser.email)) {
                setUser(currentUser);
            } else {
                if (currentUser) {
                    auth.signOut();
                    Swal.fire({ icon: 'error', title: 'Acceso Denegado' });
                }
                setUser(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            Swal.fire('Error', 'Fallo en login', 'error');
        }
    };

    if (loading) {
        return (
            <>
                <div className="vh-100 d-flex justify-content-center align-items-center"><Spinner animation="border" variant="primary" /></div>
                <ActualizacionPWA />
            </>
        );
    }

    if (!user) {
        return (
            <>
                <div className="vh-100 d-flex align-items-center justify-content-center bg-light">
                    <Card className="shadow p-4 text-center border-0" style={{ maxWidth: '400px', width: '100%' }}>
                        <img src="/logo-masucri.png" alt="MASUCRI Logo" className="mx-auto mb-3" style={{ maxHeight: '80px', width: 'auto' }} />
                        <p className="text-muted">Acceso exclusivo para administradores</p>
                        <Button variant="dark" size="lg" className="w-100 mt-3 shadow-sm" onClick={handleLogin}>
                            Iniciar sesión con Google
                        </Button>
                    </Card>
                </div>
                <ActualizacionPWA />
            </>
        );
    }

    return (
        <HashRouter>
            <div className="d-flex flex-column min-vh-100 bg-light">
                <EstadoConexion />
                <NavBar user={user} />

                {/* Aquí ocurre la magia: dependiendo de la URL, React inyecta una página distinta */}
                <Routes>
                    <Route path="/" element={<Pedidos />} />
                    <Route path="/historial" element={<Historial />} />
                    <Route path="/catalogo" element={<Catalogo />} />
                    <Route path="/finanzas" element={<Finanzas />} />
                    <Route path="/bi" element={<DashboardBI />} />

                    {/* El asterisco (*) atrapa cualquier ruta que aún no hayamos creado */}
                    <Route path="*" element={
                        <Container className="mt-4">
                            <h3 className="text-muted">Módulo en construcción... 🛠️</h3>
                        </Container>
                    } />
                </Routes>

                <BotonSubir />
                <ActualizacionPWA />
            </div>
        </HashRouter>
    );
}