import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Search, Plus, Minus, Trash2 } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

export default function AdminCounterOrderModal({
  tables = [],
  adminTableId,
  setAdminTableId,
  adminCustomerName,
  setAdminCustomerName,
  cart,
  setCart,
  onAdminSubmitSuccess
}) {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cartEndRef = useRef(null);
  const { showToast } = useToast();

  useEffect(() => {
    cartEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [cart]);

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      const [itemsRes, catsRes] = await Promise.all([
        api.get('/menu?available=true'),
        api.get('/menu/categories')
      ]);
      
      const filteredCats = catsRes.data
        .filter(c => c.name.toLowerCase() !== 'adventures')
        .sort((a, b) => a.name.localeCompare(b.name));
        
      const filteredItems = itemsRes.data.filter(i => i.category_name?.toLowerCase() !== 'adventures');

      setMenuItems(filteredItems);
      setCategories(filteredCats);
      if (filteredCats.length > 0) {
        setActiveCategory(filteredCats[0].id); // default to first category
      }
    } catch (error) {
      showToast('Failed to load menu', 'error');
    }
  };

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1, notes: '' }];
    });
  };

  const updateCartQty = (id, delta) => {
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = i.quantity + delta;
        return newQty > 0 ? { ...i, quantity: newQty } : null;
      }
      return i;
    }).filter(Boolean));
  };

  const updateItemNotes = (id, notes) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, notes } : i));
  };

  const submitOrder = async () => {
    if (cart.length === 0 || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const items = cart.map(i => ({ menu_item_id: i.id, quantity: i.quantity, notes: i.notes, price_at_order: i.price }));
      
      const payload = {
        table_id: adminTableId || null,
        order_type: adminTableId ? 'table' : 'counter',
        customer_name: adminCustomerName,
        items
      };

      if (adminTableId) {
        let orderId;
        try {
          const activeRes = await api.get(`/orders/table/${adminTableId}/active`);
          if (activeRes.data && activeRes.data.id) {
            orderId = activeRes.data.id;
            await api.post(`/orders/${orderId}/items`, { items, customer_name: adminCustomerName });
          } else {
            await api.post('/orders', payload);
          }
        } catch (err) {
          console.error("Error adding items to table order:", err);
          throw new Error('Failed to update existing table order. Please try again.');
        }
      } else {
        await api.post('/orders', payload);
      }

      showToast('Order placed successfully!', 'success');
      if (onAdminSubmitSuccess) onAdminSubmitSuccess();
    } catch (error) {
      showToast('Failed to place order', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter items
  let displayItems = menuItems;
  if (activeCategory && activeCategory !== 'all') {
    displayItems = displayItems.filter(i => i.category_id === activeCategory);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    displayItems = displayItems.filter(i => 
      i.name.toLowerCase().includes(q) || 
      (i.name_np && i.name_np.includes(q))
    );
  }

  const cartTotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
      
      {/* Left Column: Categories */}
      <div style={{ width: '220px', minWidth: '220px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
        <div style={{ padding: '20px', fontWeight: 'bold', fontSize: '18px', borderBottom: '1px solid var(--border-color)' }}>Categories</div>
        <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {categories.map(cat => (
            <div 
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: '12px 16px',
                marginBottom: '8px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: activeCategory === cat.id ? 'var(--primary)' : 'transparent',
                color: activeCategory === cat.id ? 'var(--primary-content)' : 'var(--text-primary)',
                fontWeight: activeCategory === cat.id ? 'bold' : 'normal',
                transition: 'all 0.2s'
              }}
            >
              {cat.name}
            </div>
          ))}
        </div>
      </div>

      {/* Middle Column: Items */}
      <div style={{ flex: 1, minWidth: '400px', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '16px', background: 'var(--bg-primary)' }}>
          <div className="input-with-icon" style={{ flex: 2 }}>
            <Search size={18} />
            <input
              type="text"
              className="form-input"
              placeholder="Search items..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <select 
            className="form-select flex-1" 
            value={adminTableId || ''}
            onChange={e => setAdminTableId(e.target.value)}
          >
            <option value="" disabled>-- Select a Table (Compulsory) --</option>
            {tables.map(t => (
              <option key={t.id} value={t.id}>Table {t.number} {t.status === 'occupied' ? '(Occupied)' : ''}</option>
            ))}
          </select>
        </div>
        <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '20px', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
            {displayItems.map(item => (
              <div 
                key={item.id} 
                className="cursor-pointer" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between', 
                  padding: '16px',
                  background: 'var(--bg-primary)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.1)';
                  e.currentTarget.style.borderColor = 'var(--primary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
                onClick={() => addToCart(item)}
              >
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)', lineHeight: '1.3' }}>{item.name}</div>
                  {item.name_np && <div className="text-secondary" style={{ fontSize: '13px', marginTop: '4px' }}>{item.name_np}</div>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: '700', color: 'var(--primary)', fontSize: '16px' }}>
                    {formatCurrency(item.price)}
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '6px', borderRadius: '50%', color: 'var(--primary)' }}>
                    <Plus size={16} />
                  </div>
                </div>
              </div>
            ))}
            {displayItems.length === 0 && (
              <div className="text-muted" style={{ padding: '20px', gridColumn: '1 / -1', textAlign: 'center' }}>No items found in this category.</div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Order Summary (Cart) */}
      <div style={{ width: '380px', minWidth: '380px', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
        <div style={{ padding: '20px', fontWeight: 'bold', fontSize: '18px', borderBottom: '1px solid var(--border-color)' }}>Order Summary</div>
        
        <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {cart.length === 0 ? (
            <div className="text-center text-muted" style={{ marginTop: '40px' }}>Cart is empty</div>
          ) : (
            <div className="flex-col gap-md">
              {cart.map(item => (
                <div key={item.id} style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                  <div className="flex justify-between align-center mb-xs">
                    <span style={{ fontWeight: 600 }}>{item.name}</span>
                    <span style={{ fontWeight: 'bold' }}>{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                  <div className="flex justify-between align-center mt-sm">
                    <div className="flex align-center gap-xs">
                      <button className="btn btn-icon btn-sm" onClick={() => updateCartQty(item.id, -1)} style={{ background: 'var(--bg-primary)', width: 28, height: 28 }}><Minus size={14} /></button>
                      <span style={{ width: 24, textAlign: 'center', fontWeight: 600 }}>{item.quantity}</span>
                      <button className="btn btn-icon btn-sm" onClick={() => updateCartQty(item.id, 1)} style={{ background: 'var(--bg-primary)', width: 28, height: 28 }}><Plus size={14} /></button>
                    </div>
                  </div>
                  <input 
                    type="text" 
                    className="form-input mt-sm w-full" 
                    style={{ fontSize: '12px', padding: '6px 10px', background: 'var(--bg-primary)' }}
                    placeholder="Add notes..."
                    value={item.notes || ''}
                    onChange={(e) => updateItemNotes(item.id, e.target.value)}
                  />
                </div>
              ))}
              <div ref={cartEndRef} />
            </div>
          )}
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
          <div className="flex justify-between align-center mb-md" style={{ fontSize: '18px', fontWeight: 'bold' }}>
            <span>Total</span>
            <span className="text-success">{formatCurrency(cartTotal)}</span>
          </div>
          
          <input 
            type="text"
            className="form-input mb-md w-full"
            placeholder="Customer Name (Optional)"
            value={adminCustomerName || ''}
            onChange={e => setAdminCustomerName(e.target.value)}
            style={{ padding: '12px' }}
          />
          
          <button 
            className="btn btn-primary w-full" 
            style={{ padding: '14px', fontSize: '16px', fontWeight: 'bold' }}
            onClick={submitOrder}
            disabled={cart.length === 0 || isSubmitting || !adminTableId}
          >
            {isSubmitting ? 'Placing Order...' : 'Place Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
