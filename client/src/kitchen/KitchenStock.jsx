import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Plus, Edit2, Trash2, AlertTriangle, ShoppingBag, History } from 'lucide-react';
import Modal from '../components/Modal';

export default function StockManagement() {
  const [stock, setStock] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lowStockFilter, setLowStockFilter] = useState(false);
  const activeTab = 'kitchen'; // Hardcoded for kitchen portal
  const { showToast } = useToast();

  const [menuItems, setMenuItems] = useState([]);
  const [menuLinks, setMenuLinks] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({
    name: '', quantity: '', unit: 'kg', low_threshold: '', vendor_id: ''
  });
  const [bulkForm, setBulkForm] = useState({
    vendor_id: '', items: [{ name: '', quantity: '', unit: 'kg', low_threshold: '' }]
  });

  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [globalPurchaseModalOpen, setGlobalPurchaseModalOpen] = useState(false);
  const [vendorBills, setVendorBills] = useState([]);
  const [transactionForm, setTransactionForm] = useState({
    stock_item_id: '', transaction_type: 'consume', quantity: '', vendor_id: '', notes: '', cost: '', linked_bill_id: '', bill_number: ''
  });
  
  const [purchaseForm, setPurchaseForm] = useState({
    vendor_id: '', bill_number: '', notes: '', items: [{ stock_item_id: '', quantity: '', price_per_unit: '', total_price: '' }]
  });

  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState(null);
  const [itemHistory, setItemHistory] = useState([]);
  const [historyLinks, setHistoryLinks] = useState([]);
  const [historyStockItem, setHistoryStockItem] = useState(null);

  useEffect(() => {
    fetchData();
  }, [lowStockFilter, activeTab]);

  // Fetch bills when vendor changes for returns
  useEffect(() => {
    if (transactionForm.transaction_type === 'return' && transactionForm.vendor_id) {
      api.get(`/vendors/${transactionForm.vendor_id}/ledger`)
        .then(res => setVendorBills(res.data.bills || []))
        .catch(() => setVendorBills([]));
    } else {
      setVendorBills([]);
    }
  }, [transactionForm.vendor_id, transactionForm.transaction_type]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();
      if (lowStockFilter) queryParams.append('low_stock', 'true');
      queryParams.append('department', activeTab);
      
      const [stockRes, vendorsRes, menuRes] = await Promise.all([
        api.get(`/stock?${queryParams.toString()}`),
        api.get('/vendors'),
        api.get('/menu')
      ]);
      setStock(stockRes.data);
      setVendors(vendorsRes.data);
      setMenuItems(menuRes.data);
    } catch (error) {
      showToast('Failed to load stock data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingItem) {
        const payload = {
          ...form,
          vendor_id: form.vendor_id || null,
          department: activeTab
        };
        const validLinks = menuLinks.filter(link => link.menu_item_id);
        await api.put(`/stock/${editingItem.id}`, payload);
        await api.put(`/stock/${editingItem.id}/links`, { links: validLinks });
        showToast('Stock item updated', 'success');
      } else {
        const validItems = bulkForm.items.filter(i => i.name && i.quantity);
        if (validItems.length === 0) return showToast('Please add at least one valid stock item', 'error');

        const payload = {
          vendor_id: bulkForm.vendor_id || null,
          department: activeTab,
          items: validItems
        };
        await api.post('/stock', payload);
        showToast('Stock items added', 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Save stock error:', error.response?.data || error);
      showToast(error.response?.data?.error || error.message || 'Failed to save stock item', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this stock item?')) {
      try {
        await api.delete(`/stock/${id}`);
        showToast('Item deleted', 'success');
        fetchData();
      } catch (error) {
        showToast('Failed to delete item', 'error');
      }
    }
  };

  const handleTransactionSave = async () => {
    if (!transactionForm.quantity || Number(transactionForm.quantity) <= 0) {
      return showToast('Please enter a valid quantity', 'error');
    }
    if (transactionForm.transaction_type === 'purchase' && transactionForm.vendor_id && !transactionForm.cost) {
      return showToast('Please enter the total cost for this purchase', 'error');
    }
    if (transactionForm.transaction_type === 'return' && transactionForm.vendor_id && !transactionForm.cost) {
      return showToast('Please enter the total credit/cost returned by the vendor', 'error');
    }

    try {
      await api.post('/stock/transactions', transactionForm);
      showToast('Transaction logged successfully', 'success');
      setTransactionModalOpen(false);
      fetchData();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to log transaction', 'error');
    }
  };

  const handleGlobalPurchase = async () => {
    if (!purchaseForm.vendor_id) return showToast('Please select a vendor', 'error');
    if (!purchaseForm.bill_number) return showToast('Bill number is required for purchase', 'error');

    // Filter out empty rows
    const validItems = purchaseForm.items.filter(i => i.stock_item_id && i.quantity > 0 && i.price_per_unit >= 0);
    if (validItems.length === 0) return showToast('Please add at least one valid stock item', 'error');

    const totalCost = validItems.reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0);

    try {
      await api.post('/stock/transactions', {
        transaction_type: 'purchase',
        vendor_id: purchaseForm.vendor_id,
        bill_number: purchaseForm.bill_number,
        cost: totalCost,
        notes: purchaseForm.notes,
        items: validItems
      });
      showToast('Purchase logged successfully', 'success');
      setGlobalPurchaseModalOpen(false);
      fetchData();
    } catch (error) {
      showToast(error.response?.data?.error || 'Failed to log purchase', 'error');
    }
  };

  const openTransactionModal = (item, type = 'consume') => {
    setTransactionForm({
      stock_item_id: item.id,
      transaction_type: type,
      quantity: '',
      vendor_id: item.vendor_id || '',
      notes: '',
      cost: ''
    });
    setEditingItem(item); 
    setTransactionModalOpen(true);
  };

  const openGlobalPurchase = () => {
    setPurchaseForm({
      vendor_id: '', bill_number: '', notes: '', items: [{ stock_item_id: '', quantity: '', price_per_unit: '', total_price: '' }]
    });
    setGlobalPurchaseModalOpen(true);
  };

  const openModal = async (item = null) => {
    if (item) {
      setEditingItem(item);
      setForm({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        low_threshold: item.low_threshold,
        vendor_id: item.vendor_id || ''
      });
      // Fetch links
      try {
        const res = await api.get(`/stock/${item.id}/links`);
        setMenuLinks(res.data);
      } catch (e) {
        setMenuLinks([]);
      }
    } else {
      setEditingItem(null);
      setBulkForm({
        vendor_id: '', items: [{ name: '', quantity: '', unit: 'kg', low_threshold: '' }]
      });
      setForm({ name: '', quantity: '', unit: 'kg', low_threshold: '', vendor_id: '' });
      setMenuLinks([]);
    }
    setIsModalOpen(true);
  };

  const fetchHistory = async (item) => {
    try {
      const res = await api.get(`/stock/${item.id}/transactions`);
      setItemHistory(res.data.transactions || []);
      setHistoryLinks(res.data.links || []);
      setHistoryStockItem(res.data.stockItem || null);
      setHistoryItem(item);
      setHistoryModalOpen(true);
    } catch (error) {
      showToast('Failed to load history', 'error');
    }
  };

  return (
    <div className="kitchen-page p-xl">
      <div className="flex justify-between align-center mb-xl">
        <div>
          <h1>Kitchen Stock</h1>
          <p className="text-secondary">Manage kitchen groceries and ingredients</p>
        </div>
        <div className="flex gap-md">
          <button className="btn btn-secondary flex align-center gap-sm" onClick={openGlobalPurchase}>
            <ShoppingBag size={16} /> Purchase Stock
          </button>
          <button className="btn btn-primary" onClick={() => openModal()}>
            <Plus size={18} /> New Kitchen Item
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between align-center mb-md">
          <label className="flex align-center gap-sm text-secondary" style={{ cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={lowStockFilter} 
              onChange={e => setLowStockFilter(e.target.checked)} 
            />
            Show Low Stock Only
          </label>
        </div>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Status</th>
              <th>Vendor</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stock.map(item => {
              const isLow = parseFloat(item.quantity) <= parseFloat(item.low_threshold);
              return (
                <tr key={item.id} style={{ backgroundColor: isLow ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                  <td style={{ fontWeight: 500, cursor: 'pointer', color: 'var(--accent-primary)' }} onClick={() => fetchHistory(item)}>{item.name}</td>
                  <td style={{ fontWeight: 600, color: isLow ? 'var(--danger)' : 'var(--text-primary)' }}>
                    {parseFloat(item.quantity).toFixed(2)}
                  </td>
                  <td className="text-secondary">{item.unit}</td>
                  <td>
                    {isLow ? (
                      <span className="badge badge-danger">
                        <AlertTriangle size={12} /> Low Stock
                      </span>
                    ) : (
                      <span className="badge badge-success">Sufficient</span>
                    )}
                  </td>
                  <td className="text-secondary">{item.vendor_name || 'N/A'}</td>
                  <td className="text-right">
                    <div className="btn-group justify-end">
                      <button className="btn btn-sm" style={{ background: 'rgba(234, 88, 12, 0.1)', color: 'var(--warning)', border: '1px solid var(--warning)', padding: '4px 12px' }} onClick={() => openTransactionModal(item, 'consume')}>
                        Consume
                      </button>
                      <button className="btn btn-sm" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '4px 12px' }} onClick={() => openTransactionModal(item, 'damage')}>
                        Damage
                      </button>
                      <button className="btn btn-sm" style={{ background: 'rgba(168, 85, 247, 0.1)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', padding: '4px 12px' }} onClick={() => openTransactionModal(item, 'return')}>
                        Return
                      </button>
                      <div style={{ width: '8px' }}></div>
                      <button className="btn btn-icon btn-secondary" onClick={() => fetchHistory(item)} title="View History">
                        <History size={16} />
                      </button>
                      <button className="btn btn-icon btn-secondary" onClick={() => openModal(item)} title="Edit Item">
                        <Edit2 size={16} />
                      </button>
                      <button className="btn btn-icon btn-secondary" onClick={() => handleDelete(item.id)} title="Delete Item">
                        <Trash2 size={16} color="var(--danger)" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {stock.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center text-muted" style={{ padding: '40px 0' }}>
                  No stock items found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? "Edit Stock Item" : "Add Stock Items"}
        maxWidth={!editingItem ? "900px" : "500px"}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save</button>
          </>
        }
      >
        {!editingItem ? (
          <>
            <div className="form-group mb-md">
              <label className="form-label">Vendor (Optional)</label>
              <select className="form-select" value={bulkForm.vendor_id} onChange={e => setBulkForm({...bulkForm, vendor_id: e.target.value})}>
                <option value="">No vendor assigned</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="form-group mb-md">
              <label className="form-label">Stock Items</label>
              <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="data-table" style={{ minWidth: '600px' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1 }}>
                    <tr>
                      <th style={{ width: '40px' }}>S.No</th>
                      <th>Item Name</th>
                      <th style={{ width: '120px' }}>Current Qty</th>
                      <th style={{ width: '100px' }}>Unit</th>
                      <th style={{ width: '120px' }}>Low Threshold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkForm.items.map((item, index) => {
                      const updateItem = (field, value) => {
                        const newItems = [...bulkForm.items];
                        newItems[index][field] = value;
                        if (index === newItems.length - 1 && newItems[index].name && newItems[index].quantity) {
                          newItems.push({ name: '', quantity: '', unit: 'kg', low_threshold: '' });
                        }
                        setBulkForm({ ...bulkForm, items: newItems });
                      };
                      return (
                        <tr key={index}>
                          <td>{index + 1}</td>
                          <td>
                            <input type="text" className="form-input w-full" style={{ padding: '4px' }} value={item.name} onChange={e => updateItem('name', e.target.value)} placeholder="Item name" />
                          </td>
                          <td>
                            <input type="number" step="0.01" className="form-input w-full" style={{ padding: '4px' }} value={item.quantity} onChange={e => updateItem('quantity', e.target.value)} placeholder="0" min="0" />
                          </td>
                          <td>
                            <select className="form-select w-full" style={{ padding: '4px' }} value={item.unit} onChange={e => updateItem('unit', e.target.value)}>
                              <option value="kg">kg</option>
                              <option value="g">grams</option>
                              <option value="L">Liters</option>
                              <option value="ml">ml</option>
                              <option value="pcs">Pieces</option>
                              <option value="pkt">Packets</option>
                            </select>
                          </td>
                          <td>
                            <input type="number" step="0.01" className="form-input w-full" style={{ padding: '4px' }} value={item.low_threshold} onChange={e => updateItem('low_threshold', e.target.value)} placeholder="0" min="0" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">Item Name</label>
              <input type="text" className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            </div>
            <div className="flex gap-md">
              <div className="form-group flex-1">
                <label className="form-label">Current Quantity</label>
                <input type="number" step="0.01" className="form-input" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} required disabled={!!editingItem} title={editingItem ? "Use stock actions (Purchase/Consume) to modify quantity" : ""} />
                {editingItem && <small className="text-muted mt-sm">Use stock actions to modify quantity.</small>}
              </div>
              <div className="form-group flex-1">
                <label className="form-label">Unit</label>
                <select className="form-select" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
                  <option value="kg">kg</option>
                  <option value="g">grams</option>
                  <option value="L">Liters</option>
                  <option value="ml">ml</option>
                  <option value="pcs">Pieces</option>
                  <option value="pkt">Packets</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Low Stock Threshold</label>
              <input type="number" step="0.01" className="form-input" value={form.low_threshold} onChange={e => setForm({...form, low_threshold: e.target.value})} required />
              <small className="text-muted mt-sm">Alert will be shown when quantity falls below this value.</small>
            </div>
            <div className="form-group mt-md">
              <label className="form-label">Vendor (Optional)</label>
              <select className="form-select" value={form.vendor_id} onChange={e => setForm({...form, vendor_id: e.target.value})}>
                <option value="">No vendor assigned</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>

            <div className="mt-lg pt-md" style={{ borderTop: '1px solid var(--border-color)' }}>
              <div className="flex justify-between align-center mb-sm">
                <h4 style={{ margin: 0 }}>Recipe Mapping</h4>
                <button className="btn btn-secondary btn-sm flex align-center gap-xs" onClick={() => setMenuLinks([...menuLinks, { menu_item_id: '', quantity_consumed: 1 }])}>
                  <Plus size={14} /> Add Link
                </button>
              </div>
              <p className="text-secondary mb-md" style={{ fontSize: 13 }}>Link this stock to menu items. When the menu item is delivered, this stock will auto-deduct.</p>
              
              {menuLinks.map((link, index) => (
                <div key={index} className="flex gap-sm mb-sm align-end">
                  <div className="form-group flex-1" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Menu Item</label>
                    <select 
                      className="form-select" 
                      value={link.menu_item_id}
                      onChange={e => {
                        const newLinks = [...menuLinks];
                        newLinks[index].menu_item_id = e.target.value;
                        setMenuLinks(newLinks);
                      }}
                    >
                      <option value="">Select menu item...</option>
                      {menuItems.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ width: 120, marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Consumption</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="form-input" 
                      value={link.quantity_consumed}
                      onChange={e => {
                        const newLinks = [...menuLinks];
                        newLinks[index].quantity_consumed = e.target.value;
                        setMenuLinks(newLinks);
                      }}
                    />
                  </div>
                  <button 
                    className="btn btn-icon btn-secondary" 
                    style={{ padding: '8px' }}
                    onClick={() => {
                      const newLinks = menuLinks.filter((_, i) => i !== index);
                      setMenuLinks(newLinks);
                    }}
                  >
                    <Trash2 size={16} className="text-danger" />
                  </button>
                </div>
              ))}
              {menuLinks.length === 0 && (
                <div className="text-center text-secondary bg-secondary" style={{ padding: 12, borderRadius: 'var(--radius)', fontSize: 13 }}>
                  No menu items linked to this stock.
                </div>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* Transaction Modal */}
      <Modal 
        isOpen={transactionModalOpen} 
        onClose={() => setTransactionModalOpen(false)}
        title={`Log Transaction - ${editingItem?.name}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setTransactionModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleTransactionSave}>Save Transaction</button>
          </>
        }
      >
        <div className="flex gap-md mb-md">
          <div className="form-group flex-1">
            <label className="form-label">Type</label>
            <select className="form-select" value={transactionForm.transaction_type} onChange={e => setTransactionForm({...transactionForm, transaction_type: e.target.value})}>
              <option value="consume">Consume (Use Stock)</option>
              <option value="damage">Damage (Waste)</option>
              <option value="return">Return (Back to Vendor)</option>
            </select>
          </div>
          <div className="form-group flex-1">
            <label className="form-label">Quantity ({editingItem?.unit})</label>
            <input type="number" step="0.01" className="form-input" value={transactionForm.quantity} onChange={e => setTransactionForm({...transactionForm, quantity: e.target.value})} required />
          </div>
        </div>

        {(transactionForm.transaction_type === 'purchase' || transactionForm.transaction_type === 'return') && (
          <div className="mb-md">
            <div className="form-group">
              <label className="form-label">Vendor (Optional)</label>
              <select className="form-select" value={transactionForm.vendor_id} onChange={e => setTransactionForm({...transactionForm, vendor_id: e.target.value, linked_bill_id: ''})}>
                <option value="">Select Vendor</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            {transactionForm.transaction_type === 'return' && transactionForm.vendor_id && (
              <div className="form-group">
                <label className="form-label">Link to Bill (Purchase)</label>
                <select className="form-select" value={transactionForm.linked_bill_id} onChange={e => {
                  const billId = e.target.value;
                  const bill = vendorBills.find(b => b.id == billId);
                  setTransactionForm({...transactionForm, linked_bill_id: billId, cost: bill && bill.amount ? bill.amount : ''});
                }}>
                  <option value="">-- Unlinked Return --</option>
                  {vendorBills.map(b => (
                    <option key={b.id} value={b.id}>
                      {new Date(b.created_at).toLocaleDateString()} - {b.notes} (Bill Amt: {b.amount})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">{transactionForm.transaction_type === 'purchase' ? 'Total Cost (Added to Vendor Ledger)' : 'Returned Credit (Deducted from Ledger)'}</label>
              <input type="number" step="0.01" className="form-input" value={transactionForm.cost} onChange={e => setTransactionForm({...transactionForm, cost: e.target.value})} placeholder="0.00" required />
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Notes (Optional)</label>
          <input type="text" className="form-input" value={transactionForm.notes} onChange={e => setTransactionForm({...transactionForm, notes: e.target.value})} placeholder="e.g. Reason for damage" />
        </div>
      </Modal>

      {/* Global Purchase Modal */}
      <Modal 
        isOpen={globalPurchaseModalOpen} 
        onClose={() => setGlobalPurchaseModalOpen(false)}
        title="Purchase Stock"
        maxWidth="900px"
        footer={
          <div className="flex justify-between w-full">
            <div className="font-bold text-lg">
              Total Cost: रू {purchaseForm.items.reduce((sum, item) => sum + parseFloat(item.total_price || 0), 0).toFixed(2)}
            </div>
            <div className="flex gap-sm">
              <button className="btn btn-secondary" onClick={() => setGlobalPurchaseModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleGlobalPurchase}>Log Purchase</button>
            </div>
          </div>
        }
      >
        <div className="flex gap-md mb-md">
          <div className="form-group flex-1">
            <label className="form-label">Select Vendor <span className="text-danger">*</span></label>
            <select className="form-select" value={purchaseForm.vendor_id} onChange={e => setPurchaseForm({...purchaseForm, vendor_id: e.target.value})}>
              <option value="">-- Choose Vendor --</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="form-group flex-1">
            <label className="form-label">Bill / Invoice Number <span className="text-danger">*</span></label>
            <input type="text" className="form-input" value={purchaseForm.bill_number} onChange={e => setPurchaseForm({...purchaseForm, bill_number: e.target.value})} placeholder="Required for ledger" required />
          </div>
        </div>

        <div className="form-group mb-md">
          <label className="form-label">Purchase Items</label>
          <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table className="data-table" style={{ minWidth: '600px' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1 }}>
                <tr>
                  <th style={{ width: '40px' }}>S.No</th>
                  <th>Stock Name</th>
                  <th style={{ width: '100px' }}>Quantity</th>
                  <th style={{ width: '60px' }}>Unit</th>
                  <th style={{ width: '120px' }}>Price/Unit</th>
                  <th style={{ width: '120px' }}>Total Price</th>
                </tr>
              </thead>
              <tbody>
                {purchaseForm.items.map((item, index) => {
                  const updateItem = (field, value) => {
                    const newItems = [...purchaseForm.items];
                    newItems[index][field] = value;
                    
                    if (field === 'quantity' || field === 'price_per_unit') {
                      const qty = parseFloat(newItems[index].quantity || 0);
                      const price = parseFloat(newItems[index].price_per_unit || 0);
                      newItems[index].total_price = (qty * price).toFixed(2);
                    }
                    
                    // Auto-add row if last row is filled
                    if (index === newItems.length - 1 && newItems[index].stock_item_id && newItems[index].quantity && newItems[index].price_per_unit) {
                      newItems.push({ stock_item_id: '', quantity: '', price_per_unit: '', total_price: '' });
                    }
                    
                    setPurchaseForm({ ...purchaseForm, items: newItems });
                  };

                  return (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>
                        <select className="form-select w-full" style={{ padding: '4px' }} value={item.stock_item_id} onChange={e => updateItem('stock_item_id', e.target.value)}>
                          <option value="">-- Choose Item --</option>
                          {stock.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <input type="number" step="0.01" className="form-input w-full" style={{ padding: '4px' }} value={item.quantity} onChange={e => updateItem('quantity', e.target.value)} min="0" />
                      </td>
                      <td className="text-center text-secondary">
                        {item.stock_item_id ? stock.find(s => s.id == item.stock_item_id)?.unit : '-'}
                      </td>
                      <td>
                        <input type="number" step="0.01" className="form-input w-full" style={{ padding: '4px' }} value={item.price_per_unit} onChange={e => updateItem('price_per_unit', e.target.value)} min="0" />
                      </td>
                      <td>
                        <input type="number" step="0.01" className="form-input w-full" style={{ padding: '4px', backgroundColor: 'var(--bg-secondary)', border: 'none' }} value={item.total_price} readOnly />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Notes (Optional)</label>
          <input type="text" className="form-input" value={purchaseForm.notes} onChange={e => setPurchaseForm({...purchaseForm, notes: e.target.value})} placeholder="Any extra remarks..." />
        </div>
      </Modal>

      {/* History / Detail Modal */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={historyItem ? `Stock Details — ${historyItem.name}` : 'Stock Details'}
        footer={<button className="btn btn-secondary" onClick={() => setHistoryModalOpen(false)}>Close</button>}
      >
        <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          {/* Stock Item Summary */}
          {historyStockItem && (
            <div className="flex gap-lg mb-lg p-md bg-secondary" style={{ borderRadius: 'var(--radius)' }}>
              <div style={{ flex: 1 }}>
                <div className="text-secondary" style={{ fontSize: 12 }}>Current Quantity</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: parseFloat(historyStockItem.quantity) <= parseFloat(historyStockItem.low_threshold) ? 'var(--danger)' : 'var(--success)' }}>
                  {parseFloat(historyStockItem.quantity).toFixed(2)} {historyStockItem.unit}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="text-secondary" style={{ fontSize: 12 }}>Low Threshold</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{parseFloat(historyStockItem.low_threshold).toFixed(2)} {historyStockItem.unit}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="text-secondary" style={{ fontSize: 12 }}>Vendor</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{historyStockItem.vendor_name || 'N/A'}</div>
              </div>
            </div>
          )}

          {/* Linked Menu Items */}
          {historyLinks.length > 0 && (
            <div className="mb-lg">
              <h4 className="mb-sm">Linked Menu Items</h4>
              <div className="flex flex-wrap gap-sm">
                {historyLinks.map((link, i) => (
                  <div key={i} className="badge badge-info" style={{ padding: '6px 12px', fontSize: 13 }}>
                    {link.menu_item_name} — consumes {link.quantity_consumed} {historyStockItem?.unit || 'units'}/order
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transaction History */}
          <h4 className="mb-sm">Transaction History</h4>
          {itemHistory.length === 0 ? (
            <div className="text-center text-secondary p-xl">No transactions recorded for this item.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {itemHistory.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(tx.created_at).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${tx.transaction_type === 'purchase' ? 'badge-success' : tx.transaction_type === 'consume' ? 'badge-warning' : tx.transaction_type === 'return' ? 'badge-info' : 'badge-danger'}`}>
                        {tx.transaction_type.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {tx.transaction_type === 'purchase' || tx.transaction_type === 'return' ? '+' : '-'}{tx.quantity}
                    </td>
                    <td>
                      {tx.order ? (
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            {tx.order.order_type === 'counter' ? tx.order.order_name : `Table ${tx.order.table_number}`}
                          </div>
                          <div className="text-secondary" style={{ fontSize: 12 }}>
                            Order #{tx.order.id} • {tx.order.status.replace('_', ' ').toUpperCase()}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-secondary">{tx.notes || '-'}</div>
                          {tx.vendor_name && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Vendor: {tx.vendor_name}</div>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>
    </div>
  );
}
