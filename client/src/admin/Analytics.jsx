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
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [revRes, popRes, peakRes, tableRes, ledgerRes, catRes, dayRes] = await Promise.all([
        api.get('/analytics/revenue'),
        api.get('/analytics/popular-items'),
        api.get('/analytics/peak-hours'),
        api.get('/analytics/table-utilization'),
        api.get('/ledger/summary'), // Using ledger summary for payment breakdown
        api.get('/analytics/category-revenue'),
        api.get('/analytics/day-of-week')
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

      <div className="card mb-lg">
        <div className="card-header">
          <h3 style={{ fontSize: 18 }}>Revenue Trend (Last 7 Days)</h3>
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
