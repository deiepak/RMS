import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { TrendingDown, Filter, PieChart as PieChartIcon, BarChart3, LineChart as LineChartIcon, Plus } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import Modal from '../components/Modal';
import DatePicker from '../components/DatePicker';

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'];

export default function ExpensesReport() {
  const [summary, setSummary] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({
    category: '',
    amount: '',
    payment_method: 'cash',
    vendor_id: '',
    description: ''
  });

  const [filters, setFilters] = useState({
    period: 'month',
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
      const queryParams = `?from=${filters.from} 00:00:00&to=${filters.to} 23:59:59`;
      
      const [summaryRes, dailyRes, vendorsRes] = await Promise.all([
        api.get(`/expenses/summary${queryParams}`),
        api.get(`/expenses/daily${queryParams}`),
        api.get('/vendors')
      ]);
      
      setSummary(summaryRes.data);
      setDailyData(dailyRes.data);
      setVendors(vendorsRes.data);
    } catch (error) {
      showToast('Failed to load expenses data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!newExpense.vendor_id) {
      showToast('Vendor is required. No vendor means no payment.', 'error');
      return;
    }
    if (!newExpense.description || !newExpense.description.trim()) {
      showToast('Description is compulsory.', 'error');
      return;
    }
    try {
      await api.post('/expenses/custom', newExpense);
      showToast('Expense recorded successfully', 'success');
      setIsModalOpen(false);
      setNewExpense({ category: '', amount: '', payment_method: 'cash', vendor_id: '', description: '' });
      fetchData();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to record expense', 'error');
    }
  };

  const pieData = summary ? [
    { name: 'Purchases', value: summary.breakdown.purchases.total },
    { name: 'HR/Salary', value: summary.breakdown.hr.total },
    { name: 'Maintenance', value: summary.breakdown.maintenance.total },
    { name: 'Custom', value: summary.breakdown.custom.total },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="admin-content">
      <div className="admin-header">
        <h2>Total Expenses</h2>
        <button className="btn btn-primary flex align-center gap-sm" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} /> Log Expense
        </button>
      </div>

      <div className="card mb-lg" style={{ padding: 20 }}>
        <div className="flex gap-lg flex-wrap align-center">
          <div className="flex gap-sm bg-secondary" style={{ padding: 4, borderRadius: 'var(--radius)' }}>
            <button className={`btn ${filters.period === 'today' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none' }} onClick={() => setDateRange('today')}>Today</button>
            <button className={`btn ${filters.period === 'week' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none' }} onClick={() => setDateRange('week')}>This Week</button>
            <button className={`btn ${filters.period === 'month' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none' }} onClick={() => setDateRange('month')}>This Month</button>
            <button className={`btn ${filters.period === 'custom' ? 'btn-primary' : 'btn-secondary'} btn-sm`} style={{ border: 'none' }} onClick={() => setDateRange('custom')}>Custom</button>
          </div>

          {filters.period === 'custom' && (
            <div className="flex gap-md align-center">
              <DatePicker className="form-input" value={filters.from} onChange={e => setFilters(prev => ({...prev, from: e.target.value}))} />
              <span>to</span>
              <DatePicker className="form-input" value={filters.to} onChange={e => setFilters(prev => ({...prev, to: e.target.value}))} />
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex-center" style={{ height: 200 }}><div className="loader"></div></div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-4 gap-lg mb-lg">
            <div className="card" style={{ padding: 20 }}>
              <div className="text-secondary mb-sm flex justify-between">
                <span>Total Expenses</span>
                <TrendingDown size={18} className="text-danger" />
              </div>
              <h2 className="text-danger">{formatCurrency(summary.total)}</h2>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div className="text-secondary mb-sm flex justify-between">
                <span>Stock Purchases</span>
                <span className="badge">{(summary.breakdown.purchases.count)} logs</span>
              </div>
              <h2>{formatCurrency(summary.breakdown.purchases.total)}</h2>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div className="text-secondary mb-sm flex justify-between">
                <span>HR & Salaries</span>
                <span className="badge">{(summary.breakdown.hr.count)} logs</span>
              </div>
              <h2>{formatCurrency(summary.breakdown.hr.total)}</h2>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div className="text-secondary mb-sm flex justify-between">
                <span>Maintenance</span>
                <span className="badge">{(summary.breakdown.maintenance.count)} logs</span>
              </div>
              <h2>{formatCurrency(summary.breakdown.maintenance.total)}</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-lg mb-lg">
            <div className="card" style={{ padding: 20 }}>
              <h3 className="mb-lg flex align-center gap-sm"><LineChartIcon size={18} /> Daily Expense Trend</h3>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--glass-border)" />
                    <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} tickFormatter={tick => tick.substring(5)} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} tickFormatter={tick => `₹${tick}`} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius)' }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="total" name="Total Expenses" stroke="var(--danger)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <h3 className="mb-lg flex align-center gap-sm"><PieChartIcon size={18} /> Expense Breakdown</h3>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius)' }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          
          <div className="card" style={{ padding: 20 }}>
             <h3 className="mb-lg flex align-center gap-sm"><BarChart3 size={18} /> Category Breakdown (Daily)</h3>
             <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--glass-border)" />
                    <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} tickFormatter={tick => tick.substring(5)} />
                    <YAxis stroke="var(--text-secondary)" fontSize={12} tickFormatter={tick => `₹${tick}`} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius)' }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Legend />
                    <Bar dataKey="purchase" name="Purchases" stackId="a" fill="#3b82f6" />
                    <Bar dataKey="hr" name="HR/Salary" stackId="a" fill="#8b5cf6" />
                    <Bar dataKey="maintenance" name="Maintenance" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="custom" name="Custom" stackId="a" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
          </div>
        </>
      ) : null}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Log Custom Expense">
        <form onSubmit={handleAddExpense} className="flex-col gap-md">
          <div className="form-group">
            <label>Vendor (Compulsory - No vendor means no payment)</label>
            <select 
              className="form-select" 
              required
              value={newExpense.vendor_id}
              onChange={e => setNewExpense({...newExpense, vendor_id: e.target.value})}
            >
              <option value="">Select Vendor</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Category</label>
            <input 
              type="text" 
              className="form-input" 
              required 
              placeholder="e.g. Rent, Utilities, Marketing"
              value={newExpense.category}
              onChange={e => setNewExpense({...newExpense, category: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label>Amount (NPR)</label>
            <input 
              type="number" 
              step="0.01"
              className="form-input" 
              required 
              value={newExpense.amount}
              onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label>Payment Method</label>
            <select 
              className="form-select" 
              value={newExpense.payment_method}
              onChange={e => setNewExpense({...newExpense, payment_method: e.target.value})}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="online">Online</option>
              <option value="bank">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          <div className="form-group">
            <label>Description (Compulsory)</label>
            <textarea 
              className="form-input" 
              rows="3"
              required
              placeholder="Provide expense details..."
              value={newExpense.description}
              onChange={e => setNewExpense({...newExpense, description: e.target.value})}
            ></textarea>
          </div>
          <button type="submit" className="btn btn-primary w-full p-md">Save Expense</button>
        </form>
      </Modal>
    </div>
  );
}
