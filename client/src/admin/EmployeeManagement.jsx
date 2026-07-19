import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, KeyRound, Shield, ChefHat, ConciergeBell, Phone, Briefcase, Camera, Tv } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import DatePicker from '../components/DatePicker';

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [stations, setStations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  
  const AVAILABLE_PAGES = [
    { id: '/admin', label: 'Dashboard' },
    { id: '/admin/orders', label: 'Orders' },
    { id: '/admin/counter', label: 'Counter Orders' },
    { id: '/admin/payments', label: 'Accept Payments' },
    { id: '/admin/tables', label: 'Tables' },
    { id: '/admin/packages', label: 'Packages' },
    { id: '/admin/menu', label: 'Menu' },
    { id: '/admin/promos', label: 'Promo Codes' },
    { id: '/admin/stock', label: 'Stock' },
    { id: '/admin/vendors', label: 'Vendors' },
    { id: '/admin/employees', label: 'Employees' },
    { id: '/admin/ledger', label: 'Books & Ledger' },
    { id: '/admin/expenses', label: 'Expenses Report' },
    { id: '/admin/financial-log', label: 'Financial Log' },
    { id: '/admin/tips', label: 'Tips Ledger' },
    { id: '/admin/damage', label: 'Damage Report' },
    { id: '/admin/maintenance', label: 'Maintenance Log' },
    { id: '/admin/analytics', label: 'Analytics' },
    { id: '/admin/stations', label: 'Stations' },
    { id: '/admin/communication', label: 'Communication' },
    { id: '/admin/settings', label: 'Settings' },
    { id: '/admin/adventures/manage', label: 'Manage Adventures' },
    { id: '/admin/adventures/sell', label: 'Sell Adventure' },
    { id: '/admin/adventures/scan', label: 'Scan Adventure' },
    { id: '/admin/adventures/videos', label: 'Adventure Videos' },
    { id: '/admin/tv-content', label: 'TV Content' },
    { id: '/admin/cancel-discount-orders', label: 'Cancel / Discount Orders' }
  ];

  const initialFormState = { 
    name: '', role: 'waiter', pin: '', station_id: '', is_active: true, 
    contact: '', join_date: '', monthly_salary: '', 
    dob: '', address: '', emergency_contact_name: '', emergency_contact_phone: '', 
    employment_type: 'full-time', hourly_rate: '', access_pages: [],
    photo: null, id_photo: null
  };
  const [form, setForm] = useState(initialFormState);
  const [pinForm, setPinForm] = useState({ new_pin: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [empRes, stationRes] = await Promise.all([
        api.get('/employees'),
        api.get('/stations')
      ]);
      setEmployees(empRes.data);
      setStations(stationRes.data);
    } catch (error) {
      showToast('Failed to load data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const formData = new FormData();
      Object.keys(form).forEach(key => {
        if (key === 'photo' || key === 'id_photo') {
          if (form[key]) formData.append(key, form[key]);
        } else if (key === 'access_pages') {
          formData.append(key, JSON.stringify(form[key]));
        } else {
          formData.append(key, form[key]);
        }
      });
      if (form.role === 'kitchen') {
        formData.set('station_id', form.station_id);
      } else {
        formData.set('station_id', '');
      }

      const headers = { 'Content-Type': 'multipart/form-data' };

      if (editingEmp) {
        formData.delete('pin');
        await api.put(`/employees/${editingEmp.id}`, formData, { headers });
        showToast('Employee updated', 'success');
      } else {
        if (!form.pin || form.pin.length < 4) {
          return showToast('PIN must be at least 4 digits', 'warning');
        }
        await api.post('/employees', formData, { headers });
        showToast('Employee created', 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to save employee', 'error');
    }
  };

  const handleResetPin = async () => {
    if (!pinForm.new_pin || pinForm.new_pin.length < 4) {
      return showToast('PIN must be at least 4 digits', 'warning');
    }
    try {
      await api.patch(`/employees/${editingEmp.id}/pin`, { pin: pinForm.new_pin });
      showToast('PIN reset successfully', 'success');
      setIsPinModalOpen(false);
    } catch (error) {
      showToast('Failed to reset PIN', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (id === currentUser.id) {
      return showToast('You cannot delete yourself', 'warning');
    }
    if (confirm('Are you sure you want to delete this employee?')) {
      try {
        await api.delete(`/employees/${id}`);
        showToast('Employee deleted', 'success');
        fetchData();
      } catch (error) {
        showToast('Failed to delete employee', 'error');
      }
    }
  };

  const openModal = (emp = null) => {
    if (emp) {
      setEditingEmp(emp);
      setForm({ 
        name: emp.name || '', role: emp.role || 'waiter', pin: '', station_id: emp.station_id || '', 
        is_active: emp.is_active, contact: emp.contact || '', 
        join_date: emp.join_date ? emp.join_date.split('T')[0] : '', 
        monthly_salary: emp.monthly_salary || '',
        dob: emp.dob ? emp.dob.split('T')[0] : '',
        address: emp.address || '',
        emergency_contact_name: emp.emergency_contact_name || '',
        emergency_contact_phone: emp.emergency_contact_phone || '',
        employment_type: emp.employment_type || 'full-time',
        hourly_rate: emp.hourly_rate || '',
        access_pages: emp.access_pages ? (typeof emp.access_pages === 'string' ? JSON.parse(emp.access_pages) : emp.access_pages) : [],
        photo: null,
        id_photo: null
      });
    } else {
      setEditingEmp(null);
      setForm(initialFormState);
    }
    setIsModalOpen(true);
  };

  const openPinModal = (emp) => {
    setEditingEmp(emp);
    setPinForm({ new_pin: '' });
    setIsPinModalOpen(true);
  };

  const getRoleIcon = (role) => {
    switch(role) {
      case 'admin': return <Shield size={16} />;
      case 'kitchen': return <ChefHat size={16} />;
      case 'waiter': return <ConciergeBell size={16} />;
      case 'cameraman': return <Camera size={16} />;
      case 'tv': return <Tv size={16} />;
      default: return null;
    }
  };

  return (
    <div className="admin-content">
      <div className="admin-header">
        <h2>Employee Management</h2>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={18} /> Add Employee
        </button>
      </div>

      <div className="card">
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role & Station</th>
                <th>Contact</th>
                <th>Base Salary</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr 
                  key={emp.id} 
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    if (!e.target.closest('button')) {
                      navigate(`/admin/employees/${emp.id}`, { state: { employee: emp } });
                    }
                  }}
                  className="hover-bg-secondary"
                >
                  <td>
                    <div className="flex align-center gap-sm">
                      {emp.photo_url ? (
                        <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                          <img src={emp.photo_url} alt="photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <div className="flex-center" style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-tertiary)' }}>
                          <Camera size={14} className="text-secondary" />
                        </div>
                      )}
                      <div>
                        <div className="font-bold">{emp.name}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ textTransform: 'capitalize' }}>
                      {emp.role} {emp.station_name && <span className="text-secondary" style={{ fontSize: 13 }}>(Station: {emp.station_name})</span>}
                    </div>
                  </td>
                  <td className="text-secondary">{emp.contact || '-'}</td>
                  <td className="font-bold">${emp.monthly_salary}</td>
                  <td>
                    <span className={`badge ${emp.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {emp.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex gap-sm justify-end">
                      <button className="btn btn-icon btn-secondary" onClick={() => openPinModal(emp)} title="Reset PIN"><KeyRound size={16} /></button>
                      <button className="btn btn-icon btn-secondary" onClick={() => openModal(emp)} title="Edit"><Edit2 size={16} /></button>
                      <button className="btn btn-icon btn-danger" onClick={() => handleDelete(emp.id)} title="Deactivate"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center text-muted p-lg">No employees found.</td>
                </tr>
              )}
            </tbody>
          </table>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingEmp ? "Edit Employee" : "Add Employee"}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save</button>
          </>
        }
      >
        <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="flex-col gap-md">
            <div className="form-group">
              <label className="form-label">Name</label>
              <input type="text" className="form-input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div className="flex gap-md">
              <div className="form-group flex-1">
                <label className="form-label">Contact (Optional)</label>
                <input type="text" className="form-input" value={form.contact || ''} onChange={e => setForm({...form, contact: e.target.value})} placeholder="Phone or Email" />
              </div>
              <div className="form-group flex-1">
                <label className="form-label">Join Date (Optional)</label>
                <DatePicker className="form-input" value={form.join_date || ''} onChange={e => setForm({...form, join_date: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-md">
              <div className="form-group flex-1">
                <label className="form-label">Date of Birth (Optional)</label>
                <DatePicker className="form-input" value={form.dob || ''} onChange={e => setForm({...form, dob: e.target.value})} />
              </div>
              <div className="form-group flex-1">
                <label className="form-label">Address (Optional)</label>
                <input type="text" className="form-input" value={form.address || ''} onChange={e => setForm({...form, address: e.target.value})} placeholder="Full Address" />
              </div>
            </div>
            <div className="flex gap-md">
              <div className="form-group flex-1">
                <label className="form-label">Emerg. Contact Name</label>
                <input type="text" className="form-input" value={form.emergency_contact_name || ''} onChange={e => setForm({...form, emergency_contact_name: e.target.value})} />
              </div>
              <div className="form-group flex-1">
                <label className="form-label">Emerg. Contact Phone</label>
                <input type="text" className="form-input" value={form.emergency_contact_phone || ''} onChange={e => setForm({...form, emergency_contact_phone: e.target.value})} />
              </div>
            </div>

            <div className="flex gap-md">
              <div className="form-group flex-1">
                <label className="form-label">Employee Photo</label>
                <input type="file" className="form-control" accept="image/*" onChange={e => setForm({ ...form, photo: e.target.files[0] })} />
                {editingEmp?.photo_url && !form.photo && <div className="mt-xs text-xs text-success">Current photo uploaded</div>}
              </div>
              <div className="form-group flex-1">
                <label className="form-label">ID Document Photo</label>
                <input type="file" className="form-control" accept="image/*" onChange={e => setForm({ ...form, id_photo: e.target.files[0] })} />
                {editingEmp?.id_photo_url && !form.id_photo && <div className="mt-xs text-xs text-success">Current ID uploaded</div>}
              </div>
            </div>
            
            <hr style={{ margin: '16px 0', borderColor: 'var(--border-color)' }} />
            
            <div className="form-group">
              <label className="form-label">Employment Type</label>
              <select className="form-select" value={form.employment_type || 'full-time'} onChange={e => setForm({...form, employment_type: e.target.value})}>
                <option value="full-time">Full-Time</option>
                <option value="part-time">Part-Time</option>
                <option value="contract">Contract</option>
              </select>
            </div>
            <div className="flex gap-md">
              <div className="form-group flex-1">
                <label className="form-label">Monthly Salary</label>
                <input type="number" step="0.01" className="form-input" value={form.monthly_salary || ''} onChange={e => setForm({...form, monthly_salary: e.target.value})} placeholder="0.00" />
              </div>
              <div className="form-group flex-1">
                <label className="form-label">Hourly Rate</label>
                <input type="number" step="0.01" className="form-input" value={form.hourly_rate || ''} onChange={e => setForm({...form, hourly_rate: e.target.value})} placeholder="0.00" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={e => setForm({...form, role: e.target.value, station_id: ''})}>
                <option value="waiter">Waiter</option>
                <option value="kitchen">Kitchen Staff</option>
                <option value="cameraman">Cameraman</option>
                <option value="tv">TV Display</option>
                <option value="admin">Admin</option>
              </select>
            </div>
        {form.role === 'kitchen' && (
          <div className="form-group">
            <label className="form-label">Station Assignment</label>
            <select className="form-select" value={form.station_id} onChange={e => setForm({...form, station_id: e.target.value})}>
              <option value="">No specific station (Sees all items)</option>
              {stations.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
        {form.role === 'admin' && (
          <div className="form-group mt-md">
            <label className="form-label">Accessible Pages</label>
            <p className="text-secondary mb-sm" style={{ fontSize: 13 }}>Select which pages this admin can view. Leave all unchecked for unrestricted access.</p>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
              {AVAILABLE_PAGES.map(page => (
                <label key={page.id} className="flex align-center gap-sm" style={{ fontSize: 14, cursor: 'pointer' }}>
                  <input 
                    type="checkbox"
                    checked={form.access_pages.includes(page.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setForm({...form, access_pages: [...form.access_pages, page.id]});
                      } else {
                        setForm({...form, access_pages: form.access_pages.filter(p => p !== page.id)});
                      }
                    }}
                  />
                  {page.label}
                </label>
              ))}
            </div>
          </div>
        )}
        {!editingEmp && (
          <div className="form-group">
            <label className="form-label">Login PIN</label>
            <input type="text" pattern="\d*" maxLength="6" className="form-input" placeholder="e.g. 1234" value={form.pin} onChange={e => setForm({...form, pin: e.target.value.replace(/\D/g, '')})} required />
            <small className="text-muted mt-sm">4 to 6 digit numeric PIN</small>
          </div>
        )}
        {editingEmp && (
          <div className="form-group mt-md">
            <label className="flex align-center gap-sm" style={{ cursor: 'pointer', fontWeight: 500 }}>
              <input 
                type="checkbox" 
                checked={form.is_active} 
                onChange={e => setForm({...form, is_active: e.target.checked})} 
                disabled={editingEmp.id === currentUser.id} 
              />
              Active Status
            </label>
            <small className="text-muted block mt-xs">Inactive employees cannot log in to the system.</small>
          </div>
        )}
        </form>
      </Modal>

      <Modal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        title={`Reset PIN for ${editingEmp?.name}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsPinModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleResetPin}>Reset PIN</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">New PIN</label>
          <input type="text" pattern="\d*" maxLength="6" className="form-input" placeholder="Enter new 4-6 digit PIN" value={pinForm.new_pin} onChange={e => setPinForm({new_pin: e.target.value.replace(/\D/g, '')})} required />
        </div>
      </Modal>
    </div>
  );
}
