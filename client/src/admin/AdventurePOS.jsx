import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, User, Ticket, CreditCard, Banknote, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import Modal from '../components/Modal';

export default function AdventurePOS() {
  const [adventures, setAdventures] = useState([]);
  const [stats, setStats] = useState({});
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
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get('/adventures/stats');
      setStats(res.data);
    } catch (e) {
      console.error('Failed to load stats', e);
    }
  };

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
      fetchStats();
      
      // Open the ticket printing modal
      setTicketModal(res.data.tickets);

    } catch (error) {
      showToast('Failed to process payment', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = () => {
    // Barebones print: No exact height calculations, no iframes, no @page hacks.
    // Just the raw window.print() command.
    window.print();
  };

  if (isLoading) return <div className="p-lg">Loading adventures...</div>;

  return (
    <div className="p-lg animate-fade-in flex gap-lg" style={{ height: 'calc(100vh - 60px)' }}>
      {/* Left side: Adventures Grid */}
      <div className="flex-2 flex flex-col">
        <h2 className="text-xl font-bold mb-md">Sell Adventures</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px', overflowY: 'auto', paddingRight: '10px', paddingBottom: '20px' }}>
          {adventures.map(adv => (
            <div 
              key={adv.id} 
              className="card cursor-pointer hover-lift"
              onClick={() => addToCart(adv)}
              style={{ border: '1px solid var(--glass-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'all 0.2s ease', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}
            >
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--bg-secondary)', position: 'relative', flex: 1 }}>
                 <div style={{ width: 64, height: 64, borderRadius: '16px', backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
                    <Ticket size={32} className="text-primary" />
                 </div>
                 <h4 className="font-bold text-center" style={{ fontSize: '18px', lineHeight: 1.2 }}>{adv.name}</h4>
                 <p className="text-primary font-bold mt-sm" style={{ fontSize: '16px', backgroundColor: 'var(--primary-light)', padding: '4px 12px', borderRadius: '20px', color: 'var(--primary)' }}>रू {Number(adv.price).toLocaleString()}</p>
              </div>
              
              {/* Stats Footer */}
              <div style={{ padding: '12px 16px', background: 'var(--bg-card)', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
                 <div className="flex flex-col align-center">
                   <span className="text-secondary" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sold</span>
                   <span className="text-primary" style={{ fontSize: '14px' }}>{stats[adv.id]?.sold || 0}</span>
                 </div>
                 <div className="flex flex-col align-center">
                   <span className="text-secondary" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Used</span>
                   <span className="text-success" style={{ fontSize: '14px' }}>{stats[adv.id]?.used || 0}</span>
                 </div>
                 <div className="flex flex-col align-center">
                   <span className="text-secondary" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unused</span>
                   <span className="text-warning" style={{ fontSize: '14px' }}>{stats[adv.id]?.unused || 0}</span>
                 </div>
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
          <div className="flex flex-col gap-md p-md">
            <div className="flex justify-center mb-md no-print">
              <div className="text-center">
                <h3 className="m-0">Ready to Print</h3>
                <p className="text-muted m-0">{ticketModal.length} tickets generated</p>
              </div>
            </div>

            <div style={{ background: '#fff', color: '#000', padding: '10px', maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border-color)' }} id="barebones-print-container">
              <div ref={printRef}>
                {ticketModal.map((ticket, index) => (
                  <div key={ticket.id} className="ticket" style={{ pageBreakAfter: index === ticketModal.length - 1 ? 'auto' : 'always', marginBottom: index === ticketModal.length - 1 ? '0px' : '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, borderBottom: '3px solid black', paddingBottom: 8, gap: 10 }}>
                      <img src="/adventure-logo.svg" alt="Adventure Pass" style={{ width: 80, height: 80, flexShrink: 0 }} />
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, letterSpacing: '1px' }}>Happy Hills</div>
                        <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.1, marginTop: 4, letterSpacing: '2px' }}>Adventure</div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '2px solid #000', paddingBottom: 5 }}>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontSize: 22, lineHeight: 1.1, marginBottom: 5 }}>{ticket.item_name}</div>
                        <div className="ticket-price">RS. {ticket.price}</div>
                        {ticket.customer_name && ticket.customer_name !== 'Guest' && (
                          <div style={{ fontSize: 13, fontWeight: 'bold', marginTop: 5, borderTop: '1px dashed #000', paddingTop: 3 }}>
                            Name: {ticket.customer_name}
                          </div>
                        )}
                        <div className="ticket-footer" style={{ textAlign: 'left', marginTop: 5 }}>
                          <div>TKT #{ticket.id.toString().padStart(6, '0')}</div>
                          <div>{new Date(ticket.purchased_at).toLocaleDateString()}</div>
                          <div>{new Date(ticket.purchased_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        </div>
                      </div>
                      
                      <div className="qr-container" style={{ flexShrink: 0 }}>
                        <QRCodeSVG 
                          value={ticket.ticket_code} 
                          size={135} 
                          level="M" 
                          includeMargin={true} 
                        />
                      </div>
                    </div>
                    
                    <div style={{ fontSize: 13, fontWeight: 'bold', marginTop: 10, textAlign: 'center' }}>✦ TERMS & CONDITIONS ✦</div>
                    <div className="disclaimer" style={{ fontSize: '12px', marginTop: '5px', textAlign: 'justify', lineHeight: '1.1' }}>
                      By purchasing this ticket, I acknowledge that I accept all risks involved and agree to follow all health, safety, and conduct requirements. I understand the refund and cancellation policies and waive liability and responsibility for any damages or injuries that may occur. I release and hold harmless the organizers, staff, and affiliates from any claims or demands that may arise from participation.
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-md mt-sm no-print">
              <button className="btn btn-secondary" onClick={() => setTicketModal(null)}>Close</button>
              <button className="btn btn-primary flex align-center gap-sm" onClick={handlePrint}>
                <Printer size={18} /> Print All Tickets
              </button>
            </div>
          </div>
        </Modal>
      )}

      <style>{`
        @media print {
          @page {
            margin: 0;
          }

          /* Force white background for the whole page */
          html, body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }

          /* Hide everything in the body by default */
          body * {
            visibility: hidden;
          }
          
          /* Only show the barebones print container */
          #barebones-print-container, #barebones-print-container * {
            visibility: visible;
            font-weight: 900 !important;
            font-family: Arial, Helvetica, sans-serif !important;
          }
          
          /* Position it absolutely so it starts at the true top-left of the paper */
          #barebones-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0 !important;
            /* Allow the 10px inline padding to apply so content (like the logo) isn't cut off at the edges */
            border: none !important;
            max-height: none !important;
            overflow: visible !important;
            background-color: #ffffff !important;
          }
          
          /* Don't print the close/print buttons */
          .no-print {
            display: none !important;
          }
          
          /* Thermal printers are 1-bit monochrome. They ruin colored SVGs with dithering.
             This filter forces pure black and white (1-bit monochrome) to prevent muddy printing. */
          #barebones-print-container img[src="/adventure-logo.svg"] {
            filter: grayscale(100%) brightness(65%) contrast(1000%);
          }
        }
      `}</style>
    </div>
  );
}
