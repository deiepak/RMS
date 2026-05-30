import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Download, Phone, Mail, MapPin, FileText } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function VendorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const [vendor, setVendor] = useState(location.state?.vendor || null);
  const [ledgerData, setLedgerData] = useState({ ledger: [], current_balance: 0, bills: [], advances: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [ledgerForm, setLedgerForm] = useState({ amount: '', payment_method: 'cash', reference_id: '', notes: '', linked_bill_id: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchVendorAndLedger();
  }, [id]);

  const fetchVendorAndLedger = async () => {
    try {
      setIsLoading(true);
      if (!vendor) {
        const vendorRes = await api.get('/vendors');
        const v = vendorRes.data.find(v => v.id === parseInt(id));
        setVendor(v);
      }
      const ledgerRes = await api.get(`/vendors/${id}/ledger`);
      setLedgerData(ledgerRes.data);
    } catch (error) {
      showToast('Failed to load vendor data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSave = async (e) => {
    e.preventDefault();
    if (!ledgerForm.amount || Number(ledgerForm.amount) <= 0) return showToast('Enter valid amount', 'error');
    
    try {
      setIsSubmitting(true);
      await api.post(`/vendors/${id}/ledger`, ledgerForm);
      showToast('Payment logged successfully', 'success');
      setLedgerForm({ amount: '', payment_method: 'cash', reference_id: '', notes: '', linked_bill_id: '' });
      const ledgerRes = await api.get(`/vendors/${id}/ledger`);
      setLedgerData(ledgerRes.data);
    } catch (error) {
      showToast('Failed to log payment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadCSV = () => {
    let csv = 'Date,Type,Amount,Method,Balance,Notes\n';
    ledgerData.ledger.forEach(entry => {
      csv += `"${new Date(entry.created_at).toLocaleString()}","${entry.transaction_type}","${entry.amount}","${entry.payment_method || ''}","${entry.balance}","${entry.notes || ''}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor_ledger_${vendor?.name.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadPDF = () => {
    if (!vendor) return;
    const doc = new jsPDF();

    // Title
    doc.setFontSize(20);
    doc.text(`Vendor Ledger — ${vendor.name}`, 14, 22);

    // Vendor Info
    doc.setFontSize(11);
    doc.text(`Contact: ${vendor.contact || 'N/A'}`, 14, 32);
    doc.text(`Email: ${vendor.email || 'N/A'}`, 14, 38);
    doc.text(`Address: ${vendor.address || 'N/A'}`, 14, 44);
    doc.text(`Current Balance: Rs. ${Number(ledgerData.current_balance).toFixed(2)}`, 14, 52);

    // Outstanding Bills
    const outstandingBills = ledgerData.bills.filter(b => b.remaining > 0 || b.remaining < 0);
    if (outstandingBills.length > 0) {
      doc.setFontSize(14);
      doc.text('Outstanding Bills', 14, 64);
      doc.autoTable({
        startY: 68,
        head: [['Date', 'Details', 'Bill Amount', 'Paid', 'Remaining']],
        body: outstandingBills.map(b => [
          new Date(b.created_at).toLocaleDateString(),
          b.notes || '-',
          `Rs. ${Number(b.amount).toFixed(2)}`,
          `Rs. ${Number(b.paid).toFixed(2)}`,
          `Rs. ${Number(b.remaining).toFixed(2)}`
        ])
      });
    }

    // Full Ledger
    const startY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : 64;
    doc.setFontSize(14);
    doc.text('Full Ledger History', 14, startY);
    doc.autoTable({
      startY: startY + 4,
      head: [['Date', 'Type', 'Method', 'Amount', 'Balance', 'Notes']],
      body: ledgerData.ledger.map(e => [
        new Date(e.created_at).toLocaleDateString(),
        e.transaction_type,
        e.payment_method || '-',
        `Rs. ${Number(e.amount).toFixed(2)}`,
        `Rs. ${Number(e.balance).toFixed(2)}`,
        e.notes || '-'
      ])
    });

    doc.save(`Vendor_Ledger_${vendor.name.replace(/\s+/g, '_')}.pdf`);
  };

  if (isLoading && !vendor) {
    return <div className="admin-content"><p>Loading...</p></div>;
  }

  if (!vendor) {
    return (
      <div className="admin-content">
        <button className="btn btn-secondary flex align-center gap-sm mb-md" onClick={() => navigate('/admin/vendors')}>
          <ArrowLeft size={16} /> Back to Vendors
        </button>
        <p>Vendor not found.</p>
      </div>
    );
  }

  return (
    <div className="admin-content" style={{ overflowY: 'auto' }}>
      <button className="btn btn-secondary flex align-center gap-sm mb-md" onClick={() => navigate('/admin/vendors')}>
        <ArrowLeft size={16} /> Back to Vendors
      </button>

      <div className="card mb-lg" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: 24, marginBottom: 16 }}>{vendor.name}</h2>
        <div className="flex gap-lg flex-wrap text-secondary">
          <div className="flex align-center gap-sm"><Phone size={16} /> {vendor.contact}</div>
          {vendor.email && <div className="flex align-center gap-sm"><Mail size={16} /> {vendor.email}</div>}
          {vendor.address && <div className="flex align-center gap-sm"><MapPin size={16} /> {vendor.address}</div>}
        </div>
        {vendor.notes && <p className="mt-md text-secondary">{vendor.notes}</p>}
      </div>

      <div className="flex flex-col gap-lg mb-lg">
        {/* Release Payment Panel */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 className="mb-md">Release Payment</h3>
          
          <div className="mb-lg p-md bg-secondary flex justify-between align-center" style={{ borderRadius: 'var(--radius)' }}>
            <div>
              <div className="text-secondary" style={{ fontSize: 14 }}>Current Payable Balance</div>
              <div style={{ fontSize: 32, fontWeight: 'bold', color: ledgerData.current_balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {formatCurrency(ledgerData.current_balance)}
              </div>
              {ledgerData.current_balance > 0 && (
                <div className="text-danger mt-sm" style={{ fontSize: 13 }}>You owe this vendor.</div>
              )}
            </div>
          </div>

          <form onSubmit={handlePaymentSave} className="flex-col gap-md">
            <div className="flex gap-md">
              <div className="form-group flex-2">
                <label className="form-label">Link to Bill (Purchase)</label>
                <select className="form-select" value={ledgerForm.linked_bill_id} onChange={e => {
                  const billId = e.target.value;
                  const bill = ledgerData.bills.find(b => b.id == billId);
                  setLedgerForm({...ledgerForm, linked_bill_id: billId, amount: bill ? bill.remaining : ''});
                }}>
                  <option value="">-- Advance Payment (Unlinked) --</option>
                  {ledgerData.bills.filter(b => b.remaining > 0).map(b => (
                    <option key={b.id} value={b.id}>
                      {new Date(b.created_at).toLocaleDateString()} - {b.notes} (Remaining: {formatCurrency(b.remaining)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group flex-1">
                <label className="form-label">Amount</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-input" 
                  placeholder="0.00" 
                  value={ledgerForm.amount} 
                  onChange={e => setLedgerForm({...ledgerForm, amount: e.target.value})} 
                  required 
                />
              </div>
            </div>
            
            <div className="flex gap-md">
              <div className="form-group flex-1">
                <label className="form-label">Payment Method</label>
                <select 
                  className="form-select" 
                  value={ledgerForm.payment_method} 
                  onChange={e => setLedgerForm({...ledgerForm, payment_method: e.target.value})}
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="online">Online / eWallet</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div className="form-group flex-1">
                <label className="form-label">Ref ID (Optional)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Txn ID or Cheque No." 
                  value={ledgerForm.reference_id} 
                  onChange={e => setLedgerForm({...ledgerForm, reference_id: e.target.value})} 
                />
              </div>
              <div className="form-group flex-2">
                <label className="form-label">Notes (Optional)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Payment description" 
                  value={ledgerForm.notes} 
                  onChange={e => setLedgerForm({...ledgerForm, notes: e.target.value})} 
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ padding: '12px' }} disabled={isSubmitting}>
              {isSubmitting ? 'Processing...' : 'Release Payment'}
            </button>
          </form>
        </div>

        {/* Outstanding Bills List */}
        <div className="card">
          <div className="card-header">
            <h3>Outstanding Bills</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Bill Details</th>
                <th className="text-right">Bill Amount</th>
                <th className="text-right">Paid / Returned</th>
                <th className="text-right">Remaining</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {ledgerData.bills.filter(b => b.remaining > 0 || b.remaining < 0).map(bill => (
                <tr key={bill.id}>
                  <td>{new Date(bill.created_at).toLocaleDateString()}</td>
                  <td className="text-secondary" style={{ fontSize: 13 }}>{bill.notes}</td>
                  <td className="text-right font-bold">{formatCurrency(bill.amount)}</td>
                  <td className="text-right text-success">{formatCurrency(bill.paid)}</td>
                  <td className="text-right font-bold" style={{ color: bill.remaining < 0 ? 'var(--info)' : 'var(--danger)' }}>
                    {formatCurrency(bill.remaining)} {bill.remaining < 0 && '(Overpaid/Credit)'}
                  </td>
                  <td className="text-right">
                    <button className="btn btn-sm btn-primary" onClick={() => setLedgerForm({...ledgerForm, linked_bill_id: bill.id, amount: bill.remaining > 0 ? bill.remaining : 0})}>
                      Pay
                    </button>
                  </td>
                </tr>
              ))}
              {ledgerData.bills.filter(b => b.remaining > 0 || b.remaining < 0).length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center text-muted p-lg">No outstanding bills.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Ledger History */}
        <div className="card flex-2" style={{ alignSelf: 'flex-start' }}>
          <div className="flex justify-between align-center p-md" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: 0 }}>Ledger History</h3>
            <div className="flex gap-sm">
              <button className="btn btn-secondary btn-sm flex align-center gap-sm" onClick={downloadPDF} disabled={ledgerData.ledger.length === 0}>
                <FileText size={14} /> Download PDF
              </button>
              <button className="btn btn-secondary btn-sm flex align-center gap-sm" onClick={downloadCSV} disabled={ledgerData.ledger.length === 0}>
                <Download size={14} /> Export CSV
              </button>
            </div>
          </div>
          
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Details</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledgerData.ledger.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="flex align-center gap-sm">
                      {entry.transaction_type === 'purchase' ? <ArrowUpRight size={14} color="var(--danger)" /> : <ArrowDownRight size={14} color="var(--success)" />}
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                        {entry.transaction_type} {entry.payment_method && `(${entry.payment_method})`}
                      </span>
                    </div>
                    {(entry.notes || entry.reference_id) && (
                      <div className="text-secondary mt-sm" style={{ fontSize: 13 }}>
                        {entry.notes} {entry.reference_id && `[Ref: ${entry.reference_id}]`}
                      </div>
                    )}
                  </td>
                  <td className="text-right" style={{ fontWeight: 600, color: entry.transaction_type === 'purchase' ? 'var(--danger)' : 'var(--success)' }}>
                    {entry.transaction_type === 'purchase' ? '+' : '-'} {formatCurrency(entry.amount)}
                  </td>
                  <td className="text-right text-secondary">
                    {formatCurrency(entry.balance)}
                  </td>
                </tr>
              ))}
              {ledgerData.ledger.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center text-muted" style={{ padding: '40px 0' }}>
                    No ledger entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
