import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import SearchBar from '../components/SearchBar';
import { Minus, Plus, ShoppingBag, X, Receipt } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

export default function MenuTab({ tableId, customerName, isCheckoutRequested, cart, setCart, goToStatus }) {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isVegOnly, setIsVegOnly] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      const [itemsRes, catsRes] = await Promise.all([
        api.get('/menu?available=true'),
        api.get('/menu/categories')
      ]);
      setMenuItems(itemsRes.data);
      setCategories(catsRes.data);
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
    showToast(`Added ${item.name} to cart`, 'success');
  };

  const updateCartQty = (id, delta) => {
    let shouldCloseCart = false;
    setCart(prev => {
      const newCart = prev.map(i => {
        if (i.id === id) {
          const newQty = i.quantity + delta;
          return newQty > 0 ? { ...i, quantity: newQty } : null;
        }
        return i;
      }).filter(Boolean); // Remove nulls (qty 0)
      if (newCart.length === 0) shouldCloseCart = true;
      return newCart;
    });
    if (shouldCloseCart) setIsCartOpen(false);
  };

  const updateItemNotes = (id, notes) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, notes } : i));
  };

  const submitOrder = async () => {
    if (!tableId || cart.length === 0 || isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      const items = cart.map(i => ({ menu_item_id: i.id, quantity: i.quantity, notes: i.notes }));
      
      const payload = {
        table_id: tableId,
        customer_name: customerName,
        items
      };

      // Check if there's an active order first
      let orderId;
      try {
        const activeRes = await api.get(`/orders/table/${tableId}/active`);
        orderId = activeRes.data.id;
        // Add to existing
        await api.post(`/orders/${orderId}/items`, { items, customer_name: customerName });
      } catch (err) {
        // No active order, create new
        await api.post('/orders', payload);
      }

      setCart([]);
      setIsCartOpen(false);
      showToast('Order placed successfully!', 'success');
      goToStatus();
    } catch (error) {
      showToast('Failed to place order', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtering & Sorting
  let filteredItems = [...menuItems];
  
  if (activeCategory !== 'all') {
    filteredItems = filteredItems.filter(i => i.category_id === activeCategory);
  }
  
  if (isVegOnly) {
    filteredItems = filteredItems.filter(i => i.is_veg);
  }
  
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredItems = filteredItems.filter(i => 
      i.name.toLowerCase().includes(q) || 
      (i.name_np && i.name_np.includes(q))
    );
  }

  // Sorting removed as per user request

  const cartTotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div>
      <div className="flex flex-col gap-sm" style={{ padding: '20px 20px 10px' }}>
        <div className="flex gap-sm">
          <input 
            type="text" 
            className="form-input flex-1" 
            placeholder="Search menu..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-sm" style={{ overflowX: 'auto', padding: '4px 0', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>

          <div className={`tab-item ${isVegOnly ? 'active' : ''}`} onClick={() => setIsVegOnly(!isVegOnly)} style={{ borderRadius: 20, border: '1px solid var(--success)', color: isVegOnly ? 'var(--success)' : 'inherit', padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="veg-badge" style={{ transform: 'scale(0.8)', margin: 0 }}></span> Veg Only
          </div>
        </div>
      </div>

      <div className="flex align-center gap-sm mb-md" style={{ margin: '0 20px' }}>
        <div 
          className={`tab-item ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => setActiveCategory('all')}
          style={{ flexShrink: 0 }}
        >
          All
        </div>
        <div className="tab-bar flex-1" style={{ margin: 0, padding: 0 }}>
          {categories.map(cat => (
            <div 
              key={cat.id}
              className={`tab-item ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.name}
            </div>
          ))}
        </div>
      </div>

      {isCheckoutRequested && (
        <div className="modal-overlay" style={{ zIndex: 30, background: 'rgba(0,0,0,0.5)' }}>
          <div className="card text-center" style={{ padding: 40, maxWidth: 400 }}>
            <Receipt size={48} color="var(--warning)" style={{ marginBottom: 20 }} />
            <h3>Please settle your bill</h3>
            <p className="text-secondary mt-sm">You have requested checkout. Ordering is disabled until the current bill is cleared.</p>
            <button className="btn btn-primary mt-lg" onClick={goToStatus}>View Status</button>
          </div>
        </div>
      )}

      <div className="menu-grid">
        {filteredItems.map(item => {
          const cartItem = cart.find(i => i.id === item.id);
          return (
            <div key={item.id} className="card menu-card">
              <img src={item.image_url} alt={item.name} className="menu-card-image" />
              <div className="menu-card-body">
                <div className="flex justify-between align-center">
                  <div className={item.is_veg ? 'veg-badge' : 'nonveg-badge'}></div>
                  <div className="menu-card-price">{formatCurrency(item.price)}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{item.name}</div>
                  {item.name_np && <div className="text-secondary" style={{ fontSize: 13 }}>{item.name_np}</div>}
                </div>
                <p className="text-secondary truncate" style={{ fontSize: 13 }}>{item.description}</p>
                
                <div className="mt-sm">
                  {cartItem ? (
                    <div className="flex align-center justify-between bg-secondary" style={{ borderRadius: 'var(--radius)', padding: 4 }}>
                      <button className="btn btn-icon" style={{ background: 'transparent' }} onClick={() => updateCartQty(item.id, -1)}>
                        <Minus size={18} />
                      </button>
                      <span style={{ fontWeight: 600, padding: '0 12px' }}>{cartItem.quantity}</span>
                      <button className="btn btn-icon" style={{ background: 'transparent' }} onClick={() => updateCartQty(item.id, 1)}>
                        <Plus size={18} />
                      </button>
                    </div>
                  ) : (
                    <button className="btn btn-secondary w-full" onClick={() => addToCart(item)} disabled={isCheckoutRequested}>
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart Summary Bar */}
      {cart.length > 0 && !isCheckoutRequested && (
        <div className="cart-bar animate-slideUp">
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{cartItemsCount} items</div>
            <div style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>Total: {formatCurrency(cartTotal)}</div>
          </div>
          <button className="btn btn-primary" onClick={() => setIsCartOpen(true)}>
            <ShoppingBag size={18} /> View Cart
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      <div className={`cart-drawer ${isCartOpen ? 'open' : ''}`}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--glass-border)' }}>
          <h3>Your Order</h3>
          <button className="btn btn-icon btn-secondary" onClick={() => setIsCartOpen(false)}>
            <X size={20} />
          </button>
        </div>
        
        <div className="card-body" style={{ flex: 1, overflowY: 'auto' }}>
          {cart.map(item => (
            <div key={item.id} className="flex-col gap-sm" style={{ padding: '16px 0', borderBottom: '1px solid var(--glass-border)' }}>
              <div className="flex justify-between">
                <div style={{ fontWeight: 600 }}>{item.name}</div>
                <div style={{ fontWeight: 600 }}>{formatCurrency(item.price * item.quantity)}</div>
              </div>
              <div className="flex justify-between align-center mt-sm">
                <div className="flex align-center bg-secondary" style={{ borderRadius: 'var(--radius-sm)', padding: 2 }}>
                  <button className="btn btn-icon" style={{ background: 'transparent', width: 28, height: 28 }} onClick={() => updateCartQty(item.id, -1)}><Minus size={14} /></button>
                  <span style={{ fontWeight: 600, width: 24, textAlign: 'center', fontSize: 14 }}>{item.quantity}</span>
                  <button className="btn btn-icon" style={{ background: 'transparent', width: 28, height: 28 }} onClick={() => updateCartQty(item.id, 1)}><Plus size={14} /></button>
                </div>
                <button className="btn" style={{ padding: '4px 8px', fontSize: 12, color: 'var(--danger)', background: 'transparent' }} onClick={() => updateCartQty(item.id, -item.quantity)}>
                  Remove
                </button>
              </div>
              <input 
                type="text" 
                className="form-input mt-sm" 
                style={{ padding: '8px 12px', fontSize: 13 }}
                placeholder="Special instructions (e.g. Less spicy)"
                value={item.notes}
                onChange={e => updateItemNotes(item.id, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div style={{ padding: 20, borderTop: '1px solid var(--glass-border)', background: 'var(--bg-card)' }}>
          <div className="flex justify-between mb-md" style={{ fontSize: 18, fontWeight: 700 }}>
            <span>Total</span>
            <span style={{ color: 'var(--accent-primary)' }}>{formatCurrency(cartTotal)}</span>
          </div>
          <button className="btn btn-primary w-full" style={{ padding: 16, fontSize: 16 }} onClick={submitOrder} disabled={isSubmitting}>
            {isSubmitting ? 'Sending Order...' : 'Place Order'}
          </button>
        </div>
      </div>
      
      {/* Backdrop for drawer */}
      {isCartOpen && (
        <div 
          className="modal-overlay" 
          style={{ zIndex: 1999, background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setIsCartOpen(false)}
        />
      )}
    </div>
  );
}
