import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import SearchBar from '../components/SearchBar';
import { Minus, Plus, ShoppingBag, X, Receipt, Search } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

export default function MenuTab({ 
  tableId, 
  customerName, 
  isCheckoutRequested, 
  cart, 
  setCart, 
  goToStatus,
  isAdminMode,
  tables = [],
  adminTableId,
  setAdminTableId,
  adminCustomerName,
  setAdminCustomerName,
  onAdminSubmitSuccess
}) {
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
      
      const filteredCats = catsRes.data.filter(c => c.name.toLowerCase() !== 'adventures');
      const filteredItems = itemsRes.data.filter(i => i.category_name?.toLowerCase() !== 'adventures');

      setMenuItems(filteredItems);
      setCategories(filteredCats);
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
    if ((!isAdminMode && !tableId) || cart.length === 0 || isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      const items = cart.map(i => ({ menu_item_id: i.id, quantity: i.quantity, notes: i.notes, price_at_order: i.price }));
      
      const effectiveTableId = isAdminMode ? adminTableId : tableId;
      const effectiveCustomerName = isAdminMode ? adminCustomerName : customerName;

      const payload = {
        table_id: effectiveTableId || null,
        order_type: effectiveTableId ? 'table' : 'counter',
        customer_name: effectiveCustomerName,
        items
      };

      if (effectiveTableId) {
        // Check if there's an active order first
        let orderId;
        try {
          const activeRes = await api.get(`/orders/table/${effectiveTableId}/active`);
          if (activeRes.data && activeRes.data.id) {
            orderId = activeRes.data.id;
            // Add to existing
            await api.post(`/orders/${orderId}/items`, { items, customer_name: effectiveCustomerName });
          } else {
            await api.post('/orders', payload);
          }
        } catch (err) {
          // No active order, create new
          await api.post('/orders', payload);
        }
      } else {
        // Counter order (no table)
        await api.post('/orders', payload);
      }

      setCart([]);
      setIsCartOpen(false);
      showToast('Order placed successfully!', 'success');
      
      if (isAdminMode && onAdminSubmitSuccess) {
        onAdminSubmitSuccess();
      } else if (goToStatus) {
        goToStatus();
      }
    } catch (error) {
      showToast('Failed to place order', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtering & Sorting
  let filteredItems = [...menuItems];
  
  // We no longer filter by activeCategory because we use scroll spy
  // if (activeCategory !== 'all') { ... }
  
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

  // Handle smooth scroll to category
  const scrollToCategory = (catId) => {
    setActiveCategory(catId);
    const container = document.getElementById('customer-scroll-container');
    if (!container) return;

    if (catId === 'all') {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const el = document.getElementById(`category-${catId}`);
      if (el) {
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const scrollTop = container.scrollTop;
        const targetY = (elRect.top - containerRect.top) + scrollTop - 60; // offset for sticky pill header
        container.scrollTo({ top: targetY, behavior: 'smooth' });
      }
    }
  };

  // ScrollSpy effect
  useEffect(() => {
    const container = document.getElementById('customer-scroll-container');
    if (!container) return;

    const handleScroll = () => {
      // Find which section is currently at the top
      const scrollPos = container.scrollTop;
      if (scrollPos < 100) {
        setActiveCategory('all');
        return;
      }
      
      const containerRect = container.getBoundingClientRect();
      let currentActive = 'all';
      for (let i = categories.length - 1; i >= 0; i--) {
        const sec = document.getElementById(`category-${categories[i].id}`);
        if (sec) {
          const rect = sec.getBoundingClientRect();
          if (rect.top - containerRect.top <= 120) { // When section title touches sticky header
            currentActive = categories[i].id;
            break;
          }
        }
      }
      setActiveCategory(prev => prev !== currentActive ? currentActive : prev);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [categories]);

  return (
    <div>
      {isAdminMode && (
        <div style={{ padding: '16px 20px', background: 'var(--bg-secondary)', display: 'flex', gap: '16px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 60 }}>
          <select 
            className="form-select flex-1" 
            value={adminTableId || ''}
            onChange={e => setAdminTableId(e.target.value)}
            style={{ padding: '12px', background: 'var(--bg-primary)' }}
          >
            <option value="">Counter Order (No Table)</option>
            {tables.map(t => (
              <option key={t.id} value={t.id}>Table {t.number} {t.status === 'occupied' ? '(Occupied)' : ''}</option>
            ))}
          </select>
          <input 
            type="text"
            className="form-input flex-1"
            placeholder="Customer Name (Optional)"
            value={adminCustomerName || ''}
            onChange={e => setAdminCustomerName(e.target.value)}
            style={{ padding: '12px', background: 'var(--bg-primary)' }}
          />
        </div>
      )}

      <div className="customer-hero">
        <h1>What are you craving?</h1>
        <div className="customer-search-container">
          <div className="customer-search-input-wrapper">
            <Search className="customer-search-icon" size={18} />
            <input 
              type="text" 
              className="customer-search-input" 
              placeholder="Search our delicious menu..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className={`veg-toggle-pill ${isVegOnly ? 'active' : ''}`} onClick={() => setIsVegOnly(!isVegOnly)}>
            <span className="veg-badge" style={{ transform: 'scale(0.8)', margin: 0 }}></span> Veg
          </div>
        </div>
      </div>

      <div className="category-strip" style={{ position: 'sticky', top: '0px', zIndex: 50 }}>
        <div 
          className={`category-pill ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => scrollToCategory('all')}
        >
          All
        </div>
        {categories.map(cat => {
          // only show pills for categories that have items matching the current search/veg filter
          const hasItems = filteredItems.some(i => i.category_id === cat.id);
          if (!hasItems) return null;
          return (
            <div 
              key={cat.id}
              className={`category-pill ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => scrollToCategory(cat.id)}
            >
              {cat.name}
            </div>
          );
        })}
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

      <div className="menu-sections">
        {(() => {
          const catsToRender = categories.filter(c => filteredItems.some(i => i.category_id === c.id));
          
          if (catsToRender.length === 0) {
            return (
              <div className="text-center text-secondary p-xl" style={{ marginTop: '40px' }}>
                No items found
              </div>
            );
          }

          return catsToRender.map(cat => {
            const itemsInCat = filteredItems.filter(i => i.category_id === cat.id);
            return (
              <div key={cat.id} className="menu-category-section" id={`category-${cat.id}`} style={{ scrollMarginTop: '160px', paddingBottom: '20px' }}>
                <h2 className="sticky-category-header" style={{
                  position: 'sticky',
                  top: '55px',
                  zIndex: 40,
                  background: 'var(--bg-primary)',
                  padding: '16px 20px',
                  margin: '0 -20px 20px -20px',
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  borderBottom: '1px solid var(--border)'
                }}>
                  {cat.name}
                </h2>
                <div className="menu-grid">
                  {itemsInCat.map(item => {
                    const cartItem = cart.find(i => i.id === item.id);
                    return (
                      <div key={item.id} className="sleek-menu-card">
                        <div className="sleek-menu-image-container">
                          {item.image_url && <img src={item.image_url} alt={item.name} className="sleek-menu-image" onError={(e) => { e.target.style.display = 'none'; }} />}
                          <div className="sleek-menu-gradient"></div>
                          <div className="sleek-badge-container">
                            <div className={item.is_veg ? 'veg-badge' : 'nonveg-badge'}></div>
                          </div>
                        </div>
                        
                        <div className="sleek-menu-body">
                          <div>
                            <div className="sleek-menu-title">{item.name}</div>
                            {item.name_np && <div className="sleek-menu-subtitle">{item.name_np}</div>}
                          </div>
                          <div className="sleek-menu-desc">{item.description}</div>
                          
                          <div className="sleek-menu-footer">
                            <div className="sleek-menu-price">{formatCurrency(item.price)}</div>
                            {!cartItem && !isCheckoutRequested ? (
                              <button className="btn btn-primary" style={{ padding: '6px 16px', borderRadius: '100px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => addToCart(item)}>
                                <Plus size={14} /> Add
                              </button>
                            ) : cartItem ? (
                              <div className="sleek-qty-stepper">
                                <button className="sleek-qty-btn" onClick={() => updateCartQty(item.id, -1)}>
                                  <Minus size={14} />
                                </button>
                                <span className="sleek-qty-val">{cartItem.quantity}</span>
                                <button className="sleek-qty-btn" onClick={() => updateCartQty(item.id, 1)}>
                                  <Plus size={14} />
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* Cart Summary Bar */}
      <div className={`sleek-cart-bar ${cart.length === 0 || isCheckoutRequested ? 'hidden' : ''}`}>
        <div className="sleek-cart-info">
          <h4>Your Order ({cartItemsCount} items)</h4>
          <div className="total">{formatCurrency(cartTotal)}</div>
        </div>
        <button className="btn btn-primary" style={{ padding: '10px 20px', borderRadius: '100px' }} onClick={() => setIsCartOpen(true)}>
          <ShoppingBag size={18} /> View Cart
        </button>
      </div>

      {/* Cart Drawer & Backdrop rendered in Portal to escape any containing blocks (like modal backdrop filters) */}
      {createPortal(
        <>
          {isCartOpen && (
            <div 
              className="modal-overlay" 
              style={{ zIndex: 1999, background: 'rgba(0,0,0,0.5)' }}
              onClick={() => setIsCartOpen(false)}
            />
          )}
          <div className={`sleek-cart-drawer ${isCartOpen ? 'open' : ''}`}>
            <div className="sleek-drawer-header">
              <h2>Your Order</h2>
              <button className="btn btn-icon btn-secondary" style={{ borderRadius: '50%' }} onClick={() => setIsCartOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="card-body" style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
              {cart.map(item => (
                <div key={item.id} className="sleek-cart-item">
                  <div className="flex justify-between">
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{item.name}</div>
                    <div style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{formatCurrency(item.price * item.quantity)}</div>
                  </div>
                  <div className="flex justify-between align-center mt-sm">
                    <div className="sleek-qty-stepper">
                      <button className="sleek-qty-btn" onClick={() => updateCartQty(item.id, -1)}><Minus size={14} /></button>
                      <span className="sleek-qty-val">{item.quantity}</span>
                      <button className="sleek-qty-btn" onClick={() => updateCartQty(item.id, 1)}><Plus size={14} /></button>
                    </div>
                    <button className="btn" style={{ padding: '4px 8px', fontSize: 12, color: 'var(--danger)', background: 'transparent' }} onClick={() => updateCartQty(item.id, -item.quantity)}>
                      Remove
                    </button>
                  </div>
                  <input 
                    type="text" 
                    className="form-input mt-sm" 
                    style={{ padding: '10px 14px', fontSize: 13, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                    placeholder="Special instructions (e.g. Less spicy)"
                    value={item.notes || ''}
                    onChange={e => updateItemNotes(item.id, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="sleek-drawer-footer">
              <div className="flex justify-between mb-md" style={{ fontSize: 18, fontWeight: 700 }}>
                <span>Total to Pay</span>
                <span style={{ color: 'var(--accent-primary)', fontSize: 22 }}>{formatCurrency(cartTotal)}</span>
              </div>
              <button className="btn btn-primary w-full" style={{ padding: 16, fontSize: 16, borderRadius: '12px' }} onClick={submitOrder} disabled={isSubmitting}>
                {isSubmitting ? 'Sending Order...' : 'Place Order Now'}
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
