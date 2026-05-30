import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, User, Ticket, CreditCard, Banknote, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import Modal from '../components/Modal';

export default function AdventurePOS() {
  const [adventures, setAdventures] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ticketModal, setTicketModal] = useState(null);
  const { showToast } = useToast();
  const { settings } = useSettings();

  const printRef = useRef(null);

  useEffect(() => {
    fetchAdventures();
  }, []);

  const fetchAdventures = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/adventures/items');
      setAdventures(res.data);
    } catch (error) {
      showToast('Failed to load adventures', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const addToCart = (adv) => {
    setCart(prev => {
      const existing = prev.find(item => item.menu_item_id === adv.id);
      if (existing) {
        return prev.map(item => item.menu_item_id === adv.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { menu_item_id: adv.id, name: adv.name, price: adv.price, quantity: 1 }];
    });
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.menu_item_id === id) {
          const newQ = item.quantity + delta;
          return newQ > 0 ? { ...item, quantity: newQ } : null;
        }
        return item;
      }).filter(Boolean);
    });
  };

  // ... (use existing cart management logic)
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const taxRate = settings?.tax_rate ? parseFloat(settings.tax_rate) : 0;
  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = taxableAmount * (taxRate / 100);
  const total = taxableAmount + tax;

  const handleCheckout = async () => {
    if (cart.length === 0) return showToast('Cart is empty', 'warning');
    
    try {
      setIsProcessing(true);
      const res = await api.post('/adventures/sell', {
        items: cart,
        payment_method: paymentMethod,
        customer_name: customerName,
        subtotal,
        discount,
        tax,
        total
      });
      
      showToast('Payment successful!', 'success');
      setCart([]);
      setCustomerName('');
      
      // Open the ticket printing modal
      setTicketModal(res.data.tickets);

    } catch (error) {
      showToast('Failed to process payment', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printContent = printRef.current.innerHTML;
    
    // Use a hidden iframe to bypass Chrome's default header/footer margins
    let iframe = document.getElementById('ticket-print-frame');
    if (iframe) iframe.remove();
    iframe = document.createElement('iframe');
    iframe.id = 'ticket-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
<style>
@page { margin: 0; padding: 0; }
html, body { 
  font-family: Arial, Helvetica, sans-serif; 
  margin: 0 !important; 
  padding: 0 !important;
  width: 80mm;
  text-align: center; 
  color: #000;
  font-weight: 900;
}
* { font-weight: 900 !important; margin: 0; padding: 0; box-sizing: border-box; }
.ticket { 
  padding: 2px 8px 8px 8px; 
  page-break-after: always; 
}
.ticket-price { font-size: 18px; margin: 2px 0; }
.qr-container { margin: 0; display: flex; justify-content: flex-end; }
.ticket-footer { font-size: 14px; margin-top: 2px; }
.disclaimer { 
  font-size: 12px; 
  margin-top: 5px; 
  text-align: justify; 
  line-height: 1.1;
}
</style>
</head>
<body>${printContent}</body>
</html>`);
    doc.close();
    
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => iframe.remove(), 1000);
      }, 200);
    };
  };

  if (isLoading) return <div className="p-lg">Loading adventures...</div>;

  return (
    <div className="p-lg animate-fade-in flex gap-lg" style={{ height: 'calc(100vh - 60px)' }}>
      {/* Left side: Adventures Grid */}
      <div className="flex-2 flex flex-col">
        <h2 className="text-xl font-bold mb-md">Sell Adventures</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', overflowY: 'auto' }}>
          {adventures.map(adv => (
            <div 
              key={adv.id} 
              className="card cursor-pointer hover-lift"
              onClick={() => addToCart(adv)}
              style={{ border: '2px solid transparent' }}
            >
              <div className="card-body text-center">
                <div className="flex-center mb-sm">
                  <div style={{ width: 60, height: 60, borderRadius: '50%', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Ticket size={32} className="text-primary" />
                  </div>
                </div>
                <h4 className="font-bold">{adv.name}</h4>
                <p className="text-primary font-bold mt-xs">रू {Number(adv.price).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right side: Cart */}
      <div className="flex-1 card flex flex-col" style={{ minWidth: 350 }}>
        <div className="card-header border-bottom">
          <h3 className="flex align-center gap-sm">
            <ShoppingCart size={20} /> Checkout
          </h3>
        </div>
        <div className="card-body flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex-center h-full text-secondary">Cart is empty</div>
          ) : (
            <div className="flex flex-col gap-sm">
              {cart.map(item => (
                <div key={item.menu_item_id} className="flex justify-between align-center p-sm" style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-secondary" style={{ fontSize: 13 }}>रू {item.price} x {item.quantity}</div>
                  </div>
                  <div className="flex align-center gap-sm">
                    <button className="btn btn-icon btn-sm" onClick={() => updateQuantity(item.menu_item_id, -1)}>-</button>
                    <span style={{ width: 20, textAlign: 'center' }}>{item.quantity}</span>
                    <button className="btn btn-icon btn-sm" onClick={() => updateQuantity(item.menu_item_id, 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="card-body border-top" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="form-group mb-md">
            <div className="flex align-center gap-sm mb-xs">
              <User size={16} /> <label className="form-label mb-0">Customer Name (Optional)</label>
            </div>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. John Doe"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
            />
          </div>

          <div className="flex justify-between mb-sm text-secondary">
            <span>Subtotal</span>
            <span>रू {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between mb-sm text-secondary">
            <span>Discount</span>
            <input 
              type="number" 
              className="form-input" 
              style={{ width: '100px', padding: '4px', textAlign: 'right' }}
              value={discount || ''}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <div className="flex justify-between mb-md text-secondary">
            <span>Tax ({taxRate}%)</span>
            <span>रू {tax.toLocaleString()}</span>
          </div>
          <div className="flex justify-between mb-lg font-bold text-lg">
            <span>Total</span>
            <span>रू {total.toLocaleString()}</span>
          </div>

          <div className="grid grid-cols-2 gap-sm mb-md">
            <button 
              className={`btn ${paymentMethod === 'cash' ? 'btn-primary' : 'btn-secondary'} flex-center gap-xs`}
              onClick={() => setPaymentMethod('cash')}
            >
              <Banknote size={18} /> Cash
            </button>
            <button 
              className={`btn ${paymentMethod === 'card' ? 'btn-primary' : 'btn-secondary'} flex-center gap-xs`}
              onClick={() => setPaymentMethod('card')}
            >
              <CreditCard size={18} /> Card / QR
            </button>
          </div>

          <button 
            className="btn btn-primary w-full py-md" 
            style={{ fontSize: 16 }}
            disabled={cart.length === 0 || isProcessing}
            onClick={handleCheckout}
          >
            {isProcessing ? 'Processing...' : `Pay रू ${total.toLocaleString()}`}
          </button>
        </div>
      </div>

      {/* Ticket Print Modal */}
      {ticketModal && (
        <Modal isOpen={true} onClose={() => setTicketModal(null)} title="Print Tickets" maxWidth="500px">
          <div className="flex flex-col gap-md">
            <div className="alert alert-success">
              Successfully generated {ticketModal.length} tickets.
            </div>
            
            <div 
              className="bg-white p-md" 
              style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}
            >
              <div ref={printRef}>
                {ticketModal.map((ticket, index) => (
                  <div key={ticket.id} className="ticket">
                    <div style={{ textAlign: 'center', marginBottom: 8, borderBottom: '3px solid black', paddingBottom: 8 }}>
                      <svg width="120" height="120" viewBox="0 0 200 200" style={{ display: 'block', margin: '0 auto' }}>
                        <defs>
                          <clipPath id={`clip-${ticket.id}`}>
                            <circle cx="100" cy="100" r="95" />
                          </clipPath>
                        </defs>
                        <g clipPath={`url(#clip-${ticket.id})`}>
                          {/* Sky - upper dome shape with organic wavy bottom edge */}
                          <path d="M 0,0 L 200,0 L 200,110 
                            C 180,100 170,95 155,105 
                            C 140,115 130,100 120,95 
                            C 110,90 100,92 90,100 
                            C 80,108 70,115 60,108 
                            C 50,100 40,95 30,100 
                            C 20,105 10,110 0,108 Z" fill="#000" />
                          
                          {/* Sun circle - nestled in the valley */}
                          <circle cx="138" cy="105" r="14" fill="#000" />
                          
                          {/* Left organic figure - larger abstract human/mountain shape */}
                          <path d="M 5,130 
                            C 10,115 25,100 40,105 
                            C 55,110 60,100 65,108 
                            C 70,116 78,120 85,118 
                            C 92,116 95,125 90,135 
                            C 85,145 80,155 75,165
                            C 70,175 55,185 40,195 
                            L 5,200 Z" fill="#000" />
                          
                          {/* Small white dot in left figure */}
                          <circle cx="55" cy="128" r="5" fill="#fff" />
                          
                          {/* Right organic figure - smaller abstract shape */}
                          <path d="M 120,140 
                            C 130,125 145,118 160,125 
                            C 175,132 185,140 188,155 
                            C 190,165 185,180 175,190 
                            L 140,200 L 105,200 
                            C 108,185 112,170 115,155 
                            C 117,148 118,144 120,140 Z" fill="#000" />
                          
                          {/* Small white dot in right figure */}
                          <circle cx="152" cy="148" r="4.5" fill="#fff" />
                        </g>
                        {/* Circle outline for clean edge */}
                        <circle cx="100" cy="100" r="95" fill="none" stroke="#000" strokeWidth="5" />
                      </svg>
                      <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '3px', marginTop: 8, lineHeight: 1 }}>ADVENTURE</div>
                      <div style={{ fontSize: 16, letterSpacing: '5px', fontWeight: 'bold', marginTop: 2 }}>PASS</div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '2px solid #000', paddingBottom: 5 }}>
                      <div style={{ flex: 1, textAlign: 'left', paddingRight: 5 }}>
                        <div style={{ fontSize: 22, lineHeight: 1.1, marginBottom: 5 }}>{ticket.item_name}</div>
                        <div className="ticket-price">RS. {ticket.price}</div>
                        <div className="ticket-footer" style={{ textAlign: 'left' }}>
                          <div>TKT #{ticket.id.toString().padStart(6, '0')}</div>
                          <div>{new Date(ticket.purchased_at).toLocaleDateString()}</div>
                          <div>{new Date(ticket.purchased_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        </div>
                      </div>
                      
                      <div className="qr-container" style={{ flexShrink: 0 }}>
                        <QRCodeSVG 
                          value={ticket.ticket_code} 
                          size={110} 
                          level="M" 
                          includeMargin={true} 
                        />
                      </div>
                    </div>
                    
                    <div style={{ fontSize: 12, fontWeight: 'bold', marginTop: 10, textAlign: 'center' }}>Terms and Conditions</div>
                    <div className="disclaimer">
                      By purchasing this ticket, I acknowledge that I accept all risks involved and agree to follow all health, safety, and conduct requirements. I understand the refund and cancellation policies and waive liability and responsibility for any damages or injuries that may occur. I release and hold harmless the organizers, staff, and affiliates from any claims or demands that may arise from participation.
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-md mt-sm">
              <button className="btn btn-secondary" onClick={() => setTicketModal(null)}>Close</button>
              <button className="btn btn-primary flex align-center gap-sm" onClick={handlePrint}>
                <Printer size={18} /> Print All Tickets
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
