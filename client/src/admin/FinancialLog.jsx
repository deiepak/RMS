import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import DatePicker from '../components/DatePicker';
import { BookOpen, Download, TrendingUp, TrendingDown, ArrowRightLeft, Wallet } from 'lucide-react';

export default function FinancialLog() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  const [filters, setFilters] = useState({
    period: 'month',
    from: '',
    to: '',
    type: 'all' // all, income, expense, cash_flow
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
      fetchLogs();
    }
  }, [filters]);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/financial-log?from=${filters.from}%2000:00:00&to=${filters.to}%2023:59:59&type=${filters.type}`);
      setLogs(res.data);
    } catch (error) {
      showToast('Failed to fetch financial logs', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (logs.length === 0) {
      showToast('No data to export', 'error');
      return;
    }

    const headers = ['Date', 'Type', 'Category', 'Description', 'Amount In', 'Amount Out', 'Payment Method'];
    const rows = logs.map(l => [
      formatDateTime(l.created_at),
      l.type.toUpperCase(),
      l.category,
      `"${l.description?.replace(/"/g, '""') || ''}"`,
      l.amount_in,
      l.amount_out,
      l.payment_method || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `financial-log_${filters.from}_to_${filters.to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalIncome = logs.filter(l => l.type !== 'cash_flow').reduce((sum, l) => sum + parseFloat(l.amount_in || 0), 0);
  const totalExpense = logs.filter(l => l.type !== 'cash_flow').reduce((sum, l) => sum + parseFloat(l.amount_out || 0), 0);
  const totalCashFlow = logs.filter(l => l.type === 'cash_flow').reduce((sum, l) => sum + parseFloat(l.amount_out || 0), 0);
  const net = totalIncome - totalExpense;

  return (
    <div className="admin-content">
      <div className="admin-header">
        <h2>Financial Log</h2>
        <button className="btn btn-secondary flex align-center gap-sm" onClick={handleExportCsv} disabled={logs.length === 0}>
          <Download size={16} /> Export CSV
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

          <div className="flex gap-sm align-center ml-auto">
            <span className="text-secondary">Type:</span>
            <select className="form-select" value={filters.type} onChange={e => setFilters({...filters, type: e.target.value})}>
              <option value="all">All</option>
              <option value="income">Income Only</option>
              <option value="expense">Expenses Only</option>
              <option value="cash_flow">Cash Flow Only</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-lg mb-lg">
        <div className="card" style={{ padding: 20 }}>
          <div className="text-secondary mb-sm flex justify-between">
            <span>Total Income</span>
            <TrendingUp size={18} className="text-success" />
          </div>
          <h2 className="text-success">{formatCurrency(totalIncome)}</h2>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="text-secondary mb-sm flex justify-between">
            <span>Total Expense</span>
            <TrendingDown size={18} className="text-danger" />
          </div>
          <h2 className="text-danger">{formatCurrency(totalExpense)}</h2>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="text-secondary mb-sm flex justify-between">
            <span>Cash Flow Out</span>
            <Wallet size={18} style={{ color: '#6366f1' }} />
          </div>
          <h2 style={{ color: '#6366f1' }}>{formatCurrency(totalCashFlow)}</h2>
          <div className="text-secondary" style={{ fontSize: 11, marginTop: 4 }}>Vendor payments (not an expense)</div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="text-secondary mb-sm flex justify-between">
            <span>Net Balance</span>
            <ArrowRightLeft size={18} className={net >= 0 ? "text-success" : "text-danger"} />
          </div>
          <h2 className={net >= 0 ? "text-success" : "text-danger"}>{formatCurrency(net)}</h2>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Chronological Log</h3>
        </div>
        <div className="card-body p-0">
          {isLoading ? (
            <div className="flex-center" style={{ height: 200 }}><div className="loader"></div></div>
          ) : logs.length === 0 ? (
            <div className="flex-center" style={{ height: 200, color: 'var(--text-secondary)' }}>No records found for selected period.</div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Payment Method</th>
                    <th style={{ textAlign: 'right' }}>In (₹)</th>
                    <th style={{ textAlign: 'right' }}>Out (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, index) => (
                    <tr key={index} style={{ backgroundColor: log.type === 'income' ? 'rgba(16, 185, 129, 0.05)' : log.type === 'income_reduction' ? 'rgba(245, 158, 11, 0.05)' : log.type === 'cash_flow' ? 'rgba(99, 102, 241, 0.05)' : 'rgba(239, 68, 68, 0.05)' }}>
                      <td>{formatDateTime(log.created_at)}</td>
                      <td>
                        <span className={`badge ${log.type === 'income' ? 'badge-success' : log.type === 'income_reduction' ? 'badge-warning' : log.type === 'cash_flow' ? 'badge-info' : 'badge-danger'}`}>
                          {log.type === 'cash_flow' ? 'CASH FLOW' : log.type === 'income_reduction' ? 'SALES RETURN' : log.type.toUpperCase()}
                        </span>
                      </td>
                      <td>{(log.category || '').replace(/_/g, ' ')}</td>
                      <td>{log.description}</td>
                      <td><span style={{ textTransform: 'capitalize' }}>{log.payment_method || '-'}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }} className={log.type === 'income_reduction' ? "text-warning" : "text-success"}>
                        {parseFloat(log.amount_in) !== 0 ? formatCurrency(log.amount_in) : '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }} className="text-danger">
                        {parseFloat(log.amount_out) > 0 ? formatCurrency(log.amount_out) : '-'}
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
  );
}
