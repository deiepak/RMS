import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Plus, Edit2, Trash2, Image as ImageIcon, Settings, CheckCircle, XCircle } from 'lucide-react';
import Modal from '../components/Modal';

export default function MenuManagement() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stations, setStations] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isCategoryManageModalOpen, setIsCategoryManageModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  
  const [editingItem, setEditingItem] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);

  const [itemForm, setItemForm] = useState({
    name: '', name_np: '', description: '', description_np: '',
    category_id: '', station_ids: [], price: '', image_url: '', image_file: null, is_veg: true, is_available: true, sort_order: 0
  });

  const [catForm, setCatForm] = useState({ name: '', name_np: '', sort_order: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [itemsRes, catsRes, stationsRes] = await Promise.all([
        api.get('/menu'),
        api.get('/menu/categories'),
        api.get('/stations')
      ]);
      setItems(itemsRes.data);
      setCategories(catsRes.data);
      setStations(stationsRes.data);
    } catch (error) {
      showToast('Failed to load menu data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Item Handlers ---
  const handleSaveItem = async () => {
    if (!itemForm.name || !itemForm.category_id || itemForm.price === '') {
      showToast('Name, Category, and Price are required', 'error');
      return;
    }
    
    const formData = new FormData();
    formData.append('name', itemForm.name);
    formData.append('name_np', itemForm.name_np || '');
    formData.append('description', itemForm.description || '');
    formData.append('description_np', itemForm.description_np || '');
    formData.append('category_id', itemForm.category_id);
    formData.append('price', itemForm.price);
    formData.append('is_veg', itemForm.is_veg);
    formData.append('is_available', itemForm.is_available);
    formData.append('sort_order', itemForm.sort_order);
    if (itemForm.station_ids) formData.append('station_ids', JSON.stringify(itemForm.station_ids));
    
    if (itemForm.image_file) {
      formData.append('image', itemForm.image_file);
    } else if (itemForm.image_url) {
      formData.append('image_url', itemForm.image_url);
    }

    try {
      if (editingItem) {
        await api.put(`/menu/items/${editingItem.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
        showToast('Item updated successfully', 'success');
      } else {
        await api.post('/menu/items', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
        showToast('Item created successfully', 'success');
      }
      setIsItemModalOpen(false);
      fetchData();
    } catch (error) {
      showToast('Failed to save item', 'error');
    }
  };

  const handleDeleteItem = async (id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await api.delete(`/menu/items/${id}`);
        showToast('Item deleted', 'success');
        fetchData();
      } catch (error) {
        console.error('Failed to delete item:', error);
        showToast(error.response?.data?.error || 'Failed to delete item', 'error');
      }
    }
  };

  const toggleItemAvailability = async (id, currentStatus) => {
    try {
      await api.patch(`/menu/items/${id}/stock`);
      showToast(currentStatus ? 'Item marked as Out of Stock' : 'Item marked as In Stock', 'success');
      fetchData();
    } catch (error) {
      showToast('Failed to update stock status', 'error');
    }
  };

  const openItemModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setItemForm({ ...item, image_file: null });
    } else {
      setEditingItem(null);
      setItemForm({
        name: '', name_np: '', description: '', description_np: '',
        category_id: categories[0]?.id || '', station_ids: [], price: '', image_url: '', image_file: null, is_veg: true, is_available: true, sort_order: 0
      });
    }
    setIsItemModalOpen(true);
  };

  // --- Category Handlers ---
  const handleSaveCategory = async () => {
    if (!catForm.name) {
      showToast('Category name is required', 'error');
      return;
    }
    try {
      if (editingCategory) {
        await api.put(`/menu/categories/${editingCategory.id}`, catForm);
        showToast('Category updated successfully', 'success');
      } else {
        await api.post('/menu/categories', catForm);
        showToast('Category created successfully', 'success');
      }
      setIsCategoryModalOpen(false);
      fetchData();
    } catch (error) {
      showToast('Failed to save category', 'error');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (window.confirm('Are you sure you want to delete this category? All items must be removed first.')) {
      try {
        await api.delete(`/menu/categories/${id}`);
        showToast('Category deleted', 'success');
        // If the active category was deleted, reset to 'all'
        if (activeCategory === id) {
          setActiveCategory('all');
        }
        fetchData();
      } catch (error) {
        showToast(error.response?.data?.error || 'Failed to delete category', 'error');
      }
    }
  };

  const openCategoryModal = (cat = null) => {
    if (cat) {
      setEditingCategory(cat);
      setCatForm(cat);
    } else {
      setEditingCategory(null);
      setCatForm({ name: '', name_np: '', sort_order: 0 });
    }
    setIsCategoryModalOpen(true);
  };

  const filteredItems = activeCategory === 'all' 
    ? items 
    : items.filter(i => i.category_id === activeCategory);

  return (
    <div className="admin-content" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      <div className="admin-header flex justify-between align-center mb-lg">
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '24px', fontWeight: 600 }}>Menu Management</h2>
          <p className="text-secondary" style={{ margin: '5px 0 0 0', fontSize: '14px' }}>Manage categories, items, and availability</p>
        </div>
        <div className="flex gap-md">
          <button className="btn btn-secondary flex align-center gap-sm" onClick={() => setIsCategoryManageModalOpen(true)} style={{ transition: 'all 0.2s' }}>
            <Settings size={18} /> Manage Categories
          </button>
          <button className="btn btn-primary flex align-center gap-sm" onClick={() => openItemModal()} style={{ transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(230, 57, 70, 0.3)' }}>
            <Plus size={18} /> Add New Item
          </button>
        </div>
      </div>

      <div className="tab-bar mb-lg" style={{ overflowX: 'auto', paddingBottom: '5px', WebkitOverflowScrolling: 'touch' }}>
        <div 
          className={`tab-item ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          All Items
        </div>
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

      {isLoading ? (
        <div className="flex justify-center align-center" style={{ height: '200px' }}>
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', borderRadius: '12px' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Item</th>
                <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Category</th>
                <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Price</th>
                <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Type</th>
                <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                <th style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, index) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s', animation: `fadeIn 0.3s ease-in-out ${index * 0.05}s forwards`, opacity: 0 }}>
                  <td style={{ padding: '16px 20px' }}>
                    <div className="flex align-center gap-md">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                      ) : (
                        <div className="stat-icon flex justify-center align-center bg-tertiary text-secondary" style={{ width: 48, height: 48, borderRadius: 10 }}>
                          <ImageIcon size={24} />
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>{item.name}</div>
                        <div className="text-secondary" style={{ fontSize: 13, marginTop: '2px' }}>{item.name_np}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-primary)' }}>{item.category_name}</td>
                  <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--accent-primary)', fontSize: '15px' }}>रू {item.price}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <span className={`badge flex align-center gap-xs`} style={{ display: 'inline-flex', padding: '4px 8px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, backgroundColor: item.is_veg ? 'rgba(42, 157, 143, 0.1)' : 'rgba(230, 57, 70, 0.1)', color: item.is_veg ? '#2A9D8F' : '#E63946' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.is_veg ? '#2A9D8F' : '#E63946' }}></span>
                      {item.is_veg ? 'Veg' : 'Non-Veg'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <button 
                      onClick={() => toggleItemAvailability(item.id, item.is_available)}
                      className="btn-icon"
                      style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: '6px', 
                        padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, 
                        backgroundColor: item.is_available ? 'rgba(42, 157, 143, 0.1)' : 'rgba(244, 162, 97, 0.1)', 
                        color: item.is_available ? '#2A9D8F' : '#F4A261',
                        border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                      }}
                      title="Click to toggle availability"
                    >
                      {item.is_available ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      {item.is_available ? 'In Stock' : 'Out of Stock'}
                    </button>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <div className="flex justify-end gap-sm">
                      <button className="btn btn-icon btn-secondary" onClick={() => openItemModal(item)} style={{ borderRadius: '8px', width: '36px', height: '36px' }}>
                        <Edit2 size={16} />
                      </button>
                      <button className="btn btn-icon btn-secondary hover-danger" onClick={() => handleDeleteItem(item.id)} style={{ borderRadius: '8px', width: '36px', height: '36px' }}>
                        <Trash2 size={16} color="var(--danger)" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center text-secondary" style={{ padding: '60px 0', fontSize: '15px' }}>
                    <div className="flex flex-col align-center gap-md">
                      <div style={{ padding: '20px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '50%' }}>
                        <ImageIcon size={32} color="var(--text-muted)" />
                      </div>
                      <p>No menu items found in this category</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Categories Management Modal */}
      <Modal 
        isOpen={isCategoryManageModalOpen} 
        onClose={() => setIsCategoryManageModalOpen(false)}
        title="Manage Categories"
        footer={
          <button className="btn btn-secondary" onClick={() => setIsCategoryManageModalOpen(false)}>Close</button>
        }
      >
        <div className="flex justify-between align-center mb-md">
          <p className="text-secondary m-0">Organize your menu categories</p>
          <button className="btn btn-primary btn-sm flex align-center gap-sm" onClick={() => openCategoryModal()}>
            <Plus size={16} /> Add Category
          </button>
        </div>
        
        <div className="card" style={{ padding: 0, maxHeight: '400px', overflowY: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Category Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Nepali Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Order</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <tr key={cat.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>{cat.name}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{cat.name_np || '-'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>{cat.sort_order}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div className="flex justify-end gap-sm">
                      <button className="btn btn-icon btn-secondary" onClick={() => openCategoryModal(cat)} style={{ width: '32px', height: '32px' }}>
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-icon btn-secondary hover-danger" onClick={() => handleDeleteCategory(cat.id)} style={{ width: '32px', height: '32px' }}>
                        <Trash2 size={14} color="var(--danger)" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center text-muted" style={{ padding: '20px 0' }}>No categories found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Edit/Add Category Modal */}
      <Modal 
        isOpen={isCategoryModalOpen} 
        onClose={() => setIsCategoryModalOpen(false)}
        title={editingCategory ? "Edit Category" : "Add Category"}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsCategoryModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveCategory}>Save Category</button>
          </>
        }
      >
        <div className="form-group mb-md">
          <label className="form-label" style={{ fontWeight: 500, marginBottom: '6px', display: 'block' }}>Name (English) *</label>
          <input 
            type="text" 
            className="form-input" 
            placeholder="e.g. Starters"
            value={catForm.name} 
            onChange={e => setCatForm({...catForm, name: e.target.value})} 
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          />
        </div>
        <div className="form-group mb-md">
          <label className="form-label" style={{ fontWeight: 500, marginBottom: '6px', display: 'block' }}>Name (Nepali)</label>
          <input 
            type="text" 
            className="form-input" 
            placeholder="e.g. सुरुवात"
            value={catForm.name_np} 
            onChange={e => setCatForm({...catForm, name_np: e.target.value})} 
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 500, marginBottom: '6px', display: 'block' }}>Sort Order</label>
          <input 
            type="number" 
            className="form-input" 
            value={catForm.sort_order} 
            onChange={e => setCatForm({...catForm, sort_order: parseInt(e.target.value) || 0})} 
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          />
        </div>
      </Modal>

      {/* Edit/Add Item Modal */}
      <Modal 
        isOpen={isItemModalOpen} 
        onClose={() => setIsItemModalOpen(false)}
        title={editingItem ? "Edit Menu Item" : "Add Menu Item"}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsItemModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveItem}>Save Item</button>
          </>
        }
      >
        <div className="flex gap-md mb-md">
          <div className="form-group flex-1">
            <label className="form-label" style={{ fontWeight: 500, marginBottom: '6px', display: 'block' }}>Category *</label>
            <select 
              className="form-select"
              value={itemForm.category_id}
              onChange={(e) => setItemForm({...itemForm, category_id: e.target.value})}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            >
              <option value="">Select a category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group flex-1">
            <label className="form-label" style={{ fontWeight: 500, marginBottom: '6px', display: 'block' }}>Stations</label>
            <div className="flex gap-sm flex-wrap" style={{ padding: '8px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-primary)', maxHeight: '100px', overflowY: 'auto' }}>
              {stations.length === 0 ? (
                <span className="text-muted" style={{ fontSize: 13 }}>No stations available</span>
              ) : (
                stations.map(s => (
                  <label key={s.id} className="flex align-center gap-xs" style={{ cursor: 'pointer', fontSize: 14 }}>
                    <input 
                      type="checkbox" 
                      checked={Array.isArray(itemForm.station_ids) && itemForm.station_ids.includes(s.id)}
                      onChange={(e) => {
                        const ids = Array.isArray(itemForm.station_ids) ? [...itemForm.station_ids] : [];
                        if (e.target.checked) ids.push(s.id);
                        else {
                          const idx = ids.indexOf(s.id);
                          if (idx > -1) ids.splice(idx, 1);
                        }
                        setItemForm({...itemForm, station_ids: ids});
                      }}
                      style={{ accentColor: 'var(--accent-primary)' }}
                    />
                    {s.name}
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-md mb-md">
          <div className="form-group flex-1">
            <label className="form-label" style={{ fontWeight: 500, marginBottom: '6px', display: 'block' }}>Name (English) *</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Momo"
              value={itemForm.name} 
              onChange={e => setItemForm({...itemForm, name: e.target.value})} 
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="form-group flex-1">
            <label className="form-label" style={{ fontWeight: 500, marginBottom: '6px', display: 'block' }}>Name (Nepali)</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. म:म:"
              value={itemForm.name_np} 
              onChange={e => setItemForm({...itemForm, name_np: e.target.value})} 
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>
        <div className="form-group mb-md">
          <label className="form-label" style={{ fontWeight: 500, marginBottom: '6px', display: 'block' }}>Description</label>
          <textarea 
            className="form-input" 
            placeholder="Short description of the item"
            value={itemForm.description} 
            onChange={e => setItemForm({...itemForm, description: e.target.value})}
            rows="2"
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', resize: 'vertical' }}
          />
        </div>
        <div className="form-group mb-md">
          <label className="form-label" style={{ fontWeight: 500, marginBottom: '6px', display: 'block' }}>Description (Nepali)</label>
          <textarea 
            className="form-input" 
            placeholder="छोटो विवरण"
            value={itemForm.description_np} 
            onChange={e => setItemForm({...itemForm, description_np: e.target.value})}
            rows="2"
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', resize: 'vertical' }}
          />
        </div>
        <div className="flex gap-md mb-md">
          <div className="form-group flex-1">
            <label className="form-label" style={{ fontWeight: 500, marginBottom: '6px', display: 'block' }}>Price (NPR) *</label>
            <input 
              type="number" 
              className="form-input" 
              placeholder="0.00"
              value={itemForm.price} 
              onChange={e => setItemForm({...itemForm, price: e.target.value})} 
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="form-group flex-1">
            <label className="form-label" style={{ fontWeight: 500, marginBottom: '6px', display: 'block' }}>Sort Order</label>
            <input 
              type="number" 
              className="form-input" 
              value={itemForm.sort_order} 
              onChange={e => setItemForm({...itemForm, sort_order: parseInt(e.target.value) || 0})} 
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>
        <div className="form-group mb-md">
          <label className="form-label" style={{ fontWeight: 500, marginBottom: '6px', display: 'block' }}>Upload Image</label>
          <div className="flex align-center gap-md">
            {(itemForm.image_file || itemForm.image_url) && (
              <img 
                src={itemForm.image_file ? URL.createObjectURL(itemForm.image_file) : itemForm.image_url} 
                alt="Preview" 
                style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }} 
              />
            )}
            <input 
              type="file" 
              accept="image/*"
              className="form-input flex-1" 
              onChange={e => setItemForm({...itemForm, image_file: e.target.files[0]})} 
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>
        <div className="flex gap-lg mt-md" style={{ padding: '15px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <label className="flex align-center gap-sm" style={{ cursor: 'pointer', fontWeight: 500 }}>
            <input 
              type="checkbox" 
              checked={itemForm.is_veg} 
              onChange={e => setItemForm({...itemForm, is_veg: e.target.checked})} 
              style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
            />
            Vegetarian
          </label>
          <label className="flex align-center gap-sm" style={{ cursor: 'pointer', fontWeight: 500 }}>
            <input 
              type="checkbox" 
              checked={itemForm.is_available} 
              onChange={e => setItemForm({...itemForm, is_available: e.target.checked})} 
              style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)' }}
            />
            Available (In Stock)
          </label>
        </div>
      </Modal>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hover-danger:hover {
          background-color: rgba(230, 57, 70, 0.1) !important;
          border-color: rgba(230, 57, 70, 0.2) !important;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(230, 57, 70, 0.2);
          border-left-color: var(--accent-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .form-input:focus, .form-select:focus {
          outline: none;
          border-color: var(--accent-primary) !important;
          box-shadow: 0 0 0 3px rgba(230, 57, 70, 0.1);
        }
      `}</style>
    </div>
  );
}
