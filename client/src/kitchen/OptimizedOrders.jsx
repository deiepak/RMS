import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { subscribeToEvent, unsubscribeFromEvent } from '../api/socket';
import { UtensilsCrossed, Clock, Check, X } from 'lucide-react';
import { formatDateTime, checkStationMatch } from '../utils/helpers';
import { useAuth } from '../contexts/AuthContext';

export default function OptimizedOrders() {
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  const formatTime = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    fetchTableOrders();

    const handleUpdate = () => fetchTableOrders();

    subscribeToEvent('order:new', handleUpdate);
    subscribeToEvent('order:item-status', handleUpdate);
    subscribeToEvent('order:checkout-requested', handleUpdate);
    subscribeToEvent('order:payment-collected', handleUpdate);
    subscribeToEvent('order:hold', handleUpdate);
    subscribeToEvent('order:unhold', handleUpdate);

    return () => {
      unsubscribeFromEvent('order:new', handleUpdate);
      unsubscribeFromEvent('order:item-status', handleUpdate);
      unsubscribeFromEvent('order:checkout-requested', handleUpdate);
      unsubscribeFromEvent('order:payment-collected', handleUpdate);
      unsubscribeFromEvent('order:hold', handleUpdate);
      unsubscribeFromEvent('order:unhold', handleUpdate);
    };
  }, []);

  const fetchTableOrders = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/orders?status=active,checkout_requested,payment_ready,hold&include_undelivered=true');
      const activeOrders = res.data;
      
      const tableMap = {};
      activeOrders.forEach(order => {
        if (!tableMap[order.table_number]) {
          tableMap[order.table_number] = {
            table_number: order.table_number,
            orders: [],
            total_items: 0
          };
        }
        
        const validItems = order.items.filter(i => {
          const isStationMatch = checkStationMatch(i.station_ids, user?.station_id);
          const isNotFinished = !['prepared', 'picked_up', 'delivered', 'rejected'].includes(i.status);
          return isStationMatch && isNotFinished;
        });
        
        if (validItems.length > 0) {
          tableMap[order.table_number].orders.push({
            ...order,
            items: validItems
          });
          tableMap[order.table_number].total_items += validItems.length;
        }
      });

      const sortedTables = Object.values(tableMap)
        .filter(t => t.orders.length > 0)
        .sort((a, b) => parseInt(a.table_number) - parseInt(b.table_number));
      setTables(sortedTables);
    } catch (error) {
      showToast('Failed to fetch table orders', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'var(--warning)';
      case 'accepted':
      case 'preparing': return 'var(--info)';
      case 'prepared':
      case 'ready':
      case 'picked_up':
      case 'delivered': return 'var(--success)';
      default: return 'var(--text-secondary)';
    }
  };

  const updateItemStatus = async (orderId, itemId, newStatus, reason = '') => {
    try {
      await api.patch(`/orders/items/${itemId}/status`, { status: newStatus, reject_reason: reason });
      showToast(`Item marked as ${newStatus.replace('_', ' ')}`, 'success');
      fetchTableOrders();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to update item', 'error');
    }
  };

  if (isLoading) {
    return <div className="flex-center" style={{ padding: 40 }}><div className="text-muted">Loading table overview...</div></div>;
  }

  if (tables.length === 0) {
    return (
      <div className="flex-center flex-col" style={{ padding: 60, textAlign: 'center' }}>
        <UtensilsCrossed size={64} className="text-muted" style={{ marginBottom: 20, opacity: 0.5 }} />
        <h3>No Active Tables</h3>
        <p className="text-secondary mt-sm">There are currently no active orders.</p>
      </div>
    );
  }

  return (
    <>
      <style>
        {`
          @keyframes pulseRedGreen {
            0% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.8); border-color: var(--danger); }
            50% { box-shadow: 0 0 25px rgba(16, 185, 129, 0.9); border-color: var(--success); }
            100% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.8); border-color: var(--danger); }
          }
          .alert-pending {
            animation: pulseRedGreen 1.5s infinite;
            border-width: 2px !important;
          }
        `}
      </style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {tables.map(table => {
          const hasPending = table.orders.some(order => order.items.some(item => item.status === 'pending'));
          return (
          <div key={table.table_number} className={`card animate-slideUp ${hasPending ? 'alert-pending' : ''}`}>
            <div className="card-header flex justify-between align-center">
            <h3>Table {table.table_number}</h3>
            <span className="badge badge-info">{table.total_items} items</span>
          </div>
          <div className="card-body" style={{ padding: '0 12px' }}>
            {table.orders.map(order => (
              <div key={order.id} style={{ marginBottom: 16 }}>
                <div className="flex justify-between text-secondary mb-sm" style={{ fontSize: 12 }}>
                  <span>Order #{order.id} {order.status === 'hold' && <span className="badge badge-warning ml-sm">ON HOLD</span>}</span>
                  <span className="flex align-center gap-sm"><Clock size={12} /> {formatDateTime(order.created_at)}</span>
                </div>
                
                <div className="flex-col gap-sm pb-md">
                  {order.items.map(item => {
                    const isRejected = item.status === 'rejected' || item.status === 'cancelled';
                    return (
                      <div key={item.id} className="flex justify-between align-center p-sm bg-secondary" style={{ borderRadius: 'var(--radius-sm)', padding: '6px 10px', opacity: isRejected ? 0.6 : 1 }}>
                        <div style={{ textDecoration: isRejected ? 'line-through' : 'none' }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>
                            {item.quantity}x {item.item_name}
                            <span className="text-muted ml-sm" style={{ fontSize: 11, fontWeight: 'normal' }}>({formatTime(item.created_at)})</span>
                          </div>
                          {item.notes && <div className="text-secondary" style={{ fontSize: 11, marginTop: 2 }}>Note: {item.notes}</div>}
                        </div>
                        <div className="flex-col align-end gap-xs">
                          {item.status === 'pending' && (
                            <div className="flex gap-xs">
                              <button className="btn btn-sm btn-secondary" style={{ padding: '4px' }} title="Reject" onClick={() => {
                                const reason = prompt('Reason for rejection:');
                                if (reason !== null && reason.trim() !== '') updateItemStatus(order.id, item.id, 'rejected', reason);
                              }}>
                                <X size={16} className="text-danger" />
                              </button>
                              <button className="btn btn-sm btn-info" style={{ padding: '4px' }} title="Accept" onClick={() => updateItemStatus(order.id, item.id, 'accepted')}>
                                <Check size={16} />
                              </button>
                            </div>
                          )}
                          {(item.status === 'accepted' || item.status === 'preparing') && (
                            <button className="btn btn-sm btn-success" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => updateItemStatus(order.id, item.id, 'prepared')}>Prepared</button>
                          )}
                          {isRejected && (
                            <div className="badge badge-danger" style={{ fontSize: 10 }}>Cancelled</div>
                          )}
                          {!['pending', 'accepted', 'preparing'].includes(item.status) && !isRejected && (
                            <div className="badge" style={{ backgroundColor: getStatusColor(item.status), color: '#fff', fontSize: 10 }}>
                              {item.status.replace('_', ' ').toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        );
        })}
      </div>
    </>
  );
}
