import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/Modal';

export default function AdventureManagement() {
  const [adventures, setAdventures] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', price: '' });
  const [editingId, setEditingId] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetchAdventures();
  }, []);

  const fetchAdventures = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/adventures/items');
      setAdventures(res.data);
    } catch (error) {
      showToast('Failed to load adventures', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/adventures/items/${editingId}`, form);
        showToast('Adventure updated successfully', 'success');
      } else {
        await api.post('/adventures/items', form);
        showToast('Adventure created successfully', 'success');
      }
      setIsModalOpen(false);
      fetchAdventures();
    } catch (error) {
      showToast('Failed to save adventure', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this adventure?')) return;
    try {
      await api.delete(`/adventures/items/${id}`);
      showToast('Adventure deleted', 'success');
      fetchAdventures();
    } catch (error) {
      showToast('Failed to delete adventure', 'error');
    }
  };

  const openModal = (adv = null) => {
    if (adv) {
      setEditingId(adv.id);
      setForm({ name: adv.name, price: adv.price });
    } else {
      setEditingId(null);
      setForm({ name: '', price: '' });
    }
    setIsModalOpen(true);
  };

  if (isLoading) return <div className="p-lg">Loading adventures...</div>;

  return (
    <div className="p-lg animate-fade-in">
      <div className="flex justify-between align-center mb-lg">
        <div>
          <h2 className="text-xl font-bold">Adventures</h2>
          <p className="text-secondary">Manage adventure activities and pricing</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={20} className="mr-sm" /> Add Adventure
        </button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Price</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {adventures.length === 0 ? (
              <tr>
                <td colSpan="3" className="text-center text-secondary py-lg">No adventures found. Create one to get started!</td>
              </tr>
            ) : (
              adventures.map(adv => (
                <tr key={adv.id}>
                  <td className="font-medium">{adv.name}</td>
                  <td>रू {Number(adv.price).toLocaleString()}</td>
                  <td className="text-right">
                    <button className="btn btn-icon mr-sm text-info" onClick={() => openModal(adv)} title="Edit">
                      <Edit2 size={18} />
                    </button>
                    <button className="btn btn-icon text-danger" onClick={() => handleDelete(adv.id)} title="Delete">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Edit Adventure' : 'New Adventure'}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-md">
          <div className="form-group">
            <label className="form-label">Adventure Name</label>
            <input
              type="text"
              className="form-input"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
              placeholder="e.g. Zipline"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Price (रू)</label>
            <input
              type="number"
              className="form-input"
              value={form.price}
              onChange={e => setForm({ ...form, price: e.target.value })}
              required
              min="0"
              step="0.01"
              placeholder="e.g. 1500"
            />
          </div>
          <div className="flex justify-end gap-md mt-md">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Adventure</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
