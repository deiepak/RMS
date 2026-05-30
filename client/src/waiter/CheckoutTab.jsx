import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { subscribeToEvent, unsubscribeFromEvent } from '../api/socket';
import { Send } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

export default function CheckoutTab({ updateCounts }) {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchCheckouts();

    const handleUpdate = () => fetchCheckouts();
    subscribeToEvent('order:checkout-requested', handleUpdate);
    subscribeToEvent('order:payment-collected', handleUpdate);

    return () => {
      unsubscribeFromEvent('order:checkout-requested', handleUpdate);
      unsubscribeFromEvent('order:payment-collected', handleUpdate);
    };
  }, []);

  const fetchCheckouts = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/orders?status=checkout_requested');
      setOrders(res.data);
      updateCounts(res.data.length);
    } catch (error) {
      showToast('Failed to load checkouts', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendToAdmin = async (orderId) => {
    try {
      setIsProcessing(true);
      await api.patch(`/orders/${orderId}/payment-ready`, { waiter_name: user?.name });
      showToast('Sent to Admin for payment', 'success');
      fetchCheckouts();
    } catch (error) {
      showToast('Failed to send to Admin', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading && orders.length === 0) {
    return <div className="flex-center text-muted">Loading checkouts...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="flex-center flex-col text-muted" style={{ height: '60vh' }}>
        <h3 style={{ fontSize: 24, marginBottom: 8 }}>No checkout requests</h3>
      </div>
    );
  }

  return (
    <div className="flex-col gap-md">
      {orders.map(order => (
        <div key={order.id} className="card notification-card animate-fadeIn" style={{ borderLeftColor: 'var(--success)', backgroundColor: 'rgba(34, 197, 94, 0.05)' }}>
          <div className="card-header flex justify-between align-center" style={{ backgroundColor: 'transparent' }}>
            <h3 style={{ fontSize: 20 }}>Table {order.table_number}</h3>
            <span className="text-secondary">#{order.id}</span>
          </div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            <div className="flex justify-between align-center mb-md">
              <div className="text-secondary">Order Total</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-primary)' }}>
                {formatCurrency(order.total)}
              </div>
            </div>
            <button 
              className="btn btn-success w-full flex align-center justify-center gap-sm" 
              onClick={() => handleSendToAdmin(order.id)}
              disabled={isProcessing}
            >
              <Send size={18} /> Send to Admin for Payment
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
