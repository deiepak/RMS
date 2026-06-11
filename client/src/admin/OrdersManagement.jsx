import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Eye,
  Clock,
  X,
  Printer,
} from 'lucide-react';
import { api } from '../api/client';
import { socket, subscribeToEvent } from '../api/socket';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import { numberToWords } from '../utils/helpers';
import { formatToBS } from '../utils/nepaliDate';
import Modal from '../components/Modal';
import '../index.css';

const STATUS_OPTIONS = [
  { value: '', label: 'All Orders' },
  { value: 'active', label: 'Active' },
  { value: 'checkout_requested', label: 'Checkout Requested' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const formatCurrency = (val) => `रू ${Number(val || 0).toLocaleString('en-NP')}`;
const formatReceiptCurrency = (val) => `${Number(val || 0).toLocaleString('en-NP')}`;

const formatTime = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getStatusBadge = (status) => {
  switch (status) {
    case 'active': return 'badge badge-info';
    case 'completed': return 'badge badge-success';
    case 'cancelled': return 'badge badge-danger';
    case 'checkout_requested': return 'badge badge-warning';
    case 'preparing': return 'badge badge-warning';
    case 'ready': return 'badge badge-success';
    case 'served': return 'badge badge-info';
    case 'pending': return 'badge badge-secondary';
    default: return 'badge';
  }
};

export default function OrdersManagement() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showAdventureOnly, setShowAdventureOnly] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const [printOrderModal, setPrintOrderModal] = useState(null);
  const [printKOTModal, setPrintKOTModal] = useState(null);
  const [selectedForKOT, setSelectedForKOT] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const { showToast } = useToast();
  const { settings } = useSettings();
  const refreshInterval = useRef(null);

  const handleToggleKOTItem = (orderId, itemId) => {
    setSelectedForKOT(prev => {
      const orderItems = prev[orderId] || [];
      if (orderItems.includes(itemId)) {
        return { ...prev, [orderId]: orderItems.filter(id => id !== itemId) };
      } else {
        return { ...prev, [orderId]: [...orderItems, itemId] };
      }
    });
  };

  const fetchOrders = useCallback(async (reset = false) => {
    try {
      if (reset) setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (dateFilter) params.append('date', dateFilter);
      if (searchTerm) params.append('search', searchTerm);
      params.append('page', reset ? 1 : page);
      params.append('limit', 20);

      const res = await api.get(`/orders?${params.toString()}`);
      const data = res.data?.data || res.data?.orders || res.data || [];
      const list = Array.isArray(data) ? data : [];

      if (reset) {
        setOrders(list);
        setPage(1);
      } else {
        setOrders((prev) => {
          const ids = new Set(prev.map((o) => o.id || o._id));
          return [...prev, ...list.filter((o) => !ids.has(o.id || o._id))];
        });
      }
      setHasMore(list.length >= 20);
    } catch (err) {
      showToast('Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFilter, searchTerm, page]);

  useEffect(() => {
    fetchOrders(true);
  }, [statusFilter, dateFilter, searchTerm]);

  // Auto-refresh every 30s
  useEffect(() => {
    refreshInterval.current = setInterval(() => {
      fetchOrders(true);
    }, 30000);
    return () => clearInterval(refreshInterval.current);
  }, [statusFilter, dateFilter, searchTerm]);

  // Real-time socket updates
  useEffect(() => {
    const unsub1 = subscribeToEvent('orderUpdate', (data) => {
      setOrders((prev) => {
        const idx = prev.findIndex((o) => (o.id || o._id) === (data.id || data._id));
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...data };
          return updated;
        }
        return [data, ...prev];
      });
    });

    const unsub2 = subscribeToEvent('newOrder', (data) => {
      setOrders((prev) => {
        if (prev.some((o) => (o.id || o._id) === (data.id || data._id))) return prev;
        return [data, ...prev];
      });
      showToast('New order received!', 'info');
    });

    return () => {
      if (unsub1) unsub1();
      if (unsub2) unsub2();
    };
  }, []);

  const toggleExpand = (id) => {
    setExpandedOrder(expandedOrder === id ? null : id);
  };

  const handleItemStatus = async (itemId, newStatus) => {
    try {
      await api.patch(`/orders/items/${itemId}/status`, { status: newStatus });
      showToast('Item status updated', 'success');
      fetchOrders(true);
    } catch (err) {
      showToast('Failed to update item status', 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePrintKOT = (order) => {
    const unprintedItems = (order.items || []).filter(i => !i.is_printed && i.status !== 'rejected' && i.status !== 'cancelled');
    if (unprintedItems.length === 0) {
      showToast('All items have already been printed for KOT.', 'info');
      return;
    }
    setPrintKOTModal({ order, items: unprintedItems, markPrinted: true });
  };

  const handleConfirmPrintKOT = async () => {
    window.print();
    if (printKOTModal.markPrinted) {
      try {
        const itemIds = printKOTModal.items.map(i => i.id || i._id);
        await api.patch('/orders/items/mark-printed', { itemIds });
        showToast('Items marked as printed.', 'success');
        fetchOrders(true);
      } catch (err) {
        showToast('Failed to mark items as printed.', 'error');
      }
    }
    setPrintKOTModal(null);
  };

  const filteredOrders = orders.filter((o) => {
    const isAdventureOrder = 
      (o.items || []).some(i => i.category_name?.toLowerCase() === 'adventures') ||
      (o.order_name && o.order_name.toLowerCase().includes('adventure'));
      
    if (showAdventureOnly && !isAdventureOrder) return false;
    if (!showAdventureOnly && isAdventureOrder) return false;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const tableNum = String(o.table_number || o.tableNumber || o.table?.number || '');
      const orderId = String(o.id || o._id || '').toLowerCase();
      const hasItem = (o.items || []).some(i => 
        (i.item_name || i.name || i.menuItem?.name || '').toLowerCase().includes(search)
      );
      if (!tableNum.includes(search) && !orderId.includes(search) && !hasItem) return false;
    }
    return true;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (sortConfig.key === 'created_at') {
      const dateA = new Date(a.created_at || a.createdAt).getTime();
      const dateB = new Date(b.created_at || b.createdAt).getTime();
      return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
    }
    if (sortConfig.key === 'discount') {
      const discA = parseFloat(a.discount || 0);
      const discB = parseFloat(b.discount || 0);
      return sortConfig.direction === 'asc' ? discA - discB : discB - discA;
    }
    if (sortConfig.key === 'total') {
      const totalA = parseFloat(a.totalAmount || a.total || 0);
      const totalB = parseFloat(b.totalAmount || b.total || 0);
      return sortConfig.direction === 'asc' ? totalA - totalB : totalB - totalA;
    }
    return 0;
  });

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const totalDiscounts = sortedOrders.reduce((sum, o) => sum + parseFloat(o.discount || 0), 0);

  return (
    <div className="orders-page">
      {/* Filter Bar */}
      <div className="card filter-bar">
        <div className="filter-row">
          <div className="form-group filter-search">
            <div className="input-with-icon">
              <Search size={16} />
              <input
                type="text"
                className="form-input"
                placeholder="Search by table, order ID, or item name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <input
              type="date"
              className="form-input"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>

          <div className="form-group flex align-center gap-sm" style={{ paddingLeft: '12px' }}>
            <input 
              type="checkbox" 
              id="adventureToggle"
              checked={showAdventureOnly}
              onChange={(e) => setShowAdventureOnly(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="adventureToggle" style={{ margin: 0, cursor: 'pointer', userSelect: 'none', fontWeight: 600 }}>
              Adventures Only
            </label>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchOrders(true)}
            title="Refresh"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="grid mb-md" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        <div className="stat-card card p-md" style={{ borderColor: 'var(--accent-secondary)' }}>
          <div className="stat-title">Total Discount Given</div>
          <div className="stat-value" style={{ color: 'var(--accent-secondary)' }}>{formatCurrency(totalDiscounts)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="skeleton-table" style={{ padding: '1rem' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <div key={n} className="skeleton-row" />
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="empty-state text-center" style={{ padding: '3rem' }}>
              <ShoppingBagEmpty />
              <p>No orders found</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Order ID</th>
                  <th>Table</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th onClick={() => requestSort('discount')} style={{ cursor: 'pointer' }}>
                    Discount {sortConfig.key === 'discount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => requestSort('total')} style={{ cursor: 'pointer' }}>
                    Total {sortConfig.key === 'total' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Status</th>
                  <th onClick={() => requestSort('created_at')} style={{ cursor: 'pointer' }}>
                    Time {sortConfig.key === 'created_at' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map((order) => (
                  <React.Fragment key={order.id || order._id}>
                    <tr
                      className={`order-row ${expandedOrder === (order.id || order._id) ? 'row-expanded' : ''}`}
                      onClick={() => toggleExpand(order.id || order._id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        {expandedOrder === (order.id || order._id) ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </td>
                      <td className="order-id">#{String(order.id || order._id || '').padStart(5, '0').toUpperCase()}</td>
                      <td>{order.table_number || order.tableNumber || order.table?.number || '—'}</td>
                      <td>{order.customer_name || order.customerName || order.customer?.name || '—'}</td>
                      <td>{order.items?.length || 0}</td>
                      <td className="amount text-warning font-bold">{formatCurrency(order.discount || 0)}</td>
                      <td className="amount">{formatCurrency(order.totalAmount || order.total)}</td>
                      <td>
                        <span className={getStatusBadge(order.status)}>
                          {(order.status || '').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <span className="time-cell">
                          <Clock size={14} />
                          {formatTime(order.created_at || order.createdAt)}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-sm">
                          <button 
                            className="btn btn-secondary btn-sm flex align-center gap-sm" 
                            onClick={() => setPrintOrderModal(order)}
                            title="Print Bill"
                          >
                            <Printer size={14} /> Bill
                          </button>
                          <button 
                            className="btn btn-secondary btn-sm flex align-center gap-sm" 
                            onClick={() => handlePrintKOT(order)}
                            title="Print unprinted items to KOT"
                          >
                            <Printer size={14} /> KOT
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedOrder === (order.id || order._id) && (
                      <tr className="expanded-row">
                        <td colSpan={9}>
                          <div className="order-items-detail">
                            <div className="flex justify-between align-center mb-sm">
                              <h4>Order Items</h4>
                              {(selectedForKOT[order.id || order._id] || []).length > 0 && (
                                <button 
                                  className="btn btn-sm btn-primary flex align-center gap-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const selectedItemIds = selectedForKOT[order.id || order._id] || [];
                                    const itemsToPrint = (order.items || []).filter(i => selectedItemIds.includes(i.id || i._id));
                                    setPrintKOTModal({ order, items: itemsToPrint });
                                  }}
                                >
                                  <Printer size={14} /> Print KOT ({(selectedForKOT[order.id || order._id] || []).length})
                                </button>
                              )}
                            </div>
                            <table className="data-table nested-table">
                              <thead>
                                <tr>
                                  <th>Item</th>
                                  <th>Qty</th>
                                  <th>Price</th>
                                  <th>Status</th>
                                  <th>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(order.items || []).map((item, idx) => (
                                  <tr key={item.id || item._id || idx} style={{
                                    opacity: (item.status === 'rejected' || item.status === 'cancelled') ? 0.6 : 1,
                                    textDecoration: (item.status === 'rejected' || item.status === 'cancelled') ? 'line-through' : 'none'
                                  }}>
                                    <td>
                                      {item.item_name || item.name || item.menuItem?.name || '—'}
                                      {(item.status === 'rejected' || item.status === 'cancelled') && (
                                        <span className="badge badge-danger" style={{ marginLeft: 8, fontSize: 10, padding: '2px 4px' }}>CANCELLED</span>
                                      )}
                                    </td>
                                    <td>{item.quantity}</td>
                                    <td>{formatCurrency((item.price_at_order || item.price) * item.quantity)}</td>
                                    <td>
                                      <span className={getStatusBadge(item.status)}>
                                        {item.status || 'pending'}
                                      </span>
                                    </td>
                                    <td>
                                      <div className="flex align-center gap-sm">
                                        <input 
                                          type="checkbox" 
                                          checked={(selectedForKOT[order.id || order._id] || []).includes(item.id || item._id)}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            handleToggleKOTItem(order.id || order._id, item.id || item._id);
                                          }}
                                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                        />
                                        {item.status !== 'served' && item.status !== 'cancelled' && item.status !== 'rejected' && (
                                          <div className="btn-group">
                                          {item.status === 'pending' && (
                                            <button
                                              className="btn btn-sm btn-secondary"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleItemStatus(item.id || item._id, 'preparing');
                                              }}
                                            >
                                              Prepare
                                            </button>
                                          )}
                                          {item.status === 'preparing' && (
                                            <button
                                              className="btn btn-sm btn-success"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleItemStatus(item.id || item._id, 'ready');
                                              }}
                                            >
                                              Ready
                                            </button>
                                          )}
                                          {item.status === 'ready' && (
                                            <button
                                              className="btn btn-sm btn-primary"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleItemStatus(item.id || item._id, 'served');
                                              }}
                                            >
                                              Served
                                            </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {order.notes && (
                              <div className="order-notes">
                                <strong>Notes:</strong> {order.notes}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Load More */}
      {!loading && hasMore && filteredOrders.length >= 20 && (
        <div className="text-center" style={{ marginTop: '1rem' }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setPage((p) => p + 1);
              fetchOrders(false);
            }}
          >
            Load More
          </button>
        </div>
      )}

      {printOrderModal && (
        <Modal
          isOpen={true}
          onClose={() => setPrintOrderModal(null)}
          title={`Print Order #${String(printOrderModal.id || printOrderModal._id).padStart(5, '0').toUpperCase()}`}
        >
          <div className="flex-col gap-md">
            <div className="ticket-print-area" style={{ fontFamily: 'monospace', lineHeight: '1.2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                <div style={{ textAlign: 'left' }}>
                  <h2 style={{ margin: '0 0 2px 0', fontSize: '16px' }}>Happy Hills</h2>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '13px' }}>ORDER SUMMARY</h3>
                  <div style={{ fontSize: '11px' }}>
                    <div style={{ margin: '2px 0' }}><strong>Order #:</strong> {String(printOrderModal.id || printOrderModal._id).padStart(5, '0').toUpperCase()}</div>
                    <div style={{ margin: '2px 0' }}><strong>Date:</strong> {formatToBS(printOrderModal.created_at || printOrderModal.createdAt)} {formatTime(printOrderModal.created_at || printOrderModal.createdAt)}</div>
                    <div style={{ margin: '2px 0' }}><strong>Table:</strong> {printOrderModal.table_number || printOrderModal.tableNumber || printOrderModal.table?.number || '—'}</div>
                  </div>
                </div>
                <img src={settings?.restaurant_logo || '/adventure-logo.svg'} alt="Logo" style={{ height: '72px', maxWidth: '90px', objectFit: 'contain', flexShrink: 0, marginLeft: '8px' }} />
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>

              <table style={{ width: '100%', fontSize: '11px', textAlign: 'left', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: '55%' }}>Item</th>
                    <th style={{ textAlign: 'center', width: '15%' }}>Qty</th>
                    <th style={{ textAlign: 'right', width: '30%' }}>Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const mergedItems = [];
                    (printOrderModal.items || []).forEach(item => {
                      const itemName = item.item_name || item.name || item.menuItem?.name || 'Item';
                      const existing = mergedItems.find(i => 
                        (i.item_name || i.name || i.menuItem?.name || 'Item') === itemName &&
                        i.status === item.status &&
                        (i.price_at_order || i.price) === (item.price_at_order || item.price)
                      );
                      if (existing) {
                        existing.quantity += item.quantity;
                      } else {
                        mergedItems.push({ ...item });
                      }
                    });
                    
                    return mergedItems.map((item, idx) => {
                      const isCancelled = item.status === 'cancelled' || item.status === 'rejected';
                      return (
                        <tr key={idx} style={{ textDecoration: isCancelled ? 'line-through' : 'none', opacity: isCancelled ? 0.6 : 1 }}>
                          <td style={{ padding: '2px 0', wordWrap: 'break-word' }}>{item.item_name || item.name || item.menuItem?.name || 'Item'}</td>
                          <td style={{ textAlign: 'center', verticalAlign: 'top', padding: '2px 0' }}>{item.quantity}</td>
                          <td style={{ textAlign: 'right', verticalAlign: 'top', padding: '2px 0' }}>{formatReceiptCurrency((item.price_at_order || item.price) * item.quantity)}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>

              <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>

              <div style={{ fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                  <span>Subtotal:</span>
                  <span>{formatReceiptCurrency(printOrderModal.subtotal || printOrderModal.items?.reduce((acc, item) => acc + ((item.price_at_order || item.price) * item.quantity), 0) || 0)}</span>
                </div>
                {(printOrderModal.discount > 0) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                    <span>Discount:</span>
                    <span>{formatReceiptCurrency(printOrderModal.discount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                  <span>Tax ({settings?.tax_rate || 0}%):</span>
                  <span>{formatReceiptCurrency(printOrderModal.tax || 0)}</span>
                </div>
                <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px', margin: '4px 0' }}>
                  <span>Total:</span>
                  <span>{formatReceiptCurrency(printOrderModal.totalAmount || printOrderModal.total || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0', fontSize: '10px', fontStyle: 'italic' }}>
                  <span>In words:</span>
                  <span style={{ textAlign: 'right', maxWidth: '70%' }}>
                    {numberToWords(Math.round(printOrderModal.totalAmount || printOrderModal.total || 0))}
                  </span>
                </div>
                <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <p style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: 'bold' }}>Loved your meal? Scan to share a quick review!</p>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
                    <img src="/boy.svg" alt="Boy" style={{ width: '80px', height: '80px', objectFit: 'contain', filter: 'grayscale(100%) contrast(1000%)' }} />
                    <img src="/google-review-qr.png" alt="Google Review QR" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                    <img src="/girl.svg" alt="Girl" style={{ width: '80px', height: '80px', objectFit: 'contain', filter: 'grayscale(100%) contrast(1000%)' }} />
                  </div>
                  
                  <div style={{ marginTop: '12px', fontSize: '11px' }}>
                    <p style={{ margin: '4px 0', fontWeight: 'bold' }}>😊 Thank you for dining with us! 😊</p>
                    <p style={{ margin: '4px 0', fontStyle: 'italic', fontSize: '10px' }}>Note: This is an order summary. Kindly contact us for the invoice.</p>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center', margin: '8px 0 0 0', fontSize: '11px' }}>
                <p style={{ margin: 0 }}>Thank you for visiting!</p>
              </div>
            </div>
            
            <button className="btn btn-primary flex align-center gap-sm" onClick={handlePrint}>
              <Printer size={18} /> Print Document
            </button>
          </div>
        </Modal>
      )}

      {printKOTModal && (
        <Modal
          isOpen={true}
          onClose={() => setPrintKOTModal(null)}
          title={`Print KOT / Waiter Ticket`}
        >
          <div className="flex-col gap-md">
            <div className="ticket-print-area" style={{ fontFamily: 'monospace', lineHeight: '1.2' }}>
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '18px' }}>KOT / WAITER TICKET</h2>
              </div>
              <div style={{ fontSize: '12px', borderBottom: '1px dashed #000', paddingBottom: '4px', marginBottom: '4px' }}>
                <div style={{ margin: '2px 0' }}><strong>Order #:</strong> {String(printKOTModal.order.id || printKOTModal.order._id).padStart(5, '0').toUpperCase()}</div>
                <div style={{ margin: '2px 0' }}><strong>Date:</strong> {formatToBS(printKOTModal.order.created_at || printKOTModal.order.createdAt)} {formatTime(printKOTModal.order.created_at || printKOTModal.order.createdAt)}</div>
                <div style={{ margin: '2px 0' }}><strong>Table:</strong> {printKOTModal.order.table_number || printKOTModal.order.tableNumber || printKOTModal.order.table?.number || '—'}</div>
              </div>
              <table style={{ width: '100%', fontSize: '14px', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px dashed #000' }}>
                    <th style={{ width: '80%', padding: '4px 0' }}>Item</th>
                    <th style={{ textAlign: 'center', width: '20%', padding: '4px 0' }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Merge same items to prevent duplicates on the ticket
                    const mergedItems = [];
                    printKOTModal.items.forEach(item => {
                      const itemName = item.item_name || item.name || item.menuItem?.name || 'Item';
                      const existing = mergedItems.find(i => (i.item_name || i.name || i.menuItem?.name || 'Item') === itemName);
                      if (existing) {
                        existing.quantity += item.quantity;
                      } else {
                        mergedItems.push({ ...item });
                      }
                    });
                    
                    return mergedItems.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '4px 0', wordWrap: 'break-word' }}>{item.item_name || item.name || item.menuItem?.name || 'Item'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', padding: '4px 0', fontSize: '16px' }}>{item.quantity}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
              <div style={{ borderBottom: '1px dashed #000', margin: '8px 0' }}></div>
            </div>
            
            <button className="btn btn-primary flex align-center gap-sm" onClick={handleConfirmPrintKOT}>
              <Printer size={18} /> Print KOT
            </button>
          </div>
        </Modal>
      )}

      <style>{`
        @media print {
          @page {
            margin: 0;
          }

          html, body {
            background-color: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body * {
            visibility: hidden;
          }

          .ticket-print-area, .ticket-print-area * {
            visibility: visible;
          }

          .ticket-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 72mm;
            padding: 0;
            margin: 0;
          }

          .ticket-print-area img {
            filter: grayscale(100%) contrast(1000%);
            -webkit-filter: grayscale(100%) contrast(1000%);
          }
        }
      `}</style>
    </div>
  );
}

function ShoppingBagEmpty() {
  return (
    <div style={{ opacity: 0.3, marginBottom: '1rem' }}>
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 01-8 0" />
      </svg>
    </div>
  );
}
