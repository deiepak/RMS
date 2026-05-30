import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { formatDateTime } from '../utils/helpers';
import { FileText, AlertTriangle } from 'lucide-react';

export default function DamageReport() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    fetchDamageTransactions();
  }, []);

  const fetchDamageTransactions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/stock/transactions');
      // Filter for damage
      const damaged = res.data.filter(t => t.transaction_type === 'damage');
      setTransactions(damaged);
    } catch (error) {
      showToast('Failed to load damage report', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="admin-content flex-center">Loading damage report...</div>;
  }

  return (
    <div className="admin-content">
      <div className="admin-header">
        <h2>Damage Report</h2>
        <button className="btn btn-secondary" onClick={fetchDamageTransactions}>Refresh</button>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {transactions.length === 0 ? (
            <div className="empty-state text-center" style={{ padding: '40px' }}>
              <AlertTriangle size={48} className="text-secondary mb-md" style={{ opacity: 0.5 }} />
              <h3>No Damaged Items</h3>
              <p className="text-secondary">There are no records of damaged stock.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Item Name</th>
                  <th>Quantity Lost</th>
                  <th>Notes / Reason</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(txn => (
                  <tr key={txn.id}>
                    <td>
                      <div className="text-secondary" style={{ fontSize: 13 }}>
                        {formatDateTime(txn.created_at)}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{txn.item_name}</td>
                    <td className="text-danger" style={{ fontWeight: 'bold' }}>
                      -{txn.quantity} {txn.unit}
                    </td>
                    <td>{txn.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
