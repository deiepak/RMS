import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { socket, subscribeToEvent, unsubscribeFromEvent } from '../api/socket';
import useSpeech from '../hooks/useSpeech';
import ThemeToggle from '../components/ThemeToggle';
import Modal from '../components/Modal';
import { Clock, CheckCircle, List, Bell, LogOut, Volume2, PackagePlus, LogIn, LogOut as LogOutIcon, MessageSquare, Zap } from 'lucide-react';
import { api } from '../api/client';
import { checkStationMatch } from '../utils/helpers';

import PendingOrders from './PendingOrders';
import AcceptedOrders from './AcceptedOrders';
import MenuList from './MenuList';
import TableWiseOrders from './TableWiseOrders';
import OptimizedOrders from './OptimizedOrders';
import ChatInterface from '../components/ChatInterface';
import KitchenStock from './KitchenStock';

export default function KitchenPortal() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const { speak } = useSpeech();
  const [activeTab, setActiveTab] = useState('pending');
  const [counts, setCounts] = useState({ pending: 0, accepted: 0 });
  const [audioEnabled, setAudioEnabled] = useState(false);

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestForm, setRequestForm] = useState([{ item_name: '', quantity: '', notes: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    socket.connect();
    socket.emit('join', { room: 'kitchen' });

    const handleNewOrder = (data) => {
      let itemsToSpeak = data.items || [];
      if (user?.station_id) {
        // If assigned to a station, only speak items for this station or items with no specific station
        itemsToSpeak = itemsToSpeak.filter(i => 
          checkStationMatch(i.station_ids, i.category_station_ids, user.station_id)
        );
      }

      if (itemsToSpeak.length > 0) {
        showToast('New order received!', 'info');
        
        // Only speak if not from a Waiter
        if (data.source !== 'waiter') {
          const tableStr = data.table_number || 'Unknown';
          const itemsStr = itemsToSpeak.map(i => `${i.quantity} ${i.item_name}${i.notes ? ` with note: ${i.notes}` : ''}`).join(', ');
          speak(`New order from Table ${tableStr}. ${itemsStr}`);
        }
      }
    };

    const handleMessage = (msg) => {
      if (msg.target_stations && msg.target_stations.length > 0) {
        if (!user?.station_id || !checkStationMatch(msg.target_stations, null, user.station_id)) {
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

    const handleVoiceChunk = (payload) => {
      if (payload.target_stations && payload.target_stations.length > 0) {
        if (!user?.station_id || !checkStationMatch(payload.target_stations, null, user.station_id)) return;
      }
      import('../utils/audioStreamer').then(({ playAudioChunk }) => {
        playAudioChunk(payload.streamId, payload.chunk, payload.isFirstChunk);
      });
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
    subscribeToEvent('chat:voice-chunk:receive', handleVoiceChunk);
    subscribeToEvent('order:item-status', handleItemStatus);
    subscribeToEvent('order:hold', handleOrderHold);
    subscribeToEvent('order:unhold', handleOrderUnhold);

    // 15-minute Order Reminder
    const reminderInterval = setInterval(async () => {
      try {
        const res = await api.get('/orders/items?status=pending,accepted');
        let pendingItems = res.data;
        if (user?.station_id) {
          pendingItems = pendingItems.filter(i => checkStationMatch(i.station_ids, i.category_station_ids, user.station_id));
        }
        if (pendingItems.length > 0) {
          speak(`Attention! You have ${pendingItems.length} items waiting to be prepared.`);
        }
      } catch (err) {
        console.error('Failed to fetch pending items for reminder', err);
      }
    }, 15 * 60 * 1000); // 15 minutes

    return () => {
      unsubscribeFromEvent('order:new', handleNewOrder);
      unsubscribeFromEvent('admin:message', handleMessage);
      unsubscribeFromEvent('chat:voice-chunk:receive', handleVoiceChunk);
      unsubscribeFromEvent('order:item-status', handleItemStatus);
      unsubscribeFromEvent('order:hold', handleOrderHold);
      unsubscribeFromEvent('order:unhold', handleOrderUnhold);
      clearInterval(reminderInterval);
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
          <button 
            className={`btn btn-icon ${audioEnabled ? 'btn-secondary' : 'btn-danger'}`} 
            onClick={() => {
              speak('Audio notifications enabled.');
              setAudioEnabled(true);
            }} 
            title="Enable Audio"
          >
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

      {!audioEnabled && (
        <div style={{ background: 'var(--danger)', color: '#fff', padding: '12px 16px', textAlign: 'center', cursor: 'pointer' }} onClick={() => {
          speak('Audio notifications enabled.');
          setAudioEnabled(true);
        }}>
          <h4 style={{ margin: 0 }}><Volume2 size={18} style={{ verticalAlign: 'middle', marginRight: 8 }}/> Click here to enable voice announcements for incoming orders!</h4>
        </div>
      )}

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
            className={`tab-item flex-1 justify-center ${activeTab === 'optimized' ? 'active' : ''}`}
            onClick={() => setActiveTab('optimized')}
          >
            <Zap size={18} /> Optimized
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
        {activeTab === 'optimized' && <OptimizedOrders />}
        {activeTab === 'menu' && <MenuList />}
        {activeTab === 'chat' && <ChatInterface fullHeight={false} />}
        {activeTab === 'stock' && <KitchenStock />}
      </div>

      <Modal isOpen={isRequestModalOpen} onClose={() => setIsRequestModalOpen(false)} title="Request Stock from Admin" maxWidth="800px">
        <form onSubmit={async (e) => {
          e.preventDefault();
          try {
            const validItems = requestForm.filter(i => i.item_name && i.quantity);
            if (validItems.length === 0) return showToast('Please add at least one item', 'error');

            setIsSubmitting(true);
            await api.post('/stock-requests', {
              items: validItems,
              requested_by: user?.name || 'Kitchen Staff'
            });
            showToast('Stock request sent to Admin', 'success');
            setIsRequestModalOpen(false);
            setRequestForm([{ item_name: '', quantity: '', notes: '' }]);
          } catch (err) {
            showToast('Failed to send request', 'error');
          } finally {
            setIsSubmitting(false);
          }
        }} className="flex-col gap-md">
          <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="data-table" style={{ minWidth: '600px' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-secondary)', zIndex: 1 }}>
                <tr>
                  <th style={{ width: '40px' }}>S.No</th>
                  <th>Item Name</th>
                  <th style={{ width: '150px' }}>Quantity</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {requestForm.map((item, index) => {
                  const updateItem = (field, value) => {
                    const newItems = [...requestForm];
                    newItems[index][field] = value;
                    if (index === newItems.length - 1 && newItems[index].item_name && newItems[index].quantity) {
                      newItems.push({ item_name: '', quantity: '', notes: '' });
                    }
                    setRequestForm(newItems);
                  };
                  return (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>
                        <input type="text" className="form-input w-full" style={{ padding: '4px' }} required={index === 0} value={item.item_name} onChange={e => updateItem('item_name', e.target.value)} placeholder="e.g. Tomatoes" />
                      </td>
                      <td>
                        <input type="text" className="form-input w-full" style={{ padding: '4px' }} required={index === 0 && !!item.item_name} value={item.quantity} onChange={e => updateItem('quantity', e.target.value)} placeholder="e.g. 5 kg" />
                      </td>
                      <td>
                        <input type="text" className="form-input w-full" style={{ padding: '4px' }} value={item.notes} onChange={e => updateItem('notes', e.target.value)} placeholder="Any specific requirements..." />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
