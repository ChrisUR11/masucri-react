import { forwardRef } from 'react';
import { LOGO_TICKET, formatoMontoTicket, prepararDatosTicket } from '../utils/ticketDatos';
import './TicketImpresion.css';

export const TicketImpresion = forwardRef(function TicketImpresion({ pedido, nombreCliente }, ref) {
    if (!pedido) return null;
    const datos = prepararDatosTicket(pedido, nombreCliente);

    return (
        <article ref={ref} className="ticket-impresion ticket-recibo" style={{ width: '80mm', maxWidth: '100%', margin: '0 auto' }}>
            <header className="ticket-recibo-cabecera">
                <img src={LOGO_TICKET} alt="MASUCRI · Confecciones y Sublimaciones" />
                <p>COMPROBANTE DE PEDIDO</p>
            </header>
            <div className="ticket-recibo-meta">
                <span>{datos.referencia ? 'Pedido #' + datos.referencia : 'Pedido'}</span>
                <span>{datos.fecha}</span>
            </div>
            <section className="ticket-recibo-cliente">
                <h2>Cliente</h2>
                <p>{datos.cliente}</p>
            </section>
            <section className="ticket-recibo-producto">
                <h2>Producto</h2>
                <p>{datos.producto}</p>
            </section>
            <dl className="ticket-recibo-totales">
                <div><dt>Total del pedido</dt><dd>{formatoMontoTicket(datos.total)}</dd></div>
                <div><dt>Total abonado</dt><dd>{formatoMontoTicket(datos.pagado)}</dd></div>
            </dl>
            <section className="ticket-recibo-abonos">
                <h2>Abonos registrados</h2>
                {datos.pagos.length ? (
                    <ul>
                        {datos.pagos.map((pago, index) => (
                            <li key={index}>
                                <span>{pago.fecha}<br />{pago.metodo}</span>
                                <strong>{formatoMontoTicket(pago.monto)}</strong>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>{datos.pagado > 0
                        ? 'Hay abonos registrados por ' + formatoMontoTicket(datos.pagado) + '. Sin detalle de fechas.'
                        : 'Aún no se han registrado abonos.'}</p>
                )}
            </section>
            <section className={'ticket-recibo-saldo' + (datos.saldo === 0 ? ' ticket-recibo-pagado' : '')}>
                <h2>Saldo pendiente</h2>
                <p>{formatoMontoTicket(datos.saldo)}</p>
            </section>
            <p className="ticket-recibo-estado">{datos.estadoPago}</p>
            {datos.saldoAFavor > 0 && <p>Saldo a favor: {formatoMontoTicket(datos.saldoAFavor)}</p>}
            <footer className="ticket-recibo-pie">
                <strong>¡Gracias por tu compra!</strong>
                <p>WhatsApp: 8404-6513</p>
            </footer>
        </article>
    );
});
