import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { subscribeToEvent, unsubscribeFromEvent } from '../api/socket';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import { DollarSign, CreditCard, Smartphone, CheckCircle, Clock } from 'lucide-react';
import Modal from '../components/Modal';
import { useLocation, useNavigate } from 'react-router-dom';

export default function AcceptPayment() {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmounts, setPaymentAmounts] = useState({ cash: '', card: '', online: '' });
  const [customDiscountType, setCustomDiscountType] = useState('');
  const [collectedBy, setCollectedBy] = useState('');
  const [manualDiscount, setManualDiscount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [waiters, setWaiters] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashTendered, setCashTendered] = useState('');
  
  const { user } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
    fetchWaiters();

    const handleUpdate = () => fetchOrders();
    subscribeToEvent('order:payment-ready', handleUpdate);
    subscribeToEvent('order:payment-collected', handleUpdate);

    return () => {
      unsubscribeFromEvent('order:payment-ready', handleUpdate);
      unsubscribeFromEvent('order:payment-collected', handleUpdate);
    };
  }, []);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      // Fetch orders that are either checkout_requested or payment_ready
      const [readyRes, reqRes] = await Promise.all([
        api.get('/orders?status=payment_ready'),
        api.get('/orders?status=checkout_requested')
      ]);
      const allOrders = [...readyRes.data, ...reqRes.data];
      setOrders(allOrders);

      // Check if we need to auto-open an order (from CounterOrders navigation)
      const autoOpenOrderId = location.state?.autoOpenOrderId;
      if (autoOpenOrderId) {
        const target = allOrders.find(o => o.id === autoOpenOrderId);
        if (target) {
          openPaymentModal(target);
          // Clear state to prevent reopening on refresh
          window.history.replaceState({}, document.title);
        }
      }
    } catch (error) {
      showToast('Failed to fetch pending payments', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWaiters = async () => {
    try {
      const res = await api.get('/employees?role=waiter');
      setWaiters(res.data);
    } catch (error) {
      console.error('Failed to fetch waiters');
    }
  };

  const openPaymentModal = (order) => {
    setSelectedOrder(order);
    setPaymentAmounts({ cash: '', card: '', online: '' });
    setCollectedBy(order.waiter_name || '');
    setManualDiscount('');
    setDiscountReason('');
    setCashTendered('');
    setCustomDiscountType('');
    setPaymentModalOpen(true);
  };

  const handlePreConfirm = () => {
    const cash = parseFloat(paymentAmounts.cash) || 0;
    const card = parseFloat(paymentAmounts.card) || 0;
    const online = parseFloat(paymentAmounts.online) || 0;
    const sum = cash + card + online;
    const md = parseFloat(manualDiscount || 0);
    const total = Math.max(0, parseFloat(selectedOrder?.total || 0) - md);

    if (md > 0 && !discountReason) {
      return showToast('Please select a discount reason.', 'warning');
    }

    if (md > 0 && discountReason === 'Custom' && !customDiscountType.trim()) {
      return showToast('Please specify the Custom Discount Type (e.g. VIP, Staff, Festival).', 'warning');
    }

    if (Math.abs(sum - total) > 0.1) {
      return showToast(`Payment sum (${sum}) must perfectly match the grand total (${total}).`, 'warning');
    }

    if (cash > 0) {
      const tendered = parseFloat(cashTendered) || 0;
      if (tendered < cash) {
        return showToast('Cash tendered cannot be less than the cash payment amount.', 'warning');
      }
      finalizePayment(tendered, Math.max(0, tendered - cash));
    } else {
      finalizePayment(0, 0);
    }
  };

  const finalizePayment = async (tendered, changeDue) => {
    const cash = parseFloat(paymentAmounts.cash) || 0;
    const card = parseFloat(paymentAmounts.card) || 0;
    const online = parseFloat(paymentAmounts.online) || 0;
    const md = parseFloat(manualDiscount || 0);

    try {
      setIsProcessing(true);
      const payments = [
        { method: 'cash', amount: cash },
        { method: 'card', amount: card },
        { method: 'online', amount: online }
      ];

      await api.patch(`/orders/${selectedOrder.id}/payment`, {
        payments,
        collected_by: collectedBy || user.name,
        manual_discount: md,
        discount_reason: discountReason === 'Custom' ? `Custom: ${customDiscountType.trim()}` : discountReason,
        cash_tendered: tendered,
        change_due: changeDue
      });
      
      showToast('Order fully paid and completed!', 'success');
      setPaymentModalOpen(false);
      setShowCashModal(false);
      
      if (window.confirm("Payment successful! Do you want to print the bill now?")) {
        navigate('/admin/orders', { state: { autoPrintOrderId: selectedOrder.id } });
      } else {
        navigate('/admin/tables');
      }
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to process payment', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const md = parseFloat(manualDiscount || 0);
  const currentSum = (parseFloat(paymentAmounts.cash) || 0) + (parseFloat(paymentAmounts.card) || 0) + (parseFloat(paymentAmounts.online) || 0);
  const totalBill = Math.max(0, (selectedOrder ? parseFloat(selectedOrder.total) : 0) - md);
  const remainingSum = Math.max(0, totalBill - currentSum);
  const isMatch = Math.abs(currentSum - totalBill) < 0.1;
  
  const maxPercent = parseFloat(settings?.max_discount_percent || '100');
  const subtotal = parseFloat(selectedOrder?.subtotal || 0);
  const currentDiscount = parseFloat(selectedOrder?.discount || 0);
  const maxAllowedDiscount = (subtotal * maxPercent) / 100;
  const isDiscountValid = (currentDiscount + md) <= maxAllowedDiscount;

  // Helper to calculate total paid for an order locally if needed,
  // but we can also just fetch it if we attached payments to the GET /orders route.
  // For simplicity, we assume we might not have `payments` populated, so we rely on the API response during patch.
  // However, to show remaining balance correctly, we should ideally know how much has been paid.
  // Since we don't have payments returned in `GET /orders`, we'll just show the total and let the admin type amounts.

  if (isLoading) {
    return <div className="admin-content flex-center">Loading pending payments...</div>;
  }

  return (
    <div className="admin-content">
      <div className="admin-header">
        <h2>Accept Payments</h2>
        <button className="btn btn-secondary" onClick={fetchOrders}>Refresh</button>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state text-center" style={{ padding: '40px' }}>
          <CheckCircle size={48} className="text-success mb-md" />
          <h3>All caught up!</h3>
          <p className="text-secondary">There are no pending payments.</p>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {orders.map(order => (
            <div key={order.id} className="card">
              <div className="card-header flex justify-between align-center">
                <h3>Table {order.table_number}</h3>
                <span className={`badge ${order.status === 'payment_ready' ? 'badge-success' : 'badge-warning'}`}>
                  {order.status === 'payment_ready' ? 'Ready to Pay' : 'Checkout Req.'}
                </span>
              </div>
              <div className="card-body">
                <div className="flex justify-between text-secondary mb-sm">
                  <span>Order #{order.id}</span>
                  <span>{formatDateTime(order.created_at)}</span>
                </div>
                {order.waiter_name && (
                  <div className="flex justify-between text-info mb-sm">
                    <span>Waiter:</span>
                    <span style={{ fontWeight: 600 }}>{order.waiter_name}</span>
                  </div>
                )}
                <div className="flex justify-between align-center mt-md mb-md">
                  <span style={{ fontSize: 18 }}>Total Bill:</span>
                  <span style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                    {formatCurrency(order.total)}
                  </span>
                </div>
                <button className="btn btn-primary w-full" onClick={() => openPaymentModal(order)}>
                  Log Payment
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={paymentModalOpen}
        onClose={() => !isProcessing && setPaymentModalOpen(false)}
        title={`Accept Payment - Table ${selectedOrder?.table_number}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setPaymentModalOpen(false)} disabled={isProcessing}>Cancel</button>
            <button className="btn btn-success" onClick={handlePreConfirm} disabled={!isMatch || !isDiscountValid || (parseFloat(paymentAmounts.cash) > 0 && (parseFloat(cashTendered) || 0) < parseFloat(paymentAmounts.cash)) || isProcessing}>
              {isProcessing ? 'Processing...' : 'Settle Bill'}
            </button>
          </>
        }
      >
        <div className="text-center mb-md">
          <div className="text-secondary">Grand Total</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: 'var(--text-primary)' }}>
            {formatCurrency(totalBill)}
          </div>
          {md > 0 && (
            <div className="text-success mt-sm" style={{ fontSize: 14 }}>
              Discount applied: {formatCurrency(md)}
            </div>
          )}
        </div>

        <div className="flex-col gap-md mb-md">
          <div className="form-group mb-0">
            <label className="form-label">Manual Discount (रू)</label>
            <input 
              type="number" 
              className="form-input" 
              value={manualDiscount}
              onChange={e => setManualDiscount(e.target.value)}
              onWheel={e => e.target.blur()}
              placeholder="0.00"
              min="0"
              step="0.01"
            />
            {!isDiscountValid && (
              <div className="text-danger mt-sm" style={{ fontSize: 13 }}>
                Exceeds maximum allowed discount ({maxPercent}% of subtotal: {formatCurrency(maxAllowedDiscount)})
              </div>
            )}
          </div>
          {parseFloat(manualDiscount) > 0 && (
            <div className="form-group mb-0 mt-sm">
              <label className="form-label">Discount Reason</label>
              <select className="form-select" value={discountReason} onChange={e => setDiscountReason(e.target.value)}>
                <option value="">Select Reason</option>
                <option value="Quality issue">Quality issue</option>
                <option value="Round off discount">Round off discount</option>
                <option value="Personal discount">Personal discount</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
          )}
          {parseFloat(manualDiscount) > 0 && discountReason === 'Custom' && (
            <div className="form-group mb-0 mt-sm" style={{ paddingLeft: '16px', borderLeft: '3px solid var(--accent-primary)' }}>
              <label className="form-label">Custom Discount Type</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. VIP Guest, Festival Offer, Staff Offer" 
                value={customDiscountType}
                onChange={e => setCustomDiscountType(e.target.value)} 
                required
              />
            </div>
          )}
        </div>

        <div className="flex-col gap-md mb-md">
          <div className="form-group mb-0">
            <label className="form-label flex align-center gap-sm"><DollarSign size={16} /> Cash</label>
            <input 
              type="number" 
              className="form-input" 
              value={paymentAmounts.cash}
              onChange={e => setPaymentAmounts(p => ({ ...p, cash: e.target.value }))}
              onWheel={e => e.target.blur()}
              placeholder="0.00"
              min="0"
              step="0.01"
            />
            {parseFloat(paymentAmounts.cash) > 0 && (
              <div className="flex-col gap-sm mt-md" style={{ paddingLeft: '16px', borderLeft: '3px solid var(--accent-primary)' }}>
                <div className="form-group mb-0">
                  <label className="form-label">Amount Tendered</label>
                  <input 
                    type="number" 
                    className="form-input"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    onWheel={e => e.target.blur()}
                    placeholder="0.00"
                    min={parseFloat(paymentAmounts.cash) || 0}
                    step="0.01"
                  />
                </div>
                <div className="flex justify-between align-center p-sm" style={{ background: ((parseFloat(cashTendered) || 0) >= (parseFloat(paymentAmounts.cash) || 0)) ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius)', border: `1px solid ${((parseFloat(cashTendered) || 0) >= (parseFloat(paymentAmounts.cash) || 0)) ? 'var(--success)' : 'var(--danger)'}` }}>
                  <span style={{ fontSize: 14, fontWeight: 'bold' }}>Return Amount:</span>
                  <span style={{ fontSize: 16, fontWeight: 'bold', color: ((parseFloat(cashTendered) || 0) >= (parseFloat(paymentAmounts.cash) || 0)) ? 'var(--success)' : 'var(--danger)' }}>
                    {((parseFloat(cashTendered) || 0) >= (parseFloat(paymentAmounts.cash) || 0)) ? formatCurrency(Math.max(0, (parseFloat(cashTendered) || 0) - (parseFloat(paymentAmounts.cash) || 0))) : 'Enter valid tender'}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="form-group mb-0">
            <label className="form-label flex align-center gap-sm"><CreditCard size={16} /> Card</label>
            <input 
              type="number" 
              className="form-input" 
              value={paymentAmounts.card}
              onChange={e => setPaymentAmounts(p => ({ ...p, card: e.target.value }))}
              onWheel={e => e.target.blur()}
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>
          <div className="form-group mb-0">
            <label className="form-label flex align-center gap-sm"><Smartphone size={16} /> Online</label>
            <input 
              type="number" 
              className="form-input" 
              value={paymentAmounts.online}
              onChange={e => setPaymentAmounts(p => ({ ...p, online: e.target.value }))}
              onWheel={e => e.target.blur()}
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <div className="flex justify-between align-center" style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', marginBottom: '10px' }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Current Sum</span>
          <span style={{ fontSize: 20, fontWeight: 'bold', color: isMatch ? 'var(--success)' : 'var(--warning)' }}>
            {formatCurrency(currentSum)}
          </span>
        </div>
        
        <div className="flex-col" style={{ padding: '16px', background: remainingSum === 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius)', border: `1px solid ${remainingSum === 0 ? 'var(--success)' : 'var(--danger)'}` }}>
          <div className="form-group mb-0">
            <label className="form-label flex align-center gap-sm">Remaining</label>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: remainingSum > 0 ? 'var(--danger)' : 'var(--success)' }}>
              {formatCurrency(remainingSum)}
            </div>
          </div>
          <div className="form-group mt-md">
            <label className="form-label flex align-center gap-sm">
              Collected By (Waiter)
              {selectedOrder?.waiter_name && (
                <span className="badge badge-success ml-sm" style={{ padding: '2px 6px', fontSize: 10 }}>Auto-Detected</span>
              )}
            </label>
            {selectedOrder?.waiter_name ? (
              <div className="bg-secondary p-sm flex align-center gap-sm" style={{ borderRadius: 'var(--radius)', border: '1px solid var(--success)', fontWeight: 600 }}>
                <CheckCircle size={16} className="text-success" />
                {selectedOrder.waiter_name}
              </div>
            ) : (
              <select className="form-select" value={collectedBy} onChange={e => setCollectedBy(e.target.value)}>
                <option value="">{user.name} (Admin)</option>
                {waiters.map(w => (
                  <option key={w.id} value={w.name}>{w.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </Modal>


    </div>
  );
}
