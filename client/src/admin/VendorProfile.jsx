import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Download, Phone, Mail, MapPin, FileText } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/helpers';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Modal from '../components/Modal';
import DatePicker from '../components/DatePicker';

export default function VendorProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const [vendor, setVendor] = useState(location.state?.vendor || null);
  const [ledgerData, setLedgerData] = useState({ ledger: [], current_balance: 0, bills: [], advances: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [bulkPayments, setBulkPayments] = useState([{ amount: '', payment_method: 'cash', reference_id: '' }]);
  const [bulkNotes, setBulkNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const defaultToDate = new Date();
  const defaultFromDate = new Date();
  defaultFromDate.setMonth(defaultFromDate.getMonth() - 1);
  
  const [fromDate, setFromDate] = useState(defaultFromDate.toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(defaultToDate.toISOString().split('T')[0]);
  const [billsFromDate, setBillsFromDate] = useState('');
  const [billsToDate, setBillsToDate] = useState('');
  const [showAllBillsModal, setShowAllBillsModal] = useState(false);
  const [showBulkPaymentModal, setShowBulkPaymentModal] = useState(false);
  const [selectedBills, setSelectedBills] = useState([]);

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
    
    // Filter out empty rows
    const validPayments = bulkPayments.filter(p => Number(p.amount) > 0);
    if (validPayments.length === 0) return showToast('Enter at least one valid amount', 'error');

    const totalEntered = validPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    let maxAllowed = ledgerData.current_balance;
    if (selectedBills.length > 0) {
      maxAllowed = selectedBills.reduce((sum, billId) => {
        const bill = ledgerData.bills.find(b => b.id === billId);
        return sum + (bill ? bill.remaining : 0);
      }, 0);
    }

    if (totalEntered > maxAllowed) {
      return showToast(`Cannot overpay. Maximum allowed is Rs. ${maxAllowed.toFixed(2)}`, 'error');
    }
    
    try {
      setIsSubmitting(true);
      for (let payment of validPayments) {
        await api.post(`/vendors/${id}/ledger`, {
          amount: payment.amount,
          payment_method: payment.payment_method,
          reference_id: payment.reference_id,
          notes: bulkNotes,
          selected_bill_ids: selectedBills.length > 0 ? selectedBills : undefined
        });
      }
      showToast('Payments logged successfully', 'success');
      setBulkPayments([{ amount: '', payment_method: 'cash', reference_id: '' }]);
      setBulkNotes('');
      setSelectedBills([]);
      setShowBulkPaymentModal(false);
      const ledgerRes = await api.get(`/vendors/${id}/ledger`);
      setLedgerData(ledgerRes.data);
    } catch (error) {
      showToast('Failed to log payments', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateBulkPayment = (index, field, value) => {
    const newPayments = [...bulkPayments];
    newPayments[index][field] = value;
    
    // Auto-append new line if amount is filled on the last row
    if (field === 'amount' && index === newPayments.length - 1 && Number(value) > 0) {
      newPayments.push({ amount: '', payment_method: 'cash', reference_id: '' });
    }
    
    setBulkPayments(newPayments);
  };

  const handleSelectAllBills = (e) => {
    if (e.target.checked) {
      const outstandingIds = ledgerData.bills.filter(b => b.remaining > 0).map(b => b.id);
      setSelectedBills(outstandingIds);
    } else {
      setSelectedBills([]);
    }
  };

  const toggleBillSelection = (billId) => {
    if (selectedBills.includes(billId)) {
      setSelectedBills(selectedBills.filter(id => id !== billId));
    } else {
      setSelectedBills([...selectedBills, billId]);
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
          formatDate(b.created_at),
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
        formatDate(e.created_at),
        e.transaction_type,
        e.payment_method || '-',
        `Rs. ${Number(e.amount).toFixed(2)}`,
        `Rs. ${Number(e.balance).toFixed(2)}`,
        e.notes || '-'
      ])
    });

    doc.save(`Vendor_Ledger_${vendor.name.replace(/\s+/g, '_')}.pdf`);
  };

  const filteredBills = ledgerData.bills.filter(bill => {
    if (billsFromDate && new Date(bill.created_at) < new Date(billsFromDate)) return false;
    if (billsToDate && new Date(bill.created_at) > new Date(billsToDate + 'T23:59:59')) return false;
    return true;
  });

  const downloadAllBillsCSV = () => {
    let csv = 'Date,Bill Details,Bill Amount,Paid/Returned,Remaining,Status\n';
    filteredBills.forEach(bill => {
      const status = bill.remaining <= 0 ? 'Paid' : 'Unpaid';
      csv += `"${formatDate(bill.created_at)}","${bill.notes || ''}","${bill.amount}","${bill.paid}","${bill.remaining}","${status}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `All_Bills_${vendor?.name.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAllBillsPDF = () => {
    if (!vendor) return;
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`All Bills — ${vendor.name}`, 14, 22);
    
    doc.autoTable({
      startY: 30,
      head: [['Date', 'Bill Details', 'Bill Amount', 'Paid/Returned', 'Remaining', 'Status']],
      body: filteredBills.map(b => [
        formatDate(b.created_at),
        b.notes || '-',
        `Rs. ${Number(b.amount).toFixed(2)}`,
        `Rs. ${Number(b.paid).toFixed(2)}`,
        `Rs. ${Number(b.remaining).toFixed(2)}`,
        b.remaining <= 0 ? 'Paid' : 'Unpaid'
      ])
    });
    doc.save(`All_Bills_${vendor.name.replace(/\s+/g, '_')}.pdf`);
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

  const filteredLedger = ledgerData.ledger.filter(entry => {
    if (fromDate && new Date(entry.created_at) < new Date(fromDate)) return false;
    if (toDate && new Date(entry.created_at) > new Date(toDate + 'T23:59:59')) return false;
    return true;
  });

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
        {/* Outstanding Bills List */}
        <div className="card">
          <div className="card-header flex justify-between align-center flex-wrap" style={{ gap: '12px' }}>
            <h3>Outstanding Bills</h3>
            <div className="flex gap-sm">
              <button 
                className="btn btn-primary btn-sm" 
                disabled={ledgerData.current_balance <= 0}
                onClick={() => {
                  const maxAllowed = selectedBills.length > 0
                    ? selectedBills.reduce((sum, id) => sum + (ledgerData.bills.find(b => b.id === id)?.remaining || 0), 0)
                    : ledgerData.current_balance;
                  setBulkPayments([{ amount: maxAllowed > 0 ? maxAllowed : '', payment_method: 'cash', reference_id: '' }]);
                  setBulkNotes('');
                  setShowBulkPaymentModal(true);
                }}
              >
                {selectedBills.length > 0 ? `Pay Selected (${selectedBills.length})` : 'Pay Advance'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAllBillsModal(true)}>
                View All Bills
              </button>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input 
                    type="checkbox" 
                    checked={ledgerData.bills.filter(b => b.remaining > 0).length > 0 && selectedBills.length === ledgerData.bills.filter(b => b.remaining > 0).length} 
                    onChange={handleSelectAllBills}
                  />
                </th>
                <th>Date</th>
                <th>Bill Details</th>
                <th className="text-right">Bill Amount</th>
                <th className="text-right">Paid / Returned</th>
                <th className="text-right">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {ledgerData.bills.filter(b => b.remaining > 0 || b.remaining < 0).map(bill => (
                <tr key={bill.id} className={selectedBills.includes(bill.id) ? 'selected-row' : ''}>
                  <td>
                    {bill.remaining > 0 && (
                      <input 
                        type="checkbox" 
                        checked={selectedBills.includes(bill.id)} 
                        onChange={() => toggleBillSelection(bill.id)}
                      />
                    )}
                  </td>
                  <td>{formatDate(bill.created_at)}</td>
                  <td className="text-secondary" style={{ fontSize: 13 }}>{bill.notes}</td>
                  <td className="text-right font-bold">{formatCurrency(bill.amount)}</td>
                  <td className="text-right text-success">{formatCurrency(bill.paid)}</td>
                  <td className="text-right font-bold" style={{ color: bill.remaining < 0 ? 'var(--info)' : 'var(--danger)' }}>
                    {formatCurrency(bill.remaining)} {bill.remaining < 0 && '(Overpaid/Credit)'}
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
          <div className="flex justify-between align-center p-md flex-wrap" style={{ borderBottom: '1px solid var(--border-color)', gap: '12px' }}>
            <h3 style={{ margin: 0 }}>Ledger History</h3>
            <div className="flex gap-sm align-center">
              <DatePicker className="form-input" style={{ padding: '6px' }} value={fromDate} onChange={e => setFromDate(e.target.value)} title="From Date" />
              <span className="text-secondary">to</span>
              <DatePicker className="form-input" style={{ padding: '6px' }} value={toDate} onChange={e => setToDate(e.target.value)} title="To Date" />
            </div>
            <div className="flex gap-sm">
              <button className="btn btn-secondary btn-sm flex align-center gap-sm" onClick={downloadPDF} disabled={filteredLedger.length === 0}>
                <FileText size={14} /> Download PDF
              </button>
              <button className="btn btn-secondary btn-sm flex align-center gap-sm" onClick={downloadCSV} disabled={filteredLedger.length === 0}>
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
              {filteredLedger.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDate(entry.created_at)}</td>
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
              {filteredLedger.length === 0 && (
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

      <Modal
        isOpen={showAllBillsModal}
        onClose={() => setShowAllBillsModal(false)}
        title={`All Bills - ${vendor.name}`}
        maxWidth="900px"
      >
        <div className="flex justify-between align-center mb-md flex-wrap" style={{ gap: '12px' }}>
          <div className="flex gap-sm align-center">
            <DatePicker className="form-input" style={{ padding: '6px' }} value={billsFromDate} onChange={e => setBillsFromDate(e.target.value)} title="From Date" />
            <span className="text-secondary">to</span>
            <DatePicker className="form-input" style={{ padding: '6px' }} value={billsToDate} onChange={e => setBillsToDate(e.target.value)} title="To Date" />
          </div>
          <div className="flex gap-sm">
            <button className="btn btn-secondary btn-sm flex align-center gap-sm" onClick={downloadAllBillsPDF} disabled={filteredBills.length === 0}>
              <FileText size={14} /> Download PDF
            </button>
            <button className="btn btn-secondary btn-sm flex align-center gap-sm" onClick={downloadAllBillsCSV} disabled={filteredBills.length === 0}>
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>
        <div className="table-responsive" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
          <table className="data-table">
            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1 }}>
              <tr>
                <th>Date</th>
                <th>Bill Details</th>
                <th className="text-right">Bill Amount</th>
                <th className="text-right">Paid / Returned</th>
                <th className="text-right">Remaining</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map(bill => (
                <tr key={bill.id}>
                  <td>{formatDate(bill.created_at)}</td>
                  <td className="text-secondary" style={{ fontSize: 13 }}>{bill.notes}</td>
                  <td className="text-right font-bold">{formatCurrency(bill.amount)}</td>
                  <td className="text-right text-success">{formatCurrency(bill.paid)}</td>
                  <td className="text-right font-bold" style={{ color: bill.remaining < 0 ? 'var(--info)' : (bill.remaining === 0 ? 'var(--success)' : 'var(--danger)') }}>
                    {formatCurrency(bill.remaining)} {bill.remaining < 0 && '(Credit)'}
                  </td>
                  <td className="text-center">
                    {bill.remaining <= 0 ? (
                      <span className="badge" style={{ background: 'var(--success)', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '12px' }}>Paid</span>
                    ) : (
                      <span className="badge" style={{ background: 'var(--danger)', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '12px' }}>Unpaid</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredBills.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center text-muted p-lg">No bills found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Bulk Payment Modal */}
      <Modal
        isOpen={showBulkPaymentModal}
        onClose={() => setShowBulkPaymentModal(false)}
        title={selectedBills.length > 0 ? `Pay ${selectedBills.length} Selected Bills` : "Advance Payment"}
        maxWidth="600px"
      >
        <form onSubmit={handlePaymentSave} className="flex-col gap-md">
          <div className="p-md bg-secondary mb-md flex justify-between align-center" style={{ borderRadius: 'var(--radius)' }}>
            <div>
              <div className="text-secondary" style={{ fontSize: 13 }}>
                {selectedBills.length > 0 ? 'Total amount for selected bills' : 'Total Payable Balance'}
              </div>
              <div style={{ fontSize: 28, fontWeight: 'bold' }}>
                {formatCurrency(
                  selectedBills.length > 0
                    ? selectedBills.reduce((sum, id) => sum + (ledgerData.bills.find(b => b.id === id)?.remaining || 0), 0)
                    : ledgerData.current_balance
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-secondary" style={{ fontSize: 13 }}>Total Entered</div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: bulkPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0) > (selectedBills.length > 0 ? selectedBills.reduce((sum, id) => sum + (ledgerData.bills.find(b => b.id === id)?.remaining || 0), 0) : ledgerData.current_balance) ? 'var(--danger)' : 'var(--success)' }}>
                {formatCurrency(bulkPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0))}
              </div>
            </div>
          </div>

          <div className="flex-col gap-sm">
            {bulkPayments.map((payment, index) => (
              <div key={index} className="p-md" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', background: 'var(--bg-primary)' }}>
                <div className="flex gap-md">
                  <div className="form-group flex-1">
                    <label className="form-label text-xs">PAYMENT METHOD</label>
                    <select 
                      className="form-select" 
                      value={payment.payment_method} 
                      onChange={e => updateBulkPayment(index, 'payment_method', e.target.value)}
                    >
                      <option value="cash">Cash</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="online">Online / eWallet</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                  <div className="form-group flex-1">
                    <label className="form-label text-xs">PAYMENT AMOUNT</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="form-input" 
                      placeholder="0.00" 
                      value={payment.amount} 
                      onChange={e => updateBulkPayment(index, 'amount', e.target.value)} 
                    />
                  </div>
                </div>
                {payment.payment_method === 'cheque' && (
                  <div className="form-group mt-sm">
                    <label className="form-label text-xs">CHEQUE NUMBER</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Enter Cheque No." 
                      value={payment.reference_id} 
                      onChange={e => updateBulkPayment(index, 'reference_id', e.target.value)} 
                    />
                  </div>
                )}
                {(payment.payment_method === 'bank' || payment.payment_method === 'online') && (
                  <div className="form-group mt-sm">
                    <label className="form-label text-xs">REFERENCE ID (OPTIONAL)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Txn ID" 
                      value={payment.reference_id} 
                      onChange={e => updateBulkPayment(index, 'reference_id', e.target.value)} 
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="form-group mt-md">
            <label className="form-label text-xs">NOTES (OPTIONAL)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Payment description for these transactions" 
              value={bulkNotes} 
              onChange={e => setBulkNotes(e.target.value)} 
            />
          </div>
          
          <div className="flex gap-sm justify-end mt-md">
            <button type="button" className="btn btn-secondary" onClick={() => setShowBulkPaymentModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Processing...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
