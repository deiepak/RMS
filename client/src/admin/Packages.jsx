import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Plus, X, Download, Package as PackageIcon, BookOpen, Calendar, User, Phone } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function Packages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
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

    try {
      await api.post('/packages', {
        title, customer_name: customerName, contact,
        event_date: eventDate, notes, items
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
      showToast('Failed to add payment', 'error');
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

  const generatePDF = () => {
    if (!viewPackage) return;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Event Package Invoice', 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Package Name: ${viewPackage.title}`, 14, 32);
    doc.text(`Customer: ${viewPackage.customer_name}`, 14, 38);
    doc.text(`Contact: ${viewPackage.contact || 'N/A'}`, 14, 44);
    doc.text(`Event Date: ${viewPackage.event_date ? new Date(viewPackage.event_date).toLocaleDateString() : 'N/A'}`, 14, 50);

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
    <div className="admin-page">
      <div className="flex justify-between align-center mb-xl">
        <div>
          <h1>Packages & Events</h1>
          <p className="text-secondary">Manage large bookings, banquets, and customized events.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={18} /> New Package
        </button>
      </div>

      {loading ? (
        <div className="text-center text-secondary p-xl">Loading packages...</div>
      ) : packages.length === 0 ? (
        <div className="card text-center p-xl">
          <PackageIcon size={48} className="text-secondary mb-md mx-auto" />
          <h3>No Packages Found</h3>
          <p className="text-secondary">Click 'New Package' to create one.</p>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {packages.map(pkg => (
            <div key={pkg.id} className="card p-lg cursor-pointer hover-lift" onClick={() => handleViewPackage(pkg.id)}>
              <div className="flex justify-between align-start mb-md">
                <h3 style={{ margin: 0 }}>{pkg.title}</h3>
                <span className={`badge ${pkg.status === 'active' ? 'badge-info' : 'badge-success'}`}>
                  {pkg.status.toUpperCase()}
                </span>
              </div>
              <div className="text-secondary mb-sm flex align-center gap-sm" style={{ fontSize: 14 }}>
                <User size={14} /> {pkg.customer_name}
              </div>
              {pkg.event_date && (
                <div className="text-secondary mb-sm flex align-center gap-sm" style={{ fontSize: 14 }}>
                  <Calendar size={14} /> {new Date(pkg.event_date).toLocaleDateString()}
                </div>
              )}
              
              <div className="mt-md pt-md" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex justify-between text-sm mb-xs">
                  <span className="text-secondary">Total:</span>
                  <span style={{ fontWeight: 500 }}>{formatCurrency(pkg.total_amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-secondary">Paid:</span>
                  <span className="text-success" style={{ fontWeight: 500 }}>{formatCurrency(pkg.paid_amount || 0)}</span>
                </div>
                <div className="flex justify-between text-sm mt-xs">
                  <span className="text-secondary">Balance:</span>
                  <span className="text-danger" style={{ fontWeight: 500 }}>
                    {formatCurrency(pkg.total_amount - (pkg.paid_amount || 0))}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Package Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 800, width: '90%' }}>
            <div className="modal-header">
              <h2>Create Event Package</h2>
              <button className="btn btn-icon" onClick={() => setShowAddModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="grid mb-lg" style={{ gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label className="block mb-xs">Package Title *</label>
                  <input type="text" className="input w-full" placeholder="e.g. 50th Birthday Party" value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div>
                  <label className="block mb-xs">Event Date</label>
                  <input type="date" className="input w-full" value={eventDate} onChange={e => setEventDate(e.target.value)} />
                </div>
                <div>
                  <label className="block mb-xs">Customer Name *</label>
                  <input type="text" className="input w-full" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                </div>
                <div>
                  <label className="block mb-xs">Contact Number</label>
                  <input type="text" className="input w-full" value={contact} onChange={e => setContact(e.target.value)} />
                </div>
              </div>
              <div className="mb-lg">
                <label className="block mb-xs">Notes/Description</label>
                <textarea className="input w-full" rows="3" value={notes} onChange={e => setNotes(e.target.value)}></textarea>
              </div>

              <div className="mb-md flex justify-between align-center">
                <h3>Line Items *</h3>
                <button className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={14} /> Add Item</button>
              </div>
              
              <div className="flex-col gap-sm mb-lg">
                {items.map((item, index) => (
                  <div key={item.id} className="flex gap-sm align-center">
                    <input 
                      type="text" 
                      className="input flex-2" 
                      placeholder="Item Description (e.g. Hall Rental)" 
                      value={item.description}
                      onChange={e => updateItem(item.id, 'description', e.target.value)}
                    />
                    <input 
                      type="number" 
                      className="input flex-1" 
                      placeholder="Qty" 
                      min="1"
                      value={item.quantity}
                      onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                    />
                    <input 
                      type="number" 
                      className="input flex-1" 
                      placeholder="Unit Price" 
                      min="0"
                      value={item.price_per_unit}
                      onChange={e => updateItem(item.id, 'price_per_unit', e.target.value)}
                    />
                    <div style={{ width: 100, textAlign: 'right', fontWeight: 500 }}>
                      {formatCurrency(item.quantity * item.price_per_unit)}
                    </div>
                    <button className="btn btn-icon text-danger" onClick={() => removeItem(item.id)} disabled={items.length === 1}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="text-right text-lg" style={{ fontWeight: 'bold' }}>
                Grand Total: {formatCurrency(items.reduce((s, i) => s + (i.quantity * i.price_per_unit), 0))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreatePackage}>Create Package</button>
            </div>
          </div>
        </div>
      )}

      {/* View Package Modal */}
      {viewPackage && (
        <div className="modal-overlay" onClick={() => setViewPackage(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 900, width: '95%' }}>
            <div className="modal-header">
              <h2>{viewPackage.title}</h2>
              <div className="flex gap-sm">
                <button className="btn btn-secondary btn-sm flex align-center gap-xs" onClick={generatePDF}>
                  <Download size={14} /> PDF
                </button>
                <button className="btn btn-icon" onClick={() => setViewPackage(null)}><X size={20} /></button>
              </div>
            </div>
            <div className="modal-body flex gap-lg" style={{ height: '70vh' }}>
              {/* Left Side: Package Details */}
              <div style={{ flex: 1.5, overflowY: 'auto', paddingRight: '20px' }}>
                <div className="grid mb-lg" style={{ gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div><span className="text-secondary text-sm">Customer</span><br/><strong>{viewPackage.customer_name}</strong></div>
                  <div><span className="text-secondary text-sm">Contact</span><br/><strong>{viewPackage.contact || '-'}</strong></div>
                  <div><span className="text-secondary text-sm">Event Date</span><br/><strong>{viewPackage.event_date ? new Date(viewPackage.event_date).toLocaleDateString() : '-'}</strong></div>
                  <div><span className="text-secondary text-sm">Status</span><br/><strong>{viewPackage.status.toUpperCase()}</strong></div>
                </div>
                {viewPackage.notes && (
                  <div className="mb-lg p-sm bg-secondary" style={{ borderRadius: 'var(--radius-sm)' }}>
                    <span className="text-secondary text-sm">Notes</span><br/>
                    {viewPackage.notes}
                  </div>
                )}
                
                <h3 className="mb-sm">Line Items</h3>
                <div className="table-responsive mb-lg">
                  <table className="table w-full">
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Description</th>
                        <th style={{ textAlign: 'center' }}>Qty</th>
                        <th style={{ textAlign: 'right' }}>Price</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewPackage.items?.map(item => (
                        <tr key={item.id}>
                          <td>{item.description}</td>
                          <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(item.price_per_unit)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-right text-lg mb-lg">
                  <strong>Grand Total: <span className="text-primary">{formatCurrency(viewPackage.total_amount)}</span></strong>
                </div>
              </div>

              {/* Right Side: Ledger */}
              <div style={{ flex: 1, borderLeft: '1px solid var(--border)', paddingLeft: '20px', display: 'flex', flexDirection: 'column' }}>
                <div className="flex justify-between align-center mb-md">
                  <h3 className="flex align-center gap-sm"><BookOpen size={20} /> Payment Ledger</h3>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px' }}>
                  {viewPackage.payments?.length === 0 ? (
                    <div className="text-center text-secondary p-lg">No payments logged yet.</div>
                  ) : (
                    <div className="flex-col gap-sm">
                      {viewPackage.payments?.map(payment => (
                        <div key={payment.id} className="p-sm bg-secondary flex justify-between align-start" style={{ borderRadius: 'var(--radius-sm)' }}>
                          <div>
                            <div style={{ fontWeight: 500 }}>{formatCurrency(payment.amount)}</div>
                            <div className="text-secondary text-sm">{new Date(payment.created_at).toLocaleString()} • {payment.payment_method.toUpperCase()}</div>
                            {payment.notes && <div className="text-xs text-secondary mt-xs">{payment.notes}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-md" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <div className="flex justify-between mb-sm text-sm">
                    <span>Total Paid:</span>
                    <span className="text-success" style={{ fontWeight: 600 }}>
                      {formatCurrency(viewPackage.payments?.reduce((s, p) => s + Number(p.amount), 0) || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between mb-md text-sm">
                    <span>Balance Due:</span>
                    <span className="text-danger" style={{ fontWeight: 600 }}>
                      {formatCurrency(viewPackage.total_amount - (viewPackage.payments?.reduce((s, p) => s + Number(p.amount), 0) || 0))}
                    </span>
                  </div>
                  
                  <div className="flex-col gap-sm">
                    <input 
                      type="number" 
                      className="input w-full" 
                      placeholder="Amount to Pay" 
                      value={paymentAmount}
                      onChange={e => setPaymentAmount(e.target.value)}
                    />
                    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="online">Online</option>
                      </select>
                      <input 
                        type="text" 
                        className="input" 
                        placeholder="Notes (optional)" 
                        value={paymentNotes}
                        onChange={e => setPaymentNotes(e.target.value)}
                      />
                    </div>
                    <button className="btn btn-success w-full mt-sm" onClick={handleAddPayment}>
                      Log Payment
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer flex justify-between">
              <button className="btn btn-danger btn-sm" onClick={() => handleDeletePackage(viewPackage.id)}>Delete Package</button>
              <button className="btn btn-secondary" onClick={() => setViewPackage(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
