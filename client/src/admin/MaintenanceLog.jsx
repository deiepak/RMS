import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Wrench, CheckCircle, Plus, AlertTriangle, X } from 'lucide-react';
import Modal from '../components/Modal';

export default function MaintenanceLog() {
  const [logs, setLogs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({ item_name: '', description: '' });

  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
  const [repairForm, setRepairForm] = useState({ log_id: '', vendor_id: '', cost: '', bill_number: '' });
  const [activeLog, setActiveLog] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [logsRes, vendorsRes] = await Promise.all([
        api.get('/maintenance'),
        api.get('/vendors')
      ]);
      setLogs(logsRes.data);
      setVendors(vendorsRes.data);
    } catch (error) {
      showToast('Failed to load maintenance data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/maintenance', addForm);
      showToast('Maintenance issue logged successfully', 'success');
      setIsAddModalOpen(false);
      setAddForm({ item_name: '', description: '' });
      fetchData();
    } catch (error) {
      showToast('Failed to log issue', 'error');
    }
  };

  const openRepairModal = (log) => {
    setActiveLog(log);
    setRepairForm({ log_id: log.id, vendor_id: '', cost: '', bill_number: '' });
    setIsRepairModalOpen(true);
  };

  const handleRepairSubmit = async (e) => {
    e.preventDefault();
    if (repairForm.vendor_id && (!repairForm.cost || !repairForm.bill_number)) {
      return showToast('Cost and Bill Number are required when a vendor is selected', 'error');
    }

    try {
      await api.patch(`/maintenance/${repairForm.log_id}/repaired`, repairForm);
      showToast('Maintenance marked as repaired', 'success');
      setIsRepairModalOpen(false);
      fetchData();
    } catch (error) {
      showToast('Failed to update maintenance status', 'error');
    }
  };

  return (
    <div className="admin-content">
      <div className="admin-header">
        <h2>Recommended Maintenance</h2>
        <button className="btn btn-primary flex align-center gap-sm" onClick={() => setIsAddModalOpen(true)}>
          <Plus size={16} /> Log Issue
        </button>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="text-center text-muted" style={{ padding: '40px' }}>Loading logs...</div>
        ) : logs.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date Logged</th>
                <th>Item / Equipment</th>
                <th>Issue Description</th>
                <th>Status</th>
                <th>Resolution</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} style={{ opacity: log.status === 'repaired' ? 0.7 : 1 }}>
                  <td>{new Date(log.created_at).toLocaleDateString()}</td>
                  <td className="font-bold">{log.item_name}</td>
                  <td className="text-secondary">{log.description || '-'}</td>
                  <td>
                    {log.status === 'pending' ? (
                      <span className="badge badge-warning flex align-center gap-sm" style={{ width: 'fit-content' }}>
                        <AlertTriangle size={12} /> Pending
                      </span>
                    ) : (
                      <span className="badge badge-success flex align-center gap-sm" style={{ width: 'fit-content' }}>
                        <CheckCircle size={12} /> Repaired
                      </span>
                    )}
                  </td>
                  <td className="text-secondary" style={{ fontSize: 13 }}>
                    {log.status === 'repaired' ? (
                      <div>
                        {log.vendor_name ? `By ${log.vendor_name} ` : 'Fixed internally '}
                        {log.repair_cost ? `(रू ${log.repair_cost})` : ''}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="text-right">
                    {log.status === 'pending' && (
                      <button className="btn btn-sm btn-primary" onClick={() => openRepairModal(log)}>
                        Mark Repaired
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state text-center" style={{ padding: '40px' }}>
            <Wrench size={48} style={{ opacity: 0.2, margin: '0 auto 16px' }} />
            <h3>No Maintenance Issues</h3>
            <p>Everything is running smoothly.</p>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        title="Log Maintenance Issue"
      >
        <form onSubmit={handleAddSubmit}>
          <div className="form-group">
            <label className="form-label">Item / Equipment Name</label>
            <input type="text" className="form-input" value={addForm.item_name} onChange={e => setAddForm({...addForm, item_name: e.target.value})} required placeholder="e.g., Main AC, Fryer #2" />
          </div>
          <div className="form-group">
            <label className="form-label">Issue Description (Optional)</label>
            <textarea className="form-input" value={addForm.description} onChange={e => setAddForm({...addForm, description: e.target.value})} rows="3" placeholder="Describe the problem..." />
          </div>
          <div className="flex justify-end gap-sm mt-lg">
            <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Issue</button>
          </div>
        </form>
      </Modal>

      {/* Repair Modal */}
      <Modal 
        isOpen={isRepairModalOpen} 
        onClose={() => setIsRepairModalOpen(false)}
        title={`Resolve Issue: ${activeLog?.item_name}`}
      >
        <form onSubmit={handleRepairSubmit}>
          <div className="form-group">
            <label className="form-label">Repaired By (Vendor) - Optional</label>
            <select className="form-select" value={repairForm.vendor_id} onChange={e => setRepairForm({...repairForm, vendor_id: e.target.value})}>
              <option value="">Internal / Unknown</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>

          {repairForm.vendor_id && (
            <>
              <div className="flex gap-md mb-md">
                <div className="form-group flex-1">
                  <label className="form-label">Repair Cost (रू)</label>
                  <input type="number" step="0.01" className="form-input" value={repairForm.cost} onChange={e => setRepairForm({...repairForm, cost: e.target.value})} required />
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">Bill / Invoice Number</label>
                  <input type="text" className="form-input" value={repairForm.bill_number} onChange={e => setRepairForm({...repairForm, bill_number: e.target.value})} required />
                </div>
              </div>
              <small className="text-secondary mb-md block">
                This cost will be automatically logged to the vendor's ledger.
              </small>
            </>
          )}

          <div className="flex justify-end gap-sm mt-lg">
            <button type="button" className="btn btn-secondary" onClick={() => setIsRepairModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Mark as Repaired</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
