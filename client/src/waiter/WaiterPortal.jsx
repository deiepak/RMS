import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { socket, subscribeToEvent, unsubscribeFromEvent } from '../api/socket';
import useSpeech from '../hooks/useSpeech';
import ThemeToggle from '../components/ThemeToggle';
import { UtensilsCrossed, CreditCard, Bell, LogOut, Volume2, LogIn, LogOut as LogOutIcon, MessageSquare, ShoppingBag } from 'lucide-react';
import { api } from '../api/client';

import PickupTab from './PickupTab';
import CheckoutTab from './CheckoutTab';
import AssistanceTab from './AssistanceTab';
import ChatInterface from '../components/ChatInterface';
import CounterOrders from '../components/CounterOrders';

export default function WaiterPortal() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const { speak } = useSpeech();
  const [activeTab, setActiveTab] = useState('pickup');
  const [counts, setCounts] = useState({ pickup: 0, checkout: 0, assistance: 0 });

  const [isClockedIn, setIsClockedIn] = useState(false);

  useEffect(() => {
    checkShiftStatus();
    socket.connect();
    socket.emit('join', { room: 'waiter' });

    const handlePickupReady = (data) => {
      showToast(`Order ready for Table ${data.table_number}!`, 'success');
      speak(`Table ${data.table_number} food is ready for pickup!`);
      // Child components auto-refresh
    };

    const handleCheckoutReq = (data) => {
      showToast(`Table ${data.table_number} requested checkout`, 'info');
      speak(`Table ${data.table_number} has requested checkout!`);
    };

    const handleAssistanceReq = (data) => {
      showToast(`Table ${data.table_number} needs assistance`, 'warning');
      speak(`Table ${data.table_number} needs assistance!`);
    };

    const handleMessage = (msg) => {
      if (msg.target_stations && msg.target_stations.length > 0) {
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

    subscribeToEvent('order:ready-for-pickup', handlePickupReady);
    subscribeToEvent('order:checkout-requested', handleCheckoutReq);
    subscribeToEvent('assistance:requested', handleAssistanceReq);
    subscribeToEvent('admin:message', handleMessage);

    return () => {
      unsubscribeFromEvent('order:ready-for-pickup', handlePickupReady);
      unsubscribeFromEvent('order:checkout-requested', handleCheckoutReq);
      unsubscribeFromEvent('assistance:requested', handleAssistanceReq);
      unsubscribeFromEvent('admin:message', handleMessage);
    };
  }, [user]);

  const checkShiftStatus = async () => {
    if (!user?.id) return;
    try {
      const res = await api.get(`/employees/${user.id}/hr-data`);
      const att = res.data.attendance;
      if (att && att.length > 0 && !att[0].clock_out) {
        setIsClockedIn(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClockIn = async () => {
    try {
      await api.post(`/employees/${user.id}/clock-in`);
      setIsClockedIn(true);
      showToast('Clocked in successfully', 'success');
    } catch (e) {
      showToast('Failed to clock in', 'error');
    }
  };

  const handleClockOut = async () => {
    try {
      await api.post(`/employees/${user.id}/clock-out`);
      setIsClockedIn(false);
      showToast('Clocked out successfully', 'success');
    } catch (e) {
      showToast(e.response?.data?.error || 'Failed to clock out', 'error');
    }
  };

  return (
    <div className="waiter-layout">
      {/* Header */}
      <div className="waiter-header">
        <div className="flex align-center gap-md" onClick={() => setActiveTab('pickup')} style={{ cursor: 'pointer' }}>
          <h2 style={{ fontFamily: 'Outfit', margin: 0, color: 'var(--info)' }}>{user?.name || 'Waiter'}</h2>
        </div>
        <div className="flex align-center gap-md">
          {!isClockedIn ? (
            <button className="btn btn-success flex align-center gap-sm btn-sm" onClick={handleClockIn}>
              <LogIn size={16} /> Clock In
            </button>
          ) : (
            <button className="btn btn-warning flex align-center gap-sm btn-sm" onClick={handleClockOut}>
              <LogOutIcon size={16} /> Clock Out
            </button>
          )}
          <button className="btn btn-icon btn-secondary" onClick={() => speak('Audio notifications enabled.')} title="Enable Audio">
            <Volume2 size={18} />
          </button>
          <ThemeToggle />
          <button className="btn btn-icon btn-secondary" onClick={logout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, paddingBottom: 100, display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'pickup' && <PickupTab updateCounts={(c) => setCounts(prev => ({...prev, pickup: c}))} />}
        {activeTab === 'checkout' && <CheckoutTab updateCounts={(c) => setCounts(prev => ({...prev, checkout: c}))} />}
        {activeTab === 'assistance' && <AssistanceTab updateCounts={(c) => setCounts(prev => ({...prev, assistance: c}))} />}
        {activeTab === 'counter' && <CounterOrders />}
        {activeTab === 'chat' && <ChatInterface fullHeight={false} />}
      </div>

      {/* Bottom Tabs */}
      <div className="bottom-tabs">
        <button 
          className="btn" 
          style={{ flex: 1, flexDirection: 'column', gap: 4, background: 'transparent', color: activeTab === 'pickup' ? 'var(--info)' : 'var(--text-secondary)', position: 'relative' }}
          onClick={() => setActiveTab('pickup')}
        >
          <UtensilsCrossed size={24} />
          <span style={{ fontSize: 12 }}>Pickup</span>
          {counts.pickup > 0 && <span className="tab-badge">{counts.pickup}</span>}
        </button>
        <button 
          className="btn" 
          style={{ flex: 1, flexDirection: 'column', gap: 4, background: 'transparent', color: activeTab === 'checkout' ? 'var(--info)' : 'var(--text-secondary)', position: 'relative' }}
          onClick={() => setActiveTab('checkout')}
        >
          <CreditCard size={24} />
          <span style={{ fontSize: 12 }}>Checkout</span>
          {counts.checkout > 0 && <span className="tab-badge">{counts.checkout}</span>}
        </button>
        <button 
          className="btn" 
          style={{ flex: 1, flexDirection: 'column', gap: 4, background: 'transparent', color: activeTab === 'assistance' ? 'var(--info)' : 'var(--text-secondary)', position: 'relative' }}
          onClick={() => setActiveTab('assistance')}
        >
          <Bell size={24} />
          <span style={{ fontSize: 12 }}>Assistance</span>
          {counts.assistance > 0 && <span className="tab-badge">{counts.assistance}</span>}
        </button>
        <button 
          className="btn" 
          style={{ flex: 1, flexDirection: 'column', gap: 4, background: 'transparent', color: activeTab === 'counter' ? 'var(--info)' : 'var(--text-secondary)', position: 'relative' }}
          onClick={() => setActiveTab('counter')}
        >
          <ShoppingBag size={24} />
          <span style={{ fontSize: 12 }}>Counter</span>
        </button>
        <button 
          className="btn" 
          style={{ flex: 1, flexDirection: 'column', gap: 4, background: 'transparent', color: activeTab === 'chat' ? 'var(--info)' : 'var(--text-secondary)', position: 'relative' }}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare size={24} />
          <span style={{ fontSize: 12 }}>Chat</span>
        </button>
      </div>
    </div>
  );
}
