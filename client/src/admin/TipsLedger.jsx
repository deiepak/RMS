import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import { Heart, Search, Filter } from 'lucide-react';

export default function TipsLedger() {
  const [ordersWithTips, setOrdersWithTips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    fetchTips();
  }, []);

  const fetchTips = async () => {
    try {
      setIsLoading(true);
      // We can fetch all completed orders and filter, or fetch all orders and filter
      const res = await api.get('/orders?status=completed');
      
      const filtered = res.data
        .filter(order => parseFloat(order.tip_amount) > 0)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
      setOrdersWithTips(filtered);
    } catch (error) {
      showToast('Failed to fetch tips', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = ordersWithTips.filter(order => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const orderIdStr = String(order.id);
    const tableStr = String(order.table_number || '');
    return orderIdStr.includes(search) || tableStr.includes(search);
  });

  const totalTips = filteredOrders.reduce((sum, order) => sum + parseFloat(order.tip_amount), 0);

  return (
    <div className="admin-content">
      <div className="admin-header">
        <h2>Tips Ledger</h2>
        <div className="flex gap-md align-center">
          <div className="search-bar">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Search by Order ID or Table..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', marginBottom: 24 }}>
        <div className="stat-card" style={{ borderColor: 'var(--primary)' }}>
          <div className="stat-title">Total Tips Collected</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{formatCurrency(totalTips)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Orders with Tips</div>
          <div className="stat-value">{filteredOrders.length}</div>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="text-center text-muted" style={{ padding: '40px' }}>Loading tips...</div>
        ) : filteredOrders.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Order ID</th>
                <th>Table</th>
                <th>Section</th>
                <th className="text-right">Total Bill</th>
                <th className="text-right">Tip Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr key={order.id}>
                  <td>{formatDateTime(new Date(order.created_at))}</td>
                  <td className="font-bold">#{order.id}</td>
                  <td>Table {order.table_number || 'N/A'}</td>
                  <td>{order.section || '-'}</td>
                  <td className="text-right text-secondary">{formatCurrency(parseFloat(order.total) - parseFloat(order.tip_amount))}</td>
                  <td className="text-right font-bold text-success">
                    <div className="flex align-center justify-end gap-xs">
                      <Heart size={14} /> {formatCurrency(order.tip_amount)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state text-center" style={{ padding: '40px' }}>
            <Heart size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
            <h3>No Tips Found</h3>
            <p>No tips have been collected yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
