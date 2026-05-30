import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { subscribeToEvent, unsubscribeFromEvent } from '../api/socket';
import { Clock, CheckCircle, ChefHat, UtensilsCrossed, XCircle, Trash2 } from 'lucide-react';
import { timeAgo } from '../utils/helpers';
import { useToast } from '../contexts/ToastContext';
import StatusBadge from '../components/StatusBadge';

export default function StatusTab({ tableId }) {
  const [orderItems, setOrderItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    if (tableId) {
      fetchOrder();
    }
  }, [tableId]);

  useEffect(() => {
    const handleStatusUpdate = (updatedOrder) => {
      // Refresh the whole order if any item status changes
      if (tableId) {
        fetchOrder();
      }
    };

    subscribeToEvent('order:item-status', handleStatusUpdate);
    return () => unsubscribeFromEvent('order:item-status', handleStatusUpdate);
  }, [tableId]);

  const fetchOrder = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/orders/table/${tableId}/active`);
      if (res.data && res.data.items) {
        // Sort items: pending first, then preparing, etc.
        const sortedItems = [...res.data.items].sort((a, b) => {
          return new Date(b.updated_at) - new Date(a.updated_at);
        });
        setOrderItems(sortedItems);
      }
    } catch (error) {
      // If 404, it means no active order, which is fine
      setOrderItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelItem = async (item) => {
    if (item.status !== 'pending') {
      showToast('To cancel an accepted item, please contact your waiter.', 'warning');
      return;
    }
    
    if (!window.confirm(`Are you sure you want to cancel ${item.item_name}?`)) return;

    try {
      await api.patch(`/orders/items/${item.id}/status`, {
        status: 'rejected',
        reject_reason: 'Cancelled by Customer'
      });
      showToast('Item cancelled successfully', 'success');
      fetchOrder();
    } catch (error) {
      showToast('Failed to cancel item', 'error');
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'pending': return <Clock size={24} className="text-warning animate-pulse" />;
      case 'accepted':
      case 'preparing': return <ChefHat size={24} className="text-info" />;
      case 'prepared': 
      case 'picked_up': return <CheckCircle size={24} className="text-success" />;
      case 'delivered': return <UtensilsCrossed size={24} className="text-success" />;
      case 'rejected': return <XCircle size={24} className="text-danger" />;
      default: return <Clock size={24} />;
    }
  };

  const getStatusText = (item) => {
    switch(item.status) {
      case 'pending': return 'Waiting for kitchen to accept...';
      case 'accepted': return 'Kitchen accepted order';
      case 'preparing': return 'Chef is preparing your food';
      case 'prepared': return 'Food is ready, waiting for waiter';
      case 'picked_up': return `${item.assigned_waiter || 'Waiter'} is bringing it to your table!`;
      case 'delivered': return 'Enjoy your meal!';
      case 'rejected': return `Sorry, this item was cancelled. Reason: ${item.reject_reason || 'Out of stock'}`;
      default: return item.status;
    }
  };

  if (isLoading) {
    return <div className="flex-center" style={{ padding: 40 }}><div className="text-muted">Loading order status...</div></div>;
  }

  if (orderItems.length === 0) {
    return (
      <div className="flex-center flex-col" style={{ padding: 60, textAlign: 'center' }}>
        <UtensilsCrossed size={64} className="text-muted" style={{ marginBottom: 20, opacity: 0.5 }} />
        <h3>No active orders</h3>
        <p className="text-secondary mt-sm">Go to the Menu tab to start ordering!</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, paddingBottom: 100 }}>
      <h3 className="mb-md">Order Status</h3>
      
      <div className="flex flex-col gap-md">
        {orderItems.map((item, idx) => (
          <div key={item.id} className="card animate-slideUp" style={{ animationDelay: `${idx * 0.1}s` }}>
            <div className="card-body">
              <div className="flex justify-between align-center mb-sm">
                <div style={{ fontWeight: 600, fontSize: 16, textDecoration: item.status === 'rejected' ? 'line-through' : 'none', opacity: item.status === 'rejected' ? 0.6 : 1 }}>
                  {item.quantity}x {item.item_name}
                </div>
                <div className="flex align-center gap-sm">
                  <StatusBadge status={item.status === 'rejected' ? 'cancelled' : item.status} />
                  {item.status !== 'rejected' && item.status !== 'delivered' && item.status !== 'served' && (
                    <button 
                      className="btn btn-icon btn-sm" 
                      onClick={() => handleCancelItem(item)}
                      style={{ color: item.status === 'pending' ? 'var(--danger)' : 'var(--text-secondary)' }}
                      title="Cancel Item"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex align-center gap-md mt-md" style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                {getStatusIcon(item.status)}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{getStatusText(item)}</div>
                  <div className="text-secondary" style={{ fontSize: 12, marginTop: 4 }}>
                    Ordered by {item.customer_name} • {timeAgo(new Date(item.created_at))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
