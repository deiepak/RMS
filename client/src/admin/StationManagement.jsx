import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Settings } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import '../index.css';

export default function StationManagement() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editStation, setEditStation] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ name: '' });
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const fetchStations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/stations');
      setStations(res.data || []);
    } catch (err) {
      showToast('Failed to load stations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editStation) {
        await api.put(`/stations/${editStation.id}`, form);
        showToast('Station updated successfully', 'success');
      } else {
        await api.post('/stations', form);
        showToast('Station added successfully', 'success');
      }
      setShowAddModal(false);
      setEditStation(null);
      setForm({ name: '' });
      fetchStations();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save station', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/stations/${deleteTarget.id}`);
      showToast('Station deleted', 'success');
      setDeleteTarget(null);
      fetchStations();
    } catch (err) {
      showToast('Failed to delete station', 'error');
    }
  };

  const openEdit = (station) => {
    setForm({ name: station.name });
    setEditStation(station);
    setShowAddModal(true);
  };

  const openAdd = () => {
    setForm({ name: '' });
    setEditStation(null);
    setShowAddModal(true);
  };

  return (
    <div className="table-mgmt-page">
      <div className="page-actions">
        <div className="page-info">
          <span className="result-count">{stations.length} stations</span>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={18} /> Add Station
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="card-body">Loading...</div>
        ) : stations.length === 0 ? (
          <div className="card-body empty-state text-center" style={{ padding: '3rem' }}>
            <Settings size={48} style={{ opacity: 0.3 }} />
            <h3>No stations configured</h3>
            <p>Add your first station (e.g., Bar, Grill) to group menu items and assignments.</p>
            <button className="btn btn-primary mt-md" onClick={openAdd}>
              <Plus size={18} /> Add Station
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Station Name</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((station) => (
                <tr key={station.id}>
                  <td style={{ fontWeight: 600 }}>{station.name}</td>
                  <td>
                    <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-icon btn-sm" onClick={() => openEdit(station)}>
                        <Edit2 size={16} />
                      </button>
                      <button className="btn btn-icon btn-sm btn-danger" onClick={() => setDeleteTarget(station)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => { setShowAddModal(false); setEditStation(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editStation ? 'Edit Station' : 'Add New Station'}</h2>
              <button className="btn btn-icon" onClick={() => { setShowAddModal(false); setEditStation(null); }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Station Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.name}
                    onChange={(e) => setForm({ name: e.target.value })}
                    required
                    placeholder="e.g., Main Kitchen, Bar, Grill"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowAddModal(false); setEditStation(null); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editStation ? 'Update Station' : 'Add Station'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Station</h2>
              <button className="btn btn-icon" onClick={() => setDeleteTarget(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{deleteTarget.name}</strong>?</p>
              <p className="text-muted mt-sm" style={{ fontSize: '0.85rem' }}>
                Menu items and employees assigned to this station will become unassigned.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
