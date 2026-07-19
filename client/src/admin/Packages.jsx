import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Plus, X, Download, Package as PackageIcon, BookOpen, Calendar, User, Phone, Banknote } from 'lucide-react';
import { formatCurrency, formatDateTime, formatDate } from '../utils/helpers';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import NepaliDate from 'nepali-date-converter';

export default function Packages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const [deletedPackages, setDeletedPackages] = useState([]);
  
  // New Package Form
  const [title, setTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [contact, setContact] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ id: Date.now(), description: '', quantity: 1, price_per_unit: 0 }]);
  
  // View Package
  const [viewPackage, setViewPackage] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');

  const { showToast } = useToast();

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const res = await api.get('/packages');
      setPackages(res.data);
    } catch (error) {
      showToast('Failed to load packages', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => setItems([...items, { id: Date.now(), description: '', quantity: 1, price_per_unit: 0 }]);
  const removeItem = (id) => setItems(items.filter(i => i.id !== id));
  const updateItem = (id, field, value) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleCreatePackage = async () => {
    if (!title || !customerName || items.length === 0) {
      return showToast('Title, customer name, and at least 1 item are required', 'error');
    }
    
    // validate items
    for (let item of items) {
      if (!item.description) return showToast('All items must have a description', 'error');
      if (item.quantity <= 0) return showToast('Quantity must be positive', 'error');
    }

    let finalEventDate = eventDate;
    if (eventDate && localStorage.getItem('rms_date_format') === 'BS') {
      try {
        const bsDate = new NepaliDate(eventDate);
        finalEventDate = bsDate.toJsDate().toLocaleDateString('en-CA'); // YYYY-MM-DD in AD
      } catch (err) {
        return showToast('Invalid BS Date format (Use YYYY-MM-DD)', 'error');
      }
    }

    try {
      await api.post('/packages', {
        title, customer_name: customerName, contact,
        event_date: finalEventDate, notes, items
      });
      showToast('Package created successfully', 'success');
      setShowAddModal(false);
      resetForm();
      fetchPackages();
    } catch (error) {
      showToast('Failed to create package', 'error');
    }
  };

  const resetForm = () => {
    setTitle(''); setCustomerName(''); setContact('');
    setEventDate(''); setNotes('');
    setItems([{ id: Date.now(), description: '', quantity: 1, price_per_unit: 0 }]);
  };

  const handleViewPackage = async (id) => {
    try {
      const res = await api.get(`/packages/${id}`);
      setViewPackage(res.data);
    } catch (error) {
      showToast('Failed to fetch package details', 'error');
    }
  };

  const handleAddPayment = async () => {
    if (!paymentAmount || isNaN(paymentAmount) || Number(paymentAmount) <= 0) {
      return showToast('Valid amount is required', 'error');
    }
    try {
      await api.post(`/packages/${viewPackage.id}/payments`, {
        amount: Number(paymentAmount),
        payment_method: paymentMethod,
        notes: paymentNotes
      });
      showToast('Payment logged successfully', 'success');
      setPaymentAmount(''); setPaymentNotes('');
      handleViewPackage(viewPackage.id); // refresh details
      fetchPackages(); // refresh list
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to add payment', 'error');
    }
  };

  const handleDeletePackage = async (id) => {
    if (!window.confirm('Are you sure you want to delete this package? This cannot be undone.')) return;
    try {
      await api.delete(`/packages/${id}`);
      showToast('Package deleted', 'success');
      setViewPackage(null);
      fetchPackages();
    } catch (error) {
      showToast('Failed to delete package', 'error');
    }
  };

  const fetchDeletedPackages = async () => {
    try {
      const res = await api.get('/packages/deleted');
      setDeletedPackages(res.data);
    } catch (error) {
      showToast('Failed to fetch deleted packages', 'error');
    }
  };

  const handleRestorePackage = async (id) => {
    try {
      await api.post(`/packages/${id}/restore`);
      showToast('Package restored', 'success');
      setViewPackage(null);
      fetchPackages();
      if (showDeletedModal) fetchDeletedPackages();
    } catch (error) {
      showToast('Failed to restore package', 'error');
    }
  };

  const generatePDF = () => {
    if (!viewPackage) return;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Event Package Invoice', 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Package Name: ${viewPackage.title}`, 14, 32);
    doc.text(`Customer: ${viewPackage.customer_name}`, 14, 38);
    doc.text(`Contact: ${viewPackage.contact || 'N/A'}`, 14, 44);
    doc.text(`Event Date: ${viewPackage.event_date ? formatDate(viewPackage.event_date) : 'N/A'}`, 14, 50);

    const itemsData = viewPackage.items.map(item => [
      item.description,
      item.quantity,
      `Rs. ${Number(item.price_per_unit).toFixed(2)}`,
      `Rs. ${Number(item.total).toFixed(2)}`
    ]);

    doc.autoTable({
      startY: 60,
      head: [['Description', 'Qty', 'Unit Price', 'Total']],
      body: itemsData,
      foot: [['', '', 'Grand Total:', `Rs. ${Number(viewPackage.total_amount).toFixed(2)}`]]
    });

    const finalY = doc.lastAutoTable.finalY || 60;
    
    doc.text('Payment Ledger', 14, finalY + 15);
    
    const paymentsData = viewPackage.payments.map(p => [
      new Date(p.created_at).toLocaleString(),
      p.payment_method.toUpperCase(),
      p.notes || '',
      `Rs. ${Number(p.amount).toFixed(2)}`
    ]);

    const totalPaid = viewPackage.payments.reduce((s, p) => s + Number(p.amount), 0);
    const balance = Number(viewPackage.total_amount) - totalPaid;

    doc.autoTable({
      startY: finalY + 20,
      head: [['Date', 'Method', 'Notes', 'Amount']],
      body: paymentsData.length ? paymentsData : [['No payments recorded', '', '', '']],
      foot: [
        ['', '', 'Total Paid:', `Rs. ${totalPaid.toFixed(2)}`],
        ['', '', 'Remaining Balance:', `Rs. ${balance.toFixed(2)}`]
      ]
    });

    doc.save(`${viewPackage.title.replace(/\s+/g, '_')}_Invoice.pdf`);
  };

  return (
    <div className="admin-page" style={{ padding: '0 24px 24px 24px' }}>
      <div className="packages-hero">
        <div>
          <h1>Packages & Events</h1>
          <p>Manage large bookings, banquets, and customized events elegantly.</p>
        </div>
        <div className="flex gap-sm">
          <button 
            className="btn" 
            style={{ background: 'rgba(0,0,0,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '12px', padding: '12px 24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', backdropFilter: 'blur(10px)' }}
            onClick={() => { setShowDeletedModal(true); fetchDeletedPackages(); }}
          >
            <PackageIcon size={20} /> Deleted Packages
          </button>
          <button 
            className="btn" 
            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '12px', padding: '12px 24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', backdropFilter: 'blur(10px)' }}
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={20} /> New Package
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-secondary p-xl">Loading packages...</div>
      ) : packages.length === 0 ? (
        <div className="card text-center p-xl" style={{ borderRadius: '24px', border: '1px dashed var(--border)' }}>
          <PackageIcon size={48} className="text-secondary mb-md mx-auto" />
          <h3>No Packages Found</h3>
          <p className="text-secondary">Click 'New Package' to create one.</p>
        </div>
      ) : (
        <div className="package-grid">
          {packages.map(pkg => {
            const balance = pkg.total_amount - (pkg.paid_amount || 0);
            return (
              <div key={pkg.id} className="pkg-card" onClick={() => handleViewPackage(pkg.id)}>
                <div className="pkg-header">
                  <h3 className="pkg-title">{pkg.title}</h3>
                  <span className={`pkg-badge ${pkg.status}`}>
                    {pkg.status}
                  </span>
                </div>
                
                <div className="pkg-info-row">
                  <div className="pkg-icon-box"><User size={16} /></div>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{pkg.customer_name}</span>
                </div>
                
                {pkg.event_date && (
                  <div className="pkg-info-row">
                    <div className="pkg-icon-box"><Calendar size={16} /></div>
                    <span>{formatDate(pkg.event_date)}</span>
                  </div>
                )}
                
                <div className="pkg-finances">
                  <div className="finance-item total">
                    <span>Total Package</span>
                    <span>{formatCurrency(pkg.total_amount)}</span>
                  </div>
                  <div className="finance-item paid">
                    <span>Amount Paid</span>
                    <span>{formatCurrency(pkg.paid_amount || 0)}</span>
                  </div>
                  <div className="finance-item balance">
                    <span>Balance Due</span>
                    <span>{formatCurrency(balance)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Package Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="premium-modal-content" style={{ maxWidth: 850, width: '90%', background: 'var(--bg-card)' }}>
            <div className="premium-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ background: 'linear-gradient(135deg, #4f46e5, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Create Event Package
                </span>
              </h2>
              <button className="btn btn-icon" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }} onClick={() => setShowAddModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '32px' }}>
              <div className="grid mb-lg" style={{ gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label className="block mb-xs" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Package Title *</label>
                  <input type="text" className="premium-input" placeholder="e.g. 50th Birthday Party" value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div>
                  <label className="block mb-xs" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Event Date</label>
                  {localStorage.getItem('rms_date_format') === 'BS' ? (
                    <input type="text" className="premium-input" placeholder="BS Date (YYYY-MM-DD)" value={eventDate} onChange={e => setEventDate(e.target.value)} />
                  ) : (
                    <input type="date" className="premium-input" value={eventDate} onChange={e => setEventDate(e.target.value)} />
                  )}
                </div>
                <div>
                  <label className="block mb-xs" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Customer Name *</label>
                  <input type="text" className="premium-input" placeholder="John Doe" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                </div>
                <div>
                  <label className="block mb-xs" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Contact Number</label>
                  <input type="text" className="premium-input" placeholder="+1234567890" value={contact} onChange={e => setContact(e.target.value)} />
                </div>
              </div>
              <div className="mb-lg">
                <label className="block mb-xs" style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Notes/Description</label>
                <textarea className="premium-input" rows="3" placeholder="Any special requests or details..." value={notes} onChange={e => setNotes(e.target.value)}></textarea>
              </div>

              <div className="mb-md flex justify-between align-center">
                <h3 style={{ margin: 0 }}>Line Items *</h3>
                <button className="btn btn-secondary btn-sm" style={{ borderRadius: '8px' }} onClick={addItem}><Plus size={14} /> Add Item</button>
              </div>
              
              <div className="flex-col gap-sm mb-lg">
                {items.map((item, index) => (
                  <div key={item.id} className="flex gap-sm align-center p-sm" style={{ background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <input 
                      type="text" 
                      className="input flex-2" 
                      style={{ background: 'transparent', border: 'none' }}
                      placeholder="Item Description (e.g. Hall Rental)" 
                      value={item.description}
                      onChange={e => updateItem(item.id, 'description', e.target.value)}
                    />
                    <input 
                      type="number" 
                      className="input flex-1" 
                      style={{ background: 'var(--bg-card)' }}
                      placeholder="Qty" 
                      min="1"
                      value={item.quantity}
                      onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                    />
                    <input 
                      type="number" 
                      className="input flex-1" 
                      style={{ background: 'var(--bg-card)' }}
                      placeholder="Unit Price" 
                      min="0"
                      value={item.price_per_unit}
                      onChange={e => updateItem(item.id, 'price_per_unit', e.target.value)}
                    />
                    <div style={{ width: 100, textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>
                      {formatCurrency(item.quantity * item.price_per_unit)}
                    </div>
                    <button className="btn btn-icon text-danger" style={{ background: 'var(--bg-card)' }} onClick={() => removeItem(item.id)} disabled={items.length === 1}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="text-right text-xl mt-lg pt-md" style={{ borderTop: '2px dashed var(--border)', fontWeight: '800' }}>
                <span className="text-secondary" style={{ fontWeight: 500, fontSize: '1rem', marginRight: '12px' }}>Grand Total</span>
                <span style={{ color: 'var(--success)' }}>{formatCurrency(items.reduce((s, i) => s + (i.quantity * i.price_per_unit), 0))}</span>
              </div>
            </div>
            <div className="modal-footer" style={{ borderTop: 'none', padding: '24px 32px', background: 'var(--bg-elevated)', borderRadius: '0 0 24px 24px' }}>
              <button className="btn btn-secondary" style={{ borderRadius: '12px', padding: '12px 24px' }} onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ borderRadius: '12px', padding: '12px 24px', background: 'linear-gradient(135deg, #4f46e5, #ec4899)' }} onClick={handleCreatePackage}>Create Package</button>
            </div>
          </div>
        </div>
      )}

      {/* View Package Modal */}
      {viewPackage && (
        <div className="modal-overlay" onClick={() => setViewPackage(null)}>
          <div className="premium-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 1000, width: '95%', background: 'var(--bg-card)' }}>
            <div className="premium-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <PackageIcon size={24} style={{ color: '#ec4899' }} />
                {viewPackage.title}
              </h2>
              <div className="flex gap-sm">
                <button className="btn btn-secondary btn-sm flex align-center gap-xs" style={{ borderRadius: '8px', border: '1px solid var(--border)' }} onClick={generatePDF}>
                  <Download size={14} /> Download PDF
                </button>
                <button className="btn btn-icon" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }} onClick={() => setViewPackage(null)}><X size={20} /></button>
              </div>
            </div>
            <div className="modal-body pkg-modal-layout gap-xl" style={{ height: '70vh', padding: '32px', overflowY: 'auto' }}>
              {/* Left Side: Package Details */}
              <div style={{ flex: 1.5, overflowY: 'auto', paddingRight: '20px' }}>
                <div className="grid mb-lg" style={{ gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div className="p-md" style={{ background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--border)' }}>
                    <span className="text-secondary text-sm flex align-center gap-xs mb-xs"><User size={14}/> Customer</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{viewPackage.customer_name}</div>
                  </div>
                  <div className="p-md" style={{ background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--border)' }}>
                    <span className="text-secondary text-sm flex align-center gap-xs mb-xs"><Phone size={14}/> Contact</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{viewPackage.contact || '-'}</div>
                  </div>
                  <div className="p-md" style={{ background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--border)' }}>
                    <span className="text-secondary text-sm flex align-center gap-xs mb-xs"><Calendar size={14}/> Event Date</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{viewPackage.event_date ? formatDate(viewPackage.event_date) : '-'}</div>
                  </div>
                  <div className="p-md" style={{ background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--border)' }}>
                    <span className="text-secondary text-sm flex align-center gap-xs mb-xs">Status</span>
                    <div><span className={`pkg-badge ${viewPackage.status}`} style={{ margin: 0 }}>{viewPackage.status}</span></div>
                  </div>
                </div>
                {viewPackage.notes && (
                  <div className="mb-lg p-md" style={{ background: 'rgba(79, 70, 229, 0.05)', borderRadius: '16px', border: '1px solid rgba(79, 70, 229, 0.1)' }}>
                    <span className="text-primary text-sm font-bold mb-xs block">Notes & Requests</span>
                    <div style={{ lineHeight: 1.6, color: 'var(--text-secondary)' }}>{viewPackage.notes}</div>
                  </div>
                )}
                
                <h3 className="mb-md" style={{ fontSize: '1.2rem' }}>Line Items</h3>
                <div className="table-responsive mb-lg" style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <table className="table w-full m-0" style={{ margin: 0 }}>
                    <thead style={{ background: 'var(--bg-elevated)' }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '16px' }}>Description</th>
                        <th style={{ textAlign: 'center', padding: '16px' }}>Qty</th>
                        <th style={{ textAlign: 'right', padding: '16px' }}>Price</th>
                        <th style={{ textAlign: 'right', padding: '16px' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewPackage.items?.map(item => (
                        <tr key={item.id}>
                          <td style={{ padding: '16px', fontWeight: 500 }}>{item.description}</td>
                          <td style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)' }}>{item.quantity}</td>
                          <td style={{ textAlign: 'right', padding: '16px', color: 'var(--text-secondary)' }}>{formatCurrency(item.price_per_unit)}</td>
                          <td style={{ textAlign: 'right', padding: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end mt-lg">
                  <div className="p-md" style={{ background: 'var(--bg-elevated)', borderRadius: '16px', minWidth: '300px', border: '1px solid var(--border)' }}>
                    <div className="flex justify-between mb-sm text-sm text-secondary">
                      <span>Subtotal</span>
                      <span>{formatCurrency(viewPackage.total_amount)}</span>
                    </div>
                    <div className="flex justify-between text-xl pt-sm mt-sm" style={{ borderTop: '2px dashed var(--border)', fontWeight: 800 }}>
                      <span>Grand Total</span>
                      <span className="text-primary">{formatCurrency(viewPackage.total_amount)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Ledger */}
              <div style={{ flex: 1, borderLeft: '1px solid var(--border)', paddingLeft: '32px', display: 'flex', flexDirection: 'column' }}>
                <div className="flex justify-between align-center mb-md">
                  <h3 className="flex align-center gap-sm" style={{ margin: 0 }}><BookOpen size={20} className="text-primary" /> Payment Ledger</h3>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '24px', paddingRight: '8px' }}>
                  {viewPackage.payments?.length === 0 ? (
                    <div className="text-center text-secondary p-xl flex-col align-center justify-center h-full" style={{ border: '1px dashed var(--border)', borderRadius: '16px' }}>
                      <Banknote size={32} style={{ opacity: 0.5, marginBottom: '12px' }} />
                      No payments logged yet.
                    </div>
                  ) : (
                    <div className="flex-col gap-md">
                      {viewPackage.payments?.map(payment => (
                        <div key={payment.id} className="p-md" style={{ background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--border)', borderLeft: '4px solid #10b981' }}>
                          <div className="flex justify-between align-start mb-xs">
                            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{formatCurrency(payment.amount)}</div>
                            <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>{payment.payment_method.toUpperCase()}</span>
                          </div>
                          <div className="text-secondary text-sm flex align-center gap-xs">
                            <Calendar size={12} /> {new Date(payment.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                          </div>
                          {payment.notes && <div className="text-sm mt-sm pt-sm" style={{ borderTop: '1px dashed var(--border)', color: 'var(--text-secondary)' }}>{payment.notes}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-xl" style={{ background: 'linear-gradient(145deg, var(--bg-elevated), var(--bg-card))', borderRadius: '24px', border: '1px solid var(--glass-border)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                  <div className="flex justify-between mb-md text-md">
                    <span className="text-secondary font-medium">Total Paid</span>
                    <span className="text-success" style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                      {formatCurrency(viewPackage.payments?.reduce((s, p) => s + Number(p.amount), 0) || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between mb-xl text-md">
                    <span className="text-secondary font-medium">Balance Due</span>
                    <span className="text-danger" style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                      {formatCurrency(viewPackage.total_amount - (viewPackage.payments?.reduce((s, p) => s + Number(p.amount), 0) || 0))}
                    </span>
                  </div>
                  
                  {!viewPackage.is_deleted && (
                  <div className="flex-col gap-md pt-lg" style={{ borderTop: '2px dashed var(--border)' }}>
                    <h4 style={{ margin: 0, color: 'var(--text-secondary)' }}>Record New Payment</h4>
                    <div className="flex gap-sm w-full" style={{ display: 'flex', width: '100%' }}>
                      <div style={{ position: 'relative', flex: 2 }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: 'var(--text-secondary)', zIndex: 10 }}>Rs.</span>
                        <input 
                          type="number" 
                          className="premium-input" 
                          style={{ paddingLeft: '40px', width: '100%', height: '100%', boxSizing: 'border-box' }}
                          placeholder="Amount" 
                          value={paymentAmount}
                          onChange={e => setPaymentAmount(e.target.value)}
                        />
                      </div>
                      <select className="premium-input" style={{ flex: 1, width: '100%' }} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="online">Online</option>
                      </select>
                    </div>
                    <input 
                      type="text" 
                      className="premium-input w-full" 
                      placeholder="Transaction ID / Notes (optional)" 
                      value={paymentNotes}
                      onChange={e => setPaymentNotes(e.target.value)}
                    />
                    <button className="btn w-full mt-sm" style={{ background: '#10b981', color: '#fff', borderRadius: '12px', padding: '14px', fontSize: '1.05rem', fontWeight: 600 }} onClick={handleAddPayment}>
                      Log Payment
                    </button>
                  </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer flex justify-between" style={{ padding: '24px 32px', background: 'var(--bg-elevated)', borderRadius: '0 0 24px 24px', borderTop: 'none' }}>
              {!viewPackage.is_deleted ? (
                <button className="btn btn-danger btn-sm" style={{ borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }} onClick={() => handleDeletePackage(viewPackage.id)}>Delete Package</button>
              ) : (
                <button className="btn btn-success btn-sm" style={{ borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }} onClick={() => handleRestorePackage(viewPackage.id)}>Restore Package</button>
              )}
              <button className="btn btn-secondary" style={{ borderRadius: '12px', padding: '10px 24px' }} onClick={() => setViewPackage(null)}>Close Window</button>
            </div>
          </div>
        </div>
      )}

      {/* Deleted Packages Modal */}
      {showDeletedModal && (
        <div className="modal-overlay">
          <div className="premium-modal-content" style={{ maxWidth: 900, width: '90%', background: 'var(--bg-card)', padding: '32px' }}>
            <div className="flex justify-between align-center mb-xl">
              <h2 style={{ margin: 0 }}>Deleted Packages</h2>
              <button className="btn btn-icon" onClick={() => setShowDeletedModal(false)}><X size={20}/></button>
            </div>
            
            {deletedPackages.length === 0 ? (
              <div className="text-center text-secondary p-xl" style={{ minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No deleted packages found.</div>
            ) : (
              <div className="package-grid" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '8px', margin: '-8px' }}>
                {deletedPackages.map(pkg => {
                  const balance = pkg.total_amount - (pkg.paid_amount || 0);
                  return (
                    <div key={pkg.id} className="pkg-card" onClick={() => handleViewPackage(pkg.id)} style={{ opacity: 0.8 }}>
                      <div className="pkg-header">
                        <h3 className="pkg-title">{pkg.title}</h3>
                        <span className="pkg-badge cancelled">Deleted</span>
                      </div>
                      
                      <div className="pkg-info-row">
                        <div className="pkg-icon-box"><User size={16} /></div>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{pkg.customer_name}</span>
                      </div>
                      
                      <div className="pkg-finances" style={{ marginTop: '16px' }}>
                        <div className="finance-item total">
                          <span>Total</span>
                          <span>{formatCurrency(pkg.total_amount)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      <style>{`
        .pkg-modal-layout {
          display: flex;
          flex-direction: row;
        }
        @media (max-width: 900px) {
          .pkg-modal-layout {
            flex-direction: column;
          }
          .pkg-modal-layout > div {
            border-left: none !important;
            padding-left: 0 !important;
          }
        }
        .packages-hero {
          background: linear-gradient(135deg, #4f46e5 0%, #ec4899 100%);
          border-radius: 24px;
          padding: 40px;
          color: white;
          margin-bottom: 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 10px 30px rgba(236, 72, 153, 0.2);
        }
        .packages-hero h1 {
          font-size: 2.5rem;
          margin: 0 0 8px 0;
          font-weight: 800;
          letter-spacing: -1px;
        }
        .packages-hero p {
          opacity: 0.9;
          font-size: 1.1rem;
          margin: 0;
        }
        .package-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 24px;
        }
        .pkg-card {
          background: var(--bg-card);
          border: 1px solid var(--glass-border);
          border-radius: 24px;
          padding: 28px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .pkg-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 5px;
          background: linear-gradient(90deg, #4f46e5, #ec4899);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .pkg-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          border-color: rgba(236, 72, 153, 0.2);
        }
        .pkg-card:hover::before {
          opacity: 1;
        }
        .pkg-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }
        .pkg-title {
          font-size: 1.3rem;
          font-weight: 800;
          margin: 0 0 8px 0;
          color: var(--text-primary);
          line-height: 1.3;
        }
        .pkg-badge {
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .pkg-badge.active { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .pkg-badge.completed { background: rgba(99, 102, 241, 0.1); color: #6366f1; }
        
        .pkg-info-row {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--text-secondary);
          font-size: 0.95rem;
          margin-bottom: 16px;
        }
        .pkg-icon-box {
          width: 36px; height: 36px;
          border-radius: 10px;
          background: var(--bg-elevated);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
          border: 1px solid var(--border);
        }
        
        .pkg-finances {
          margin-top: 10px;
          padding-top: 20px;
          border-top: 1px dashed var(--border);
        }
        .finance-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 0.95rem;
        }
        .finance-item:last-child { margin-bottom: 0; }
        .finance-item.total { font-weight: 700; font-size: 1.1rem; color: var(--text-primary); }
        .finance-item.paid { color: #10b981; font-weight: 500; }
        .finance-item.balance { color: #ef4444; font-weight: 700; }
        
        .premium-input {
          width: 100%;
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-primary);
          font-family: inherit;
          font-size: 0.95rem;
          transition: all 0.2s;
        }
        .premium-input:focus {
          outline: none;
          border-color: #ec4899;
          box-shadow: 0 0 0 3px rgba(236, 72, 153, 0.1);
        }
      `}</style>
    </div>
  );
}
