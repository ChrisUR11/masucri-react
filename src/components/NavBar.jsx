import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import Swal from 'sweetalert2';
import { Link, useLocation } from 'react-router-dom';

export default function NavBar({ user }) {
    const location = useLocation(); // Hook de React para saber en qué URL estamos

    const handleLogout = async () => {
        const result = await Swal.fire({ title: '¿Salir?', icon: 'warning', showCancelButton: true });
        if (result.isConfirmed) signOut(auth);
    };

    return (
        <Navbar bg="dark" variant="dark" expand="lg" className="mb-4 shadow sticky-top">
            <Container>
                <Navbar.Brand as={Link} to="/" className="d-flex align-items-center">
                    <img src="./logo-masucri.png" alt="MASUCRI" height="35" className="d-inline-block align-text-top me-2" style={{ objectFit: 'contain' }} />
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                    <Nav className="me-auto">
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