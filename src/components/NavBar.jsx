import { useState } from 'react';
import { Navbar, Nav, NavDropdown, Container, Button } from 'react-bootstrap';
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
                    <Nav className="me-auto">
                        <Nav.Link as={Link} to="/" onClick={cerrarMenu} active={location.pathname === '/'} aria-current={location.pathname === '/' ? 'page' : undefined}>Pedidos</Nav.Link>
                        <Nav.Link as={Link} to="/historial" onClick={cerrarMenu} active={location.pathname === '/historial'} aria-current={location.pathname === '/historial' ? 'page' : undefined}>Historial</Nav.Link>
                        <Nav.Link as={Link} to="/catalogo" onClick={cerrarMenu} active={location.pathname === '/catalogo'} aria-current={location.pathname === '/catalogo' ? 'page' : undefined}>Catálogo</Nav.Link>
                        <Nav.Link as={Link} to="/finanzas" onClick={cerrarMenu} active={location.pathname === '/finanzas'} aria-current={location.pathname === '/finanzas' ? 'page' : undefined}>Finanzas</Nav.Link>
                        <NavDropdown
                            title={<span className="fw-bold text-warning">BI MASUCRI</span>}
                            id="bi-masucri-dropdown"
                            active={location.pathname === '/bi' || location.pathname === '/historial-cliente'}
                        >
                            <NavDropdown.Item as={Link} to="/bi" onClick={cerrarMenu} active={location.pathname === '/bi'}>
                                Indicadores
                            </NavDropdown.Item>
                            <NavDropdown.Item as={Link} to="/historial-cliente" onClick={cerrarMenu} active={location.pathname === '/historial-cliente'}>
                                Clientes
                            </NavDropdown.Item>
                        </NavDropdown>
                        <Nav.Link as={Link} to="/asistente" onClick={cerrarMenu} active={location.pathname === '/asistente'} aria-current={location.pathname === '/asistente' ? 'page' : undefined} className={location.pathname === '/asistente' ? 'fw-bold text-warning' : undefined}>
                            <i className="fas fa-wand-magic-sparkles me-1" aria-hidden="true"></i>Asistente
                        </Nav.Link>
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
