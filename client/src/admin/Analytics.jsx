import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { 
  LineChart, BarChart, PieChart, Line, Bar, Pie, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Cell, AreaChart, Area
} from 'recharts';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import DatePicker from '../components/DatePicker';
import { TrendingUp, TrendingDown, DollarSign, Activity, Package, Clock, Percent } from 'lucide-react';

const COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981', '#3b82f6'];

const StatCard = ({ title, value, subtitle, icon: Icon, trend, trendValue, isCurrency }) => (
  <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: '-15px', right: '-15px', opacity: 0.05, transform: 'scale(2)' }}>
      {Icon && <Icon size={100} />}
    </div>
    
    <div className="flex justify-between align-center mb-md">
      <span className="text-secondary font-medium">{title}</span>
      {Icon && <div style={{ padding: '8px', background: 'var(--glass-bg)', borderRadius: '8px', color: 'var(--accent-primary)' }}><Icon size={18} /></div>}
    </div>
    
    <h3 style={{ fontSize: '28px', margin: '0 0 8px 0', fontWeight: 700, color: 'var(--text-primary)' }}>
      {isCurrency ? formatCurrency(value) : value}
    </h3>
    
    <div className="flex align-center gap-sm mt-auto" style={{ fontSize: '13px' }}>
      {trend === 'up' && <div className="flex align-center text-success font-bold"><TrendingUp size={14} style={{marginRight:4}} /> +{trendValue}%</div>}
      {trend === 'down' && <div className="flex align-center text-danger font-bold"><TrendingDown size={14} style={{marginRight:4}} /> {trendValue}%</div>}
      {trend === 'neutral' && <div className="text-secondary">0%</div>}
      <span className="text-muted ml-sm">{subtitle}</span>
    </div>
  </div>
);

