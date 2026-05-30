import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Plus, Edit2, Trash2, Tag, Calendar, Percent, Banknote } from 'lucide-react';
import Modal from '../components/Modal';

export default function PromoManagement() {
  const [promos, setPromos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [form, setForm] = useState({
    code: '', type: 'percent', value: '', min_order: 0, max_uses: 0, expires_at: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/promos');
      setPromos(res.data);
    } catch (error) {
      showToast('Failed to load promos', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingPromo) {
        await api.put(`/promos/${editingPromo.id}`, form);
        showToast('Promo updated', 'success');
      } else {
        await api.post('/promos', form);
        showToast('Promo created', 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      showToast('Failed to save promo', 'error');
    }
  };

  const handleToggle = async (id) => {
    try {
      await api.patch(`/promos/${id}/toggle`);
      fetchData();
    } catch (error) {
      showToast('Failed to toggle status', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this promo code?')) {
      try {
        await api.delete(`/promos/${id}`);
        showToast('Promo deleted', 'success');
        fetchData();
      } catch (error) {
        showToast('Failed to delete promo', 'error');
      }
    }
  };

  const openModal = (promo = null) => {
    if (promo) {
      setEditingPromo(promo);
      setForm({
        code: promo.code,
        type: promo.type,
        value: promo.value,
        min_order: promo.min_order,
        max_uses: promo.max_uses,
        expires_at: promo.expires_at ? new Date(promo.expires_at).toISOString().slice(0, 16) : ''
      });
    } else {
      setEditingPromo(null);
      setForm({ code: '', type: 'percent', value: '', min_order: 0, max_uses: 0, expires_at: '' });
    }
    setIsModalOpen(true);
  };

  return (
    <div className="admin-content">
      <div className="admin-header">
        <h2>Promo Codes</h2>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={18} /> Add Promo Code
        </button>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Type / Value</th>
              <th>Usage</th>
              <th>Expiry</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {promos.map(promo => {
              const isExpired = promo.expires_at && new Date(promo.expires_at) < new Date();
              return (
                <tr key={promo.id} style={{ opacity: isExpired ? 0.6 : 1 }}>
                  <td>
                    <div className="flex align-center gap-sm" style={{ fontWeight: 700, letterSpacing: 1 }}>
                      <Tag size={16} className="text-secondary" /> {promo.code}
                    </div>
                  </td>
                  <td>
                    <div className="flex align-center gap-sm" style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                      {promo.type === 'percent' ? <Percent size={14} /> : <Banknote size={14} />}
                      {promo.type === 'percent' ? `${promo.value}%` : `रू ${promo.value}`}
                    </div>
                    {parseFloat(promo.min_order) > 0 && (
                      <div className="text-secondary mt-sm" style={{ fontSize: 12 }}>Min Order: रू {promo.min_order}</div>
                    )}
                  </td>
                  <td>
                    <div className="text-secondary">
                      {promo.used_count} / {promo.max_uses == 0 ? '∞' : promo.max_uses}
                    </div>
                  </td>
                  <td>
                    {promo.expires_at ? (
                      <div className="flex align-center gap-sm text-secondary">
                        <Calendar size={14} /> {new Date(promo.expires_at).toLocaleDateString()}
                        {isExpired && <span className="text-danger ml-sm">(Expired)</span>}
                      </div>
                    ) : 'Never'}
                  </td>
                  <td>
                    <button 
                      className={`badge ${promo.is_active ? 'badge-success' : 'badge-danger'}`}
                      style={{ border: 'none', cursor: 'pointer' }}
                      onClick={() => handleToggle(promo.id)}
                    >
                      {promo.is_active ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td className="text-right">
                    <div className="btn-group justify-end">
                      <button className="btn btn-icon btn-secondary" onClick={() => openModal(promo)}>
                        <Edit2 size={16} />
                      </button>
                      <button className="btn btn-icon btn-secondary" onClick={() => handleDelete(promo.id)}>
                        <Trash2 size={16} color="var(--danger)" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {promos.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center text-muted" style={{ padding: '40px 0' }}>
                  No promo codes created
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingPromo ? "Edit Promo Code" : "Add Promo Code"}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Promo Code</label>
          <input type="text" className="form-input" style={{ textTransform: 'uppercase', letterSpacing: 2, fontWeight: 'bold' }} value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} required />
        </div>
        <div className="flex gap-md">
          <div className="form-group flex-1">
            <label className="form-label">Type</label>
            <select className="form-select" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              <option value="percent">Percentage (%)</option>
              <option value="flat">Flat Amount (रू)</option>
            </select>
          </div>
          <div className="form-group flex-1">
            <label className="form-label">Discount Value</label>
            <input type="number" step="0.01" className="form-input" value={form.value} onChange={e => setForm({...form, value: e.target.value})} required />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Minimum Order Amount (रू)</label>
          <input type="number" className="form-input" value={form.min_order} onChange={e => setForm({...form, min_order: e.target.value})} />
          <small className="text-muted mt-sm">Leave 0 for no minimum</small>
        </div>
        <div className="flex gap-md">
          <div className="form-group flex-1">
            <label className="form-label">Max Uses (Total)</label>
            <input type="number" className="form-input" value={form.max_uses} onChange={e => setForm({...form, max_uses: e.target.value})} />
            <small className="text-muted mt-sm">Leave 0 for unlimited</small>
          </div>
          <div className="form-group flex-1">
            <label className="form-label">Expiry Date & Time (Optional)</label>
            <input type="datetime-local" className="form-input" value={form.expires_at} onChange={e => setForm({...form, expires_at: e.target.value})} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
