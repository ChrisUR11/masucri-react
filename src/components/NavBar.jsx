import { useState } from 'react';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import Swal from 'sweetalert2';
import { Link, useLocation } from 'react-router-dom';

export default function NavBar({ user }) {
    const location = useLocation();
    const [expandido, setExpandido] = useState(false);

    const handleLogout = async () => {
        const result = await Swal.fire({ title: '¿Salir?', icon: 'warning', showCancelButton: true });
        if (result.isConfirmed) signOut(auth);
    };

    const cerrarMenu = () => setExpandido(false);

    return (
        <Navbar
            bg="dark"
            variant="dark"
            expand="lg"
            expanded={expandido}
            onToggle={setExpandido}
            className="app-navbar shadow sticky-top"
            style={{ zIndex: 1035 }}
        >
            <Container>
                <Navbar.Brand as={Link} to="/" className="d-flex align-items-center" onClick={cerrarMenu}>
                    <img src={`${import.meta.env.BASE_URL}logo-masucri.png`} alt="MASUCRI" height="35" className="d-inline-block align-text-top me-2" style={{ objectFit: 'contain' }} />
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" aria-label={expandido ? 'Cerrar navegación' : 'Abrir navegación'} />
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="me-auto" onClick={cerrarMenu}>
                        <Nav.Link as={Link} to="/" active={location.pathname === '/'} aria-current={location.pathname === '/' ? 'page' : undefined}>Pedidos</Nav.Link>
                        <Nav.Link as={Link} to="/historial" active={location.pathname === '/historial'} aria-current={location.pathname === '/historial' ? 'page' : undefined}>Historial</Nav.Link>
                        <Nav.Link as={Link} to="/catalogo" active={location.pathname === '/catalogo'} aria-current={location.pathname === '/catalogo' ? 'page' : undefined}>Catálogo</Nav.Link>
                        <Nav.Link as={Link} to="/finanzas" active={location.pathname === '/finanzas'} aria-current={location.pathname === '/finanzas' ? 'page' : undefined}>Finanzas</Nav.Link>
                        <Nav.Link as={Link} to="/bi" active={location.pathname === '/bi'} aria-current={location.pathname === '/bi' ? 'page' : undefined} className="fw-bold text-warning">BI MASUCRI</Nav.Link>
                        <Nav.Link as={Link} to="/historial-cliente" active={location.pathname === '/historial-cliente'} aria-current={location.pathname === '/historial-cliente' ? 'page' : undefined}>Clientes</Nav.Link>
                    </Nav>
                    <div className="navbar-account d-flex align-items-center gap-2 mt-2 mt-lg-0">
                        <span className="text-white fw-semibold small text-break">Admin: {user.displayName || user.email}</span>
                        <Button variant="outline-danger" size="sm" className="navbar-logout" onClick={handleLogout}>Salir</Button>
                    </div>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
}
