import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Plus, X, Trash2, ShoppingBag, DollarSign, Bell, Search } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import { useNavigate, useLocation } from 'react-router-dom';
import { subscribeToEvent, unsubscribeFromEvent } from '../api/socket';

export default function CounterOrders() {
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showActiveOrdersModal, setShowActiveOrdersModal] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [viewOrderDetails, setViewOrderDetails] = useState(null);
  const [tables, setTables] = useState([]);
  const [assignTableId, setAssignTableId] = useState('');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [orderSearch, setOrderSearch] = useState('');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const location = useLocation();

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

  useEffect(() => {
    if (location.state?.autoOpenTableId) {
      setSelectedTableId(location.state.autoOpenTableId.toString());
      setCustomerName('Admin');
      setShowAddModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get('/orders?status=active,checkout_requested&include_undelivered=true');
      setAllOrders(res.data);
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
      setTables(res.data);
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
    if (cart.length === 0) return;
    try {
      if (selectedTableId && tables.find(t => t.id === parseInt(selectedTableId))?.status === 'occupied') {
        const activeOrderForTable = allOrders.find(o => String(o.table_id) === String(selectedTableId) && ['active', 'checkout_requested'].includes(o.status));
        if (activeOrderForTable) {
          const items = cart.map(i => ({ menu_item_id: i.id, quantity: i.quantity, price_at_order: i.price }));
          await api.post(`/orders/${activeOrderForTable.id}/items`, { items });
          showToast('Items added to existing table order', 'success');
          setShowAddModal(false);
          setCart([]);
          setCustomerName('');
          setSelectedTableId('');
          fetchOrders();
          return;
        }
      }

      await api.post('/orders', {
        order_type: 'counter',
        table_id: selectedTableId || null,
        items: cart.map(item => ({
          menu_item_id: item.id,
          quantity: item.quantity,
          customer_name: customerName,
          price_at_order: item.price
        }))
      });
      showToast('Order created successfully', 'success');
      setShowAddModal(false);
      setCart([]);
      setCustomerName('');
      setSelectedTableId('');
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
    <div style={{ padding: '24px' }}>
      <div className="flex justify-between mb-xl" style={{ flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0 }}>Counter Orders</h1>
          <p className="text-secondary" style={{ margin: 0, marginTop: 4 }}>Manage walk-in and takeaway orders</p>
        </div>
        <div className="flex gap-md" style={{ flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end', minWidth: '300px' }}>
          <div className="input-with-icon" style={{ flex: 1, minWidth: '200px', maxWidth: '300px' }}>
            <Search size={18} />
            <input
              type="text"
              className="form-input"
              placeholder="Search orders..."
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary" onClick={() => setShowActiveOrdersModal(true)} style={{ whiteSpace: 'nowrap' }}>
            Active Orders
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ whiteSpace: 'nowrap' }}>
            <Plus size={18} /> New Order
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
          <div className="modal-content" style={{ maxWidth: 900, width: '95%', background: 'var(--glass-bg)', backdropFilter: 'blur(30px)', border: '1px solid var(--glass-border)' }}>
            <div className="modal-header">
              <h2>New Counter Order</h2>
              <button className="btn btn-icon" onClick={() => setShowAddModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body counter-modal-body gap-lg" style={{ height: '75vh', overflow: 'hidden' }}>
              <div className="counter-menu-panel">
                <div style={{ flexShrink: 0 }}>
                  <div className="mb-md flex gap-sm" style={{ flexWrap: 'wrap' }}>
                  <input 
                    type="text" 
                    className="form-input flex-1" 
                    placeholder="Customer Name (Optional)" 
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                  />
                  <select 
                    className="form-select flex-1" 
                    value={selectedTableId}
                    onChange={e => setSelectedTableId(e.target.value)}
                  >
                    <option value="">Table No (Optional)</option>
                    {tables.map(t => (
                      <option key={t.id} value={t.id}>
                        Table {t.number} {t.status === 'occupied' ? '(Occupied)' : ''}
                      </option>
                    ))}
                  </select>
                  <select
                    className="form-select flex-1"
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                  >
                    <option value="All">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <div className="flex flex-1 gap-sm">
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
                    <button className="btn btn-secondary btn-icon" style={{ borderRadius: '8px', flexShrink: 0 }} title="Search">
                      <Search size={16} />
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
              {categories.map(cat => {
                  if (selectedCategory !== 'All' && selectedCategory !== cat) return null;
                  const filteredItems = menuItems.filter(m => m.category === cat && m.name.toLowerCase().includes(menuSearch.toLowerCase()));
                  if (filteredItems.length === 0) return null;
                  return (
                  <div key={cat} className="mb-lg">
                    <h4 className="mb-sm text-secondary">{cat}</h4>
                    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                      {filteredItems.map(item => (
                        <div key={item.id} className="card p-sm flex flex-col justify-between hover-lift" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                          <div className="flex align-start justify-between mb-sm gap-sm">
                            <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>{item.name}</div>
                            <div className={item.is_veg ? 'veg-badge' : 'nonveg-badge'} style={{ width: 10, height: 10, flexShrink: 0, position: 'static' }}></div>
                          </div>
                          <div className="flex justify-between align-center mt-auto pt-sm" style={{ borderTop: '1px dashed var(--border)' }}>
                            <div className="text-primary" style={{ fontSize: 14, fontWeight: 800 }}>{formatCurrency(item.price)}</div>
                            <button className="btn btn-icon btn-primary btn-sm" onClick={() => addToCart(item)} style={{ width: 28, height: 28, borderRadius: '8px' }}><Plus size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  );
                })}
                </div>
              </div>
              <div className="counter-cart-panel">
                <div className="flex justify-between align-center mb-md">
                  <h3 style={{ margin: 0 }}>Order Cart</h3>
                  {cart.length > 0 && (
                    <span className="badge badge-primary" style={{ fontSize: 12 }}>
                      {cart.reduce((s, i) => s + i.quantity, 0)} Items
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {cart.length === 0 ? (
                    <div className="text-secondary text-center p-md">Cart is empty</div>
                  ) : (
                    cart.map(item => (
                      <div key={item.id} className="mb-sm p-md sleek-cart-item" style={{ background: 'var(--bg-elevated)', borderRadius: '16px' }}>
                        <div className="flex justify-between align-center mb-sm">
                          <span style={{ fontWeight: 600, fontSize: '15px' }}>{item.name}</span>
                          <button className="btn btn-icon btn-sm text-danger" onClick={() => removeFromCart(item.id)}><X size={16} /></button>
                        </div>
                        <div className="flex justify-between align-center">
                          <div className="sleek-qty-stepper" style={{ border: 'none', background: 'var(--bg-card)' }}>
                            <input 
                              type="number" 
                              min="1"
                              className="input btn-sm text-center" 
                              style={{ width: 60, padding: 4, background: 'transparent', border: 'none', fontWeight: 600 }}
                              value={item.quantity}
                              onChange={(e) => updateCartItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                            />
                          </div>
                          <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(item.price * item.quantity)}</span>
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
                    {selectedTableId && tables.find(t => t.id === parseInt(selectedTableId))?.status === 'occupied' 
                      ? 'Add to Existing Order' 
                      : 'Place Counter Order'}
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
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, background: 'var(--glass-bg)', backdropFilter: 'blur(30px)', border: '1px solid var(--glass-border)' }}>
            <div className="modal-header">
              <h2>{viewOrderDetails.order_name || 'Counter Order'}</h2>
              <button className="btn btn-icon" onClick={() => setViewOrderDetails(null)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              <div className="flex-col gap-sm mb-lg">
                {viewOrderDetails.items?.map(item => {
                  const isCancelled = item.status === 'rejected' || item.status === 'cancelled';
                  return (
                    <div key={item.id} className="flex justify-between p-md mb-sm" style={{ 
                      borderRadius: '12px',
                      background: 'var(--bg-elevated)',
                      opacity: isCancelled ? 0.6 : 1,
                      textDecoration: isCancelled ? 'line-through' : 'none'
                    }}>
                      <span style={{ fontWeight: 500 }}>{item.quantity}x {item.item_name}</span>
                      <div className="flex gap-md align-center">
                        <span style={{ fontWeight: 700 }}>{formatCurrency((item.price_at_order || item.price) * item.quantity)}</span>
                        <span className={isCancelled ? "text-danger" : "text-info"} style={{ width: 80, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>
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
              
              {!viewOrderDetails.table_id && !viewOrderDetails.tableId && (
                <div className="flex gap-sm w-full mt-sm mb-sm p-sm bg-secondary" style={{ borderRadius: 'var(--radius-sm)', alignItems: 'center' }}>
                  <select className="form-select flex-2" value={assignTableId} onChange={e => setAssignTableId(e.target.value)}>
                    <option value="">-- Assign to Table --</option>
                    {tables.map(t => <option key={t.id} value={t.id}>{t.number} ({t.capacity} pax)</option>)}
                  </select>
                  <button className="btn btn-secondary flex-1" onClick={handleAssignTable} disabled={!assignTableId}>Assign</button>
                </div>
              )}

              <div className="flex gap-sm w-full">
                <button className="btn btn-danger flex-1" onClick={() => handleDeleteOrder(viewOrderDetails.id)}>Cancel Order</button>
                <button className="btn btn-secondary flex-1" onClick={() => { setViewOrderDetails(null); setAssignTableId(''); }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      )}

      {/* Active Orders Summary Modal */}
      {showActiveOrdersModal && (
        <div className="modal-overlay" onClick={() => setShowActiveOrdersModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, width: '95%', background: 'var(--glass-bg)', backdropFilter: 'blur(30px)', border: '1px solid var(--glass-border)' }}>
            <div className="modal-header">
              <h2>Active Orders Summary</h2>
              <button className="btn btn-icon" onClick={() => setShowActiveOrdersModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div className="flex-col gap-sm">
                {allOrders.filter(o => ['active', 'checkout_requested'].includes(o.status)).map(order => (
                  <div key={order.id} className="flex justify-between align-center p-md" style={{ background: 'var(--bg-elevated)', borderRadius: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '15px' }}>
                        {order.order_type === 'table' ? `Table ${order.table_number || order.table?.number || order.table_id}` : (order.order_name || `Counter Order ${order.id}`)}
                      </div>
                      <div className="text-secondary" style={{ fontSize: '13px' }}>
                        {order.items?.length || 0} items
                      </div>
                    </div>
                    <div className="flex align-center gap-md">
                      <span className={`badge ${order.status === 'checkout_requested' ? 'badge-warning' : 'badge-info'}`}>
                        {order.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span style={{ fontWeight: 700, minWidth: '80px', textAlign: 'right' }}>
                        {formatCurrency(order.total)}
                      </span>
                    </div>
                  </div>
                ))}
                {allOrders.filter(o => ['active', 'checkout_requested'].includes(o.status)).length === 0 && (
                  <div className="text-center text-secondary p-xl">No active orders</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
