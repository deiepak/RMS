import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import { Search, Ban, History, Clock, FileText, CheckCircle, RefreshCw } from 'lucide-react';
import Modal from '../components/Modal';

export default function SalesReturn() {
  const [activeTab, setActiveTab] = useState('process'); // 'process' | 'logs'
  const { showToast } = useToast();

  // Process Sales Return State
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnReason, setReturnReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Logs State
  const [logs, setLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logsSearch, setLogsSearch] = useState('');
  const [filters, setFilters] = useState({
    period: 'today',
    from: '',
    to: ''
  });

  const setDateRange = (period) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const endOfDay = new Date();
    endOfDay.setHours(23,59,59,999);
    
    let fromDate = new Date(today);
    
    if (period === 'today') {
      fromDate = today;
    } else if (period === 'week') {
      fromDate.setDate(today.getDate() - 7);
    } else if (period === 'month') {
      fromDate.setMonth(today.getMonth() - 1);
    }

    const pad = (n) => n.toString().padStart(2, '0');
    const toLocalISOString = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

    if (period !== 'custom') {
      setFilters(prev => ({
        ...prev,
        period,
        from: toLocalISOString(fromDate),
        to: toLocalISOString(endOfDay)
      }));
    } else {
      setFilters(prev => ({ ...prev, period }));
    }
  };

  useEffect(() => {
    setDateRange('today');
    fetchRecentOrders();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (filters.from && filters.to && activeTab === 'logs') {
      fetchLogs();
    }
  }, [filters, activeTab, logsSearch]);

  const fetchRecentOrders = async () => {
    try {
      setSearching(true);
      const res = await api.get('/orders?status=completed,active&limit=20');
      setOrders(res.data || []);
    } catch (error) {
      showToast('Failed to load recent orders', 'error');
    } finally {
      setSearching(false);
    }
  };

  const handleSearchOrder = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      fetchRecentOrders();
      return;
    }
    try {
      setSearching(true);
      const cleanedSearch = searchTerm.replace(/^ORD-/i, '').trim();
      const res = await api.get(`/orders?search=${cleanedSearch}`);
      setOrders(res.data || []);
      if (res.data && res.data.length === 1) {
        setSelectedOrder(res.data[0]);
      }
    } catch (error) {
      showToast('Failed to search order', 'error');
    } finally {
      setSearching(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setIsLoadingLogs(true);
      const searchParam = logsSearch ? `&search=${encodeURIComponent(logsSearch)}` : '';
      const res = await api.get(`/orders/sales-return-logs?from=${filters.from}%2000:00:00&to=${filters.to}%2023:59:59${searchParam}`);
      setLogs(res.data || []);
    } catch (error) {
      showToast('Failed to load sales return logs', 'error');
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleOpenReturnModal = (order, item) => {
    setSelectedOrder(order);
    setSelectedItem(item);
    setReturnQuantity(1);
    setReturnReason('');
    setReturnModalOpen(true);
  };

  const handleProcessSalesReturn = async (e) => {
    e.preventDefault();
    if (returnQuantity <= 0 || returnQuantity > selectedItem.quantity) {
      showToast('Invalid return quantity', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post(`/orders/${selectedOrder.id}/sales-return`, {
        order_item_id: selectedItem.id || selectedItem._id,
        quantity: returnQuantity,
        reason: returnReason
      });

      showToast(`Sales return processed successfully. Refund: ${formatCurrency(res.data.returnAmount)}`, 'success');
      setReturnModalOpen(false);
      
      // Refresh order details
      if (searchTerm.trim()) {
        const cleanedSearch = searchTerm.replace(/^ORD-/i, '').trim();
        const searchRes = await api.get(`/orders?search=${cleanedSearch}`);
        setOrders(searchRes.data || []);
        const updated = (searchRes.data || []).find(o => o.id === selectedOrder.id);
        setSelectedOrder(updated || null);
      } else {
        await fetchRecentOrders();
        if (selectedOrder) {
          // Update selected order reference if it exists in recent orders
          const searchRes = await api.get('/orders?status=completed,active&limit=20');
          const updated = (searchRes.data || []).find(o => o.id === selectedOrder.id);
          setSelectedOrder(updated || null);
        }
      }
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to process sales return', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-content">
      <div className="admin-header flex justify-between align-center mb-md">
        <h2>Sales Return Management</h2>
        <div className="flex gap-sm bg-secondary" style={{ padding: 4, borderRadius: 'var(--radius)' }}>
          <button 
            className={`btn ${activeTab === 'process' ? 'btn-primary' : 'btn-secondary'} btn-sm flex align-center gap-xs`} 
            style={{ border: 'none' }} 
            onClick={() => setActiveTab('process')}
          >
            <Ban size={16} /> Process Return
          </button>
          <button 
            className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-secondary'} btn-sm flex align-center gap-xs`} 
            style={{ border: 'none' }} 
            onClick={() => setActiveTab('logs')}
          >
            <History size={16} /> Sales Return Logs
          </button>
        </div>
      </div>

      {activeTab === 'process' && (
        <div>
          <div className="card mb-lg" style={{ padding: 20 }}>
            <form onSubmit={handleSearchOrder} className="flex gap-md align-center">
              <div className="input-with-icon flex-1">
                <Search size={18} />
                <input 
                  type="text" 
                  className="form-input w-full" 
                  placeholder="Search order by ID (e.g. ORD-123 or 123) or Table Number..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                />
              </div>
              <button type="submit" className="btn btn-primary flex align-center gap-xs" disabled={searching}>
                {searching ? <RefreshCw size={16} className="spin" /> : <Search size={16} />} Search Order
              </button>
              {searchTerm && (
                <button type="button" className="btn btn-secondary" onClick={() => { setSearchTerm(''); fetchRecentOrders(); setSelectedOrder(null); }}>
                  Clear
                </button>
              )}
            </form>
          </div>

          <div style={{ display: 'flex', gap: '24px', flexDirection: window.innerWidth < 1024 ? 'column' : 'row' }}>
            <div style={{ flex: selectedOrder ? '1 1 40%' : '1 1 100%', minWidth: 0 }}>
              <div className="card">
                <div className="card-header">
                  <h3>{searchTerm ? 'Search Results' : 'Recent Orders'}</h3>
                </div>
                <div className="card-body p-0">
                  {searching ? (
                    <div className="flex-center" style={{ height: 200 }}><div className="loader"></div></div>
                  ) : orders.length === 0 ? (
                    <div className="flex-center" style={{ height: 200, color: 'var(--text-secondary)' }}>No orders found.</div>
                  ) : (
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Order ID</th>
                            <th>Table / Ref</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map(order => (
                            <tr 
                              key={order.id} 
                              style={{ 
                                backgroundColor: selectedOrder?.id === order.id ? 'var(--bg-secondary)' : 'transparent',
                                cursor: 'pointer' 
                              }}
                              onClick={() => setSelectedOrder(order)}
                            >
                              <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>ORD-{order.id}</td>
                              <td>{order.table_number ? `Table ${order.table_number}` : 'Counter Order'}</td>
                              <td style={{ fontWeight: 600 }}>{formatCurrency(order.total)}</td>
                              <td>
                                <span className={`badge ${order.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                                  {order.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td>
                                <button className="btn btn-secondary btn-sm">Select</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {selectedOrder && (
              <div style={{ flex: '1 1 60%', minWidth: 0 }}>
                <div className="card">
                  <div className="card-header flex justify-between align-center">
                    <h3>Order Details - ORD-{selectedOrder.id}</h3>
                    <button className="btn btn-secondary btn-sm" onClick={() => setSelectedOrder(null)}>Close View</button>
                  </div>
                  <div className="card-body">
                    <div className="flex justify-between mb-md bg-secondary p-md" style={{ borderRadius: 'var(--radius)' }}>
                      <div>
                        <div className="text-secondary" style={{ fontSize: 13 }}>Table</div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{selectedOrder.table_number ? `Table ${selectedOrder.table_number}` : 'Counter Order'}</div>
                      </div>
                      <div>
                        <div className="text-secondary" style={{ fontSize: 13 }}>Date</div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{formatDateTime(selectedOrder.created_at)}</div>
                      </div>
                      <div>
                        <div className="text-secondary" style={{ fontSize: 13 }}>Status</div>
                        <div className={`badge ${selectedOrder.status === 'completed' ? 'badge-success' : 'badge-warning'}`} style={{ textTransform: 'capitalize' }}>
                          {selectedOrder.status.replace('_', ' ')}
                        </div>
                      </div>
                    </div>

                    <h4 className="mb-sm flex align-center gap-xs"><FileText size={16} /> Order Items</h4>
                    {(!selectedOrder.items || selectedOrder.items.length === 0) ? (
                      <div className="text-center p-lg text-secondary">No active items in this order (all items may have been returned/deleted).</div>
                    ) : (
                      <div className="table-responsive mb-md">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Item Name</th>
                              <th>Category</th>
                              <th>Qty</th>
                              <th>Price</th>
                              <th>Total</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedOrder.items.map(item => (
                              <tr key={item.id || item._id}>
                                <td style={{ fontWeight: 600 }}>{item.item_name || item.name}</td>
                                <td className="text-secondary">{item.category_name || 'Menu'}</td>
                                <td>{item.quantity}</td>
                                <td>{formatCurrency(item.price_at_order || item.price)}</td>
                                <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                                  {formatCurrency((item.price_at_order || item.price) * item.quantity)}
                                </td>
                                <td>
                                  <button 
                                    className="btn btn-danger btn-sm flex align-center gap-xs" 
                                    onClick={() => handleOpenReturnModal(selectedOrder, item)}
                                  >
                                    <Ban size={14} /> Return Item
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="flex-col gap-sm p-md bg-secondary" style={{ borderRadius: 'var(--radius)' }}>
                      <div className="flex justify-between">
                        <span className="text-secondary">Subtotal</span>
                        <span>{formatCurrency(selectedOrder.subtotal)}</span>
                      </div>
                      {parseFloat(selectedOrder.discount) > 0 && (
                        <div className="flex justify-between text-success">
                          <span>Discount</span>
                          <span>-{formatCurrency(selectedOrder.discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between align-center mt-sm pt-sm" style={{ borderTop: '1px solid var(--border-color)' }}>
                        <span style={{ fontWeight: 600, fontSize: 16 }}>Grand Total</span>
                        <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent-primary)' }}>{formatCurrency(selectedOrder.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div>
          <div className="card mb-lg" style={{ padding: 20 }}>
            <div className="flex gap-lg flex-wrap align-center">
              <div className="flex gap-sm bg-secondary" style={{ padding: 4, borderRadius: 'var(--radius)' }}>
                <button className={`btn ${filters.period === 'today' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none' }} onClick={() => setDateRange('today')}>Today</button>
                <button className={`btn ${filters.period === 'week' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none' }} onClick={() => setDateRange('week')}>This Week</button>
                <button className={`btn ${filters.period === 'month' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none' }} onClick={() => setDateRange('month')}>This Month</button>
                <button className={`btn ${filters.period === 'custom' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none' }} onClick={() => setDateRange('custom')}>Custom Range</button>
              </div>

              {filters.period === 'custom' && (
                <div className="flex gap-md align-center">
                  <input type="date" className="form-input" style={{ padding: '8px' }} value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} />
                  <span className="text-secondary">to</span>
                  <input type="date" className="form-input" style={{ padding: '8px' }} value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} />
                </div>
              )}

              <div className="input-with-icon flex-1 ml-auto">
                <Search size={16} />
                <input 
                  type="text" 
                  className="form-input w-full" 
                  placeholder="Search logs by Order ID, Item Name, Reason, or Admin..." 
                  value={logsSearch} 
                  onChange={e => setLogsSearch(e.target.value)} 
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Sales Return Audit Logs</h3>
            </div>
            <div className="card-body p-0">
              {isLoadingLogs ? (
                <div className="flex-center" style={{ height: 200 }}><div className="loader"></div></div>
              ) : logs.length === 0 ? (
                <div className="flex-center" style={{ height: 200, color: 'var(--text-secondary)' }}>No sales return logs found for selected period.</div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Order ID</th>
                        <th>Returned Item</th>
                        <th>Qty</th>
                        <th>Refund Amount</th>
                        <th>Reason</th>
                        <th>Processed By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} style={{ backgroundColor: 'rgba(245, 158, 11, 0.05)' }}>
                          <td>{formatDateTime(log.created_at)}</td>
                          <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>ORD-{log.order_id}</td>
                          <td style={{ fontWeight: 600 }}>{log.item_name}</td>
                          <td><span className="badge badge-warning">{log.quantity}x</span></td>
                          <td style={{ fontWeight: 600 }} className="text-warning">{formatCurrency(log.refund_amount)}</td>
                          <td className="text-secondary">{log.reason || 'N/A'}</td>
                          <td style={{ fontWeight: 500 }}>{log.processed_by}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        title={`Process Sales Return - ${selectedItem?.item_name || selectedItem?.name}`}
        maxWidth="500px"
      >
        {selectedItem && (
          <form onSubmit={handleProcessSalesReturn} className="flex-col gap-md">
            <div className="bg-secondary p-md flex justify-between align-center" style={{ borderRadius: 'var(--radius)' }}>
              <div>
                <div className="text-secondary" style={{ fontSize: 12 }}>Unit Price</div>
                <div style={{ fontWeight: 600 }}>{formatCurrency(selectedItem.price_at_order || selectedItem.price)}</div>
              </div>
              <div>
                <div className="text-secondary" style={{ fontSize: 12 }}>Max Returnable Qty</div>
                <div style={{ fontWeight: 600 }}>{selectedItem.quantity}</div>
              </div>
              <div>
                <div className="text-secondary" style={{ fontSize: 12 }}>Total Refund</div>
                <div style={{ fontWeight: 700, color: 'var(--warning)' }}>{formatCurrency((selectedItem.price_at_order || selectedItem.price) * returnQuantity)}</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Return Quantity</label>
              <input 
                type="number" 
                className="form-input w-full" 
                min="1" 
                max={selectedItem.quantity} 
                value={returnQuantity} 
                onChange={e => setReturnQuantity(parseInt(e.target.value || 1))} 
                required 
              />
              <span className="text-secondary mt-xs block" style={{ fontSize: 11 }}>
                Specify the exact quantity being returned. The order total will be reduced and inventory will be restocked accordingly.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Reason for Return (Optional)</label>
              <textarea 
                className="form-input w-full" 
                rows="3" 
                placeholder="e.g. Customer changed mind, food spoiled, incorrect entry..." 
                value={returnReason} 
                onChange={e => setReturnReason(e.target.value)} 
              />
            </div>

            <div className="flex gap-md justify-end mt-md">
              <button type="button" className="btn btn-secondary" onClick={() => setReturnModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-danger flex align-center gap-xs" disabled={isSubmitting}>
                {isSubmitting ? <RefreshCw size={16} className="spin" /> : <Ban size={16} />} Confirm Sales Return
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
