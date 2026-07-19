import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Ban, Tag, Trash2, Download, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import Modal from '../components/Modal';
import DatePicker from '../components/DatePicker';

export default function CancelDiscountOrders() {
  const [activeTab, setActiveTab] = useState('cancelled'); // 'cancelled' | 'discounted'
  const [data, setData] = useState({ cancelled: [], discounted: [] });
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  const [filters, setFilters] = useState({
    period: 'month',
    from: '',
    to: '',
    discount_reason: 'all',
    custom_type: ''
  });

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [orderIdToDelete, setOrderIdToDelete] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState({});
  const [selectedOrderForDelete, setSelectedOrderForDelete] = useState(null);
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);

  const toggleExpand = (id) => {
    setExpandedOrders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const setDateRange = (period) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    let fromDate = new Date(today);

    if (period === 'today') {
      fromDate = today;
    } else if (period === 'week') {
      fromDate.setDate(today.getDate() - 7);
    } else if (period === 'month') {
      fromDate.setMonth(today.getMonth() - 1);
    }

    if (period !== 'custom') {
      setFilters(prev => ({
        ...prev,
        period,
        from: fromDate.toLocaleDateString('en-CA'),
        to: endOfDay.toLocaleDateString('en-CA')
      }));
    } else {
      setFilters(prev => ({ ...prev, period }));
    }
  };

  useEffect(() => {
    setDateRange('month');
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (filters.from && filters.to) {
      fetchData();
    }
  }, [filters]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams({
        from: `${filters.from} 00:00:00`,
        to: `${filters.to} 23:59:59`,
        discount_reason: filters.discount_reason,
        custom_type: filters.discount_reason === 'Custom' ? filters.custom_type : ''
      }).toString();

      const res = await api.get(`/orders/cancel-discount-report?${queryParams}`);
      setData(res.data);
    } catch (error) {
      showToast('Failed to load orders report', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteOrder = async (id) => {
    if (!id) return;
    try {
      setIsDeleting(true);
      await api.delete(`/orders/${id}`);
      showToast(`Order #${id} deleted successfully`, 'success');
      setIsDeleteModalOpen(false);
      setOrderIdToDelete('');
      fetchData();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to delete order', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const downloadCSV = () => {
    const list = activeTab === 'cancelled' ? data.cancelled : data.discounted;
    if (list.length === 0) {
      showToast('No data to download for the selected filter', 'error');
      return;
    }

    let headers = [];
    let rows = [];

    if (activeTab === 'cancelled') {
      headers = ['Order ID', 'Table Number', 'Order Status', 'Cancellation Reason', 'Subtotal', 'Date'];
      rows = list.map(o => [
        `#${o.id}`,
        o.table_number ? `Table ${o.table_number}` : 'Counter / Takeaway',
        o.status,
        `"${o.cancel_reason ? o.cancel_reason.replace(/"/g, '""') : 'Cancelled by Kitchen'}"`,
        o.subtotal,
        formatDateTime(o.updated_at || o.created_at)
      ]);
    } else {
      headers = ['Order ID', 'Table Number', 'Subtotal', 'Discount', 'Discount Reason', 'Custom Discount Type', 'Total', 'Payment Method', 'Date'];
      rows = list.map(o => [
        `#${o.id}`,
        o.table_number ? `Table ${o.table_number}` : 'Counter / Takeaway',
        o.subtotal,
        o.discount,
        `"${(o.discount_reason || '').replace(/"/g, '""')}"`,
        `"${(o.custom_discount_type || 'N/A').replace(/"/g, '""')}"`,
        o.total,
        o.payment_method || 'cash',
        formatDateTime(o.updated_at || o.created_at)
      ]);
    }

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${activeTab}_orders_report_${filters.from}_to_${filters.to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="admin-content">
      <div className="admin-header flex justify-between align-center flex-wrap gap-md">
        <div>
          <h2>Cancel / Discount Orders</h2>
          <p className="text-secondary">Click on any order to expand and view individual cancelled/rejected items</p>
        </div>
        <div className="flex gap-md align-center flex-wrap">
          <button className="btn btn-secondary flex align-center gap-sm" onClick={downloadCSV}>
            <Download size={16} /> Download CSV
          </button>
          <button className="btn btn-danger flex align-center gap-sm" onClick={() => setIsDeleteModalOpen(true)}>
            <Trash2 size={16} /> Delete Order by ID
          </button>
        </div>
      </div>

      <div className="card mb-lg" style={{ padding: 20 }}>
        <div className="flex gap-lg flex-wrap align-center justify-between">
          <div className="flex gap-sm bg-secondary" style={{ padding: 4, borderRadius: 'var(--radius)' }}>
            <button className={`btn ${filters.period === 'today' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none' }} onClick={() => setDateRange('today')}>Today</button>
            <button className={`btn ${filters.period === 'week' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none' }} onClick={() => setDateRange('week')}>This Week</button>
            <button className={`btn ${filters.period === 'month' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none' }} onClick={() => setDateRange('month')}>This Month</button>
            <button className={`btn ${filters.period === 'custom' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none' }} onClick={() => setDateRange('custom')}>Custom</button>
          </div>

          {filters.period === 'custom' && (
            <div className="flex gap-md align-center">
              <DatePicker className="form-input" value={filters.from} onChange={e => setFilters(prev => ({ ...prev, from: e.target.value }))} />
              <span>to</span>
              <DatePicker className="form-input" value={filters.to} onChange={e => setFilters(prev => ({ ...prev, to: e.target.value }))} />
            </div>
          )}

          <div className="flex gap-md align-center flex-wrap">
            <div className="flex align-center gap-sm">
              <Filter size={16} className="text-secondary" />
              <select 
                className="form-select btn-sm"
                value={filters.discount_reason}
                onChange={e => setFilters(prev => ({ ...prev, discount_reason: e.target.value }))}
              >
                <option value="all">All Discount Reasons</option>
                <option value="Quality issue">Quality issue</option>
                <option value="Round off discount">Round off discount</option>
                <option value="Personal discount">Personal discount</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            {filters.discount_reason === 'Custom' && (
              <div className="flex align-center gap-sm">
                <input 
                  type="text" 
                  className="form-input btn-sm" 
                  placeholder="Custom Type (e.g. VIP, Staff)" 
                  value={filters.custom_type} 
                  onChange={e => setFilters(prev => ({ ...prev, custom_type: e.target.value }))} 
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card mb-lg" style={{ overflow: 'hidden' }}>
        <div className="tabs flex bg-secondary" style={{ borderBottom: '1px solid var(--glass-border)' }}>
          <button 
            className={`btn flex-1 flex align-center justify-center gap-sm ${activeTab === 'cancelled' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ borderRadius: 0, border: 'none', padding: '16px' }}
            onClick={() => setActiveTab('cancelled')}
          >
            <Ban size={18} /> Cancelled Orders & Items ({data.cancelled.length})
          </button>
          <button 
            className={`btn flex-1 flex align-center justify-center gap-sm ${activeTab === 'discounted' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ borderRadius: 0, border: 'none', padding: '16px' }}
            onClick={() => setActiveTab('discounted')}
          >
            <Tag size={18} /> Discounted Orders ({data.discounted.length})
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {isLoading ? (
            <div className="flex-center" style={{ height: 200 }}><div className="loader"></div></div>
          ) : activeTab === 'cancelled' ? (
            <div className="table-responsive">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Order ID</th>
                    <th>Table / Source</th>
                    <th>Order Status</th>
                    <th>Cancellation Summary</th>
                    <th>Subtotal</th>
                    <th>Date & Time</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cancelled.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center text-secondary" style={{ padding: '40px 0' }}>
                        No cancelled orders or items found for the selected date range.
                      </td>
                    </tr>
                  ) : (
                    data.cancelled.map(order => (
                      <React.Fragment key={order.id}>
                        <tr onClick={() => toggleExpand(order.id)} style={{ cursor: 'pointer' }}>
                          <td>
                            {expandedOrders[order.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </td>
                          <td className="font-bold">#{order.id}</td>
                          <td>{order.table_number ? `Table ${order.table_number}` : 'Counter / Takeaway'}</td>
                          <td>
                            <span className={`badge ${order.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="text-danger">{order.cancel_reason || 'Cancelled by Kitchen'}</td>
                          <td>{formatCurrency(order.subtotal)}</td>
                          <td>{formatDateTime(order.updated_at || order.created_at)}</td>
                          <td>
                            <button 
                              className="btn btn-danger btn-sm flex align-center gap-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrderForDelete(order);
                                setIsConfirmDeleteModalOpen(true);
                              }}
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </td>
                        </tr>
                        {expandedOrders[order.id] && (
                          <tr style={{ background: 'var(--bg-elevated)' }}>
                            <td colSpan="8" style={{ padding: '16px 24px' }}>
                              <div className="order-items-list">
                                <h4 className="mb-sm flex align-center gap-sm" style={{ fontSize: '0.95rem' }}>
                                  <span>Order #{order.id} Items Breakdown</span>
                                  <span className="text-secondary" style={{ fontSize: '0.85rem' }}>({order.items?.length || 0} items)</span>
                                </h4>
                                <table className="data-table w-full" style={{ background: 'var(--bg-main)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                                  <thead>
                                    <tr style={{ background: 'var(--bg-secondary)', fontSize: '0.85rem' }}>
                                      <th>Item Name</th>
                                      <th>Quantity</th>
                                      <th>Price</th>
                                      <th>Item Status</th>
                                      <th>Kitchen Notes / Reason</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {!order.items || order.items.length === 0 ? (
                                      <tr>
                                        <td colSpan="5" className="text-center text-secondary py-sm">No items found</td>
                                      </tr>
                                    ) : (
                                      order.items.map(item => (
                                        <tr key={item.id} style={{ fontSize: '0.9rem' }}>
                                          <td className="font-bold">{item.item_name || `Item #${item.menu_item_id}`}</td>
                                          <td>{item.quantity}</td>
                                          <td>{formatCurrency(item.item_price || 0)}</td>
                                          <td>
                                            <span className={`badge ${
                                              item.status === 'rejected' || item.status === 'cancelled' ? 'badge-danger' : 'badge-success'
                                            }`}>
                                              {item.status}
                                            </span>
                                          </td>
                                          <td className="text-danger font-medium">{item.reject_reason || item.notes || '-'}</td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Order ID</th>
                    <th>Table / Source</th>
                    <th>Subtotal</th>
                    <th>Discount Amount</th>
                    <th>Discount Reason</th>
                    <th>Custom Discount Type</th>
                    <th>Total Paid</th>
                    <th>Payment Method</th>
                    <th>Date & Time</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.discounted.length === 0 ? (
                    <tr>
                      <td colSpan="11" className="text-center text-secondary" style={{ padding: '40px 0' }}>
                        No discounted orders found for the selected filter.
                      </td>
                    </tr>
                  ) : (
                    data.discounted.map(order => (
                      <React.Fragment key={order.id}>
                        <tr onClick={() => toggleExpand(order.id)} style={{ cursor: 'pointer' }}>
                          <td>
                            {expandedOrders[order.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </td>
                          <td className="font-bold">#{order.id}</td>
                          <td>{order.table_number ? `Table ${order.table_number}` : 'Counter / Takeaway'}</td>
                          <td>{formatCurrency(order.subtotal)}</td>
                          <td className="text-success font-bold">{formatCurrency(order.discount)}</td>
                          <td>{order.discount_reason?.startsWith('Custom:') ? 'Custom' : (order.discount_reason || 'General Discount')}</td>
                          <td><span className="badge badge-secondary">{order.custom_discount_type || 'N/A'}</span></td>
                          <td className="font-bold">{formatCurrency(order.total)}</td>
                          <td><span className="badge badge-primary">{order.payment_method || 'cash'}</span></td>
                          <td>{formatDateTime(order.updated_at || order.created_at)}</td>
                          <td>
                            <button 
                              className="btn btn-danger btn-sm flex align-center gap-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrderForDelete(order);
                                setIsConfirmDeleteModalOpen(true);
                              }}
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </td>
                        </tr>
                        {expandedOrders[order.id] && (
                          <tr style={{ background: 'var(--bg-elevated)' }}>
                            <td colSpan="11" style={{ padding: '16px 24px' }}>
                              <div className="order-items-list">
                                <h4 className="mb-sm flex align-center gap-sm" style={{ fontSize: '0.95rem' }}>
                                  <span>Order #{order.id} Items Breakdown</span>
                                  <span className="text-secondary" style={{ fontSize: '0.85rem' }}>({order.items?.length || 0} items)</span>
                                </h4>
                                <table className="data-table w-full" style={{ background: 'var(--bg-main)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                                  <thead>
                                    <tr style={{ background: 'var(--bg-secondary)', fontSize: '0.85rem' }}>
                                      <th>Item Name</th>
                                      <th>Quantity</th>
                                      <th>Price</th>
                                      <th>Item Status</th>
                                      <th>Notes / Reason</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {!order.items || order.items.length === 0 ? (
                                      <tr>
                                        <td colSpan="5" className="text-center text-secondary py-sm">No items found</td>
                                      </tr>
                                    ) : (
                                      order.items.map(item => (
                                        <tr key={item.id} style={{ fontSize: '0.9rem' }}>
                                          <td className="font-bold">{item.item_name || `Item #${item.menu_item_id}`}</td>
                                          <td>{item.quantity}</td>
                                          <td>{formatCurrency(item.item_price || 0)}</td>
                                          <td>
                                            <span className={`badge ${
                                              item.status === 'rejected' || item.status === 'cancelled' ? 'badge-danger' : 'badge-success'
                                            }`}>
                                              {item.status}
                                            </span>
                                          </td>
                                          <td className="text-secondary">{item.reject_reason || item.notes || '-'}</td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Delete Order by ID">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (window.confirm(`Are you sure you want to completely delete Order #${orderIdToDelete} from the database?`)) {
              handleDeleteOrder(orderIdToDelete);
            }
          }} 
          className="flex-col gap-md"
        >
          <div className="form-group">
            <label>Enter Order ID to Delete</label>
            <input 
              type="number" 
              className="form-input" 
              required 
              placeholder="e.g. 123" 
              value={orderIdToDelete} 
              onChange={e => setOrderIdToDelete(e.target.value)} 
            />
            <p className="text-danger mt-sm" style={{ fontSize: '0.85rem' }}>
              Warning: This action will permanently delete the order and all its items from the database.
            </p>
          </div>
          <button type="submit" className="btn btn-danger w-full p-md flex align-center justify-center gap-sm" disabled={isDeleting}>
            <Trash2 size={16} /> {isDeleting ? 'Deleting...' : 'Delete Order'}
          </button>
        </form>
      </Modal>

      <Modal 
        isOpen={isConfirmDeleteModalOpen} 
        onClose={() => { setIsConfirmDeleteModalOpen(false); setSelectedOrderForDelete(null); }} 
        title={selectedOrderForDelete ? `Confirm Order Deletion — Order #${selectedOrderForDelete.id}` : 'Confirm Deletion'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => { setIsConfirmDeleteModalOpen(false); setSelectedOrderForDelete(null); }}>
              Cancel
            </button>
            <button 
              className="btn btn-danger flex align-center gap-sm" 
              onClick={() => {
                if (selectedOrderForDelete) {
                  handleDeleteOrder(selectedOrderForDelete.id);
                  setIsConfirmDeleteModalOpen(false);
                  setSelectedOrderForDelete(null);
                }
              }}
              disabled={isDeleting}
            >
              <Trash2 size={16} /> {isDeleting ? 'Deleting...' : 'Final Delete'}
            </button>
          </>
        }
      >
        {selectedOrderForDelete && (
          <div className="delete-confirm-details flex-col gap-md" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
            <div className="p-md bg-secondary flex justify-between align-center" style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
              <div>
                <div className="text-secondary" style={{ fontSize: '0.85rem' }}>Table / Source</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                  {selectedOrderForDelete.table_number ? `Table ${selectedOrderForDelete.table_number}` : 'Counter / Takeaway'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-secondary" style={{ fontSize: '0.85rem' }}>Order Status</div>
                <div>
                  <span className={`badge ${selectedOrderForDelete.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                    {selectedOrderForDelete.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-md">
              <div className="p-md bg-secondary" style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                <div className="text-secondary" style={{ fontSize: '0.85rem' }}>Subtotal / Total</div>
                <div className="font-bold" style={{ fontSize: '1.1rem' }}>
                  {formatCurrency(selectedOrderForDelete.subtotal)} {selectedOrderForDelete.total ? `/ ${formatCurrency(selectedOrderForDelete.total)}` : ''}
                </div>
              </div>
              <div className="p-md bg-secondary" style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                <div className="text-secondary" style={{ fontSize: '0.85rem' }}>Date & Time</div>
                <div className="font-medium" style={{ fontSize: '0.95rem' }}>
                  {formatDateTime(selectedOrderForDelete.updated_at || selectedOrderForDelete.created_at)}
                </div>
              </div>
            </div>

            {selectedOrderForDelete.cancel_reason && (
              <div className="p-md bg-danger-subtle text-danger" style={{ borderRadius: 'var(--radius)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <div className="font-bold" style={{ fontSize: '0.85rem' }}>Cancellation Reason</div>
                <div style={{ fontSize: '0.95rem', marginTop: '4px' }}>{selectedOrderForDelete.cancel_reason}</div>
              </div>
            )}

            {selectedOrderForDelete.discount > 0 && (
              <div className="p-md bg-success-subtle text-success" style={{ borderRadius: 'var(--radius)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <div className="font-bold" style={{ fontSize: '0.85rem' }}>Discount: {formatCurrency(selectedOrderForDelete.discount)}</div>
                <div style={{ fontSize: '0.95rem', marginTop: '4px' }}>Reason: {selectedOrderForDelete.discount_reason || 'General Discount'}</div>
              </div>
            )}

            {(selectedOrderForDelete.payment_method || selectedOrderForDelete.custom_payment_type) && (
              <div className="p-md bg-secondary flex justify-between align-center" style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}>
                <div>
                  <div className="text-secondary" style={{ fontSize: '0.85rem' }}>Payment Method</div>
                  <div className="font-bold capitalize">{selectedOrderForDelete.payment_method || 'cash'}</div>
                </div>
                {selectedOrderForDelete.custom_payment_type && (
                  <div className="text-right">
                    <div className="text-secondary" style={{ fontSize: '0.85rem' }}>Custom Type Field</div>
                    <div className="font-bold badge badge-secondary">{selectedOrderForDelete.custom_payment_type}</div>
                  </div>
                )}
              </div>
            )}

            <div className="card-header p-0 mt-sm">
              <h4 style={{ fontSize: '0.95rem', margin: 0 }}>Items Breakdown ({selectedOrderForDelete.items?.length || 0} items)</h4>
            </div>

            <div className="table-responsive" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius)' }}>
              <table className="data-table w-full m-0" style={{ background: 'var(--bg-main)' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', fontSize: '0.85rem' }}>
                    <th>Item Name</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Notes / Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {!selectedOrderForDelete.items || selectedOrderForDelete.items.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center text-secondary py-sm">No items found</td>
                    </tr>
                  ) : (
                    selectedOrderForDelete.items.map(item => (
                      <tr key={item.id} style={{ fontSize: '0.9rem' }}>
                        <td className="font-bold">{item.item_name || `Item #${item.menu_item_id}`}</td>
                        <td>{item.quantity}</td>
                        <td>{formatCurrency(item.item_price || 0)}</td>
                        <td>
                          <span className={`badge ${
                            item.status === 'rejected' || item.status === 'cancelled' ? 'badge-danger' : 'badge-success'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="text-secondary">{item.reject_reason || item.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="text-danger p-md mt-sm flex align-center gap-sm" style={{ background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <Trash2 size={24} className="text-danger flex-shrink-0" />
              <div style={{ fontSize: '0.9rem' }}>
                <strong>Warning:</strong> This action is irreversible. Clicking <strong>Final Delete</strong> will permanently remove this order and all its associated items from the database.
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
