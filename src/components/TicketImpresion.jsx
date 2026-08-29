import React from 'react';

// Se llama forwardRef para que podamos mandarle la orden de imprimir desde afuera
export const TicketImpresion = React.forwardRef(({ pedido }, ref) => {
    if (!pedido) return null;

    return (
        <div ref={ref} className="ticket-impresion bg-white text-dark p-3" style={{ width: '300px', margin: '0 auto', fontFamily: 'monospace', fontSize: '14px' }}>
            
            <div className="text-center mb-3">
                <img src="./logo-masucri.png" alt="MASUCRI" style={{ maxWidth: '120px' }} />
                <h5 className="fw-bold mt-2 mb-0">MASUCRI</h5>
                <p className="mb-0 small">Confecciones y Sublimaciones</p>
                <p className="mb-0 small">WhatsApp: 8404-6513</p>
            </div>
            
            <div className="border-bottom border-dark mb-2 pb-2" style={{ borderBottomStyle: 'dashed !important' }}>
                <p className="mb-0"><strong>Fecha:</strong> {new Date().toLocaleDateString('es-CR')}</p>
                <p className="mb-0"><strong>Cliente:</strong> {pedido.cliente}</p>
                {pedido.telefono && <p className="mb-0"><strong>Tel:</strong> {pedido.telefono}</p>}
                <p className="mb-0 mt-1"><strong>Ticket #:</strong> {pedido.id?.slice(0,6).toUpperCase()}</p>
            </div>

            <div className="border-bottom border-dark mb-2 pb-2" style={{ borderBottomStyle: 'dashed !important' }}>
                <p className="mb-0 fw-bold text-uppercase">Detalle:</p>
                <p className="mb-0">{pedido.producto}</p>
            </div>

            <div className="mb-3">
                <div className="d-flex justify-content-between">
                    <span>Subtotal:</span>
                    <strong>₡{(pedido.precio || 0).toLocaleString('es-CR')}</strong>
                </div>
                <div className="d-flex justify-content-between text-muted">
                    <span>Abonado:</span>
                    <span>- ₡{(pedido.monto_pagado || 0).toLocaleString('es-CR')}</span>
                </div>
                
                <div className="d-flex justify-content-between fs-5 fw-bold mt-2 border-top border-dark pt-1">
                    <span>SALDO:</span>
                    <span>₡{((pedido.precio || 0) - (pedido.monto_pagado || 0)).toLocaleString('es-CR')}</span>
                </div>
            </div>

            <div className="text-center small mt-4">
                <p className="mb-0 fw-bold">¡Gracias por su preferencia!</p>
                <p className="mb-0 mt-2">Revisar mercadería al retirar.</p>
                <p className="mb-0">No se aceptan devoluciones pasados los 8 días hábiles.</p>
                <p className="fw-bold mt-3">*** MASUCRI ***</p>
            </div>
        </div>
    );
});