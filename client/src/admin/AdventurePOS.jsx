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
  const [paymentAmounts, setPaymentAmounts] = useState({ cash: '', online: '' });
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
    
    const cashAmt = parseFloat(paymentAmounts.cash) || 0;
    const onlineAmt = parseFloat(paymentAmounts.online) || 0;
    const currentSum = cashAmt + onlineAmt;
    if (Math.abs(currentSum - total) > 0.01) {
      return showToast(`Payment sum (रू ${currentSum}) must match the total (रू ${total}).`, 'warning');
    }

    try {
      setIsProcessing(true);
      const res = await api.post('/adventures/sell', {
        items: cart,
        payments: [
          { method: 'cash', amount: cashAmt },
          { method: 'online', amount: onlineAmt }
        ],
        customer_name: customerName,
        subtotal,
        discount,
        tax,
        total
      });
      
      showToast('Payment successful!', 'success');
      setCart([]);
      setCustomerName('');
      setPaymentAmounts({ cash: '', online: '' });
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
    <div className="p-lg animate-fade-in flex gap-xl" style={{ height: 'calc(100vh - 60px)' }}>
      {/* Left side: Adventures Grid */}
      <div className="flex-2 flex flex-col">
        <div className="flex justify-between align-center mb-lg">
          <div>
            <h2 className="text-2xl font-bold m-0" style={{ letterSpacing: '-0.5px' }}>Adventure Passes</h2>
            <p className="text-secondary m-0 mt-xs">Select passes to add to the customer's cart.</p>
          </div>
        </div>
        
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '24px', overflowY: 'auto', paddingRight: '12px', paddingBottom: '24px' }}>
          {adventures.map(adv => (
            <div 
              key={adv.id} 
              className="card cursor-pointer"
              onClick={() => addToCart(adv)}
              style={{ 
                border: '1px solid var(--glass-border)', 
                borderRadius: '24px',
                overflow: 'hidden', 
                display: 'flex', 
                flexDirection: 'column', 
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
                boxShadow: '0 12px 32px rgba(0,0,0,0.06)',
                background: 'var(--bg-card)',
                transform: 'translateY(0)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.boxShadow = '0 24px 48px rgba(0,0,0,0.12)';
                e.currentTarget.style.borderColor = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.06)';
                e.currentTarget.style.borderColor = 'var(--glass-border)';
              }}
            >
              <div style={{ padding: '36px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', flex: 1 }}>
                 <div style={{ 
                   width: 80, height: 80, 
                   borderRadius: '50%', 
                   background: 'linear-gradient(135deg, var(--primary-light), var(--bg-card))',
                   display: 'flex', alignItems: 'center', justifyContent: 'center', 
                   boxShadow: '0 8px 24px rgba(0,0,0,0.08)', 
                   marginBottom: '24px' 
                 }}>
                    <Ticket size={40} style={{ color: 'var(--primary)' }} />
                 </div>
                 <h4 style={{ fontSize: '22px', fontWeight: 800, lineHeight: 1.2, marginBottom: '16px', textAlign: 'center', letterSpacing: '-0.5px' }}>{adv.name}</h4>
                 <div style={{
                   fontSize: '18px', 
                   fontWeight: 800,
                   color: 'var(--primary)',
                   padding: '6px 20px', 
                   borderRadius: '30px', 
                   backgroundColor: 'var(--primary-light)',
                   border: '1px solid rgba(255,255,255,0.1)'
                 }}>
                   रू {Number(adv.price).toLocaleString()}
                 </div>
              </div>
              
              {/* Stats Footer */}
              <div style={{ 
                padding: '16px', 
                background: 'var(--bg-secondary)', 
                borderTop: '1px solid var(--glass-border)', 
                display: 'flex', 
                justifyContent: 'space-around', 
                alignItems: 'center'
              }}>
                 <div className="flex flex-col align-center" style={{ flex: 1 }}>
                   <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>Sold</span>
                   <span style={{ fontSize: '16px', fontWeight: 800 }}>{stats[adv.id]?.sold || 0}</span>
                 </div>
                 <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--glass-border)' }}></div>
                 <div className="flex flex-col align-center" style={{ flex: 1 }}>
                   <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>Used</span>
                   <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--success)' }}>{stats[adv.id]?.used || 0}</span>
                 </div>
                 <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--glass-border)' }}></div>
                 <div className="flex flex-col align-center" style={{ flex: 1 }}>
                   <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>Left</span>
                   <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--warning)' }}>{stats[adv.id]?.unused || 0}</span>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right side: Cart */}
      <div className="card flex flex-col" style={{ flex: '0 0 420px', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', border: '1px solid var(--glass-border)' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--glass-border)' }}>
          <h3 className="flex align-center gap-sm m-0" style={{ fontSize: '20px', fontWeight: 800 }}>
            <ShoppingCart size={24} style={{ color: 'var(--primary)' }} /> Order Summary
          </h3>
        </div>
        
        <div className="card-body flex-1 overflow-y-auto" style={{ padding: '24px' }}>
          {cart.length === 0 ? (
            <div className="flex-center h-full flex-col text-secondary opacity-50" style={{ gap: '16px' }}>
              <ShoppingCart size={64} />
              <div style={{ fontSize: '18px', fontWeight: 600 }}>Cart is empty</div>
              <div style={{ fontSize: '14px' }}>Add adventures from the left to begin.</div>
            </div>
          ) : (
            <div className="flex flex-col gap-md">
              {cart.map(item => (
                <div key={item.menu_item_id} className="flex justify-between align-center" style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', padding: '16px', border: '1px solid var(--glass-border)' }}>
                  <div>
                    <div className="font-bold" style={{ fontSize: '16px', marginBottom: '4px' }}>{item.name}</div>
                    <div className="text-primary font-bold" style={{ fontSize: 14 }}>रू {item.price}</div>
                  </div>
                  <div className="flex align-center gap-md" style={{ background: 'var(--bg-card)', padding: '6px', borderRadius: '30px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <button className="btn btn-icon" style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-secondary)' }} onClick={() => updateQuantity(item.menu_item_id, -1)}>-</button>
                    <span style={{ width: 24, textAlign: 'center', fontWeight: 800 }}>{item.quantity}</span>
                    <button className="btn btn-icon" style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', color: '#fff' }} onClick={() => updateQuantity(item.menu_item_id, 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '24px', borderTop: '1px solid var(--glass-border)', borderBottomLeftRadius: '24px', borderBottomRightRadius: '24px' }}>
          <div className="form-group mb-lg">
            <div className="flex align-center gap-sm mb-sm text-secondary font-bold" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              <User size={14} /> Customer Details
            </div>
            <input 
              type="text" 
              className="form-input" 
              style={{ borderRadius: '12px', padding: '12px 16px', border: '1px solid var(--glass-border)' }}
              placeholder="Enter customer name (optional)"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
            />
          </div>

          <div className="flex justify-between mb-sm text-secondary font-medium">
            <span>Subtotal</span>
            <span>रू {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between mb-sm text-secondary font-medium align-center">
            <span>Discount Amount</span>
            <input 
              type="number" 
              className="form-input" 
              style={{ width: '100px', padding: '6px 12px', textAlign: 'right', borderRadius: '8px', border: '1px solid var(--glass-border)' }}
              value={discount || ''}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <div className="flex justify-between mb-lg text-secondary font-medium">
            <span>Tax ({taxRate}%)</span>
            <span>रू {tax.toLocaleString()}</span>
          </div>
          
          <div className="flex justify-between align-center mb-xl" style={{ borderTop: '2px dashed var(--glass-border)', paddingTop: '16px' }}>
            <span className="font-bold" style={{ fontSize: '18px' }}>Total Amount</span>
            <span style={{ fontSize: '28px', fontWeight: 900, color: 'var(--primary)' }}>रू {total.toLocaleString()}</span>
          </div>

          <div className="flex-col gap-sm mb-lg">
            <div className="flex justify-between align-center mb-sm text-secondary font-bold" style={{ fontSize: '14px' }}>
              <span className="flex align-center gap-sm"><Banknote size={16} /> Cash</span>
              <input 
                type="number" 
                className="form-input" 
                style={{ width: '120px', padding: '8px 12px', textAlign: 'right', borderRadius: '8px', border: '1px solid var(--glass-border)' }}
                placeholder="0"
                value={paymentAmounts.cash}
                onChange={(e) => setPaymentAmounts({ ...paymentAmounts, cash: e.target.value })}
              />
            </div>
            <div className="flex justify-between align-center text-secondary font-bold" style={{ fontSize: '14px' }}>
              <span className="flex align-center gap-sm"><CreditCard size={16} /> Online / Card</span>
              <input 
                type="number" 
                className="form-input" 
                style={{ width: '120px', padding: '8px 12px', textAlign: 'right', borderRadius: '8px', border: '1px solid var(--glass-border)' }}
                placeholder="0"
                value={paymentAmounts.online}
                onChange={(e) => setPaymentAmounts({ ...paymentAmounts, online: e.target.value })}
              />
            </div>
          </div>

          <button 
            className="btn btn-primary w-full flex-center justify-center gap-sm" 
            style={{ 
              padding: '20px', 
              fontSize: '18px', 
              fontWeight: 800, 
              borderRadius: '16px',
              boxShadow: '0 8px 24px rgba(var(--primary-rgb), 0.3)',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
            disabled={cart.length === 0 || isProcessing}
            onClick={handleCheckout}
          >
            {isProcessing ? 'Processing...' : (
              <>
                Process Payment <ShoppingCart size={20} />
              </>
            )}
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
