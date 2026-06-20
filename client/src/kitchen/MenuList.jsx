import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import SearchBar from '../components/SearchBar';
import { useAuth } from '../contexts/AuthContext';
import { checkStationMatch } from '../utils/helpers';

export default function MenuList() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [itemsRes, catsRes] = await Promise.all([
        api.get('/menu'),
        api.get('/menu/categories')
      ]);
      setItems(itemsRes.data);
      setCategories(catsRes.data);
    } catch (error) {
      showToast('Failed to load menu', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStock = async (id) => {
    try {
      await api.patch(`/menu/items/${id}/stock`);
      // Update local state immediately
      setItems(prev => prev.map(item => 
        item.id === id ? { ...item, is_available: !item.is_available } : item
      ));
    } catch (error) {
      showToast('Failed to update stock status', 'error');
    }
  };

  let filteredItems = items;
  
  if (user?.station_id) {
    filteredItems = filteredItems.filter(item => {
      const cat = categories.find(c => c.id === item.category_id);
      return checkStationMatch(item.station_ids, cat?.station_ids, user.station_id);
    });
  }

  if (activeCategory !== 'all') {
    filteredItems = filteredItems.filter(i => i.category_id == activeCategory);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredItems = filteredItems.filter(i => i.name.toLowerCase().includes(q));
  }

  filteredItems = filteredItems.sort((a, b) => {
    if (sortBy === 'category') {
      return (a.category_name || '').localeCompare(b.category_name || '') || a.name.localeCompare(b.name);
    } else if (sortBy === 'stock') {
      if (a.is_available === b.is_available) return a.name.localeCompare(b.name);
      return a.is_available ? 1 : -1;
    }
    return a.name.localeCompare(b.name);
  });

  if (isLoading) return <div className="flex-center text-muted">Loading menu...</div>;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="flex gap-md mb-md align-center">
        <div style={{ flex: 1 }}>
          <SearchBar 
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search menu items..."
          />
        </div>
        <select 
          className="form-select" 
          style={{ width: 180 }}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="name">Sort by Name</option>
          <option value="category">Sort by Category</option>
          <option value="stock">Out of Stock First</option>
        </select>
        <select 
          className="form-select" 
          style={{ width: 180 }}
          value={activeCategory}
          onChange={(e) => setActiveCategory(e.target.value)}
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Stock Status</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map(item => (
              <tr key={item.id} style={{ opacity: item.is_available ? 1 : 0.6 }}>
                <td>
                  <div className="flex align-center gap-sm">
                    <img src={item.image_url} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                    <span style={{ fontWeight: 600 }}>{item.name}</span>
                  </div>
                </td>
                <td className="text-secondary">{item.category_name}</td>
                <td>
                  <span className={`badge ${item.is_available ? 'badge-success' : 'badge-danger'}`}>
                    {item.is_available ? 'In Stock' : 'Out of Stock'}
                  </span>
                </td>
                <td className="text-right">
                  <button 
                    className={`btn btn-sm ${item.is_available ? 'btn-danger' : 'btn-success'}`}
                    onClick={() => handleToggleStock(item.id)}
                  >
                    Mark as {item.is_available ? 'Out of Stock' : 'In Stock'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
