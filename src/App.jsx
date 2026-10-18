import { lazy, Suspense, useState, useEffect } from 'react';
import { auth, googleProvider } from './config/firebase';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { Button, Card, Container, Spinner } from 'react-bootstrap';
import Swal from 'sweetalert2';
import NavBar from './components/NavBar';
import BotonSubir from './components/BotonSubir';
import EstadoConexion from './components/EstadoConexion';
import EstadoCarga from './components/EstadoCarga';
import { HashRouter, Link, Routes, Route } from 'react-router-dom';

const Pedidos = lazy(() => import('./pages/Pedidos'));
const Catalogo = lazy(() => import('./pages/Catalogo'));
const Finanzas = lazy(() => import('./pages/Finanzas'));
const Historial = lazy(() => import('./pages/Historial'));
const DashboardBI = lazy(() => import('./pages/DashboardBI'));
const HistorialCliente = lazy(() => import('./pages/HistorialCliente'));

const CORREOS_PERMITIDOS = ["ulloarodriguezchris@gmail.com", "anisrmj5@gmail.com"];

export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

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
        } catch {
            Swal.fire('Error', 'Fallo en login', 'error');
        }
    };

    if (loading) {
        return (
            <>
                <div className="vh-100 d-flex justify-content-center align-items-center" role="status" aria-live="polite">
                    <Spinner animation="border" variant="primary" aria-hidden="true" />
                    <span className="visually-hidden">Verificando sesión...</span>
                </div>
            </>
        );
    }

    if (!user) {
        return (
            <>
                <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light p-3">
                    <Card className="shadow p-4 text-center border-0" style={{ maxWidth: '400px', width: '100%' }}>
                        <img src={`${import.meta.env.BASE_URL}logo-masucri.png`} alt="" className="mx-auto mb-3" style={{ maxHeight: '80px', width: 'auto' }} />
                        <h1 className="h4 fw-bold">MASUCRI</h1>
                        <p className="text-muted">Acceso exclusivo para administradores</p>
                        <Button variant="dark" size="lg" className="w-100 mt-3 shadow-sm" onClick={handleLogin}>
                            Iniciar sesión con Google
                        </Button>
                    </Card>
                </div>
            </>
        );
    }

    return (
        <HashRouter>
            <div className="d-flex flex-column min-vh-100 bg-light">
                <a
                    href="#main-content"
                    className="skip-link btn btn-light shadow-sm"
                    onClick={(event) => {
                        event.preventDefault();
                        document.getElementById('main-content')?.focus();
                    }}
                >
                    Saltar al contenido
                </a>
                <EstadoConexion />
                <NavBar user={user} />

                <main id="main-content" className="app-content" tabIndex={-1}>
                    <Suspense fallback={<EstadoCarga texto="Cargando sección..." />}>
                        <Routes>
                            <Route path="/" element={<Pedidos />} />
                            <Route path="/historial" element={<Historial />} />
                            <Route path="/historial-cliente" element={<HistorialCliente />} />
                            <Route path="/catalogo" element={<Catalogo />} />
                            <Route path="/finanzas" element={<Finanzas />} />
                            <Route path="/bi" element={<DashboardBI />} />

                            <Route path="*" element={
                                <Container className="py-5 text-center">
                                    <h1 className="h3 fw-bold">Página no encontrada</h1>
                                    <p className="text-muted">La sección solicitada no existe.</p>
                                    <Button as={Link} to="/" variant="primary">Volver a Pedidos</Button>
                                </Container>
                            } />
                        </Routes>
                    </Suspense>
                </main>

                <BotonSubir />
            </div>
        </HashRouter>
    );
}
