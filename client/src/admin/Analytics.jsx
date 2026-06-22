import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { LineChart, BarChart, PieChart, Line, Bar, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency } from '../utils/helpers';

const COLORS = ['#e94560', '#f5a623', '#00d2ff', '#22c55e', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function Analytics() {
  const [revenueData, setRevenueData] = useState([]);
  const [popularItems, setPopularItems] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [tableStats, setTableStats] = useState([]);
  const [paymentStats, setPaymentStats] = useState([]);
  const [categoryRevenue, setCategoryRevenue] = useState([]);
  const [dayOfWeekStats, setDayOfWeekStats] = useState([]);
  const [filters, setFilters] = useState({ period: '7d', from: '', to: '' });
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    // Initialize default date range on mount
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
    const to = new Date().toISOString().split('T')[0];
    let from = new Date();
    if (period === 'today') {
      from = to;
    } else if (period === '7d') {
      from.setDate(from.getDate() - 7);
      from = from.toISOString().split('T')[0];
    } else if (period === 'month') {
      from.setMonth(from.getMonth() - 1);
      from = from.toISOString().split('T')[0];
    } else if (period === 'year') {
      from.setFullYear(from.getFullYear() - 1);
      from = from.toISOString().split('T')[0];
    }
    setFilters({ period, from, to });
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const queryStr = `?from=${filters.from}&to=${filters.to}`;
      const [revRes, popRes, peakRes, tableRes, ledgerRes, catRes, dayRes] = await Promise.all([
        api.get(`/analytics/revenue${queryStr}`),
        api.get(`/analytics/popular-items${queryStr}`),
        api.get(`/analytics/peak-hours${queryStr}`),
        api.get(`/analytics/table-utilization${queryStr}`),
        api.get(`/ledger/summary${queryStr}`), // Using ledger summary for payment breakdown
        api.get(`/analytics/category-revenue${queryStr}`),
        api.get(`/analytics/day-of-week${queryStr}`)
      ]);

      // Format dates for revenue
      const formattedRev = revRes.data.map(item => ({
        date: new Date(item.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
        Revenue: parseFloat(item.total)
      }));
      setRevenueData(formattedRev);

      // Format popular items
      const formattedPop = popRes.data.map(item => ({
        name: item.name,
        Orders: parseInt(item.count),
        Revenue: parseFloat(item.revenue || 0)
      }));
      setPopularItems(formattedPop);

      // Format peak hours (0-23 to readable)
      const formattedPeak = peakRes.data.map(item => {
        const hour = parseInt(item.hour);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return {
          time: `${displayHour} ${ampm}`,
          Orders: parseInt(item.count)
        };
      });
      setPeakHours(formattedPeak);

      // Format table stats
      const formattedTables = tableRes.data.map(item => ({
        name: `Table ${item.number}`,
        Usage: parseInt(item.count)
      })).slice(0, 10);
      setTableStats(formattedTables);

      // Format payment methods
      const pData = ledgerRes.data.by_method;
      setPaymentStats([
        { name: 'Cash', value: pData.cash },
        { name: 'Card', value: pData.card },
        { name: 'Online', value: pData.online }
      ].filter(i => i.value > 0));

      // Format category revenue
      const formattedCat = catRes.data.map(item => ({
        name: item.name || 'Uncategorized',
        value: parseFloat(item.value || 0)
      })).filter(i => i.value > 0);
      setCategoryRevenue(formattedCat);

      // Format Day of Week
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const formattedDays = dayRes.data.map(item => ({
        name: dayNames[item.day - 1] || 'Unknown',
        Orders: parseInt(item.count || 0)
      }));
      setDayOfWeekStats(formattedDays);

    } catch (error) {
      showToast('Failed to load analytics data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload, label, isCurrency }) => {
    if (active && payload && payload.length) {
      return (
        <div className="card" style={{ padding: '10px 15px', border: '1px solid var(--glass-border)' }}>
          <p className="text-secondary" style={{ marginBottom: 5 }}>{label}</p>
          {payload.map((p, i) => (
            <p key={i} style={{ color: p.color, fontWeight: 600 }}>
              {p.name}: {isCurrency ? formatCurrency(p.value) : p.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="admin-content flex-center">
        <div className="text-muted">Loading analytics data...</div>
      </div>
    );
  }

  return (
    <div className="admin-content">
      <div className="admin-header">
        <h2>Analytics & Reports</h2>
      </div>

      <div className="card mb-lg" style={{ padding: 20 }}>
        <div className="flex gap-lg flex-wrap align-center">
          <div className="flex gap-sm bg-secondary" style={{ padding: 4, borderRadius: 'var(--radius)' }}>
            <button className={`btn ${filters.period === 'today' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none' }} onClick={() => setDateRange('today')}>Today</button>
            <button className={`btn ${filters.period === '7d' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none' }} onClick={() => setDateRange('7d')}>7 Days</button>
            <button className={`btn ${filters.period === 'month' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none' }} onClick={() => setDateRange('month')}>1 Month</button>
            <button className={`btn ${filters.period === 'year' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none' }} onClick={() => setDateRange('year')}>1 Year</button>
            <button className={`btn ${filters.period === 'custom' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none' }} onClick={() => setDateRange('custom')}>Custom</button>
          </div>

          {filters.period === 'custom' && (
            <div className="flex gap-md align-center">
              <input type="date" className="form-input" value={filters.from} onChange={e => setFilters(prev => ({...prev, from: e.target.value}))} />
              <span>to</span>
              <input type="date" className="form-input" value={filters.to} onChange={e => setFilters(prev => ({...prev, to: e.target.value}))} />
            </div>
          )}
        </div>
      </div>

      <div className="card mb-lg">
        <div className="card-header">
          <h3 style={{ fontSize: 18 }}>Revenue Trend</h3>
        </div>
        <div className="card-body" style={{ height: 350 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
              <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)' }} />
              <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)' }} tickFormatter={(val) => `रू${val}`} />
              <Tooltip content={<CustomTooltip isCurrency={true} />} />
              <Line type="monotone" dataKey="Revenue" stroke="var(--accent-primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--bg-card)', strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex gap-lg flex-wrap mb-lg">
        <div className="card flex-1" style={{ minWidth: 300 }}>
          <div className="card-header">
            <h3 style={{ fontSize: 18 }}>Peak Ordering Hours</h3>
          </div>
          <div className="card-body" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={peakHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-secondary)" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)' }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="Orders" fill="var(--accent-secondary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card flex-1" style={{ minWidth: 300 }}>
          <div className="card-header">
            <h3 style={{ fontSize: 18 }}>Payment Methods</h3>
          </div>
          <div className="card-body flex-center" style={{ height: 300 }}>
            {paymentStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {paymentStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted">No payment data available</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-lg flex-wrap mb-lg">
        <div className="card flex-1" style={{ minWidth: 300 }}>
          <div className="card-header">
            <h3 style={{ fontSize: 18 }}>Revenue by Category</h3>
          </div>
          <div className="card-body flex-center" style={{ height: 300 }}>
            {categoryRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryRevenue}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryRevenue.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted">No category data available</div>
            )}
          </div>
        </div>

        <div className="card flex-1" style={{ minWidth: 300 }}>
          <div className="card-header">
            <h3 style={{ fontSize: 18 }}>Busiest Days of Week</h3>
          </div>
          <div className="card-body" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayOfWeekStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)' }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="Orders" fill="var(--info)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="flex gap-lg flex-wrap mb-lg">
        <div className="card flex-1" style={{ minWidth: 300 }}>
          <div className="card-header">
            <h3 style={{ fontSize: 18 }}>Top 10 Popular Items</h3>
          </div>
          <div className="card-body" style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={popularItems} layout="vertical" margin={{ left: 40, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)' }} />
                <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" tick={{ fontSize: 12, fill: 'var(--text-primary)' }} width={100} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="Orders" fill="var(--info)" radius={[0, 4, 4, 0]} barSize={15} />
                <Bar dataKey="Revenue" fill="var(--accent-secondary)" radius={[0, 4, 4, 0]} barSize={15} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card flex-1" style={{ minWidth: 300 }}>
          <div className="card-header">
            <h3 style={{ fontSize: 18 }}>Top Utilized Tables</h3>
          </div>
          <div className="card-body" style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tableStats} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)' }} />
                <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" tick={{ fontSize: 12, fill: 'var(--text-primary)' }} width={60} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Bar dataKey="Usage" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20}>
                  {tableStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
