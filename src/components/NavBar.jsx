import { useState } from 'react';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import Swal from 'sweetalert2';
import { Link, useLocation } from 'react-router-dom';

export default function NavBar({ user }) {
    const location = useLocation(); // Hook de React para saber en qué URL estamos
    // Controlamos el menú a mano para poder cerrarlo al elegir una opción en móvil
    // (antes se quedaba abierto tapando la pantalla hasta que tocabas el ícono de nuevo).
    const [expandido, setExpandido] = useState(false);

    const handleLogout = async () => {
        const result = await Swal.fire({ title: '¿Salir?', icon: 'warning', showCancelButton: true });
        if (result.isConfirmed) signOut(auth);
    };

    const cerrarMenu = () => setExpandido(false);

    return (
        <Navbar bg="dark" variant="dark" expand="lg" expanded={expandido} onToggle={setExpandido} className="mb-4 shadow sticky-top">
            <Container>
                <Navbar.Brand as={Link} to="/" className="d-flex align-items-center" onClick={cerrarMenu}>
                    <img src="./logo-masucri.png" alt="MASUCRI" height="35" className="d-inline-block align-text-top me-2" style={{ objectFit: 'contain' }} />
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    {/* Al hacer clic en cualquier link dentro de este <Nav>, se cierra el menú. */}
                    <Nav className="me-auto" onClick={cerrarMenu}>
                        {/* as={Link} le dice a Bootstrap que actúe como un enrutador de React */}
                        <Nav.Link as={Link} to="/" active={location.pathname === '/'}>Pedidos</Nav.Link>
                        <Nav.Link as={Link} to="/historial" active={location.pathname === '/historial'}>Historial</Nav.Link>
                        <Nav.Link as={Link} to="/catalogo" active={location.pathname === '/catalogo'}>Catálogo</Nav.Link>
                        <Nav.Link as={Link} to="/finanzas" active={location.pathname === '/finanzas'}>Finanzas</Nav.Link>
                        <Nav.Link as={Link} to="/bi" active={location.pathname === '/bi'} className="fw-bold text-warning">BI MASUCRI</Nav.Link>
                    </Nav>
                    <div className="d-flex align-items-center mt-2 mt-lg-0">
                        <span className="text-white me-3 fw-semibold small">Admin: {user.displayName}</span>
                        <Button variant="outline-danger" size="sm" onClick={handleLogout}>Salir</Button>
                    </div>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
}