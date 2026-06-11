import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { socket, subscribeToEvent, unsubscribeFromEvent } from '../api/socket';
import useSpeech from '../hooks/useSpeech';
import ThemeToggle from '../components/ThemeToggle';
import Modal from '../components/Modal';
import { Clock, CheckCircle, List, Bell, LogOut, Volume2, PackagePlus, LogIn, LogOut as LogOutIcon, MessageSquare } from 'lucide-react';
import { api } from '../api/client';
import { checkStationMatch } from '../utils/helpers';

import PendingOrders from './PendingOrders';
import AcceptedOrders from './AcceptedOrders';
import MenuList from './MenuList';
import TableWiseOrders from './TableWiseOrders';
import ChatInterface from '../components/ChatInterface';
import KitchenStock from './KitchenStock';

export default function KitchenPortal() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const { speak } = useSpeech();
  const [activeTab, setActiveTab] = useState('pending');
  const [counts, setCounts] = useState({ pending: 0, accepted: 0 });

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ item_name: '', quantity: '', notes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    socket.connect();
    socket.emit('join', { room: 'kitchen' });

    const handleNewOrder = (data) => {
      let itemsToSpeak = data.items || [];
      if (user?.station_id) {
        // If assigned to a station, only speak items for this station or items with no specific station
        itemsToSpeak = itemsToSpeak.filter(i => checkStationMatch(i.station_ids, user.station_id));
      }

      if (itemsToSpeak.length > 0) {
        showToast('New order received!', 'info');
        const tableStr = data.table_number || 'Unknown';
        const itemsStr = itemsToSpeak.map(i => `${i.quantity} ${i.item_name}${i.notes ? ` with note: ${i.notes}` : ''}`).join(', ');
        speak(`New order from Table ${tableStr}. ${itemsStr}`);
      }
    };

    const handleMessage = (msg) => {
      if (msg.target_stations && msg.target_stations.length > 0) {
        // If station_id is not set or not in target_stations, ignore
        if (!user?.station_id || !msg.target_stations.includes(user.station_id)) {
          return;
        }
      }
      showToast(`From ${msg.sender_role}: ${msg.content || 'Voice message'}`, 'info');
      
      if (msg.audio_data) {
        const audio = new Audio(msg.audio_data);
        audio.play().catch(e => console.error("Audio play failed:", e));
      } else if (msg.content) {
        speak(`Announcement from ${msg.sender_role}. ${msg.content}`);
      }
    };

    const handleItemStatus = (updatedItem) => {
      if (updatedItem.status === 'rejected' || updatedItem.status === 'cancelled') {
        const stationMatch = checkStationMatch(updatedItem.station_ids, user?.station_id);
        if (stationMatch) {
          showToast(`Item cancelled: ${updatedItem.item_name}`, 'warning');
          speak(`Attention! The item ${updatedItem.item_name} has been cancelled.`);
        }
      }
    };

    const handleOrderHold = (data) => {
      showToast(`Order for Table ${data.table_number || 'Unknown'} is ON HOLD!`, 'warning');
      speak(`Attention! Order for Table ${data.table_number || 'Unknown'} has been put on hold.`);
    };

    const handleOrderUnhold = (data) => {
      showToast(`Order for Table ${data.table_number || 'Unknown'} has been UNHELD.`, 'success');
      speak(`Order for Table ${data.table_number || 'Unknown'} is no longer on hold.`);
    };

    subscribeToEvent('order:new', handleNewOrder);
    subscribeToEvent('admin:message', handleMessage);
    subscribeToEvent('order:item-status', handleItemStatus);
    subscribeToEvent('order:hold', handleOrderHold);
    subscribeToEvent('order:unhold', handleOrderUnhold);

    return () => {
      unsubscribeFromEvent('order:new', handleNewOrder);
      unsubscribeFromEvent('admin:message', handleMessage);
      unsubscribeFromEvent('order:item-status', handleItemStatus);
      unsubscribeFromEvent('order:hold', handleOrderHold);
      unsubscribeFromEvent('order:unhold', handleOrderUnhold);
    };
  }, [user]);

  return (
    <div className="kitchen-layout">
      {/* Header */}
      <div className="kitchen-header">
        <div className="flex align-center gap-md" onClick={() => setActiveTab('pending')} style={{ cursor: 'pointer' }}>
          <h2 style={{ fontFamily: 'Outfit', margin: 0, color: 'var(--warning)' }}>{user?.name || 'Kitchen'}</h2>
          {user?.station_id && <span className="badge badge-warning">Station Assigned</span>}
        </div>
        <div className="flex align-center gap-md">
          <button className="btn btn-primary flex align-center gap-sm btn-sm" onClick={() => setIsRequestModalOpen(true)}>
            <PackagePlus size={16} /> Request Stock
          </button>
          <button className="btn btn-icon btn-secondary" onClick={() => speak('Audio notifications enabled.')} title="Enable Audio">
            <Volume2 size={18} />
          </button>
          <div className="btn-icon bg-secondary" style={{ position: 'relative' }}>
            <Bell size={18} />
            <span className="tab-badge" style={{ right: -4, top: -4 }}>{counts.pending}</span>
          </div>
          <ThemeToggle />
          <button className="btn btn-icon btn-secondary" onClick={logout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Top Tabs */}
      <div className="bg-card" style={{ padding: '12px 0', borderBottom: '1px solid var(--glass-border)' }}>
        <div className="tab-bar" style={{ maxWidth: '100%', margin: '0 16px' }}>
          <div 
            className={`tab-item flex-1 justify-center ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            <Clock size={18} /> Pending Orders
          </div>
          <div 
            className={`tab-item flex-1 justify-center ${activeTab === 'accepted' ? 'active' : ''}`}
            onClick={() => setActiveTab('accepted')}
          >
            <CheckCircle size={18} /> Preparing
          </div>
          <div 
            className={`tab-item flex-1 justify-center ${activeTab === 'table-wise' ? 'active' : ''}`}
            onClick={() => setActiveTab('table-wise')}
          >
            <List size={18} /> Table Wise
          </div>
          <div 
            className={`tab-item flex-1 justify-center ${activeTab === 'menu' ? 'active' : ''}`}
            onClick={() => setActiveTab('menu')}
          >
            <List size={18} /> Menu
          </div>
          <div 
            className={`tab-item flex-1 justify-center ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={18} /> Chat
          </div>
          <div 
            className={`tab-item flex-1 justify-center ${activeTab === 'stock' ? 'active' : ''}`}
            onClick={() => setActiveTab('stock')}
          >
            <PackagePlus size={18} /> Stock
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'pending' && <PendingOrders updateCounts={(c) => setCounts(prev => ({...prev, pending: c}))} />}
        {activeTab === 'accepted' && <AcceptedOrders updateCounts={(c) => setCounts(prev => ({...prev, accepted: c}))} />}
        {activeTab === 'table-wise' && <TableWiseOrders />}
        {activeTab === 'menu' && <MenuList />}
        {activeTab === 'chat' && <ChatInterface fullHeight={false} />}
        {activeTab === 'stock' && <KitchenStock />}
      </div>

      <Modal isOpen={isRequestModalOpen} onClose={() => setIsRequestModalOpen(false)} title="Request Stock from Admin">
        <form onSubmit={async (e) => {
          e.preventDefault();
          try {
            setIsSubmitting(true);
            await api.post('/stock-requests', {
              ...requestForm,
              requested_by: user?.name || 'Kitchen Staff'
            });
            showToast('Stock request sent to Admin', 'success');
            setIsRequestModalOpen(false);
            setRequestForm({ item_name: '', quantity: '', notes: '' });
          } catch (err) {
            showToast('Failed to send request', 'error');
          } finally {
            setIsSubmitting(false);
          }
        }} className="flex-col gap-md">
          <div className="form-group">
            <label className="form-label">Item Name</label>
            <input type="text" className="form-input" required value={requestForm.item_name} onChange={e => setRequestForm({...requestForm, item_name: e.target.value})} placeholder="e.g. Tomatoes" />
          </div>
          <div className="form-group">
            <label className="form-label">Quantity</label>
            <input type="text" className="form-input" required value={requestForm.quantity} onChange={e => setRequestForm({...requestForm, quantity: e.target.value})} placeholder="e.g. 5 kg" />
          </div>
          <div className="form-group">
            <label className="form-label">Notes (Optional)</label>
            <textarea className="form-input" value={requestForm.notes} onChange={e => setRequestForm({...requestForm, notes: e.target.value})} placeholder="Any specific requirements..."></textarea>
          </div>
          <div className="flex gap-md justify-end mt-md">
            <button type="button" className="btn btn-secondary" onClick={() => setIsRequestModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Sending...' : 'Send Request'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
