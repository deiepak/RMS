import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Edit2,
  Trash2,
  QrCode,
  Download,
  X,
  Users,
  Grid3X3,
  ArrowRightLeft,
  Banknote,
  RefreshCw,
  Search,
  Merge,
  Printer,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { subscribeToEvent, unsubscribeFromEvent } from '../api/socket';
import { useToast } from '../contexts/ToastContext';
import { formatCurrency, formatTime, formatDateTime } from '../utils/helpers';
import '../index.css';

const emptyForm = { number: '', capacity: 4, section: 'Main Hall' };

export default function TableManagement() {
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftFromTable, setShiftFromTable] = useState(null);
  const [shiftToTableId, setShiftToTableId] = useState('');
  
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSourceTable, setMergeSourceTable] = useState(null);
  const [mergeTargetTableId, setMergeTargetTableId] = useState('');

  const [editTable, setEditTable] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [qrTable, setQrTable] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  
  const [viewOrderTable, setViewOrderTable] = useState(null);
  const [viewOrderDetails, setViewOrderDetails] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  
  const [activeOrders, setActiveOrders] = useState({});
  const [tooltipState, setTooltipState] = useState({ visible: false, tableId: null, x: 0, y: 0, align: 'bottom' });

  const { showToast } = useToast();
  const qrRef = useRef(null);

  const [sections, setSections] = useState(['Main Hall', 'Patio', 'VIP', 'Rooftop', 'Garden', 'Bar']);
  const [showSectionsModal, setShowSectionsModal] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [savingSections, setSavingSections] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      if (res.data.table_sections) {
        setSections(JSON.parse(res.data.table_sections));
      }
    } catch (err) {
      console.error('Failed to load settings', err);
    }
  };

  const handleSaveSections = async (updatedSections) => {
    setSavingSections(true);
    try {
      await api.put('/settings', { table_sections: JSON.stringify(updatedSections) });
      setSections(updatedSections);
      showToast('Categories updated successfully', 'success');
    } catch (err) {
      showToast('Failed to update categories', 'error');
    } finally {
      setSavingSections(false);
    }
  };

  const addSection = () => {
    const s = newSectionName.trim();
    if (!s) return;
    if (sections.map(x => x.toLowerCase()).includes(s.toLowerCase())) {
      showToast('Category already exists', 'error');
      return;
    }
    const newSections = [...sections, s];
    handleSaveSections(newSections);
    setNewSectionName('');
  };

  const removeSection = (sec) => {
    const isUsed = tables.some(t => t.section === sec);
    const msg = isUsed 
      ? `STRICT WARNING: The category "${sec}" is currently assigned to one or more tables.\n\nIf you delete it, those tables might behave unexpectedly or become uncategorized until you reassign them.\n\nAre you absolutely sure you want to permanently delete this category?`
      : `Are you sure you want to delete the category "${sec}"?`;

    if (!window.confirm(msg)) return;
    const newSections = sections.filter(s => s !== sec);
    handleSaveSections(newSections);
  };

  const fetchTables = async () => {
    setLoading(true);
    try {
      const [res, ordersRes] = await Promise.all([
        api.get('/tables'),
        api.get('/orders?status=active,checkout_requested,payment_ready,hold')
      ]);
      setTables(res.data?.data || res.data || []);
      
      const ordersMap = {};
      ordersRes.data.forEach(order => {
        if (order.table_id) {
          ordersMap[order.table_id] = order;
        }
      });
      setActiveOrders(ordersMap);
    } catch (err) {
      showToast('Failed to load tables', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
    fetchSettings();

    const handleUpdate = () => fetchTables();
    
    subscribeToEvent('order:new', handleUpdate);
    subscribeToEvent('order:item-status', handleUpdate);
    subscribeToEvent('order:payment-ready', handleUpdate);
    subscribeToEvent('order:payment-collected', handleUpdate);
    subscribeToEvent('table:updated', handleUpdate);
    subscribeToEvent('order:hold', handleUpdate);
    subscribeToEvent('order:unhold', handleUpdate);

    return () => {
      unsubscribeFromEvent('order:new', handleUpdate);
      unsubscribeFromEvent('order:item-status', handleUpdate);
      unsubscribeFromEvent('order:payment-ready', handleUpdate);
      unsubscribeFromEvent('order:payment-collected', handleUpdate);
      unsubscribeFromEvent('table:updated', handleUpdate);
      unsubscribeFromEvent('order:hold', handleUpdate);
      unsubscribeFromEvent('order:unhold', handleUpdate);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editTable) {
        await api.put(`/tables/${editTable.id}`, form);
        showToast('Table updated successfully', 'success');
      } else {
        await api.post('/tables', form);
        showToast('Table added successfully', 'success');
      }
      setShowAddModal(false);
      setEditTable(null);
      setForm({ ...emptyForm });
      fetchTables();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save table', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/tables/${deleteTarget.id}`);
      showToast('Table deleted', 'success');
      setDeleteTarget(null);
      fetchTables();
    } catch (err) {
      showToast('Failed to delete table', 'error');
    }
  };

  const handleRefreshQrToken = async (tableId) => {
    try {
      setSaving(true);
      const res = await api.patch(`/tables/${tableId}/refresh-token`);
      showToast('QR Token refreshed securely', 'success');
      // Update qrTable if open
      if (qrTable && qrTable.id === tableId) {
        setQrTable({ ...qrTable, qr_token: res.data.qr_token });
      }
      fetchTables();
    } catch (err) {
      showToast('Failed to refresh QR token', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (table) => {
    setForm({
      number: table.number,
      capacity: table.capacity,
      section: table.section || 'Main Hall',
    });
    setEditTable(table);
    setShowAddModal(true);
  };

  const openAdd = () => {
    setForm({ ...emptyForm, section: sections[0] || 'Main Hall' });
    setEditTable(null);
    setShowAddModal(true);
  };

  const openShift = (table) => {
    setShiftFromTable(table);
    setShiftToTableId('');
    setShowShiftModal(true);
  };

  const handleShiftSubmit = async (e) => {
    e.preventDefault();
    if (!shiftToTableId) return;
    setSaving(true);
    try {
      await api.post('/tables/shift', { from_table_id: shiftFromTable.id, to_table_id: parseInt(shiftToTableId) });
      showToast('Table shifted successfully', 'success');
      setShowShiftModal(false);
      setShiftFromTable(null);
      setShiftToTableId('');
      fetchTables();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to shift table', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openMerge = (table) => {
    setMergeSourceTable(table);
    setMergeTargetTableId('');
    setShowMergeModal(true);
  };

  const handleMergeSubmit = async (e) => {
    e.preventDefault();
    if (!mergeTargetTableId) return;
    try {
      setSaving(true);
      await api.post('/orders/merge-table', { source_table_id: mergeSourceTable.id, target_table_id: parseInt(mergeTargetTableId) });
      showToast('Table merged successfully', 'success');
      setShowMergeModal(false);
      setMergeSourceTable(null);
      setMergeTargetTableId('');
      fetchTables();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to merge table', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleViewOrder = async (table) => {
    if (table.status !== 'occupied') return;
    setViewOrderTable(table);
    setLoadingOrder(true);
    try {
      const res = await api.get(`/orders/table/${table.id}/active`);
      setViewOrderDetails(res.data);
    } catch (err) {
      showToast('Failed to load active order', 'error');
    } finally {
      setLoadingOrder(false);
    }
  };

  const handleQuickCheckout = async (e, table) => {
    e.stopPropagation();
    try {
      setSaving(true);
      const res = await api.get(`/orders/table/${table.id}/active`);
      const activeOrder = res.data;
      if (activeOrder && activeOrder.status !== 'checkout_requested') {
        await api.patch(`/orders/${activeOrder.id}/status`, { status: 'checkout_requested' });
      }
      navigate('/admin/payments', { state: { autoOpenOrderId: activeOrder.id } });
    } catch (err) {
      showToast('Failed to checkout table', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintBill = async (e, table) => {
    e.stopPropagation();
    try {
      setSaving(true);
      const res = await api.get(`/orders/table/${table.id}/active`);
      const activeOrder = res.data;
      if (activeOrder) {
        navigate('/admin/orders', { state: { autoPrintOrderId: activeOrder.id } });
      }
    } catch (err) {
      showToast('Failed to print bill', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to cancel this item?')) return;
    try {
      await api.patch(`/orders/items/${itemId}/status`, { 
        status: 'rejected', 
        reject_reason: 'Cancelled by Admin' 
      });
      showToast('Item cancelled successfully', 'success');
      // Refresh order details
      handleViewOrder(viewOrderTable);
    } catch (err) {
      showToast('Failed to cancel item', 'error');
    }
  };

  const handleHoldOrder = async (orderId, isHold) => {
    try {
      if (isHold) {
        await api.patch(`/orders/${orderId}/unhold`);
        showToast('Order resumed successfully', 'success');
      } else {
        await api.patch(`/orders/${orderId}/hold`);
        showToast('Order is on hold', 'warning');
      }
      handleViewOrder(viewOrderTable);
    } catch (err) {
      showToast('Failed to update order hold status', 'error');
    }
  };

  const downloadQR = () => {
    const svgEl = qrRef.current?.querySelector('svg');
    if (!svgEl) return;

    const canvas = document.createElement('canvas');
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2 + 60;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, img.width * 2, img.height * 2);

      // Add table number text
      ctx.fillStyle = '#1a1a2e';
      ctx.font = 'bold 28px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Table ${qrTable.number}`, canvas.width / 2, img.height * 2 + 40);

      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `table-${qrTable.number}-qr.png`;
      link.href = pngUrl;
      link.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'available': return 'status-available';
      case 'occupied': return 'status-occupied';
      case 'reserved': return 'status-reserved';
      default: return '';
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'available': return 'badge badge-success';
      case 'occupied': return 'badge badge-warning';
      case 'reserved': return 'badge badge-info';
      default: return 'badge';
    }
  };

  const getSectionHeaderStyle = (section) => {
    const s = (section || 'Main Hall').toLowerCase().trim();
    if (s.includes('picnic')) {
      return { 
        background: '#10b981', 
        borderBottom: '1px solid #059669', 
        color: '#ffffff',
        borderTopLeftRadius: 'calc(var(--radius) - 1px)',
        borderTopRightRadius: 'calc(var(--radius) - 1px)'
      };
    }
    if (s.includes('upstairs') || s.includes('up ')) {
      return { 
        background: '#8b5cf6', 
        borderBottom: '1px solid #7c3aed', 
        color: '#ffffff',
        borderTopLeftRadius: 'calc(var(--radius) - 1px)',
        borderTopRightRadius: 'calc(var(--radius) - 1px)'
      };
    }
    if (s.includes('main') || s.includes('hall')) {
      return { 
        background: '#2563eb', 
        borderBottom: '1px solid #1d4ed8', 
        color: '#ffffff',
        borderTopLeftRadius: 'calc(var(--radius) - 1px)',
        borderTopRightRadius: 'calc(var(--radius) - 1px)'
      };
    }
    if (s.includes('ground') || s.includes('downstairs')) {
      return { 
        background: '#ea580c', 
        borderBottom: '1px solid #c2410c', 
        color: '#ffffff',
        borderTopLeftRadius: 'calc(var(--radius) - 1px)',
        borderTopRightRadius: 'calc(var(--radius) - 1px)'
      };
    }
    if (s.includes('garden') || s.includes('outdoor')) {
      return { 
        background: '#ca8a04', 
        borderBottom: '1px solid #a16207', 
        color: '#ffffff',
        borderTopLeftRadius: 'calc(var(--radius) - 1px)',
        borderTopRightRadius: 'calc(var(--radius) - 1px)'
      };
    }
    if (s.includes('vip') || s.includes('lounge')) {
      return { 
        background: '#db2777', 
        borderBottom: '1px solid #be185d', 
        color: '#ffffff',
        borderTopLeftRadius: 'calc(var(--radius) - 1px)',
        borderTopRightRadius: 'calc(var(--radius) - 1px)'
      };
    }
    // Default fallback using Premium Slate Grey
    return { 
      background: '#475569', 
      borderBottom: '1px solid #334155', 
      color: '#ffffff',
      borderTopLeftRadius: 'calc(var(--radius) - 1px)',
      borderTopRightRadius: 'calc(var(--radius) - 1px)'
    };
  };

  return (
    <div className="table-mgmt-page">
      <style>
        {`
          @keyframes pulseRedGreen {
            0% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.8); border-color: var(--danger); }
            50% { box-shadow: 0 0 25px rgba(16, 185, 129, 0.9); border-color: var(--success); }
            100% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.8); border-color: var(--danger); }
          }
          .alert-pending {
            animation: pulseRedGreen 1.5s infinite;
            border-width: 2px !important;
          }
          @keyframes fullscreenPulseRedGreen {
            0% { box-shadow: inset 0 0 50px 20px rgba(239, 68, 68, 0.4); background-color: rgba(239, 68, 68, 0.05); }
            50% { box-shadow: inset 0 0 100px 40px rgba(16, 185, 129, 0.5); background-color: rgba(16, 185, 129, 0.05); }
            100% { box-shadow: inset 0 0 50px 20px rgba(239, 68, 68, 0.4); background-color: rgba(239, 68, 68, 0.05); }
          }
          .fullscreen-alert {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            pointer-events: none;
            z-index: 9999;
            animation: fullscreenPulseRedGreen 1.5s infinite;
          }
        `}
      </style>

      {Object.values(activeOrders).some(order => order?.items?.some(item => item.status === 'pending')) && (
        <div className="fullscreen-alert" />
      )}

      {/* Header */}
      <div className="page-actions" style={{ flexWrap: 'wrap', gap: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div className="page-info">
          <span className="result-count">{tables.length} tables</span>
        </div>
        <div className="flex gap-sm flex-wrap align-center" style={{ flex: 1, justifyContent: 'flex-end', minWidth: '300px' }}>
          <div className="input-with-icon" style={{ flex: 1, maxWidth: '300px' }}>
            <Search size={18} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search by number or capacity..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <label className="flex align-center gap-xs cursor-pointer" style={{ userSelect: 'none', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <input 
              type="checkbox" 
              checked={showActiveOnly}
              onChange={(e) => setShowActiveOnly(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Active Tables</span>
          </label>
          <button className="btn btn-secondary" onClick={() => setShowSectionsModal(true)} style={{ whiteSpace: 'nowrap' }}>
            Manage Categories
          </button>
          <button className="btn btn-primary" onClick={openAdd} style={{ whiteSpace: 'nowrap' }}>
            <Plus size={18} /> Add Table
          </button>
        </div>
      </div>

      {/* Tables Grid */}
      {loading ? (
        <div className="tables-grid">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="card table-card skeleton-card">
              <div className="skeleton-row" style={{ width: '60%', height: '2rem' }} />
              <div className="skeleton-row" style={{ width: '40%' }} />
              <div className="skeleton-row" style={{ width: '50%' }} />
            </div>
          ))}
        </div>
      ) : tables.length === 0 ? (
        <div className="card empty-state text-center" style={{ padding: '3rem' }}>
          <Grid3X3 size={48} style={{ opacity: 0.3 }} />
          <h3>No tables configured</h3>
          <p>Add your first table to get started.</p>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={18} /> Add Table
          </button>
        </div>
      ) : (
        <div className="tables-grid">
          {tables
            .filter(t => t.number?.toLowerCase().includes(searchQuery.toLowerCase()) || String(t.capacity).includes(searchQuery))
            .filter(t => {
              if (!showActiveOnly) return true;
              return !!activeOrders[t.id] || t.status === 'occupied' || t.status === 'reserved';
            })
            .map((table) => {
              const hasActiveOrder = !!activeOrders[table.id];
              const displayStatus = hasActiveOrder ? 'occupied' : (table.status || 'available');
              const hasPending = activeOrders[table.id]?.items?.some(item => item.status === 'pending');
              
              return (
            <div 
              key={table.id} 
              className={`card table-card ${getStatusClass(displayStatus)} ${hasPending ? 'alert-pending' : ''}`}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                const align = spaceBelow < 250 ? 'top' : 'bottom';
                setTooltipState({
                  visible: true,
                  tableId: table.id,
                  x: rect.left + rect.width / 2,
                  y: align === 'top' ? rect.top - 8 : rect.bottom + 8,
                  align
                });
              }}
              onMouseLeave={() => setTooltipState({ visible: false, tableId: null, x: 0, y: 0, align: 'bottom' })}
              onClick={(e) => {
                // Ignore if clicked on an action button
                if (e.target.closest('.table-card-actions') || e.target.closest('.table-card-admin-actions')) return;
                if (hasActiveOrder) handleViewOrder(table);
              }}
              style={{ 
                cursor: displayStatus === 'occupied' ? 'pointer' : 'default', 
                position: 'relative'
              }}
            >
              <div className="table-card-header" style={getSectionHeaderStyle(table.section)}>
                <span className="table-number">{table.number}</span>
                <span className={getStatusBadge(displayStatus)}>
                  {displayStatus}
                </span>
              </div>
              <div className="table-card-body">
                <div className="table-detail">
                  <Users size={14} />
                  <span>{table.capacity} seats</span>
                </div>
                <div className="table-detail">
                  <Grid3X3 size={14} />
                  <span>{table.section || 'Main Hall'}</span>
                </div>
              </div>
              <div className="table-card-admin-actions p-sm flex gap-sm" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', borderRadius: '0 0 var(--radius) var(--radius)' }}>
                <button 
                  className="btn btn-primary btn-sm flex-1" 
                  onClick={(e) => { e.stopPropagation(); navigate('/admin/counter', { state: { autoOpenTableId: table.id } }) }}
                >
                  Order by Admin
                </button>
                {displayStatus === 'occupied' && (
                  <button 
                    className="btn btn-success btn-sm flex-1" 
                    onClick={(e) => handleQuickCheckout(e, table)}
                  >
                    Proceed to Payment
                  </button>
                )}
              </div>
              <div className="table-card-actions">
                {displayStatus === 'occupied' && (
                  <>
                    <button
                      className="btn btn-icon btn-sm btn-info"
                      onClick={(e) => handlePrintBill(e, table)}
                      title="Print Bill"
                      disabled={saving}
                    >
                      <Printer size={16} />
                    </button>
                    <button
                      className="btn btn-icon btn-sm btn-primary"
                      onClick={() => openShift(table)}
                      title="Shift Table"
                    >
                      <ArrowRightLeft size={16} />
                    </button>
                    <button
                      className="btn btn-icon btn-sm btn-secondary"
                      onClick={() => openMerge(table)}
                      title="Merge Table"
                    >
                      <Merge size={16} />
                    </button>
                  </>
                )}
                <button
                  className="btn btn-icon btn-sm"
                  onClick={() => setQrTable(table)}
                  title="Generate QR"
                >
                  <QrCode size={16} />
                </button>
                <button
                  className="btn btn-icon btn-sm"
                  onClick={() => openEdit(table)}
                  title="Edit"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  className="btn btn-icon btn-sm btn-danger"
                  onClick={() => setDeleteTarget(table)}
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => { setShowAddModal(false); setEditTable(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editTable ? 'Edit Table' : 'Add New Table'}</h2>
              <button className="btn btn-icon" onClick={() => { setShowAddModal(false); setEditTable(null); }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Table Number</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.number}
                    onChange={(e) => setForm({ ...form, number: e.target.value })}
                    required
                    min="1"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Capacity (Seats)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 1 })}
                    required
                    min="1"
                    max="20"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Section</label>
                  <select
                    className="form-select"
                    value={form.section}
                    onChange={(e) => setForm({ ...form, section: e.target.value })}
                  >
                    {SECTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowAddModal(false); setEditTable(null); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editTable ? 'Update Table' : 'Add Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shift Table Modal */}
      {showShiftModal && shiftFromTable && (
        <div className="modal-overlay" onClick={() => setShowShiftModal(false)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Shift {shiftFromTable.number}</h2>
              <button className="btn btn-icon" onClick={() => setShowShiftModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleShiftSubmit}>
              <div className="modal-body">
                <p style={{ marginBottom: '16px' }}>Move the current order from {shiftFromTable.number} to a new available table.</p>
                <div className="form-group">
                  <label className="form-label">Select Destination Table</label>
                  <select 
                    className="form-select" 
                    value={shiftToTableId} 
                    onChange={(e) => setShiftToTableId(e.target.value)}
                    required
                  >
                    <option value="" disabled>-- Select a table --</option>
                    {tables.filter(t => t.status === 'available' || t.status === null).map(t => (
                      <option key={t.id} value={t.id}>{t.number} ({t.capacity} seats, {t.section})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowShiftModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving || !shiftToTableId}>
                  {saving ? 'Shifting...' : 'Shift Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Merge Table Modal */}
      {showMergeModal && mergeSourceTable && (
        <div className="modal-overlay" onClick={() => setShowMergeModal(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Merge {mergeSourceTable.number}</h2>
              <button className="btn btn-icon" onClick={() => setShowMergeModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleMergeSubmit}>
              <div className="modal-body">
                <p style={{ marginBottom: '16px' }}>Move all items from {mergeSourceTable.number} to another table.</p>
                <div className="form-group">
                  <label>Target Table *</label>
                  <select 
                    className="input" 
                    required 
                    value={mergeTargetTableId} 
                    onChange={(e) => setMergeTargetTableId(e.target.value)}
                  >
                    <option value="">-- Select Target Table --</option>
                    {tables
                      .filter(t => t.id !== mergeSourceTable.id)
                      .map(t => (
                        <option key={t.id} value={t.id}>
                          {t.number} ({t.section || 'Main Hall'}) - {t.status}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer flex gap-sm justify-end">
                <button type="button" className="btn btn-secondary" onClick={() => setShowMergeModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving || !mergeTargetTableId}>
                  {saving ? 'Merging...' : 'Merge Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Table</h2>
              <button className="btn btn-icon" onClick={() => setDeleteTarget(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{deleteTarget.number}</strong>? This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrTable && (
        <div className="modal-overlay" onClick={() => setQrTable(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>QR Code — {qrTable.number}</h2>
              <button className="btn btn-icon" onClick={() => setQrTable(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body text-center" ref={qrRef}>
              <QRCodeSVG
                value={`${window.location.origin}/customer?token=${qrTable.qr_token}`}
                size={220}
                level="H"
                includeMargin
                bgColor="#ffffff"
                fgColor="#1a1a2e"
              />
              <p style={{ marginTop: '0.5rem', fontWeight: 600, fontSize: '1.1rem' }}>
                {qrTable.number}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Scan to order securely from this table
              </p>
              <button 
                className="btn btn-sm" 
                style={{ marginTop: '1rem', width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}
                onClick={() => handleRefreshQrToken(qrTable.id)}
                disabled={saving}
              >
                <RefreshCw size={14} /> Regenerate QR Token
              </button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setQrTable(null)}>Close</button>
              <button className="btn btn-primary" onClick={downloadQR}>
                <Download size={16} /> Download PNG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Order Modal */}
      {viewOrderTable && (
        <div className="modal-overlay" onClick={() => setViewOrderTable(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>{viewOrderTable.number} - Active Order</h2>
              <button className="btn btn-icon" onClick={() => setViewOrderTable(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {loadingOrder ? (
                <div className="text-center text-secondary" style={{ padding: 40 }}>Loading order details...</div>
              ) : viewOrderDetails ? (
                <div>
                  <div className="flex justify-between mb-md text-secondary" style={{ fontSize: 13, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                    <span>Order #{viewOrderDetails.id}</span>
                    <span className="badge badge-info">{viewOrderDetails.status.replace('_', ' ').toUpperCase()}</span>
                  </div>
                  <div className="flex-col gap-sm">
                    {viewOrderDetails.items?.map(item => (
                      <div key={item.id} className="flex justify-between align-center p-sm bg-secondary" style={{ borderRadius: 'var(--radius-sm)', padding: '8px 12px', opacity: item.status === 'rejected' || item.status === 'cancelled' ? 0.6 : 1 }}>
                        <div style={{ textDecoration: item.status === 'rejected' || item.status === 'cancelled' ? 'line-through' : 'none' }}>
                          <span style={{ fontWeight: 600 }}>{item.quantity}x {item.item_name}</span>
                          {item.created_at && (
                            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                              {formatTime(item.created_at)}
                            </span>
                          )}
                          {item.notes && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Note: {item.notes}</div>}
                        </div>
                        <div className="flex align-center gap-sm">
                          <span className="badge" style={{ fontSize: 10 }}>{item.status === 'rejected' ? 'CANCELLED' : item.status.toUpperCase()}</span>
                          {item.status !== 'rejected' && item.status !== 'cancelled' && item.status !== 'served' && item.status !== 'delivered' && (
                            <button 
                              className="btn btn-icon btn-sm btn-danger" 
                              onClick={() => handleCancelItem(item.id)}
                              title="Cancel Item"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {(!viewOrderDetails.items || viewOrderDetails.items.length === 0) && (
                      <div className="text-center text-secondary" style={{ padding: 20 }}>No items found.</div>
                    )}
                  </div>
                  <div className="flex justify-between mt-md pt-md" style={{ borderTop: '1px solid var(--border)', fontWeight: 'bold', fontSize: 16 }}>
                    <span>Total</span>
                    <span style={{ color: 'var(--success)' }}>रू {viewOrderDetails.total}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center text-secondary" style={{ padding: 40 }}>No active order found for this table.</div>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {viewOrderDetails && viewOrderDetails.status !== 'completed' && (
                <>
                  <button 
                    className={`btn ${viewOrderDetails.status === 'hold' ? 'btn-success' : 'btn-warning'} flex-1`}
                    style={{ fontSize: '1rem', padding: '12px', minWidth: '140px' }} 
                    onClick={() => handleHoldOrder(viewOrderDetails.id, viewOrderDetails.status === 'hold')}
                  >
                    {viewOrderDetails.status === 'hold' ? 'Unhold Order' : 'Hold Order'}
                  </button>
                  <button 
                    className="btn btn-info flex-1" 
                    style={{ fontSize: '1rem', padding: '12px', background: 'var(--info)', minWidth: '140px' }} 
                    onClick={(e) => { e.stopPropagation(); navigate('/admin/counter', { state: { autoOpenTableId: viewOrderTable.id } }); }}
                  >
                    Order by Admin
                  </button>
                  <button 
                    className="btn btn-primary flex-1" 
                    style={{ fontSize: '1rem', padding: '12px', minWidth: '140px' }} 
                    onClick={(e) => { e.stopPropagation(); navigate('/admin/orders', { state: { autoPrintOrderId: viewOrderDetails.id } }); }}
                  >
                    Print Bill
                  </button>
                  <button 
                    className="btn btn-success flex-1" 
                    style={{ fontSize: '1rem', padding: '12px', minWidth: '140px' }} 
                    onClick={async () => {
                      if (viewOrderDetails.status !== 'checkout_requested') {
                        await api.patch(`/orders/${viewOrderDetails.id}/status`, { status: 'checkout_requested' });
                      }
                      navigate('/admin/payments', { state: { autoOpenOrderId: viewOrderDetails.id } });
                    }}
                  >
                    Proceed to Payment
                  </button>
                </>
              )}
              <button className="btn btn-secondary" style={{ flex: '1 1 100%', padding: '12px', fontSize: '1rem' }} onClick={() => setViewOrderTable(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Global Tooltip Portal */}
      {tooltipState.visible && activeOrders[tooltipState.tableId] && createPortal(
        <div 
          className="card"
          style={{ 
            position: 'fixed', 
            top: tooltipState.y,
            left: tooltipState.x, 
            transform: `translate(-50%, ${tooltipState.align === 'top' ? '-100%' : '0'})`, 
            zIndex: 999999, 
            minWidth: '220px', 
            background: 'var(--bg-elevated)', 
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            padding: '12px',
            borderRadius: '12px',
            pointerEvents: 'none'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '8px', color: 'var(--accent-primary)' }}>
            <span>Order #{activeOrders[tooltipState.tableId].id}</span>
            <span>{formatCurrency(activeOrders[tooltipState.tableId].total)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {activeOrders[tooltipState.tableId].items?.map((item, idx) => (
              <div key={idx} style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between', color: item.status === 'rejected' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: item.status === 'rejected' ? 'line-through' : 'none' }}>
                <span>{item.quantity}x {item.item_name}</span>
                <span style={{ opacity: 0.7, fontSize: '11px', textTransform: 'capitalize' }}>{item.status}</span>
              </div>
            ))}
            {(!activeOrders[tooltipState.tableId].items || activeOrders[tooltipState.tableId].items.length === 0) && (
              <div className="text-muted" style={{ fontSize: '12px' }}>No items yet</div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Sections Modal */}
      {showSectionsModal && (
        <div className="modal-overlay" onClick={() => setShowSectionsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header" style={{ alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0' }}>Manage Categories</h2>
                <p className="text-secondary" style={{ fontSize: '13px', margin: 0 }}>Create or remove sections to organize your tables.</p>
              </div>
              <button className="btn btn-icon" onClick={() => setShowSectionsModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body flex-col gap-md">
              <div className="flex gap-sm align-center">
                <input 
                  type="text" 
                  className="form-input flex-1" 
                  placeholder="New Category Name (e.g. Balcony)" 
                  value={newSectionName} 
                  onChange={e => setNewSectionName(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && addSection()}
                  style={{ padding: '12px 16px', fontSize: '15px' }}
                />
                <button 
                  className="btn btn-primary" 
                  onClick={addSection} 
                  disabled={savingSections}
                  style={{ padding: '12px 24px', fontSize: '15px', fontWeight: 600 }}
                >
                  Add
                </button>
              </div>
              
              <div style={{ marginTop: '16px' }}>
                <h4 className="text-secondary mb-sm" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                  Current Categories
                </h4>
                <div className="flex-col gap-sm">
                  {sections.length === 0 && (
                    <div className="text-secondary text-sm p-md text-center bg-secondary" style={{ borderRadius: 'var(--radius)' }}>
                      No custom categories.
                    </div>
                  )}
                  {sections.map(sec => (
                    <div 
                      key={sec} 
                      className="flex justify-between align-center p-md" 
                      style={{ 
                        borderRadius: '10px', 
                        background: 'var(--bg-elevated)', 
                        border: '1px solid var(--border)' 
                      }}
                    >
                      <span style={{ fontWeight: 500, fontSize: '15px', color: 'var(--text-primary)' }}>{sec}</span>
                      <button 
                        className="btn btn-icon btn-sm" 
                        style={{ color: 'var(--danger)', background: 'rgba(255, 59, 48, 0.1)' }}
                        onClick={() => removeSection(sec)} 
                        disabled={savingSections}
                        title="Delete Category"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
