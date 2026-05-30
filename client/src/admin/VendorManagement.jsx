import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Plus, Edit2, Trash2, Mail, Phone, MapPin, FileText } from 'lucide-react';
import Modal from '../components/Modal';

export default function VendorManagement() {
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [form, setForm] = useState({
    name: '', contact: '', email: '', address: '', notes: ''
  });

  const navigate = useNavigate();


  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/vendors');
      setVendors(res.data);
    } catch (error) {
      showToast('Failed to load vendors', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingVendor) {
        await api.put(`/vendors/${editingVendor.id}`, form);
        showToast('Vendor updated', 'success');
      } else {
        await api.post('/vendors', form);
        showToast('Vendor added', 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      showToast('Failed to save vendor', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this vendor? This will not delete their stock items, but will remove the link.')) {
      try {
        await api.delete(`/vendors/${id}`);
        showToast('Vendor deleted', 'success');
        fetchData();
      } catch (error) {
        showToast('Failed to delete vendor', 'error');
      }
    }
  };

  const openLedger = (vendor) => {
    navigate(`/admin/vendors/${vendor.id}`, { state: { vendor } });
  };

  const openModal = (vendor = null) => {
    if (vendor) {
      setEditingVendor(vendor);
      setForm({
        name: vendor.name,
        contact: vendor.contact,
        email: vendor.email || '',
        address: vendor.address || '',
        notes: vendor.notes || ''
      });
    } else {
      setEditingVendor(null);
      setForm({ name: '', contact: '', email: '', address: '', notes: '' });
    }
    setIsModalOpen(true);
  };

  return (
    <div className="admin-content">
      <div className="admin-header">
        <h2>Vendor Management</h2>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={18} /> Add Vendor
        </button>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Vendor Name</th>
              <th>Contact Details</th>
              <th>Address</th>
              <th>Linked Items</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map(vendor => (
              <tr key={vendor.id}>
                <td>
                  <div 
                    style={{ fontWeight: 600, color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    onClick={() => openLedger(vendor)}
                    title="View Vendor Profile & Ledger"
                  >
                    {vendor.name}
                    <FileText size={14} />
                  </div>
                </td>
                <td>
                  <div className="flex flex-col gap-sm text-secondary" style={{ fontSize: 13 }}>
                    <div className="flex align-center gap-sm"><Phone size={14} /> {vendor.contact}</div>
                    {vendor.email && <div className="flex align-center gap-sm"><Mail size={14} /> {vendor.email}</div>}
                  </div>
                </td>
                <td className="text-secondary">
                  {vendor.address ? (
                    <div className="flex align-center gap-sm">
                      <MapPin size={14} /> {vendor.address}
                    </div>
                  ) : 'N/A'}
                </td>
                <td>
                  <span className="badge badge-info">{vendor.linked_items_count || 0} Items</span>
                </td>
                <td className="text-right">
                  <div className="btn-group justify-end">
                    <button className="btn btn-icon btn-secondary" onClick={() => openLedger(vendor)} title="View Ledger">
                      <FileText size={16} color="var(--info)" />
                    </button>
                    <button className="btn btn-icon btn-secondary" onClick={() => openModal(vendor)} title="Edit Vendor">
                      <Edit2 size={16} />
                    </button>
                    <button className="btn btn-icon btn-secondary" onClick={() => handleDelete(vendor.id)} title="Delete Vendor">
                      <Trash2 size={16} color="var(--danger)" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {vendors.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center text-muted" style={{ padding: '40px 0' }}>
                  No vendors found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingVendor ? "Edit Vendor" : "Add Vendor"}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Vendor Name</label>
          <input type="text" className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
        </div>
        <div className="flex gap-md">
          <div className="form-group flex-1">
            <label className="form-label">Contact Number</label>
            <input type="text" className="form-input" value={form.contact} onChange={e => setForm({...form, contact: e.target.value})} required />
          </div>
          <div className="form-group flex-1">
            <label className="form-label">Email (Optional)</label>
            <input type="email" className="form-input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Address (Optional)</label>
          <input type="text" className="form-input" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-input" style={{ resize: 'vertical', minHeight: 80 }} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}></textarea>
        </div>
      </Modal>

    </div>
  );
}
