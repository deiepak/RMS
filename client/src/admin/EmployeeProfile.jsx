import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { ArrowLeft, Phone, Calendar, Briefcase, DollarSign, Plus, Check, X, MapPin, AlertCircle, Clock, FileText, LogIn, LogOut as LogOutIcon } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/helpers';
import Modal from '../components/Modal';
import DatePicker from '../components/DatePicker';

export default function EmployeeProfile() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [employee, setEmployee] = useState(location.state?.employee || null);
  const [hrData, setHrData] = useState({ leaves: [], payments: [], attendance: [], performance: [], documents: [] });
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('overview'); // overview, payments, leaves, timesheets, performance, documents

  // Modals state
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', type: 'vacation', reason: '' });
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'bank', notes: '', bonus: 0, deduction: 0 });

  const [isPerfModalOpen, setIsPerfModalOpen] = useState(false);
  const [perfForm, setPerfForm] = useState({ type: 'warning', notes: '', date: new Date().toLocaleDateString('en-CA') });

  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docForm, setDocForm] = useState({ document_name: '', status: 'collected' });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      if (!employee) {
        const empRes = await api.get('/employees');
        const e = empRes.data.find(e => e.id === parseInt(id));
        setEmployee(e);
      }
      const hrRes = await api.get(`/employees/${id}/hr-data`);
      setHrData(hrRes.data);
    } catch (error) {
      showToast('Failed to load HR data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLeave = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/employees/${id}/leaves`, leaveForm);
      showToast('Leave request added', 'success');
      setIsLeaveModalOpen(false);
      setLeaveForm({ start_date: '', end_date: '', type: 'vacation', reason: '' });
      fetchData();
    } catch (error) {
      showToast('Failed to add leave', 'error');
    }
  };

  const handleUpdateLeaveStatus = async (leaveId, status) => {
    try {
      await api.put(`/employees/${id}/leaves/${leaveId}`, { status });
      showToast(`Leave ${status}`, 'success');
      fetchData();
    } catch (error) {
      showToast('Failed to update leave', 'error');
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/employees/${id}/pay`, paymentForm);
      showToast('Salary payment recorded', 'success');
      setIsPaymentModalOpen(false);
      setPaymentForm({ amount: '', payment_method: 'bank', notes: '', bonus: 0, deduction: 0 });
      fetchData();
    } catch (error) {
      showToast('Failed to record payment', 'error');
    }
  };

  const handleAddPerf = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/employees/${id}/performance`, perfForm);
      showToast('Performance record added', 'success');
      setIsPerfModalOpen(false);
      setPerfForm({ type: 'warning', notes: '', date: new Date().toLocaleDateString('en-CA') });
      fetchData();
    } catch (error) {
      showToast('Failed to add performance record', 'error');
    }
  };

  const handleAddDoc = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/employees/${id}/documents`, docForm);
      showToast('Document record added', 'success');
      setIsDocModalOpen(false);
      setDocForm({ document_name: '', status: 'collected' });
      fetchData();
    } catch (error) {
      showToast('Failed to add document', 'error');
    }
  };

  const handleUpdateDoc = async (docId, status) => {
    try {
      await api.put(`/employees/${id}/documents/${docId}`, { status });
      showToast('Document status updated', 'success');
      fetchData();
    } catch (error) {
      showToast('Failed to update document', 'error');
    }
  };

  const isClockedIn = hrData.attendance && hrData.attendance.length > 0 && !hrData.attendance[0].clock_out;

  const handleClockIn = async () => {
    try {
      await api.post(`/employees/${id}/clock-in`);
      showToast('Clocked in successfully', 'success');
      fetchData();
    } catch (e) {
      showToast('Failed to clock in', 'error');
    }
  };

  const handleClockOut = async () => {
    try {
      await api.post(`/employees/${id}/clock-out`);
      showToast('Clocked out successfully', 'success');
      fetchData();
    } catch (e) {
      showToast(e.response?.data?.error || 'Failed to clock out', 'error');
    }
  };

  if (isLoading && !employee) {
    return <div className="admin-content"><p>Loading...</p></div>;
  }

  if (!employee) {
    return (
      <div className="admin-content">
        <button className="btn btn-secondary flex align-center gap-sm mb-md" onClick={() => navigate('/admin/employees')}>
          <ArrowLeft size={16} /> Back to Employees
        </button>
        <p>Employee not found.</p>
      </div>
    );
  }

  return (
    <div className="admin-content" style={{ overflowY: 'auto' }}>
      <button className="btn btn-secondary flex align-center gap-sm mb-md" onClick={() => navigate('/admin/employees')}>
        <ArrowLeft size={16} /> Back to Employees
      </button>

      {/* Header Card */}
      <div className="card mb-lg" style={{ padding: '24px' }}>
        <div className="flex gap-lg align-start mb-md">
          {employee.photo_url ? (
            <div style={{ width: 100, height: 100, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--border-color)', flexShrink: 0 }}>
              <img src={employee.photo_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ) : (
            <div className="flex-center" style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--bg-tertiary)', flexShrink: 0 }}>
              <Briefcase size={32} className="text-secondary" />
            </div>
          )}
          <div className="flex-1">
            <div className="flex justify-between align-center mb-md">
              <div className="flex align-center gap-md">
                <h2 style={{ fontSize: 24, margin: 0 }}>{employee.name}</h2>
                <span className={`badge ${employee.is_active ? 'badge-success' : 'badge-danger'}`}>
                  {employee.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div>
            {!isClockedIn ? (
              <button className="btn btn-success flex align-center gap-sm" onClick={handleClockIn}>
                <LogIn size={16} /> Clock In
              </button>
            ) : (
              <button className="btn btn-warning flex align-center gap-sm" onClick={handleClockOut}>
                <LogOutIcon size={16} /> Clock Out
              </button>
            )}
          </div>
            </div>
            
            <div className="flex gap-lg flex-wrap text-secondary">
              <div className="flex align-center gap-sm text-capitalize"><Briefcase size={16} /> {employee.role} {employee.station_name && `(${employee.station_name})`}</div>
              {employee.contact && <div className="flex align-center gap-sm"><Phone size={16} /> {employee.contact}</div>}
              {employee.join_date && <div className="flex align-center gap-sm"><Calendar size={16} /> Joined: {formatDate(employee.join_date)}</div>}
              <div className="flex align-center gap-sm font-bold text-success"><DollarSign size={16} /> Base Salary: {formatCurrency(employee.monthly_salary)} / mo</div>
              <div className="flex align-center gap-sm font-bold text-primary"><DollarSign size={16} /> Hourly: {formatCurrency(employee.hourly_rate)} / hr</div>
            </div>

            {employee.id_photo_url && (
              <div className="mt-md">
                <div className="text-sm text-secondary mb-xs">ID Document:</div>
                <a href={employee.id_photo_url} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm flex align-center gap-xs" style={{ display: 'inline-flex', width: 'auto' }}>
                  <FileText size={16} /> View ID Document
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-md mb-lg" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <button className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={`btn ${activeTab === 'timesheets' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveTab('timesheets')}>Timesheets</button>
        <button className={`btn ${activeTab === 'payments' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveTab('payments')}>Payroll</button>
        <button className={`btn ${activeTab === 'leaves' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveTab('leaves')}>Leaves</button>
        <button className={`btn ${activeTab === 'performance' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveTab('performance')}>Performance</button>
        <button className={`btn ${activeTab === 'documents' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setActiveTab('documents')}>Documents</button>
      </div>

      {/* Tab Content */}
      <div className="mb-xl">
        {activeTab === 'overview' && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            <div className="card p-lg">
              <h3 className="mb-md">Personal Details</h3>
              <div className="flex-col gap-sm">
                <div className="flex gap-sm align-center text-secondary"><Calendar size={16} /> <strong className="text-body">DOB:</strong> {employee.dob ? formatDate(employee.dob) : 'Not Set'}</div>
                <div className="flex gap-sm align-center text-secondary"><MapPin size={16} /> <strong className="text-body">Address:</strong> {employee.address || 'Not Set'}</div>
                <div className="flex gap-sm align-center text-secondary"><AlertCircle size={16} /> <strong className="text-body">Emergency Contact:</strong> {employee.emergency_contact_name || 'Not Set'} {employee.emergency_contact_phone && `(${employee.emergency_contact_phone})`}</div>
                <div className="flex gap-sm align-center text-secondary"><Briefcase size={16} /> <strong className="text-body">Emp Type:</strong> <span className="text-capitalize">{employee.employment_type}</span></div>
              </div>
            </div>
            
            <div className="card p-lg">
              <h3 className="mb-md">HR Summary</h3>
              <div className="text-secondary mb-sm">Total Leaves Taken: {hrData.leaves.filter(l => l.status === 'approved').length}</div>
              <div className="text-secondary mb-sm">Last Payment: {hrData.payments.length > 0 ? formatDate(hrData.payments[0].created_at) : 'None'}</div>
              <div className="text-secondary mb-sm">Pending Documents: {hrData.documents.filter(d => d.status === 'missing').length}</div>
              <div className="text-secondary mb-sm">Active Warnings: {hrData.performance.filter(p => p.type === 'warning').length}</div>
            </div>
          </div>
        )}

        {activeTab === 'timesheets' && (
          <div className="card">
            <div className="card-header flex justify-between align-center">
              <h3>Clock-In Timesheets</h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th className="text-right">Total Hours</th>
                </tr>
              </thead>
              <tbody>
                {hrData.attendance.map(att => (
                  <tr key={att.id}>
                    <td>{formatDate(att.clock_in)}</td>
                    <td>{new Date(att.clock_in).toLocaleTimeString()}</td>
                    <td>{att.clock_out ? new Date(att.clock_out).toLocaleTimeString() : <span className="badge badge-warning">Active</span>}</td>
                    <td className="text-right font-bold">{att.total_hours ? `${att.total_hours}h` : '-'}</td>
                  </tr>
                ))}
                {hrData.attendance.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center text-muted p-lg">No timesheets recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="card">
            <div className="card-header flex justify-between align-center">
              <h3>Payroll History</h3>
              <button className="btn btn-primary flex align-center gap-sm btn-sm" onClick={() => setIsPaymentModalOpen(true)}>
                <Plus size={14} /> Record Payment
              </button>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Notes</th>
                  <th className="text-right">Bonus</th>
                  <th className="text-right">Deduction</th>
                  <th className="text-right">Net Amount</th>
                </tr>
              </thead>
              <tbody>
                {hrData.payments.map(pay => (
                  <tr key={pay.id}>
                    <td>{formatDate(pay.created_at)}</td>
                    <td className="text-capitalize">{pay.payment_method}</td>
                    <td className="text-secondary">{pay.notes || '-'}</td>
                    <td className="text-right text-success">{pay.bonus > 0 ? `+${formatCurrency(pay.bonus)}` : '-'}</td>
                    <td className="text-right text-danger">{pay.deduction > 0 ? `-${formatCurrency(pay.deduction)}` : '-'}</td>
                    <td className="text-right font-bold text-success">{formatCurrency(pay.amount)}</td>
                  </tr>
                ))}
                {hrData.payments.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center text-muted p-lg">No payments recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'leaves' && (
          <div className="card">
            <div className="card-header flex justify-between align-center">
              <h3>Leave Requests</h3>
              <button className="btn btn-primary flex align-center gap-sm btn-sm" onClick={() => setIsLeaveModalOpen(true)}>
                <Plus size={14} /> Add Leave
              </button>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date Range</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {hrData.leaves.map(leave => (
                  <tr key={leave.id}>
                    <td>{formatDate(leave.start_date)} - {formatDate(leave.end_date)}</td>
                    <td className="text-capitalize">{leave.type}</td>
                    <td className="text-secondary">{leave.reason || '-'}</td>
                    <td>
                      <span className={`badge ${leave.status === 'approved' ? 'badge-success' : leave.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                        {leave.status}
                      </span>
                    </td>
                    <td className="text-right">
                      {leave.status === 'pending' && (
                        <div className="flex gap-sm justify-end">
                          <button className="btn btn-icon btn-success" onClick={() => handleUpdateLeaveStatus(leave.id, 'approved')} title="Approve"><Check size={16} /></button>
                          <button className="btn btn-icon btn-danger" onClick={() => handleUpdateLeaveStatus(leave.id, 'rejected')} title="Reject"><X size={16} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {hrData.leaves.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center text-muted p-lg">No leaves recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="card">
            <div className="card-header flex justify-between align-center">
              <h3>Performance & Disciplinary</h3>
              <button className="btn btn-primary flex align-center gap-sm btn-sm" onClick={() => setIsPerfModalOpen(true)}>
                <Plus size={14} /> Add Record
              </button>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {hrData.performance.map(perf => (
                  <tr key={perf.id}>
                    <td>{formatDate(perf.date)}</td>
                    <td>
                      <span className={`badge ${perf.type === 'commendation' ? 'badge-success' : perf.type === 'warning' ? 'badge-danger' : 'badge-warning'}`}>
                        {perf.type}
                      </span>
                    </td>
                    <td>{perf.notes}</td>
                  </tr>
                ))}
                {hrData.performance.length === 0 && (
                  <tr>
                    <td colSpan="3" className="text-center text-muted p-lg">No performance records.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="card">
            <div className="card-header flex justify-between align-center">
              <h3>Compliance Documents</h3>
              <button className="btn btn-primary flex align-center gap-sm btn-sm" onClick={() => setIsDocModalOpen(true)}>
                <Plus size={14} /> Request Document
              </button>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Document Name</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {hrData.documents.map(doc => (
                  <tr key={doc.id}>
                    <td className="font-bold">{doc.document_name}</td>
                    <td>
                      <span className={`badge ${doc.status === 'verified' ? 'badge-success' : doc.status === 'collected' ? 'badge-warning' : 'badge-danger'}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="text-right flex justify-end gap-sm">
                      {doc.status !== 'verified' && (
                        <button className="btn btn-sm btn-success" onClick={() => handleUpdateDoc(doc.id, 'verified')}>Verify</button>
                      )}
                      {doc.status === 'missing' && (
                        <button className="btn btn-sm btn-secondary" onClick={() => handleUpdateDoc(doc.id, 'collected')}>Mark Collected</button>
                      )}
                    </td>
                  </tr>
                ))}
                {hrData.documents.length === 0 && (
                  <tr>
                    <td colSpan="3" className="text-center text-muted p-lg">No documents tracked.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Record Salary Payment">
        <form onSubmit={handleAddPayment} className="flex-col gap-md">
          <div className="form-group">
            <label className="form-label">Net Amount Paid</label>
            <input type="number" step="0.01" className="form-input" required value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} placeholder={employee.monthly_salary} />
          </div>
          <div className="flex gap-md">
            <div className="form-group flex-1">
              <label className="form-label">Bonus Included</label>
              <input type="number" step="0.01" className="form-input" value={paymentForm.bonus} onChange={e => setPaymentForm({...paymentForm, bonus: e.target.value})} placeholder="0.00" />
            </div>
            <div className="form-group flex-1">
              <label className="form-label">Deduction Applied</label>
              <input type="number" step="0.01" className="form-input" value={paymentForm.deduction} onChange={e => setPaymentForm({...paymentForm, deduction: e.target.value})} placeholder="0.00" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Method</label>
            <select className="form-select" value={paymentForm.payment_method} onChange={e => setPaymentForm({...paymentForm, payment_method: e.target.value})}>
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Notes (Optional)</label>
            <input type="text" className="form-input" value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} placeholder="e.g. May 2026 Salary" />
          </div>
          <div className="flex gap-md justify-end mt-md">
            <button type="button" className="btn btn-secondary" onClick={() => setIsPaymentModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Record Payment</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isLeaveModalOpen} onClose={() => setIsLeaveModalOpen(false)} title="Add Leave Request">
        <form onSubmit={handleAddLeave} className="flex-col gap-md">
          <div className="flex gap-md">
            <div className="form-group flex-1">
              <label className="form-label">Start Date *</label>
              <DatePicker className="form-input" required value={leaveForm.start_date} onChange={e => setLeaveForm({...leaveForm, start_date: e.target.value})} />
            </div>
            <div className="form-group flex-1">
              <label className="form-label">End Date *</label>
              <DatePicker className="form-input" required value={leaveForm.end_date} onChange={e => setLeaveForm({...leaveForm, end_date: e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Leave Type</label>
            <select className="form-select" value={leaveForm.type} onChange={e => setLeaveForm({...leaveForm, type: e.target.value})}>
              <option value="sick">Sick Leave</option>
              <option value="vacation">Vacation</option>
              <option value="unpaid">Unpaid Leave</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Reason (Optional)</label>
            <textarea className="form-input" value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} placeholder="Why is this leave requested?"></textarea>
          </div>
          <div className="flex gap-md justify-end mt-md">
            <button type="button" className="btn btn-secondary" onClick={() => setIsLeaveModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Submit Leave Request</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isPerfModalOpen} onClose={() => setIsPerfModalOpen(false)} title="Add Performance Record">
        <form onSubmit={handleAddPerf} className="flex-col gap-md">
          <div className="form-group">
            <label className="form-label">Record Type</label>
            <select className="form-select" value={perfForm.type} onChange={e => setPerfForm({...perfForm, type: e.target.value})}>
              <option value="warning">Warning</option>
              <option value="commendation">Commendation (Positive)</option>
              <option value="incident">Incident Report</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Date *</label>
            <DatePicker className="form-input" required value={perfForm.date} onChange={e => setPerfForm({...perfForm, date: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Details / Notes</label>
            <textarea className="form-input" required value={perfForm.notes} onChange={e => setPerfForm({...perfForm, notes: e.target.value})} placeholder="Describe the incident or reason for warning..."></textarea>
          </div>
          <div className="flex gap-md justify-end mt-md">
            <button type="button" className="btn btn-secondary" onClick={() => setIsPerfModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Record</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isDocModalOpen} onClose={() => setIsDocModalOpen(false)} title="Request Document">
        <form onSubmit={handleAddDoc} className="flex-col gap-md">
          <div className="form-group">
            <label className="form-label">Document Name</label>
            <input type="text" className="form-input" required value={docForm.document_name} onChange={e => setDocForm({...docForm, document_name: e.target.value})} placeholder="e.g. ID Card, Signed Contract" />
          </div>
          <div className="form-group">
            <label className="form-label">Current Status</label>
            <select className="form-select" value={docForm.status} onChange={e => setDocForm({...docForm, status: e.target.value})}>
              <option value="missing">Missing</option>
              <option value="collected">Collected (Needs Verification)</option>
              <option value="verified">Verified</option>
            </select>
          </div>
          <div className="flex gap-md justify-end mt-md">
            <button type="button" className="btn btn-secondary" onClick={() => setIsDocModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Document</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
