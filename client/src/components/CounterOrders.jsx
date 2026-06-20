import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Plus, X, Trash2, ShoppingBag, DollarSign, Bell, Search } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import { useNavigate, useLocation } from 'react-router-dom';
import { subscribeToEvent, unsubscribeFromEvent } from '../api/socket';
import MenuTab from '../customer/MenuTab';
import AdminCounterOrderModal from '../admin/AdminCounterOrderModal';

export default function CounterOrders({ isAdminView = false }) {
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
  const [cameFromTables, setCameFromTables] = useState(false);
  const [waiterStep, setWaiterStep] = useState(1);
  const [expandedTableId, setExpandedTableId] = useState(null);
  const cartEndRef = useRef(null);
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
    cartEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [cart]);

  useEffect(() => {
    if (location.state?.autoOpenTableId) {
      setSelectedTableId(location.state.autoOpenTableId.toString());
      setCustomerName('Admin');
      setShowAddModal(true);
      setCameFromTables(true);
      navigate('.', { replace: true, state: {} });
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
      const cats = [...new Set(res.data.map(item => item.category_name))];
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
      if (selectedTableId) {
        // ALWAYS check backend for an active order to avoid race conditions
        const activeRes = await api.get(`/orders/table/${selectedTableId}/active`).catch(() => null);
        const activeOrderForTable = activeRes?.data;
        
        if (activeOrderForTable) {
          const items = cart.map(i => ({ menu_item_id: i.id, quantity: i.quantity, price_at_order: i.price, notes: i.notes }));
          await api.post(`/orders/${activeOrderForTable.id}/items`, { items });
          showToast('Items added to existing table order', 'success');
          setShowAddModal(false);
          setCart([]);
          setCustomerName('');
          setSelectedTableId('');
          setWaiterStep(1);
          fetchOrders();
          return;
        }
      }

      await api.post('/orders', {
        order_type: selectedTableId ? 'table' : 'counter',
        table_id: selectedTableId || null,
        items: cart.map(item => ({
          menu_item_id: item.id,
          quantity: item.quantity,
          customer_name: customerName,
          price_at_order: item.price,
          notes: item.notes
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
          <h1 style={{ margin: 0 }}>{isAdminView ? 'Counter Orders' : 'Table Orders'}</h1>
          <p className="text-secondary" style={{ margin: 0, marginTop: 4 }}>{isAdminView ? 'Manage walk-in and takeaway orders' : 'Select a table and place orders'}</p>
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
          <button 
            className="btn btn-primary" 
            onClick={() => {
              setSelectedTableId('');
              setCustomerName('');
              setCart([]);
              setShowAddModal(true);
            }} 
            style={{ whiteSpace: 'nowrap' }}
          >
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

      {/* Add Counter Order / Table Selection Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 1100, width: '95%', background: 'var(--glass-bg)', backdropFilter: 'blur(30px)', border: '1px solid var(--glass-border)' }}>
            <div className="modal-header">
              <h2>{isAdminView ? 'New Counter Order' : (waiterStep === 1 ? 'Table Selection' : `Order for Table ${tables.find(t => t.id === parseInt(selectedTableId))?.number}`)}</h2>
              <button 
                className="btn btn-icon" 
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedTableId('');
                  setCustomerName('');
                  setCart([]);
                  if (cameFromTables) {
                    navigate('/admin/tables');
                  }
                  setCameFromTables(false);
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" id="customer-scroll-container" style={{ height: '80vh', overflowY: 'auto', overflowX: 'auto', padding: 0 }}>
              {isAdminView ? (
                <AdminCounterOrderModal
                  tables={tables}
                  adminTableId={selectedTableId}
                  setAdminTableId={setSelectedTableId}
                  adminCustomerName={customerName}
                  setAdminCustomerName={setCustomerName}
                  cart={cart}
                  setCart={setCart}
                  onAdminSubmitSuccess={() => {
                    setShowAddModal(false);
                    fetchOrders();
                    setCart([]);
                    setSelectedTableId('');
                    setCustomerName('');
                    if (cameFromTables) {
                      navigate('/admin/tables');
                      setCameFromTables(false);
                    }
                  }}
                />
              ) : waiterStep === 1 ? (
                <div style={{ padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100%', background: 'var(--bg-base)' }}>
                  <h2 style={{ marginBottom: '24px', fontSize: '24px', color: 'var(--text-primary)' }}>Select a Table</h2>
                  
                  <div style={{ width: '100%', maxWidth: '800px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {tables.map(t => {
                      const isOccupied = t.status === 'occupied';
                      const isExpanded = expandedTableId === t.id;
                      const activeOrder = isOccupied ? allOrders.find(o => String(o.table_id) === String(t.id) && ['active', 'checkout_requested'].includes(o.status)) : null;

                      return (
                        <div 
                          key={t.id}
                          style={{ 
                            background: 'var(--bg-primary)', 
                            borderRadius: '12px', 
                            borderLeft: `6px solid ${isOccupied ? 'var(--danger)' : 'var(--success)'}`,
                            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                            overflow: 'hidden',
                            transition: 'all 0.2s',
                            cursor: 'pointer'
                          }}
                        >
                          <div 
                            style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            onClick={() => {
                              if (isOccupied) {
                                setExpandedTableId(isExpanded ? null : t.id);
                              } else {
                                setSelectedTableId(t.id);
                                setWaiterStep(2);
                              }
                            }}
                          >
                            <div>
                              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>Table {t.number}</h3>
                              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{isOccupied ? 'Occupied' : 'Available'}</span>
                            </div>
                            {isOccupied && (
                              <div style={{ padding: '6px 12px', background: 'var(--bg-secondary)', borderRadius: '20px', fontSize: '13px', fontWeight: 500 }}>
                                {isExpanded ? 'Hide' : 'View'}
                              </div>
                            )}
                          </div>
                          
                          {isOccupied && isExpanded && (
                            <div style={{ borderTop: '1px solid var(--border)', padding: '16px', background: 'var(--bg-secondary)' }}>
                              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>Active Order Items</h4>
                              {activeOrder?.items?.length > 0 ? (
                                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px 0', fontSize: '14px' }}>
                                  {activeOrder.items.map(item => (
                                    <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-primary)' }}>
                                      <span>{item.quantity}x {item.item_name}</span>
                                      <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(item.price_at_order * item.quantity)}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>No items found.</p>
                              )}
                              <button 
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', fontWeight: 600 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTableId(t.id);
                                  setWaiterStep(2);
                                }}
                              >
                                Place New Order
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <AdminCounterOrderModal
                  tables={tables}
                  adminTableId={selectedTableId}
                  setAdminTableId={setSelectedTableId}
                  adminCustomerName={customerName}
                  setAdminCustomerName={setCustomerName}
                  cart={cart}
                  setCart={setCart}
                  onAdminSubmitSuccess={() => {
                    setShowAddModal(false);
                    fetchOrders();
                    setCart([]);
                    setSelectedTableId('');
                    setCustomerName('');
                    setWaiterStep(1);
                  }}
                />
              )}
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
