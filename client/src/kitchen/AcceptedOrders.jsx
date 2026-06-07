import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { subscribeToEvent, unsubscribeFromEvent } from '../api/socket';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { checkStationMatch } from '../utils/helpers';

export default function AcceptedOrders({ updateCounts }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    fetchAccepted();

    const handleUpdate = () => fetchAccepted();
    subscribeToEvent('order:hold', handleUpdate);
    subscribeToEvent('order:unhold', handleUpdate);

    // Auto-refresh timer for elapsed times
    const interval = setInterval(() => {
      setOrders(prev => [...prev]);
    }, 60000);

    return () => {
      unsubscribeFromEvent('order:hold', handleUpdate);
      unsubscribeFromEvent('order:unhold', handleUpdate);
      clearInterval(interval);
    };
  }, []);

  const fetchAccepted = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/orders?status=active,checkout_requested,payment_ready,hold&include_undelivered=true');
      
      const acceptedOrders = res.data.map(order => {
        const filteredItems = order.items?.filter(i => {
          const isStationMatch = checkStationMatch(i.station_ids, user?.station_id);
          return isStationMatch && (i.status === 'accepted' || i.status === 'preparing' || i.status === 'rejected');
        }) || [];
        return { ...order, items: filteredItems };
      }).filter(order => order.items.length > 0);
      
      setOrders(acceptedOrders);
      
      const count = acceptedOrders.reduce((sum, o) => 
        sum + o.items.filter(i => i.status === 'accepted' || i.status === 'preparing').length, 0
      );
      updateCounts(count);
    } catch (error) {
      showToast('Failed to load preparing orders', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkPrepared = async (itemId) => {
    try {
      await api.patch(`/orders/items/${itemId}/status`, { status: 'prepared' });
      showToast('Marked as prepared', 'success');
      fetchAccepted();
    } catch (error) {
      showToast('Failed to update status', 'error');
    }
  };

  const getElapsed = (dateString) => {
    const ms = new Date() - new Date(dateString);
    const mins = Math.floor(ms / 60000);
    return `${mins}m`;
  };

  if (isLoading && orders.length === 0) {
    return <div className="flex-center text-muted">Loading preparing orders...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="flex-center flex-col text-muted" style={{ height: '60vh' }}>
        <h3 style={{ fontSize: 24, marginBottom: 8 }}>No items being prepared</h3>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 24 }}>
      {orders.map(order => {
        const preparingItems = order.items.filter(i => i.status === 'accepted' || i.status === 'preparing' || i.status === 'rejected');
        if (preparingItems.length === 0) return null;

        return (
          <div key={order.id} className="card order-card accepted animate-fadeIn">
            <div className="card-header bg-secondary flex justify-between align-center">
              <div className="flex align-center gap-md">
                <div className={`order-card-table ${order.status === 'hold' ? 'text-warning' : 'text-info'}`}>
                  T-{order.table_number}
                </div>
                <div>
                  <div style={{ fontSize: 13 }} className="text-secondary">Order #{order.id} {order.status === 'hold' && <span className="badge badge-warning ml-sm">ON HOLD</span>}</div>
                </div>
              </div>
            </div>
            
            <div className="card-body" style={{ padding: '0 16px' }}>
              {preparingItems.map(item => {
                const isRejected = item.status === 'rejected';
                return (
                  <div key={item.id} className="order-item-row" style={{ padding: '16px 0', opacity: isRejected ? 0.6 : 1 }}>
                    <div style={{ flex: 1, paddingRight: 16 }}>
                      <div className="flex justify-between align-center mb-sm">
                        <div style={{ fontWeight: 600, fontSize: 16, textDecoration: isRejected ? 'line-through' : 'none' }}>
                          <span className={isRejected ? "text-danger mr-sm" : "text-info mr-sm"}>{item.quantity}x</span> 
                          {item.item_name}
                        </div>
                        <div className="timer bg-secondary" style={{ padding: '4px 8px', borderRadius: 4 }}>
                          {isRejected ? <span className="text-danger">Cancelled</span> : getElapsed(item.updated_at)}
                        </div>
                      </div>
                      {item.notes && (
                        <div className="text-secondary mt-sm" style={{ fontSize: 13, textDecoration: isRejected ? 'line-through' : 'none' }}>
                          Note: {item.notes}
                        </div>
                      )}
                      
                      {!isRejected && (
                        <button 
                          className="btn btn-primary btn-sm mt-md w-full" 
                          onClick={() => handleMarkPrepared(item.id)}
                          disabled={order.status === 'hold'}
                        >
                          <CheckCircle2 size={16} /> Mark as Prepared
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
