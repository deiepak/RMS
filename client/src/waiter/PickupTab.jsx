import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { subscribeToEvent, unsubscribeFromEvent } from '../api/socket';

export default function PickupTab({ updateCounts }) {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    fetchPrepared();

    const handleUpdate = () => fetchPrepared();
    subscribeToEvent('order:item-status', handleUpdate);
    subscribeToEvent('order:ready-for-pickup', handleUpdate);

    return () => {
      unsubscribeFromEvent('order:item-status', handleUpdate);
      unsubscribeFromEvent('order:ready-for-pickup', handleUpdate);
    };
  }, []);

  const fetchPrepared = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/orders?status=active,checkout_requested,payment_ready&include_undelivered=true');
      
      const preparedOrders = res.data.filter(order => 
        order.items && order.items.some(i => 
          i.status === 'prepared' || 
          (i.status === 'picked_up' && i.assigned_waiter === user.name)
        )
      );
      
      setOrders(preparedOrders);
      updateCounts(preparedOrders.length);
    } catch (error) {
      showToast('Failed to load pickups', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickup = async (itemId) => {
    try {
      await api.patch(`/orders/items/${itemId}/status`, { 
        status: 'picked_up', 
        assigned_waiter: user.name 
      });
      showToast('Assigned to you', 'success');
      fetchPrepared();
    } catch (error) {
      showToast('Failed to pickup', 'error');
    }
  };

  const handleDeliver = async (itemId) => {
    try {
      await api.patch(`/orders/items/${itemId}/status`, { status: 'delivered' });
      showToast('Marked as delivered', 'success');
      fetchPrepared();
    } catch (error) {
      showToast('Failed to deliver', 'error');
    }
  };

  if (isLoading && orders.length === 0) {
    return <div className="flex-center text-muted">Loading pickups...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="flex-center flex-col text-muted" style={{ height: '60vh' }}>
        <h3 style={{ fontSize: 24, marginBottom: 8 }}>No pickups</h3>
        <p>Kitchen is still preparing food.</p>
      </div>
    );
  }

  return (
    <div className="flex-col gap-md">
      {orders.map(order => {
        const items = order.items.filter(i => 
          i.status === 'prepared' || 
          (i.status === 'picked_up' && i.assigned_waiter === user.name)
        );
        
        if (items.length === 0) return null;

        return (
          <div key={order.id} className="card notification-card animate-fadeIn">
            <div className="card-header flex justify-between align-center" style={{ backgroundColor: 'transparent' }}>
              <h3 style={{ fontSize: 20 }}>Table {order.table_number}</h3>
            </div>
            <div className="card-body" style={{ paddingTop: 0 }}>
              {items.map(item => (
                <div key={item.id} className="flex justify-between align-center" style={{ padding: '12px 0', borderBottom: '1px solid var(--glass-border)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{item.quantity}x {item.item_name}</div>
                    <div className="text-secondary" style={{ fontSize: 13 }}>For: {item.customer_name}</div>
                  </div>
                  <div>
                    {item.status === 'prepared' ? (
                      <button className="btn btn-primary" onClick={() => handlePickup(item.id)}>
                        Accept Pickup
                      </button>
                    ) : (
                      <button className="btn btn-success" onClick={() => handleDeliver(item.id)}>
                        Delivered
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