export default function Analytics() {
  const [summary, setSummary] = useState({});
  const [revenueData, setRevenueData] = useState([]);
  const [popularItems, setPopularItems] = useState([]);
  const [leastPopularItems, setLeastPopularItems] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [revenueByHour, setRevenueByHour] = useState([]);
  const [categoryRevenue, setCategoryRevenue] = useState([]);
  const [popularCombos, setPopularCombos] = useState([]);
  const [staffPerformance, setStaffPerformance] = useState([]);
  const [filters, setFilters] = useState({ period: '7d', from: '', to: '' });
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals state
  const [viewMoreModal, setViewMoreModal] = useState({ isOpen: false, type: null, title: '' });
  const [fullList, setFullList] = useState([]);
  const [isFetchingFull, setIsFetchingFull] = useState(false);
  const [comboConfig, setComboConfig] = useState({
    type: 'category',
    size: 2,
    filters: ['all', 'all', 'all', 'all']
  });
  const [menuData, setMenuData] = useState({ categories: [], items: [] });

  const { showToast } = useToast();

  useEffect(() => {
    setDateRange('7d');
  }, []);

  useEffect(() => {
    if (filters.period === 'custom' && (!filters.from || !filters.to)) return;
    fetchData();
  }, [filters.from, filters.to]);

  const setDateRange = (period) => {
    if (period === 'custom') {
      setFilters(prev => ({ ...prev, period }));
      return;
    }
    const toDate = new Date();
    const to = toDate.toLocaleDateString('en-CA');
    let fromDate = new Date();
    
    if (period === 'today') {
      // from = to; handled below
    } else if (period === '7d') {
      fromDate.setDate(fromDate.getDate() - 7);
    } else if (period === 'month') {
      fromDate.setMonth(fromDate.getMonth() - 1);
    } else if (period === 'year') {
      fromDate.setFullYear(fromDate.getFullYear() - 1);
    }
    
    const from = period === 'today' ? to : fromDate.toLocaleDateString('en-CA');
    setFilters({ period, from, to });
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const queryStr = `?from=${filters.from}&to=${filters.to}`;
      
      const [sumRes, revRes, popRes, leastRes, peakRes, revHourRes, catRes, combosRes, staffRes] = await Promise.all([
        api.get(`/analytics/summary-metrics${queryStr}`),
        api.get(`/analytics/revenue${queryStr}`),
        api.get(`/analytics/popular-items${queryStr}`),
        api.get(`/analytics/least-popular-items${queryStr}`),
        api.get(`/analytics/peak-hours${queryStr}`),
        api.get(`/analytics/revenue-by-hour${queryStr}`),
        api.get(`/analytics/category-revenue${queryStr}`),
        api.get(`/analytics/popular-combos${queryStr}`),
        api.get(`/analytics/waiter-performance${queryStr}`)
      ]);

      setSummary(sumRes.data);

      const formattedRev = revRes.data.map(item => ({
        date: new Date(item.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
        Revenue: parseFloat(item.total || item.revenue)
      }));
      setRevenueData(formattedRev);

      setPopularItems(popRes.data.map(item => ({
        name: item.name.length > 12 ? item.name.substring(0, 10) + '...' : item.name,
        fullName: item.name,
        Orders: parseInt(item.count),
        Revenue: parseFloat(item.revenue || 0)
      })));

      setLeastPopularItems(leastRes.data.map(item => ({
        name: item.name.length > 12 ? item.name.substring(0, 10) + '...' : item.name,
        fullName: item.name,
        Orders: parseInt(item.count),
        Revenue: parseFloat(item.revenue || 0)
      })));

      setPeakHours(peakRes.data.map(item => {
        const hour = parseInt(item.hour);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return { time: `${displayHour} ${ampm}`, Orders: parseInt(item.count) };
      }));

      setRevenueByHour(revHourRes.data.map(item => {
        const hour = parseInt(item.hour);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return { time: `${displayHour} ${ampm}`, Revenue: parseFloat(item.revenue || 0) };
      }));

      setCategoryRevenue(catRes.data.map(item => ({
        name: item.name || 'Uncategorized',
        value: parseFloat(item.value || 0)
      })).filter(i => i.value > 0));

      setPopularCombos(combosRes.data);
      setStaffPerformance(staffRes.data);

    } catch (error) {
      showToast('Failed to load analytics data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCombos = async (config) => {
    setIsFetchingFull(true);
    try {
      const activeFilters = config.filters.slice(0, config.size);
      const queryStr = `?from=${filters.from}&to=${filters.to}&limit=all&type=${config.type}&size=${config.size}&filters=${JSON.stringify(activeFilters)}`;
      const res = await api.get(`/analytics/popular-combos${queryStr}`);
      setFullList(res.data);
    } catch (error) {
      showToast('Failed to load combos list', 'error');
    } finally {
      setIsFetchingFull(false);
    }
  };

  const openViewMore = async (type, title) => {
    setViewMoreModal({ isOpen: true, type, title });
    setIsFetchingFull(true);
    
    if (type === 'combos' && menuData.categories.length === 0) {
      try {
        const [catsRes, itemsRes] = await Promise.all([
          api.get('/menu/categories'),
          api.get('/menu')
        ]);
        setMenuData({ categories: catsRes.data, items: itemsRes.data });
      } catch (e) {
        console.error('Failed to load menu data', e);
      }
    }

    try {
      if (type === 'combos') {
        await fetchCombos(comboConfig);
      } else {
        const queryStr = `?from=${filters.from}&to=${filters.to}&limit=all`;
        let res;
        if (type === 'popular') {
          res = await api.get(`/analytics/popular-items${queryStr}`);
        } else if (type === 'least') {
          res = await api.get(`/analytics/least-popular-items${queryStr}`);
        } else if (type === 'staff') {
          res = await api.get(`/analytics/waiter-performance${queryStr}`);
        }
        setFullList(res.data);
      }
    } catch (error) {
      showToast('Failed to load full list', 'error');
    } finally {
      setIsFetchingFull(false);
    }
  };

  const CustomTooltip = ({ active, payload, label, isCurrency }) => {
    if (active && payload && payload.length) {
      const fullLabel = payload[0].payload.fullName || label;
      return (
        <div className="card" style={{ padding: '12px 16px', border: '1px solid var(--glass-border)', zIndex: 100, background: 'var(--bg-card)', color: 'var(--text-primary)', backdropFilter: 'blur(8px)' }}>
          <p className="text-secondary font-bold mb-xs">{fullLabel}</p>
          {payload.map((p, i) => (
            <p key={i} style={{ color: p.color, fontWeight: 600, fontSize: '14px', margin: '4px 0' }}>
              {p.name}: {isCurrency || p.dataKey === 'Revenue' || p.dataKey === 'value' ? formatCurrency(p.value) : p.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomLegend = (props) => {
    const { payload } = props;
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px' }}>
        {payload.map((entry, index) => (
          <li key={`item-${index}`} style={{ display: 'flex', alignItems: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <span style={{ width: 12, height: 12, backgroundColor: entry.color, borderRadius: '50%', marginRight: 8 }}></span>
            {entry.value}
          </li>
        ))}
      </ul>
    );
  };

  const growthTrend = summary.growth > 0 ? 'up' : (summary.growth < 0 ? 'down' : 'neutral');

  return (
    <div className="admin-content" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      <div className="admin-header mb-xl">
        <h2 style={{ fontSize: '28px', fontWeight: 800 }}>Analytics & Reports</h2>
        <p className="text-secondary">Comprehensive overview of your restaurant's performance</p>
      </div>

      {/* Date Filter Bar */}
      <div className="card mb-lg" style={{ padding: '16px 24px' }}>
        <div className="flex gap-lg flex-wrap align-center justify-between">
          <div className="filter-bar">
            <button className={`filter-btn ${filters.period === 'today' ? 'active' : ''}`} onClick={() => setDateRange('today')}>Today</button>
            <button className={`filter-btn ${filters.period === '7d' ? 'active' : ''}`} onClick={() => setDateRange('7d')}>7 Days</button>
            <button className={`filter-btn ${filters.period === 'month' ? 'active' : ''}`} onClick={() => setDateRange('month')}>30 Days</button>
            <button className={`filter-btn ${filters.period === 'year' ? 'active' : ''}`} onClick={() => setDateRange('year')}>1 Year</button>
            <button className={`filter-btn ${filters.period === 'custom' ? 'active' : ''}`} onClick={() => setDateRange('custom')}>Custom</button>
          </div>

          {filters.period === 'custom' && (
            <div className="flex gap-md align-center bg-dark" style={{ padding: '8px 16px', borderRadius: '12px' }}>
              <DatePicker className="form-input bg-transparent border-none text-sm" value={filters.from} onChange={e => setFilters(prev => ({...prev, from: e.target.value}))} />
              <span className="text-muted">to</span>
              <DatePicker className="form-input bg-transparent border-none text-sm" value={filters.to} onChange={e => setFilters(prev => ({...prev, to: e.target.value}))} />
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex-center" style={{ height: '400px' }}>
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          {/* Summary Cards Grid */}
          <div className="analytics-grid-cards mb-lg">
            <StatCard 
              title="Total Sales" 
              value={summary.currentSales || 0} 
              isCurrency={true} 
              icon={DollarSign}
              trend={growthTrend}
              trendValue={Math.abs(summary.growth || 0).toFixed(1)}
              subtitle="vs previous period"
            />
            <StatCard 
              title="Average Order Value" 
              value={summary.averageOrderValue || 0} 
              isCurrency={true} 
              icon={Activity}
            />
            <StatCard 
              title="Discounts Given" 
              value={summary.discountsGiven || 0} 
              isCurrency={true} 
              icon={Percent}
            />
            <StatCard 
              title="Avg Prep Time" 
              value={`${Math.round(summary.avgPrepTime || 0)} min`} 
              icon={Clock}
            />
            <StatCard 
              title="Total Refunds" 
              value={summary.totalRefunds || 0} 
              isCurrency={true} 
              icon={Package}
            />
          </div>

          {/* Main Charts Grid */}
          <div className="analytics-grid-main mb-lg">
            
            {/* Revenue Trend Area Chart */}
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <div className="card-header border-bottom">
                <h3 style={{ fontSize: '18px', margin: 0 }}>Revenue Trend</h3>
              </div>
              <div className="card-body" style={{ height: '400px', padding: '24px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} dy={10} />
                    <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} tickFormatter={(val) => `रू${val}`} dx={-10} />
                    <Tooltip content={<CustomTooltip isCurrency={true} />} />
                    <Area type="monotone" dataKey="Revenue" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Revenue by Category (Pie) */}
            <div className="card">
              <div className="card-header border-bottom">
                <h3 style={{ fontSize: '18px', margin: 0 }}>Revenue by Category</h3>
              </div>
              <div className="card-body flex-center" style={{ height: '350px', padding: '16px' }}>
                {categoryRevenue.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryRevenue}
                        cx="50%" cy="45%"
                        innerRadius={60} outerRadius={90}
                        paddingAngle={5} dataKey="value"
                        stroke="var(--bg-card)"
                      >
                        {categoryRevenue.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip isCurrency={true} />} />
                      <Legend content={<CustomLegend />} wrapperStyle={{ bottom: 0, color: 'var(--text-primary)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-muted">No category data available</div>
                )}
              </div>
            </div>

            {/* Revenue By Hour (Bar) */}
            <div className="card">
              <div className="card-header border-bottom">
                <h3 style={{ fontSize: '18px', margin: 0 }}>Revenue by Hour</h3>
              </div>
              <div className="card-body" style={{ height: '350px', padding: '24px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueByHour}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} dy={10} />
                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} dx={-10} tickFormatter={(val) => `रू${val}`} />
                    <Tooltip content={<CustomTooltip isCurrency={true} />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Bar dataKey="Revenue" fill="var(--success)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Peak Ordering Hours (Bar) */}
            <div className="card">
              <div className="card-header border-bottom">
                <h3 style={{ fontSize: '18px', margin: 0 }}>Peak Ordering Hours (Volume)</h3>
              </div>
              <div className="card-body" style={{ height: '350px', padding: '24px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={peakHours}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} dy={10} />
                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} dx={-10} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Bar dataKey="Orders" fill="var(--accent-secondary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Popular Combos (Table) */}
            <div className="card">
              <div className="card-header border-bottom flex justify-between align-center">
                <h3 style={{ fontSize: '18px', margin: 0 }}>Frequently Bought Together</h3>
                <button className="btn btn-sm btn-secondary" onClick={() => openViewMore('combos', 'All Frequently Bought Together')}>View More</button>
              </div>
              <div className="card-body p-0">
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: 'var(--bg-tertiary)' }}>
                    <tr>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Item 1</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Item 2</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Frequency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {popularCombos.length > 0 ? popularCombos.map((combo, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>{combo.item1}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>{combo.item2}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <span className="badge badge-info">{combo.count} orders</span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="3" className="text-center text-muted" style={{ padding: '20px' }}>No combos found in this period</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Best Selling Items (Horizontal Bar) */}
            <div className="card">
              <div className="card-header border-bottom flex justify-between align-center">
                <h3 style={{ fontSize: '18px', margin: 0 }}>Top 10 Best-Selling Items</h3>
                <button className="btn btn-sm btn-secondary" onClick={() => openViewMore('popular', 'All Popular Items')}>View More</button>
              </div>
              <div className="card-body" style={{ height: '350px', padding: '16px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={popularItems} layout="vertical" margin={{ left: 20, right: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
                    <YAxis dataKey="name" type="category" stroke="var(--text-muted)" tick={{ fontSize: 12, fill: 'var(--text-primary)' }} width={80} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Bar dataKey="Orders" fill="var(--info)" radius={[0, 4, 4, 0]} barSize={12} />
                    <Bar dataKey="Revenue" fill="var(--accent-secondary)" radius={[0, 4, 4, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Least Selling Items (Horizontal Bar) */}
            <div className="card">
              <div className="card-header border-bottom flex justify-between align-center">
                <h3 style={{ fontSize: '18px', margin: 0 }}>Top 10 Least-Selling Items</h3>
                <button className="btn btn-sm btn-secondary" onClick={() => openViewMore('least', 'All Least-Selling Items')}>View More</button>
              </div>
              <div className="card-body" style={{ height: '350px', padding: '16px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leastPopularItems} layout="vertical" margin={{ left: 20, right: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
                    <YAxis dataKey="name" type="category" stroke="var(--text-muted)" tick={{ fontSize: 12, fill: 'var(--text-primary)' }} width={80} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Bar dataKey="Orders" fill="var(--danger)" radius={[0, 4, 4, 0]} barSize={12} />
                    <Bar dataKey="Revenue" fill="var(--warning)" radius={[0, 4, 4, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Staff Performance (Table) */}
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <div className="card-header border-bottom flex justify-between align-center">
                <h3 style={{ fontSize: '18px', margin: 0 }}>Staff Performance (Waiters)</h3>
                <button className="btn btn-sm btn-secondary" onClick={() => openViewMore('staff', 'All Staff Performance')}>View More</button>
              </div>
              <div className="card-body p-0" style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: 'var(--bg-tertiary)' }}>
                    <tr>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Waiter Name</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Items Handled</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Delivered</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Rejected</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Revenue Handled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffPerformance.length > 0 ? staffPerformance.map((staff, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{staff.name}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <span className="badge badge-info">{staff.items_handled}</span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <span className="badge badge-success">{staff.items_delivered}</span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <span className="badge badge-danger">{staff.items_rejected}</span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold', color: 'var(--success)' }}>
                          {formatCurrency(staff.revenue_handled || 0)}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="5" className="text-center text-muted" style={{ padding: '20px' }}>No staff performance data in this period</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* View More Modal */}
          {viewMoreModal.isOpen && (
            <div className="modal-overlay" onClick={() => setViewMoreModal({ isOpen: false, type: null, title: '' })}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
                <div className="modal-header">
                  <h3>{viewMoreModal.title}</h3>
                  <button className="btn btn-icon" onClick={() => setViewMoreModal({ isOpen: false, type: null, title: '' })}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                  </button>
                </div>
                {viewMoreModal.type === 'combos' && (
                  <div className="bg-tertiary" style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)' }}>
                    <div className="flex gap-md flex-wrap align-center mb-md">
                      <select className="form-select border-none" style={{ background: 'var(--bg-card)' }} value={comboConfig.type} onChange={e => {
                          setComboConfig(prev => ({...prev, type: e.target.value, filters: ['all', 'all', 'all', 'all']}));
                        }}>
                        <option value="category">By Category</option>
                        <option value="item">By Specific Item</option>
                      </select>
                      
                      <div className="flex align-center gap-sm">
                        <span className="text-sm text-secondary">Combo Size (Max 4):</span>
                        <input type="number" min="2" max="4" className="form-input border-none" style={{ width: '70px', background: 'var(--bg-card)' }} value={comboConfig.size} onChange={e => {
                          let val = parseInt(e.target.value) || 2;
                          if (val > 4) val = 4;
                          if (val < 2) val = 2;
                          setComboConfig(prev => ({...prev, size: val}));
                        }} />
                      </div>
                    </div>
                    
                    <div className="flex gap-md flex-wrap align-center">
                      {Array.from({length: comboConfig.size}).map((_, i) => (
                        <select key={i} className="form-select border-none flex-1" style={{ background: 'var(--bg-card)', minWidth: '150px' }} value={comboConfig.filters[i]} onChange={e => {
                          const newFilters = [...comboConfig.filters];
                          newFilters[i] = e.target.value;
                          setComboConfig(prev => ({...prev, filters: newFilters}));
                        }}>
                          <option value="all">Any {comboConfig.type === 'category' ? 'Category' : 'Item'}</option>
                          {comboConfig.type === 'category' ? 
                            menuData.categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>) :
                            menuData.items.map(it => <option key={it.id} value={it.name}>{it.name}</option>)
                          }
                        </select>
                      ))}
                      <button className="btn btn-primary" onClick={() => fetchCombos(comboConfig)}>Apply Filters</button>
                    </div>
                  </div>
                )}
                <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                  {isFetchingFull ? (
                    <div className="flex-center p-xl">
                      <div className="spinner"></div>
                    </div>
                  ) : (
                    <table className="data-table" style={{ width: '100%' }}>
                      <thead style={{ background: 'var(--bg-tertiary)' }}>
                        <tr>
                          {viewMoreModal.type === 'combos' ? (
                            <>
                              {Array.from({length: comboConfig.size}).map((_, i) => (
                                <th key={i} style={{ textAlign: 'left' }}>Item {i+1}</th>
                              ))}
                              <th style={{ textAlign: 'right' }}>Frequency</th>
                            </>
                          ) : viewMoreModal.type === 'staff' ? (
                            <>
                              <th style={{ textAlign: 'left' }}>Waiter Name</th>
                              <th style={{ textAlign: 'right' }}>Items Handled</th>
                              <th style={{ textAlign: 'right' }}>Delivered</th>
                              <th style={{ textAlign: 'right' }}>Rejected</th>
                              <th style={{ textAlign: 'right' }}>Revenue Handled</th>
                            </>
                          ) : (
                            <>
                              <th style={{ textAlign: 'left' }}>Item Name</th>
                              <th style={{ textAlign: 'right' }}>Orders</th>
                              <th style={{ textAlign: 'right' }}>Revenue</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {fullList.length === 0 ? (
                          <tr><td colSpan="5" className="text-center p-md text-muted">No data available</td></tr>
                        ) : viewMoreModal.type === 'combos' ? (
                          fullList.map((combo, idx) => (
                            <tr key={idx}>
                              {Array.from({length: comboConfig.size}).map((_, i) => (
                                <td key={i}>{combo[`item${i+1}`]}</td>
                              ))}
                              <td style={{ textAlign: 'right' }}><span className="badge badge-info">{combo.count} orders</span></td>
                            </tr>
                          ))
                        ) : viewMoreModal.type === 'staff' ? (
                          fullList.map((staff, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600 }}>{staff.name}</td>
                              <td style={{ textAlign: 'right' }}><span className="badge badge-info">{staff.items_handled}</span></td>
                              <td style={{ textAlign: 'right' }}><span className="badge badge-success">{staff.items_delivered}</span></td>
                              <td style={{ textAlign: 'right' }}><span className="badge badge-danger">{staff.items_rejected}</span></td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--success)' }}>
                                {formatCurrency(staff.revenue_handled || 0)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          fullList.map((item, idx) => (
                            <tr key={idx}>
                              <td>{item.name}</td>
                              <td style={{ textAlign: 'right' }}>{item.count}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(item.revenue || 0)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .analytics-grid-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 24px;
        }
        
        .analytics-grid-main {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
          gap: 24px;
        }

        @media (max-width: 1024px) {
          .analytics-grid-main {
            grid-template-columns: 1fr;
          }
        }

        .border-bottom {
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 16px;
          margin-bottom: 16px;
        }

        .spinner {
          width: 48px; height: 48px;
          border: 4px solid rgba(99, 102, 241, 0.2);
          border-left-color: var(--accent-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
