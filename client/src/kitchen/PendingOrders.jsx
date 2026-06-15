import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { subscribeToEvent, unsubscribeFromEvent } from '../api/socket';
import { Check, X } from 'lucide-react';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { checkStationMatch } from '../utils/helpers';

export default function PendingOrders({ updateCounts }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectingItem, setRejectingItem] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchPending();

    const handleNewOrder = () => fetchPending();
    subscribeToEvent('order:new', handleNewOrder);
    subscribeToEvent('order:item-status', handleNewOrder);
    subscribeToEvent('order:hold', handleNewOrder);
    subscribeToEvent('order:unhold', handleNewOrder);
    
    // Set up auto-refresh timer to update the "time ago" displays
    const interval = setInterval(() => {
      setOrders(prev => [...prev]); // force re-render
    }, 60000);

    return () => {
      unsubscribeFromEvent('order:new', handleNewOrder);
      unsubscribeFromEvent('order:item-status', handleNewOrder);
      unsubscribeFromEvent('order:hold', handleNewOrder);
      unsubscribeFromEvent('order:unhold', handleNewOrder);
      clearInterval(interval);
    };
  }, []);

  const fetchPending = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/orders?status=active,checkout_requested,payment_ready,hold&include_undelivered=true');
      // Filter to only get orders that have pending items for this station
      const pendingOrders = res.data.map(order => {
        const filteredItems = order.items?.filter(i => {
          const isStationMatch = checkStationMatch(i.station_ids, user?.station_id);
          return isStationMatch && (i.status === 'pending' || i.status === 'rejected');
        }) || [];
        return { ...order, items: filteredItems };
      }).filter(order => order.items.length > 0);
      
      setOrders(pendingOrders);
      
      // Calculate total pending items for badge
      const count = pendingOrders.reduce((sum, o) => 
        sum + o.items.filter(i => i.status === 'pending').length, 0
      );
      updateCounts(count);
    } catch (error) {
      showToast('Failed to load pending orders', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (itemId) => {
    try {
      await api.patch(`/orders/items/${itemId}/status`, { status: 'accepted' });
      showToast('Item accepted', 'success');
      fetchPending();
    } catch (error) {
      showToast('Failed to accept item', 'error');
    }
  };

  const handleAcceptAll = async (orderId, items) => {
    try {
      const pendingItemIds = items.filter(i => i.status === 'pending').map(i => i.id);
      await Promise.all(pendingItemIds.map(id => 
        api.patch(`/orders/items/${id}/status`, { status: 'accepted' })
      ));
      showToast('All items accepted', 'success');
      fetchPending();
    } catch (error) {
      showToast('Failed to accept items', 'error');
    }
  };

  const openRejectModal = (item) => {
    setRejectingItem(item);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return showToast('Reason is required', 'warning');
    
    try {
      await api.patch(`/orders/items/${rejectingItem.id}/status`, { 
        status: 'rejected',
        reject_reason: rejectReason
      });
      showToast('Item rejected', 'success');
      setIsRejectModalOpen(false);
      fetchPending();
    } catch (error) {
      showToast('Failed to reject item', 'error');
    }
  };

  // Helper for elapsed time in MM:SS format if < 60 mins
  const getElapsed = (dateString) => {
    const ms = new Date() - new Date(dateString);
    const mins = Math.floor(ms / 60000);
    if (mins > 60) return `${Math.floor(mins/60)}h ${mins%60}m ago`;
    return `${mins} min ago`;
  };

  if (isLoading && orders.length === 0) {
    return <div className="flex-center text-muted">Loading pending orders...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="flex-center flex-col text-muted" style={{ height: '60vh' }}>
        <h3 style={{ fontSize: 24, marginBottom: 8 }}>No pending orders 🎉</h3>
        <p>You're all caught up!</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 24 }}>
      {orders.map(order => {
        const pendingItems = order.items.filter(i => i.status === 'pending' || i.status === 'rejected');
        if (pendingItems.length === 0) return null;

        const orderTime = pendingItems[0].created_at;
        const isOld = (new Date() - new Date(orderTime)) > 15 * 60000; // > 15 mins

        return (
          <div key={order.id} className="card order-card pending animate-fadeIn">
            <div className="card-header bg-secondary flex justify-between align-center">
              <div className="flex align-center gap-md">
                <div className="order-card-table" style={{ color: order.status === 'hold' ? 'var(--warning)' : (isOld ? 'var(--danger)' : 'var(--success)') }}>
                  T-{order.table_number}
                </div>
                <div>
                  <div style={{ fontSize: 13 }} className="text-secondary">Order #{order.id} {order.status === 'hold' && <span className="badge badge-warning ml-sm">ON HOLD</span>}</div>
                  <div className="timer" style={{ color: isOld ? 'var(--danger)' : 'inherit' }}>
                    {getElapsed(orderTime)}
                  </div>
                </div>
              </div>
              {order.items.some(i => i.status === 'pending') && order.status !== 'hold' && (
                <button className="btn btn-primary btn-sm" onClick={() => handleAcceptAll(order.id, pendingItems)}>
                  Accept All
                </button>
              )}
            </div>
            
            <div className="card-body" style={{ padding: '0 16px' }}>
              {pendingItems.map(item => {
                const isRejected = item.status === 'rejected';
                return (
                  <div key={item.id} className="order-item-row" style={{ opacity: isRejected ? 0.6 : 1 }}>
                    <div style={{ flex: 1, paddingRight: 16, textDecoration: isRejected ? 'line-through' : 'none' }}>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>
                        <span className={isRejected ? "text-danger mr-sm" : "text-warning mr-sm"}>{item.quantity}x</span> 
                        {item.item_name}
                      </div>
                      {item.notes && (
                        <div className="text-secondary mt-sm bg-primary" style={{ padding: '4px 8px', borderRadius: 4, fontSize: 13, borderLeft: `2px solid ${isRejected ? 'var(--danger)' : 'var(--warning)'}` }}>
                          Note: {item.notes}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-sm align-center">
                      {isRejected ? (
                        <div className="badge badge-danger">Cancelled</div>
                      ) : (
                        <>
                          <button className="btn btn-icon btn-secondary" disabled={order.status === 'hold'} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => openRejectModal(item)}>
                            <X size={18} />
                          </button>
                          <button className="btn btn-icon btn-success" disabled={order.status === 'hold'} onClick={() => handleAccept(item.id)}>
                            <Check size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Item"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsRejectModalOpen(false)}>Cancel</button>
            <button className="btn btn-danger" onClick={handleReject}>Reject Item</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Reason for rejection</label>
          <select className="form-select mb-sm" value={rejectReason} onChange={e => setRejectReason(e.target.value)}>
            <option value="">Select a reason...</option>
            <option value="Out of stock">Out of stock</option>
            <option value="Kitchen is too busy">Kitchen is too busy</option>
            <option value="Cannot fulfill special request">Cannot fulfill special request</option>
            <option value="Other">Other</option>
          </select>
          {rejectReason === 'Other' && (
            <input 
              type="text" 
              className="form-input" 
              placeholder="Type custom reason..."
              onChange={e => setRejectReason(e.target.value)}
              autoFocus
            />
          )}
        </div>
      </Modal>
    </div>
  );
}
