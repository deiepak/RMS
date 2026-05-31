import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Plus, X, Trash2, ShoppingBag, DollarSign, Bell, Search } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import { useNavigate } from 'react-router-dom';
import { subscribeToEvent, unsubscribeFromEvent } from '../api/socket';

export default function CounterOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [viewOrderDetails, setViewOrderDetails] = useState(null);
  const [tables, setTables] = useState([]);
  const [assignTableId, setAssignTableId] = useState('');
  const [menuSearch, setMenuSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    fetchOrders();
    fetchMenu();
    fetchTables();

    const handleUpdate = () => {
      fetchOrders();
      fetchTables();
    };
    subscribeToEvent('order:new', handleUpdate);
    subscribeToEvent('order:item-status', handleUpdate);
    subscribeToEvent('order:status-update', handleUpdate);

    return () => {
      unsubscribeFromEvent('order:new', handleUpdate);
      unsubscribeFromEvent('order:item-status', handleUpdate);
      unsubscribeFromEvent('order:status-update', handleUpdate);
    };
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get('/orders?status=active,checkout_requested&include_undelivered=true');
      // Filter only counter orders
      const counterOrders = res.data.filter(o => o.order_type === 'counter');
      setOrders(counterOrders);
    } catch (error) {
      showToast('Failed to load counter orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchMenu = async () => {
    try {
      const res = await api.get('/menu');
      setMenuItems(res.data);
      const cats = [...new Set(res.data.map(item => item.category))];
      setCategories(cats);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchTables = async () => {
    try {
      const res = await api.get('/tables');
      setTables(res.data.filter(t => t.status !== 'occupied'));
    } catch (error) {
      console.error(error);
    }
  };

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1, notes: '' }];
    });
  };

  const updateCartItem = (id, field, value) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const handleCreateOrder = async () => {
    if (cart.length === 0) return showToast('Cart is empty', 'error');
    try {
      const items = cart.map(i => ({
        menu_item_id: i.id,
        quantity: i.quantity,
        notes: i.notes
      }));
      await api.post('/orders', { 
        order_type: 'counter',
        customer_name: customerName,
        items 
      });
      showToast('Counter order created', 'success');
      setShowAddModal(false);
      setCart([]);
      setCustomerName('');
      fetchOrders();
    } catch (error) {
      showToast('Failed to create order', 'error');
    }
  };

  const handleViewOrder = async (orderId) => {
    try {
      const res = await api.get(`/orders/${orderId}`);
      setViewOrderDetails(res.data);
    } catch (error) {
      showToast('Failed to load order details', 'error');
    }
  };

  const handleProceedToPayment = async () => {
    if (!viewOrderDetails) return;
    try {
      if (viewOrderDetails.status !== 'checkout_requested') {
        await api.patch(`/orders/${viewOrderDetails.id}/checkout`, {});
      }
      navigate('/admin/payments', { state: { autoOpenOrderId: viewOrderDetails.id } });
    } catch (error) {
      showToast('Failed to proceed to payment', 'error');
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel this counter order?')) return;
    try {
      await api.patch(`/orders/${orderId}/status`, { status: 'cancelled' });
      showToast('Order cancelled', 'success');
      setViewOrderDetails(null);
      fetchOrders();
    } catch (error) {
      showToast('Failed to cancel order', 'error');
    }
  };

  const handleAssignTable = async () => {
    if (!viewOrderDetails || !assignTableId) return;
    try {
      await api.patch(`/orders/${viewOrderDetails.id}/assign-table`, { table_id: assignTableId });
      showToast('Order assigned to table', 'success');
      setViewOrderDetails(null);
      setAssignTableId('');
      fetchOrders();
    } catch (error) {
      showToast('Failed to assign table', 'error');
    }
  };

  const filteredOrders = orders.filter(o => 
    o.order_name?.toLowerCase().includes(orderSearch.toLowerCase()) || 
    o.items?.[0]?.customer_name?.toLowerCase().includes(orderSearch.toLowerCase()) ||
    o.id.toString().includes(orderSearch)
  );

  return (
    <div className="admin-page">
      <div className="flex justify-between align-center mb-xl">
        <div>
          <h1>Counter Orders</h1>
          <p className="text-secondary">Manage walk-in and takeaway orders</p>
        </div>
        <div className="flex gap-md align-center">
          <div className="input-with-icon" style={{ width: 250 }}>
            <Search size={16} />
            <input
              type="text"
              className="form-input"
              placeholder="Search orders..."
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={18} /> New Counter Order
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-secondary p-xl">Loading counter orders...</div>
      ) : orders.length === 0 ? (
        <div className="card text-center p-xl">
          <ShoppingBag size={48} className="text-secondary mb-md mx-auto" />
          <h3>No Active Counter Orders</h3>
          <p className="text-secondary">Click 'New Counter Order' to create one.</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="card text-center p-xl">
          <p className="text-secondary">No orders match your search.</p>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {filteredOrders.map(order => (
            <div key={order.id} className="card p-lg cursor-pointer" onClick={() => handleViewOrder(order.id)}>
              <div className="flex justify-between align-center mb-md">
                <h3 style={{ margin: 0 }}>{order.order_name || `Counter Order ${order.id}`}</h3>
                <span className={`badge ${order.status === 'checkout_requested' ? 'badge-warning' : 'badge-info'}`}>
                  {order.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div className="text-secondary mb-sm" style={{ fontSize: 14 }}>
                Customer: {order.items?.[0]?.customer_name || 'Guest'}
              </div>
              <div className="flex justify-between align-center mt-md pt-md" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-secondary">{formatDateTime(order.created_at)}</span>
                <span style={{ fontWeight: 'bold', color: 'var(--success)' }}>{formatCurrency(order.total)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Counter Order Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 800, width: '90%' }}>
            <div className="modal-header">
              <h2>New Counter Order</h2>
              <button className="btn btn-icon" onClick={() => setShowAddModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body flex gap-lg" style={{ height: '60vh' }}>
              <div style={{ flex: 2, overflowY: 'auto' }}>
                <div className="mb-md flex gap-sm">
                  <input 
                    type="text" 
                    className="input flex-1" 
                    placeholder="Customer Name (Optional)" 
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                  />
                  <div className="input-with-icon flex-1">
                    <Search size={16} />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search menu..."
                      value={menuSearch}
                      onChange={(e) => setMenuSearch(e.target.value)}
                    />
                  </div>
                </div>
                {categories.map(cat => {
                  const filteredItems = menuItems.filter(m => m.category === cat && m.name.toLowerCase().includes(menuSearch.toLowerCase()));
                  if (filteredItems.length === 0) return null;
                  return (
                  <div key={cat} className="mb-lg">
                    <h4 className="mb-sm">{cat}</h4>
                    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                      {filteredItems.map(item => (
                        <div key={item.id} className="card p-sm flex flex-col justify-between cursor-pointer hover-lift" onClick={() => addToCart(item)} style={{ background: 'var(--bg-secondary)', border: '2px solid transparent' }}>
                          <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 8 }}>{item.name}</div>
                          <div className="flex justify-between align-center">
                            <div className="text-primary" style={{ fontSize: 13, fontWeight: 600 }}>{formatCurrency(item.price)}</div>
                            <div className="btn btn-icon btn-sm" style={{ background: 'var(--bg-primary)', padding: 4 }}><Plus size={14} /></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  );
                })}
              </div>
              <div style={{ flex: 1, borderLeft: '1px solid var(--border)', paddingLeft: '20px', display: 'flex', flexDirection: 'column' }}>
                <h3 className="mb-md">Order Cart</h3>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {cart.length === 0 ? (
                    <div className="text-secondary text-center p-md">Cart is empty</div>
                  ) : (
                    cart.map(item => (
                      <div key={item.id} className="mb-sm p-sm bg-secondary" style={{ borderRadius: 'var(--radius-sm)' }}>
                        <div className="flex justify-between align-center mb-xs">
                          <span style={{ fontWeight: 500 }}>{item.name}</span>
                          <button className="btn btn-icon btn-sm text-danger" onClick={() => removeFromCart(item.id)}><X size={14} /></button>
                        </div>
                        <div className="flex justify-between align-center">
                          <input 
                            type="number" 
                            min="1"
                            className="input btn-sm" 
                            style={{ width: 60, padding: 4 }}
                            value={item.quantity}
                            onChange={(e) => updateCartItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                          />
                          <span style={{ fontWeight: 600 }}>{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-md pt-md" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="flex justify-between mb-md text-lg" style={{ fontWeight: 'bold' }}>
                    <span>Total:</span>
                    <span>{formatCurrency(cart.reduce((s, i) => s + (i.price * i.quantity), 0))}</span>
                  </div>
                  <button className="btn btn-primary w-full" onClick={handleCreateOrder} disabled={cart.length === 0}>
                    Place Counter Order
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View/Pay Modal */}
      {viewOrderDetails && (
        <div className="modal-overlay" onClick={() => setViewOrderDetails(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>{viewOrderDetails.order_name || 'Counter Order'}</h2>
              <button className="btn btn-icon" onClick={() => setViewOrderDetails(null)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              <div className="flex-col gap-sm mb-lg">
                {viewOrderDetails.items?.map(item => {
                  const isCancelled = item.status === 'rejected' || item.status === 'cancelled';
                  return (
                    <div key={item.id} className="flex justify-between p-sm bg-secondary" style={{ 
                      borderRadius: 'var(--radius-sm)',
                      opacity: isCancelled ? 0.6 : 1,
                      textDecoration: isCancelled ? 'line-through' : 'none'
                    }}>
                      <span>{item.quantity}x {item.item_name}</span>
                      <div className="flex gap-md align-center">
                        <span style={{ fontWeight: 600 }}>{formatCurrency((item.price_at_order || item.price) * item.quantity)}</span>
                        <span className={isCancelled ? "text-danger" : ""} style={{ width: 80, textAlign: 'right' }}>
                          {isCancelled ? 'CANCELLED' : item.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mb-md text-lg" style={{ fontWeight: 'bold' }}>
                <span>Total Amount:</span>
                <span className="text-success">{formatCurrency(viewOrderDetails.total)}</span>
              </div>
            </div>
            <div className="modal-footer flex-col gap-sm">
              <button className="btn btn-primary w-full p-md" style={{ fontSize: '1.1rem' }} onClick={handleProceedToPayment}>
                Proceed to Payment
              </button>
              
              <div className="flex gap-sm w-full mt-sm mb-sm p-sm bg-secondary" style={{ borderRadius: 'var(--radius-sm)', alignItems: 'center' }}>
                <select className="form-select flex-2" value={assignTableId} onChange={e => setAssignTableId(e.target.value)}>
                  <option value="">-- Assign to Table --</option>
                  {tables.map(t => <option key={t.id} value={t.id}>{t.number} ({t.capacity} pax)</option>)}
                </select>
                <button className="btn btn-secondary flex-1" onClick={handleAssignTable} disabled={!assignTableId}>Assign</button>
              </div>

              <div className="flex gap-sm w-full">
                <button className="btn btn-danger flex-1" onClick={() => handleDeleteOrder(viewOrderDetails.id)}>Cancel Order</button>
                <button className="btn btn-secondary flex-1" onClick={() => { setViewOrderDetails(null); setAssignTableId(''); }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
