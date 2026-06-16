import React, { useState, useEffect } from 'react';
import { useDragScroll } from '../hooks/useDragScroll';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Download, FileText, FileSpreadsheet, DollarSign, CreditCard, Smartphone, Wallet, BarChart3 } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import Modal from '../components/Modal';

export default function BooksLedger() {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { ref: stripRef, dragProps } = useDragScroll();

  const [filters, setFilters] = useState({
    period: 'today',
    method: 'all',
    from: '',
    to: ''
  });

  useEffect(() => {
    fetchData();
  }, [filters]);

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

    if (period !== 'custom') {
      setFilters(prev => ({
        ...prev,
        period,
        from: fromDate.toISOString().split('T')[0],
        to: endOfDay.toISOString().split('T')[0]
      }));
    } else {
      setFilters(prev => ({ ...prev, period }));
    }
  };

  // Initialize dates on first load
  useEffect(() => {
    setDateRange('today');
    // eslint-disable-next-line
  }, []);

  const fetchData = async () => {
    if (!filters.from) return; // Wait for dates to be set
    
    try {
      setIsLoading(true);
      const queryParams = `?from=${filters.from}%2000:00:00&to=${filters.to}%2023:59:59&method=${filters.method}`;
      
      const [paymentsRes, summaryRes, catRes] = await Promise.all([
        api.get(`/ledger${queryParams}`),
        api.get(`/ledger/summary?from=${filters.from}%2000:00:00&to=${filters.to}%2023:59:59`),
        api.get(`/ledger/by-category?from=${filters.from}&to=${filters.to}`)
      ]);
      
      setPayments(paymentsRes.data);
      setSummary(summaryRes.data);
      setCategories(catRes.data || []);
    } catch (error) {
      showToast('Failed to load ledger data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const groupPaymentsByDate = () => {
    const grouped = Object.values(payments.reduce((acc, p) => {
      if (!acc[p.order_id]) {
        acc[p.order_id] = {
          order_id: p.order_id,
          table_number: p.table_number,
          created_at: p.created_at,
          amount: 0,
          methods: new Set(),
          collected_by: new Set(),
          discount: parseFloat(p.order_discount || 0),
          is_package: p.is_package
        };
      }
      acc[p.order_id].amount += parseFloat(p.amount);
      acc[p.order_id].methods.add(p.method);
      acc[p.order_id].collected_by.add(p.collected_by);
      if (new Date(p.created_at) > new Date(acc[p.order_id].created_at)) {
        acc[p.order_id].created_at = p.created_at;
      }
      return acc;
    }, {})).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Then group by date string
    const byDate = {};
    grouped.forEach(order => {
      const dateStr = new Date(order.created_at).toISOString().split('T')[0];
      if (!byDate[dateStr]) {
        byDate[dateStr] = {
          date: dateStr,
          orders: [],
          total: 0,
          cash: 0,
          card: 0,
          online: 0,
        };
      }
      byDate[dateStr].orders.push(order);
      byDate[dateStr].total += order.amount;
      Array.from(order.methods).forEach(m => {
        // distribute amount based on exact payment data if needed, but since we grouped by order, we approximate if multiple methods
        // To be exact, we should iterate raw payments for method sums per day.
      });
    });

    // Let's compute exact method sums per day from raw payments
    payments.forEach(p => {
      const dateStr = new Date(p.created_at).toISOString().split('T')[0];
      if (byDate[dateStr]) {
        byDate[dateStr][p.method] = (byDate[dateStr][p.method] || 0) + parseFloat(p.amount);
      }
    });

    return Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
  };

  const downloadNormalCSV = () => {
    let csv = 'Date Group,Transaction Date,Order ID,Table,Amount,Methods,Discount,Collected By\n';
    
    const dailyGroups = groupPaymentsByDate();

    dailyGroups.forEach(day => {
      // Add a header row for the day
      csv += `\n"--- ${day.date} ---","","","","","","",""\n`;
      day.orders.forEach(p => {
        csv += `"${day.date}","${new Date(p.created_at).toLocaleString()}","${p.is_package ? p.order_id : `ORD-${p.order_id}`}","${p.is_package ? p.table_number : (p.table_number ? `Table ${p.table_number}` : 'Counter Order')}","${p.amount}","${Array.from(p.methods).join(' + ')}","${p.discount}","${Array.from(p.collected_by).join(', ')}"\n`;
      });
      csv += `"Daily Total","","","","${day.total}","","",""\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger_detailed_${filters.from}_to_${filters.to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadMinimalCSV = () => {
    let csv = 'Date,Orders Count,Total Revenue,Cash,Card,Online\n';
    const dailyGroups = groupPaymentsByDate();

    dailyGroups.forEach(day => {
      csv += `"${day.date}","${day.orders.length}","${day.total}","${day.cash || 0}","${day.card || 0}","${day.online || 0}"\n`;
    });

    // Add total row
    csv += `\n"TOTAL","${summary?.count || 0}","${summary?.total_revenue || 0}","${summary?.by_method.cash || 0}","${summary?.by_method.card || 0}","${summary?.by_method.online || 0}"\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger_summary_${filters.from}_to_${filters.to}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const openOrderDetails = async (p) => {
    if (p.is_package) {
      showToast('This is a package payment. Manage it in the Packages section.', 'info');
      return;
    }
    try {
      const res = await api.get(`/orders/${p.order_id}`);
      setSelectedOrder(res.data);
      setIsModalOpen(true);
    } catch (error) {
      showToast('Failed to load order details', 'error');
    }
  };

  // Raw orders for the table view
  const displayOrders = Object.values(payments.reduce((acc, p) => {
    if (!acc[p.order_id]) {
      acc[p.order_id] = {
        id: p.id,
        order_id: p.order_id,
        table_number: p.table_number,
        created_at: p.created_at,
        amount: 0,
        methods: new Set(),
        collected_by: new Set(),
        discount: parseFloat(p.order_discount || 0),
        is_package: p.is_package
      };
    }
    acc[p.order_id].amount += parseFloat(p.amount);
    acc[p.order_id].methods.add(p.method);
    acc[p.order_id].collected_by.add(p.collected_by);
    if (new Date(p.created_at) > new Date(acc[p.order_id].created_at)) {
      acc[p.order_id].created_at = p.created_at;
    }
    return acc;
  }, {})).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="admin-content">
      <div className="admin-header flex justify-between align-center">
        <h2>Books & Ledger</h2>
        <div className="flex gap-sm">
          <button className="btn btn-secondary flex align-center gap-xs" onClick={downloadNormalCSV} disabled={payments.length === 0}>
            <FileSpreadsheet size={16} /> Normal CSV
          </button>
          <button className="btn btn-primary flex align-center gap-xs" onClick={downloadMinimalCSV} disabled={payments.length === 0}>
            <FileText size={16} /> Minimal CSV
          </button>
        </div>
      </div>

      <div className="card mb-lg" style={{ padding: 20 }}>
        <div className="flex gap-lg flex-wrap align-center">
          <div 
            className="flex gap-sm bg-secondary hide-scrollbar" 
            style={{ padding: 4, borderRadius: 'var(--radius)', ...dragProps.style }}
            ref={stripRef}
            {...dragProps}
          >
            <button className={`btn ${filters.period === 'today' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none', whiteSpace: 'nowrap' }} onClick={() => setDateRange('today')}>Today</button>
            <button className={`btn ${filters.period === 'week' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none', whiteSpace: 'nowrap' }} onClick={() => setDateRange('week')}>This Week</button>
            <button className={`btn ${filters.period === 'month' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none', whiteSpace: 'nowrap' }} onClick={() => setDateRange('month')}>This Month</button>
            <button className={`btn ${filters.period === 'custom' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none', whiteSpace: 'nowrap' }} onClick={() => setDateRange('custom')}>Custom Range</button>
          </div>

          {filters.period === 'custom' && (
            <div className="flex gap-md align-center">
              <input type="date" className="form-input" style={{ padding: '8px' }} value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} />
              <span className="text-secondary">to</span>
              <input type="date" className="form-input" style={{ padding: '8px' }} value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} />
            </div>
          )}

          <select className="form-select" style={{ width: 150 }} value={filters.method} onChange={e => setFilters({...filters, method: e.target.value})}>
            <option value="all">All Methods</option>
            <option value="cash">Cash Only</option>
            <option value="card">Card Only</option>
            <option value="online">Online/QR Only</option>
          </select>
        </div>
      </div>

      {summary && (
        <div className="stats-grid mb-lg">
          <div className="card stat-card" style={{ borderTopColor: 'var(--success)' }}>
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value">{formatCurrency(summary.total_revenue)}</div>
            <div className="flex align-center gap-sm mt-sm text-secondary">
              <Wallet size={14} /> {summary.count} transactions
            </div>
          </div>
          <div className="card stat-card" style={{ borderTopColor: '#f5a623' }}>
            <div className="stat-label">Cash</div>
            <div className="stat-value">{formatCurrency(summary.by_method.cash)}</div>
            <div className="flex align-center gap-sm mt-sm text-secondary">
              <DollarSign size={14} /> Cash drawer
            </div>
          </div>
          <div className="card stat-card" style={{ borderTopColor: '#00d2ff' }}>
            <div className="stat-label">Card</div>
            <div className="stat-value">{formatCurrency(summary.by_method.card)}</div>
            <div className="flex align-center gap-sm mt-sm text-secondary">
              <CreditCard size={14} /> POS Terminal
            </div>
          </div>
          <div className="card stat-card" style={{ borderTopColor: '#8b5cf6' }}>
            <div className="stat-label">Online</div>
            <div className="stat-value">{formatCurrency(summary.by_method.online)}</div>
            <div className="flex align-center gap-sm mt-sm text-secondary">
              <Smartphone size={14} /> QR / Wallets
            </div>
          </div>
        </div>
      )}

      {categories.length > 0 && (
        <div className="card mb-lg" style={{ padding: 20 }}>
          <h3 className="mb-md flex align-center gap-sm"><BarChart3 size={18} /> Revenue By Category</h3>
          <div className="flex gap-md flex-wrap">
            {categories.map((cat, idx) => (
              <div key={idx} className="bg-secondary flex-col gap-xs" style={{ padding: '12px 16px', borderRadius: 'var(--radius)', minWidth: 150 }}>
                <span className="text-secondary" style={{ fontSize: 13 }}>{cat.category || 'Uncategorized'}</span>
                <span style={{ fontSize: 18, fontWeight: 600 }}>{formatCurrency(cat.total)}</span>
                <span className="text-secondary" style={{ fontSize: 11 }}>{cat.items_count} items sold</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Order Ref</th>
              <th>Total Paid</th>
              <th>Payment Info</th>
              <th>Collected By</th>
            </tr>
          </thead>
          <tbody>
            {displayOrders.map(p => (
              <tr key={`order-${p.order_id}`}>
                <td>{formatDateTime(new Date(p.created_at))}</td>
                <td>
                  <div className="flex align-center gap-sm">
                    <button className="btn btn-icon btn-secondary" onClick={() => openOrderDetails(p)} title="View Order">
                      <DollarSign size={16} />
                    </button>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{p.is_package ? p.order_id : `ORD-${p.order_id}`}</div>
                      <div className="text-secondary" style={{ fontSize: 12 }}>{p.is_package ? 'Event Package' : (p.table_number ? `Table ${p.table_number}` : 'Counter Order')}</div>
                    </div>
                  </div>
                </td>
                <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                  {formatCurrency(p.amount)}
                </td>
                <td>
                  <div className="flex gap-xs flex-wrap align-center">
                    {Array.from(p.methods).map(m => (
                      <span key={m} className={`badge ${m === 'cash' ? 'badge-warning' : m === 'card' ? 'badge-info' : 'badge-success'}`} style={{ textTransform: 'capitalize' }}>
                        {m}
                      </span>
                    ))}
                    {p.discount > 0 && (
                      <span className="badge badge-secondary ml-xs text-warning">
                        Discount: {formatCurrency(p.discount)}
                      </span>
                    )}
                  </div>
                </td>
                <td className="text-secondary">{Array.from(p.collected_by).join(', ')}</td>
              </tr>
            ))}
            {displayOrders.length === 0 && !isLoading && (
              <tr>
                <td colSpan="5" className="text-center text-muted" style={{ padding: '40px 0' }}>
                  No payment records found for this period
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan="5" className="text-center text-muted" style={{ padding: '40px 0' }}>
                  Loading records...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Order Details - ORD-${selectedOrder?.id}`}
        footer={<button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Close</button>}
      >
        {selectedOrder && (
          <div>
            <div className="flex justify-between mb-md">
              <div>
                <div className="text-secondary" style={{ fontSize: 13 }}>Table</div>
                <div style={{ fontWeight: 600 }}>{selectedOrder.table_number}</div>
              </div>
              <div>
                <div className="text-secondary" style={{ fontSize: 13 }}>Date</div>
                <div style={{ fontWeight: 600 }}>{formatDateTime(selectedOrder.created_at)}</div>
              </div>
              <div>
                <div className="text-secondary" style={{ fontSize: 13 }}>Status</div>
                <div className="badge badge-success" style={{ textTransform: 'capitalize' }}>{selectedOrder.status.replace('_', ' ')}</div>
              </div>
            </div>

            <div className="card bg-secondary p-md mb-md">
              <h4 className="mb-sm">Items</h4>
              {selectedOrder.items?.map(item => (
                <div key={item.id} className="flex justify-between align-center mb-sm">
                  <div>
                    <span style={{ fontWeight: 600 }}>{item.quantity}x</span> {item.item_name}
                  </div>
                  <div>{formatCurrency(item.price_at_order * item.quantity)}</div>
                </div>
              ))}
            </div>

            <div className="flex-col gap-sm">
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
            
            <div className="mt-md pt-md text-secondary" style={{ borderTop: '1px solid var(--border-color)', fontSize: 13 }}>
              Collected By: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedOrder.waiter_name || 'Admin'}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
