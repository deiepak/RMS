import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  ShoppingBag,
  Grid3X3,
  UtensilsCrossed,
  TrendingUp,
  Clock,
  RefreshCw,
  BarChart3,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/Modal';
import '../index.css';

const CHART_COLORS = ['#e94560', '#f5a623', '#00d2ff', '#22c55e', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const formatCurrency = (val) => `रू ${Number(val || 0).toLocaleString('en-NP')}`;

function StatCard({ icon: Icon, label, value, color, loading }) {
  return (
    <div className="stat-card" style={{ '--accent': color }}>
      <div className="stat-icon" style={{ background: `${color}20`, color }}>
        <Icon size={24} />
      </div>
      <div>
        <div className="stat-value">{loading ? '—' : value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="skeleton-chart">
      <div className="skeleton-bar" style={{ height: '60%' }} />
      <div className="skeleton-bar" style={{ height: '80%' }} />
      <div className="skeleton-bar" style={{ height: '45%' }} />
      <div className="skeleton-bar" style={{ height: '90%' }} />
      <div className="skeleton-bar" style={{ height: '70%' }} />
      <div className="skeleton-bar" style={{ height: '55%' }} />
      <div className="skeleton-bar" style={{ height: '75%' }} />
    </div>
  );
}

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [popular, setPopular] = useState([]);
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showData, setShowData] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const { showToast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ovRes, revRes, popRes, tblRes, ordRes] = await Promise.allSettled([
        api.get('/analytics/overview'),
        api.get('/analytics/revenue'),
        api.get('/analytics/popular-items'),
        api.get('/tables'),
        api.get('/orders?status=active,checkout_requested'),
      ]);
      if (ovRes.status === 'fulfilled') setOverview(ovRes.value.data);
      if (revRes.status === 'fulfilled') {
        const revData = revRes.value.data?.data || revRes.value.data || [];
        setRevenue(revData.map(d => ({ ...d, revenue: Number(d.revenue || 0) })));
      }
      if (popRes.status === 'fulfilled') setPopular(popRes.value.data?.data || popRes.value.data || []);
      if (tblRes.status === 'fulfilled') setTables(tblRes.value.data?.data || tblRes.value.data || []);
      if (ordRes.status === 'fulfilled') setOrders((ordRes.value.data?.data || ordRes.value.data || []));
    } catch (err) {
      showToast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const ov = overview?.data || overview || {};
  const occupiedTables = tables.filter(t => t.status === 'occupied').length;
  const totalTables = tables.length;

  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'available': return 'status-available';
      case 'occupied': return 'status-occupied';
      case 'reserved': return 'status-reserved';
      default: return '';
    }
  };

  const getOrderBadge = (status) => {
    switch (status) {
      case 'active': return 'badge badge-info';
      case 'completed': return 'badge badge-success';
      case 'cancelled': return 'badge badge-danger';
      case 'checkout_requested': return 'badge badge-warning';
      default: return 'badge';
    }
  };

  return (
    <div className="dashboard-page">
      {/* Header with Privacy Toggle */}
      <div className="flex justify-end mb-md">
        <button 
          className="btn btn-secondary flex align-center gap-sm" 
          onClick={() => setShowData(!showData)}
        >
          {showData ? <EyeOff size={18} /> : <Eye size={18} />}
          {showData ? 'Hide Data' : 'Reveal Data'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card" style={{ '--accent': '#22c55e', flexDirection: 'column', alignItems: 'flex-start', padding: '16px' }}>
          <div className="flex align-center gap-sm" style={{ width: '100%' }}>
            <div className="stat-icon" style={{ background: `#22c55e20`, color: '#22c55e' }}>
              <DollarSign size={24} />
            </div>
            <div>
              <div className="stat-value">{loading ? '—' : (showData ? formatCurrency(ov.todayRevenue || ov.totalRevenue || 0) : '***')}</div>
              <div className="stat-label">Today's Revenue</div>
            </div>
          </div>
          {showData && ov.revenueBreakdown && (
            <div className="flex gap-md" style={{ marginTop: '16px', fontSize: '13px', width: '100%', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <div><span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Cash:</span> {formatCurrency(ov.revenueBreakdown.cash)}</div>
              <div><span style={{ color: 'var(--info)', fontWeight: 'bold' }}>Online:</span> {formatCurrency(ov.revenueBreakdown.online)}</div>
              <div><span style={{ color: 'var(--warning)', fontWeight: 'bold' }}>Card:</span> {formatCurrency(ov.revenueBreakdown.card)}</div>
            </div>
          )}
        </div>
        <StatCard
          icon={ShoppingBag}
          label="Active Orders"
          value={showData ? (ov.activeOrders ?? ov.totalOrders ?? 0) : '***'}
          color="#00d2ff"
          loading={loading}
        />
        <StatCard
          icon={Grid3X3}
          label="Tables Occupied"
          value={showData ? (ov.tablesOccupied ?? 0) : '***'}
          color="#f5a623"
          loading={loading}
        />
        <StatCard
          icon={UtensilsCrossed}
          label="Items Served Today"
          value={showData ? (ov.itemsServed ?? ov.totalItemsServed ?? 0) : '***'}
          color="#8b5cf6"
          loading={loading}
        />
      </div>

      {/* 2x2 Dashboard Grid */}
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
        
        {/* Quadrant 1: Table Status Grid */}
        <div className="card">
          <div className="card-header">
            <h3><Grid3X3 size={18} /> Table Status ({occupiedTables}/{totalTables} Occupied)</h3>
          </div>
          <div className="card-body">
            {loading ? (
              <div className="table-status-grid">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="table-status-card skeleton-card" style={{ height: '80px' }} />
                ))}
              </div>
            ) : tables.length > 0 ? (
              <div className="table-status-grid" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {tables.map((t) => (
                  <div key={t.id || t._id || t.number} className={`table-status-card ${getStatusClass(t.status)}`}>
                    <span className="table-num">{t.number || t.table_number}</span>
                    <span className="table-cap">{t.capacity} seats</span>
                    <span className={`badge badge-sm ${
                      t.status === 'available' ? 'badge-success' :
                      t.status === 'occupied' ? 'badge-warning' :
                      'badge-info'
                    }`}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state text-center">No tables configured</div>
            )}
          </div>
        </div>

        {/* Quadrant 2: Recent / Active Orders */}
        <div className="card">
          <div className="card-header">
            <h3><Clock size={18} /> Active Orders</h3>
          </div>
          <div className="card-body">
            {loading ? (
              <div className="skeleton-table">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="skeleton-row" />
                ))}
              </div>
            ) : orders.length > 0 ? (
              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Table</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id || o._id}>
                        <td>#{String(o.id || o._id || '').padStart(5, '0').toUpperCase()}</td>
                        <td 
                          className="text-primary" 
                          style={{ cursor: 'pointer', textDecoration: 'underline' }} 
                          onClick={() => setSelectedOrder(o)}
                        >
                          {o.table_number || o.tableNumber || o.table?.number || '—'}
                        </td>
                        <td>{showData ? formatCurrency(o.totalAmount || o.total) : '***'}</td>
                        <td>
                          <span className={getOrderBadge(o.status)}>
                            {o.status?.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state text-center">No active orders</div>
            )}
          </div>
        </div>

        {/* Quadrant 3: Popular Items (Top 10) */}
        <div className="card">
          <div className="card-header">
            <h3><BarChart3Icon size={18} /> Top 10 Items</h3>
          </div>
          <div className="card-body">
            {loading ? (
              <SkeletonChart />
            ) : popular.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={popular.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" hide={!showData} tick={{ fontSize: 12 }} stroke="var(--text-secondary)" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    width={100}
                    stroke="var(--text-secondary)"
                  />
                  {showData && (
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                      }}
                    />
                  )}
                  <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} barSize={16}>
                    {popular.slice(0, 10).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state text-center">No popular items data</div>
            )}
          </div>
        </div>

        {/* Quadrant 4: Revenue Chart */}
        <div className="card">
          <div className="card-header">
            <h3><TrendingUp size={18} /> Revenue — Last 7 Days</h3>
            <button className="btn btn-icon btn-sm" onClick={fetchData} title="Refresh">
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="card-body">
            {loading ? (
              <SkeletonChart />
            ) : revenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={revenue} margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }} 
                    stroke="var(--text-secondary)"
                    tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    stroke="var(--text-secondary)" 
                    hide={!showData} 
                    domain={[0, dataMax => Math.max(Math.ceil(dataMax * 1.1), 100)]}
                  />
                  {showData && (
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                      }}
                      formatter={(v) => [formatCurrency(v), 'Revenue']}
                      labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke={CHART_COLORS[0]}
                    strokeWidth={3}
                    dot={{ r: 4, fill: CHART_COLORS[0] }}
                    activeDot={{ r: 6 }}
                    connectNulls={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state text-center">No revenue data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <Modal title={`Order Details (Table ${selectedOrder.table_number || '—'})`} onClose={() => setSelectedOrder(null)}>
          <div className="flex-col gap-md p-md">
            <h4 style={{ margin: 0 }}>Items for Order #{selectedOrder.id}</h4>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedOrder.items || []).map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.item_name || item.name || 'Item'}</td>
                      <td>{item.quantity}</td>
                      <td>
                        <span className={`badge ${item.status === 'delivered' || item.status === 'prepared' ? 'badge-success' : 'badge-warning'}`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!selectedOrder.items || selectedOrder.items.length === 0) && (
                <div className="text-center text-muted p-md">No items found</div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* Inline BarChart3 icon wrapper (avoid name collision with recharts BarChart) */
function BarChart3Icon(props) {
  return <BarChart3 {...props} />;
}


