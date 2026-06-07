import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { UtensilsCrossed, Clock, Receipt, Headphones } from 'lucide-react';
import { api } from '../api/client';
import { socket, subscribeToEvent, unsubscribeFromEvent } from '../api/socket';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import ThemeToggle from '../components/ThemeToggle';
import Modal from '../components/Modal';

import MenuTab from './MenuTab';
import StatusTab from './StatusTab';
import BillTab from './BillTab';

export default function CustomerPortal() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tableNum = searchParams.get('table');
  const { showToast } = useToast();
  const { settings } = useSettings();

  const [customerName, setCustomerName] = useState(sessionStorage.getItem('customerName') || '');
  const [isNameModalOpen, setIsNameModalOpen] = useState(!customerName);
  const [nameInput, setNameInput] = useState('');
  const [activeTab, setActiveTab] = useState('menu');
  const [isCheckoutRequested, setIsCheckoutRequested] = useState(false);
  const [tableId, setTableId] = useState(null);
  
  // Cart state stored at portal level so it persists across tabs
  const [cart, setCart] = useState([]);

  useEffect(() => {
    if (!tableNum) {
      showToast('No table number specified in URL', 'error');
      // Redirect or show error
      return;
    }

    // Connect to socket room for this table
    const joinRoom = () => {
      socket.emit('join', { room: `table-${tableNum}` });
    };

    if (socket.connected) {
      joinRoom();
    } else {
      socket.connect();
    }
    socket.on('connect', joinRoom);

    api.get('/tables').then(res => {
      const table = res.data.find(t => String(t.number) === String(tableNum));
      if (table) {
        setTableId(table.id);
        checkActiveOrder(table.id);
      }
    });

    const handleCheckoutRequested = () => {
      setIsCheckoutRequested(true);
      showToast('Checkout requested', 'info');
    };
    
    const handlePaymentCollected = () => {
      showToast('Payment successful! Thank you.', 'success');
      sessionStorage.removeItem('customerName');
      setTimeout(() => window.location.reload(), 3000); // Reset for next customer
    };

    const handleTableShifted = (data) => {
      if (data.from_table_number === parseInt(tableNum)) {
        showToast(`Your table has been shifted to Table ${data.to_table_number}`, 'info');
        window.location.href = `?table=${data.to_table_number}`;
      }
    };

    subscribeToEvent('order:checkout-requested', handleCheckoutRequested);
    subscribeToEvent('order:payment-collected', handlePaymentCollected);
    subscribeToEvent('table:shifted', handleTableShifted);

    return () => {
      unsubscribeFromEvent('order:checkout-requested', handleCheckoutRequested);
      unsubscribeFromEvent('order:payment-collected', handlePaymentCollected);
      unsubscribeFromEvent('table:shifted', handleTableShifted);
      socket.off('connect', joinRoom);
    };
  }, [tableNum]);

  const checkActiveOrder = async (tId) => {
    try {
      const res = await api.get(`/orders/table/${tId}/active`);
      if (res.data && res.data.status === 'checkout_requested') {
        setIsCheckoutRequested(true);
      }
    } catch (error) {
      // No active order, that's fine
    }
  };

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (nameInput.trim()) {
      sessionStorage.setItem('customerName', nameInput.trim());
      setCustomerName(nameInput.trim());
      setIsNameModalOpen(false);
    }
  };

  const requestAssistance = async () => {
    if (!tableId || !customerName) return;
    try {
      await api.post('/assistance', { table_id: tableId, customer_name: customerName });
      showToast('Waiter notified', 'success');
    } catch (error) {
      showToast('Failed to notify waiter', 'error');
    }
  };

  if (!tableNum) {
    return <div className="customer-layout flex-center"><h1>Please scan the QR code on your table.</h1></div>;
  }

  return (
    <div className="customer-layout">
      {/* Header */}
      <div className="customer-header">
        <div className="flex align-center gap-md" onClick={() => setActiveTab('menu')} style={{ cursor: 'pointer' }}>
          <h2 style={{ fontFamily: 'Outfit', margin: 0 }}>{settings?.restaurant_name || 'Restaurant'}</h2>
          <span className="table-badge">Table {tableNum}</span>
        </div>
        <div className="flex align-center gap-md">
          {customerName && <span className="text-secondary" style={{ fontWeight: 600 }}>{customerName}</span>}
          <ThemeToggle />
        </div>
      </div>

      {isCheckoutRequested && (
        <div className="bg-warning text-center" style={{ padding: 12, color: '#fff', fontWeight: 600 }}>
          Checkout requested - new orders disabled. Waiting for your waiter.
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'menu' && (
          <MenuTab 
            tableId={tableId} 
            customerName={customerName} 
            isCheckoutRequested={isCheckoutRequested}
            cart={cart}
            setCart={setCart}
            goToStatus={() => setActiveTab('status')}
          />
        )}
        {activeTab === 'status' && <StatusTab tableId={tableId} />}
        {activeTab === 'bill' && <BillTab tableId={tableId} setIsCheckoutRequested={setIsCheckoutRequested} />}
      </div>

      {/* Floating Seek Assistance Button */}
      <button className="seek-assistance-btn" onClick={requestAssistance} title="Call Waiter">
        <Headphones size={24} />
        <span className="seek-assistance-text">Seek Assistance</span>
      </button>

      {/* Bottom Navigation */}
      <div className="bottom-tabs">
        <button 
          className="btn" 
          style={{ flex: 1, flexDirection: 'column', gap: 4, background: 'transparent', color: activeTab === 'menu' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
          onClick={() => setActiveTab('menu')}
        >
          <UtensilsCrossed size={20} />
          <span style={{ fontSize: 12 }}>Menu</span>
        </button>
        <button 
          className="btn" 
          style={{ flex: 1, flexDirection: 'column', gap: 4, background: 'transparent', color: activeTab === 'status' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
          onClick={() => setActiveTab('status')}
        >
          <Clock size={20} />
          <span style={{ fontSize: 12 }}>Status</span>
        </button>
        <button 
          className="btn" 
          style={{ flex: 1, flexDirection: 'column', gap: 4, background: 'transparent', color: activeTab === 'bill' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
          onClick={() => setActiveTab('bill')}
        >
          <Receipt size={20} />
          <span style={{ fontSize: 12 }}>Bill</span>
        </button>
      </div>

      {/* Name Entry Modal */}
      <Modal
        isOpen={isNameModalOpen}
        onClose={() => {}} // Can't close without entering name
        title={`Welcome to ${settings?.restaurant_name || 'Restaurant'}!`}
      >
        <form onSubmit={handleNameSubmit} className="flex flex-col gap-lg mt-md">
          <p className="text-secondary text-center">Please enter your name to start ordering.</p>
          <div className="form-group">
            <input 
              type="text" 
              className="form-input" 
              style={{ fontSize: 18, padding: 16, textAlign: 'center' }}
              placeholder="Your Name"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              required
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary w-full" style={{ padding: 16, fontSize: 16 }}>
            Start Ordering
          </button>
        </form>
      </Modal>
    </div>
  );
}
