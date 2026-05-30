import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import { viewBillPDF, downloadBillPDF } from '../utils/pdf';
import { useSettings } from '../contexts/SettingsContext';
import { Receipt, FileText, Download, Tag, Heart } from 'lucide-react';
import Modal from '../components/Modal';
import useSpeech from '../hooks/useSpeech';

export default function BillTab({ tableId, setIsCheckoutRequested }) {
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [customTip, setCustomTip] = useState('');
  const [showCustomTip, setShowCustomTip] = useState(false);
  
  const { showToast } = useToast();
  const { settings } = useSettings();
  const { speak } = useSpeech();

  useEffect(() => {
    if (tableId) fetchOrder();
  }, [tableId]);

  const fetchOrder = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/orders/table/${tableId}/active`);
      setOrder(res.data);
    } catch (error) {
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyPromo = async (e) => {
    e.preventDefault();
    if (!promoCode.trim()) return;

    try {
      setIsApplyingPromo(true);
      const res = await api.post(`/promos/validate`, { 
        code: promoCode, 
        order_total: order.subtotal 
      });
      
      // Calculate new totals locally for display before actual checkout
      const discount = parseFloat(res.data.discount_amount);
      const newTotal = (order.subtotal - discount).toFixed(2);
      
      setPromoResult({
        ...res.data,
        new_total: newTotal
      });
      showToast('Promo code applied!', 'success');
      setPromoCode('');
    } catch (error) {
      showToast(error.response?.data?.error || 'Invalid promo code', 'error');
      setPromoResult(null);
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setPromoResult(null);
  };


  const handleRequestCheckoutClick = () => {
    setIsTipModalOpen(true);
  };

  const submitCheckout = async (tipAmount = 0) => {
    if (!order) return;
    try {
      const payload = { tip_amount: tipAmount };
      if (promoResult) {
        // In a real app, we'd apply this discount in the backend during checkout
        await api.post(`/orders/${order.id}/apply-promo`, { code: promoResult.code });
      }
      
      await api.patch(`/orders/${order.id}/checkout`, payload);
      setIsTipModalOpen(false);
      setIsCheckoutRequested(true);
      
      if (tipAmount > 0) {
        speak('Thank you for your generous tip', { lang: 'en-IN' });
      }
      
      fetchOrder(); // refresh status
    } catch (error) {
      showToast('Failed to request checkout', 'error');
    }
  };

  if (isLoading) {
    return <div className="flex-center" style={{ padding: 40 }}><div className="text-muted">Loading bill...</div></div>;
  }

  if (!order || order.items.length === 0) {
    return (
      <div className="flex-center flex-col" style={{ padding: 60, textAlign: 'center' }}>
        <Receipt size={64} className="text-muted" style={{ marginBottom: 20, opacity: 0.5 }} />
        <h3>No active bill</h3>
        <p className="text-secondary mt-sm">Your bill will appear here once you place an order.</p>
      </div>
    );
  }

  // Group by customer for split bill view
  const byPerson = {};
  order.items.forEach(item => {
    if (!byPerson[item.customer_name]) {
      byPerson[item.customer_name] = { total: 0, items: [] };
    }
    const itemTotal = parseFloat(item.price) * item.quantity;
    if (item.status !== 'rejected' && item.status !== 'cancelled') {
      byPerson[item.customer_name].total += itemTotal;
    }
    byPerson[item.customer_name].items.push(item);
  });

  const displayDiscount = promoResult ? parseFloat(promoResult.discount_amount) : parseFloat(order.discount || 0);
  const displayTotal = promoResult ? parseFloat(promoResult.new_total) : parseFloat(order.total || 0);

  const roundOffSetting = parseFloat(settings?.tip_roundoff_amount) || 50;
  
  // Always round up to the next interval. If it perfectly divides, add the full interval.
  const suggestedTip = roundOffSetting - (displayTotal % roundOffSetting);
  const roundedTotal = displayTotal + suggestedTip;

  return (
    <div style={{ padding: 20, paddingBottom: 100 }}>
      {order.status === 'checkout_requested' && (
        <div className="bg-warning text-center" style={{ padding: '12px 20px', color: '#fff', fontWeight: 600, borderRadius: 'var(--radius)', marginBottom: 20 }}>
          <div className="animate-pulse">Waiter has been notified and is coming with your bill.</div>
        </div>
      )}

      <div className="card mb-lg">
        <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          <div className="flex justify-between w-full align-center">
            <h3 className="flex align-center gap-sm"><Receipt size={20} /> Bill Summary</h3>
            <span className="text-secondary" style={{ fontSize: 13 }}>Order #{order.id}</span>
          </div>
          <div className="text-secondary" style={{ fontSize: 13 }}>{formatDateTime(new Date(order.created_at))}</div>
        </div>
        
        <div className="card-body">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--glass-border)', textAlign: 'left' }}>
                <th style={{ paddingBottom: 8 }}>Item</th>
                <th style={{ paddingBottom: 8, textAlign: 'center' }}>Qty</th>
                <th style={{ paddingBottom: 8, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => {
                const isCancelled = item.status === 'rejected' || item.status === 'cancelled';
                return (
                  <tr key={idx} style={{ 
                    borderBottom: '1px solid var(--glass-border)',
                    opacity: isCancelled ? 0.6 : 1,
                    textDecoration: isCancelled ? 'line-through' : 'none'
                  }}>
                    <td style={{ padding: '12px 0' }}>
                      <div className="flex align-center gap-xs">
                        <span style={{ fontWeight: 500 }}>{item.menu_item_name}</span>
                        {isCancelled && <span className="badge badge-danger" style={{ fontSize: 10, padding: '2px 4px' }}>CANCELLED</span>}
                      </div>
                      <div className="text-secondary" style={{ fontSize: 12 }}>{item.customer_name}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatCurrency(parseFloat(item.price) * item.quantity)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '2px solid var(--glass-border)' }}>
            <div className="flex justify-between mb-sm text-secondary">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            
            {displayDiscount > 0 && (
              <div className="flex justify-between mb-sm" style={{ color: 'var(--success)' }}>
                <span>Discount {promoResult ? `(${promoResult.code})` : (order.promo_code_name ? `(${order.promo_code_name})` : '')}</span>
                <span>-{formatCurrency(displayDiscount)}</span>
              </div>
            )}
            
            <div className="flex justify-between mt-md" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-primary)' }}>
              <span>Grand Total</span>
              <span>{formatCurrency(displayTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {order.status !== 'checkout_requested' && (
        <div className="card mb-lg">
          <div className="card-body">
            <h4 className="mb-md">Apply Promo Code</h4>
            {promoResult ? (
              <div className="flex justify-between align-center bg-success" style={{ padding: '10px 16px', borderRadius: 'var(--radius-sm)', color: '#fff' }}>
                <div className="flex align-center gap-sm">
                  <Tag size={16} /> <strong>{promoResult.code}</strong> Applied
                </div>
                <button className="btn btn-icon" style={{ background: 'transparent', color: '#fff' }} onClick={handleRemovePromo}>×</button>
              </div>
            ) : (
              <form className="flex gap-md" onSubmit={handleApplyPromo}>
                <input 
                  type="text" 
                  className="form-input flex-1" 
                  placeholder="Enter code" 
                  value={promoCode} 
                  onChange={e => setPromoCode(e.target.value.toUpperCase())}
                  style={{ textTransform: 'uppercase' }}
                />
                <button type="submit" className="btn btn-secondary" disabled={!promoCode || isApplyingPromo}>
                  Apply
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {Object.keys(byPerson).length > 1 && (
        <div className="card mb-lg">
          <div className="card-header">
            <h4>Split Breakdown</h4>
          </div>
          <div className="card-body flex-col gap-sm">
            {Object.entries(byPerson).map(([person, data]) => (
              <div key={person} className="flex justify-between p-sm bg-secondary" style={{ padding: 12, borderRadius: 'var(--radius-sm)' }}>
                <span>{person}</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(data.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-col gap-md">
        <div className="flex gap-md">
          <button className="btn btn-secondary flex-1" onClick={() => viewBillPDF({...order, discount: displayDiscount, tax: 0, total: displayTotal}, settings)}>
            <FileText size={18} /> View PDF
          </button>
          <button className="btn btn-secondary flex-1" onClick={() => downloadBillPDF({...order, discount: displayDiscount, tax: 0, total: displayTotal}, settings)}>
            <Download size={18} /> Download
          </button>
        </div>
        
        {order.status !== 'checkout_requested' && (
          <button className="btn btn-primary w-full flex-center gap-sm" style={{ padding: 16, fontSize: 16 }} onClick={handleRequestCheckoutClick}>
            <Receipt size={20} /> Request Checkout
          </button>
        )}
      </div>

      {/* Tip Modal */}
      <Modal
        isOpen={isTipModalOpen}
        onClose={() => setIsTipModalOpen(false)}
        title="Add a Tip (Optional)"
      >
        <div className="flex-col gap-md text-center">
          <Heart size={48} className="text-primary mx-auto mb-sm" style={{ opacity: 0.8 }} />
          <h3 style={{ margin: 0 }}>Enjoyed your meal?</h3>
          <p className="text-secondary" style={{ margin: '0 0 16px 0' }}>Support our staff by adding a tip to your bill.</p>
          
          <div className="bg-secondary" style={{ padding: '12px 16px', borderRadius: 'var(--radius)', marginBottom: 8 }}>
            <div className="flex justify-between">
              <span className="text-secondary">Bill Total:</span>
              <span className="font-bold">{formatCurrency(displayTotal)}</span>
            </div>
          </div>
          
          <div className="flex-col gap-sm">
            {suggestedTip > 0 && (
              <button 
                className="btn w-full flex-center" 
                style={{ backgroundColor: 'rgba(234, 88, 12, 0.1)', color: 'var(--primary)', border: '1px solid var(--primary)', padding: 16, fontSize: 16 }}
                onClick={() => submitCheckout(suggestedTip)}
              >
                Tip {formatCurrency(suggestedTip)} and pay total {formatCurrency(roundedTotal)}
              </button>
            )}

            {!showCustomTip ? (
              <button 
                className="btn btn-primary w-full flex-center" 
                style={{ padding: 16, fontSize: 16 }}
                onClick={() => setShowCustomTip(true)}
              >
                Custom Tip
              </button>
            ) : (
              <div className="bg-secondary" style={{ padding: 16, borderRadius: 'var(--radius)', border: '1px solid var(--glass-border)' }}>
                <label className="form-label text-left block mb-sm">Enter Custom Amount</label>
                <div className="flex gap-sm">
                  <input 
                    type="number" 
                    className="form-input flex-1" 
                    placeholder="0.00" 
                    value={customTip} 
                    onChange={e => setCustomTip(e.target.value)}
                    min="0"
                    step="0.01"
                    autoFocus
                  />
                  <button 
                    className="btn btn-primary" 
                    onClick={() => submitCheckout(parseFloat(customTip) || 0)}
                    disabled={!customTip || parseFloat(customTip) <= 0}
                  >
                    Continue to Payment with Tip
                  </button>
                </div>
              </div>
            )}
            
            <button 
              className="btn w-full flex-center btn-secondary" 
              style={{ padding: 16, fontSize: 16 }}
              onClick={() => submitCheckout(0)}
            >
              No Tip, Continue to Checkout
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
