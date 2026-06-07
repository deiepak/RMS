import React, { useState, useEffect } from 'react';
import { Save, Building, MapPin, Phone, Globe, DollarSign, Percent } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../api/client';

const GeneralSettings = () => {
  const { settings, updateSettingsLocally } = useSettings();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    restaurant_name: '',
    restaurant_address: '',
    restaurant_phone: '',
    restaurant_website: '',
    currency_symbol: '',
    tip_roundoff_amount: '50',
    date_format: 'AD',
    max_discount_percent: '100'
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings && Object.keys(settings).length > 0 && settings.restaurant_name !== 'Loading...') {
      setFormData({
        restaurant_name: settings.restaurant_name || '',
        restaurant_address: settings.restaurant_address || '',
        restaurant_phone: settings.restaurant_phone || '',
        restaurant_website: settings.restaurant_website || '',
        currency_symbol: settings.currency_symbol || '',
        tip_roundoff_amount: settings.tip_roundoff_amount || '50',
        date_format: settings.date_format || 'AD',
        max_discount_percent: settings.max_discount_percent || '100'
      });
    }
  }, [settings]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.put('/settings', formData);
      updateSettingsLocally(formData);
      localStorage.setItem('rms_date_format', formData.date_format);
      showToast('Settings saved successfully!', 'success');
    } catch (error) {
      showToast('Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="admin-content" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      <div className="admin-header flex justify-between align-center mb-lg">
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '24px', fontWeight: 600 }}>General Settings</h2>
          <p className="text-secondary" style={{ margin: '5px 0 0 0', fontSize: '14px' }}>
            Manage global restaurant configuration
          </p>
        </div>
        <button 
          className="btn btn-primary flex align-center gap-sm" 
          onClick={handleSave}
          disabled={isSaving}
          style={{ padding: '10px 24px', boxShadow: '0 4px 12px rgba(230, 57, 70, 0.3)' }}
        >
          <Save size={18} />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="card" style={{ maxWidth: '800px' }}>
        <form onSubmit={handleSave} className="settings-form">
          
          <h3 className="mb-md" style={{ color: 'var(--text-primary)', fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            Basic Information
          </h3>
          
          <div className="form-group mb-md">
            <label className="form-label flex align-center gap-sm" style={{ fontWeight: 500, marginBottom: '8px' }}>
              <Building size={16} className="text-secondary" />
              Restaurant Name
            </label>
            <input 
              type="text" 
              name="restaurant_name"
              className="form-input" 
              value={formData.restaurant_name}
              onChange={handleChange}
              placeholder="e.g. Namaste Kitchen"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}
            />
          </div>

          <div className="form-group mb-md">
            <label className="form-label flex align-center gap-sm" style={{ fontWeight: 500, marginBottom: '8px' }}>
              <MapPin size={16} className="text-secondary" />
              Address
            </label>
            <input 
              type="text" 
              name="restaurant_address"
              className="form-input" 
              value={formData.restaurant_address}
              onChange={handleChange}
              placeholder="e.g. 123 Main Street"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}
            />
          </div>

          <div className="flex gap-md mb-xl">
            <div className="form-group flex-1">
              <label className="form-label flex align-center gap-sm" style={{ fontWeight: 500, marginBottom: '8px' }}>
                <Phone size={16} className="text-secondary" />
                Phone Number
              </label>
              <input 
                type="text" 
                name="restaurant_phone"
                className="form-input" 
                value={formData.restaurant_phone}
                onChange={handleChange}
                placeholder="e.g. +1 234 567 8900"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}
              />
            </div>
            
            <div className="form-group flex-1">
              <label className="form-label flex align-center gap-sm" style={{ fontWeight: 500, marginBottom: '8px' }}>
                <Globe size={16} className="text-secondary" />
                Website URL
              </label>
              <input 
                type="text" 
                name="restaurant_website"
                className="form-input" 
                value={formData.restaurant_website}
                onChange={handleChange}
                placeholder="e.g. www.example.com"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}
              />
            </div>
          </div>

          <h3 className="mb-md mt-lg" style={{ color: 'var(--text-primary)', fontSize: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            Billing Preferences
          </h3>

          <div className="flex gap-md">
            <div className="form-group flex-1">
              <label className="form-label flex align-center gap-sm" style={{ fontWeight: 500, marginBottom: '8px' }}>
                <DollarSign size={16} className="text-secondary" />
                Currency Symbol
              </label>
              <input 
                type="text" 
                name="currency_symbol"
                className="form-input" 
                value={formData.currency_symbol}
                onChange={handleChange}
                placeholder="$"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}
              />
            </div>
            
            <div className="form-group flex-1">
              <label className="form-label flex align-center gap-sm" style={{ fontWeight: 500, marginBottom: '8px' }}>
                <Percent size={16} className="text-secondary" />
                Default Tip Round-off
              </label>
              <input 
                type="number" 
                name="tip_roundoff_amount"
                className="form-input" 
                value={formData.tip_roundoff_amount}
                onChange={handleChange}
                placeholder="e.g. 50"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}
              />
              <small className="text-secondary" style={{ display: 'block', marginTop: '4px' }}>Rounds customer bill to next multiple (e.g. 50, 100). Set to 0 to disable.</small>
            </div>
            
            <div className="form-group flex-1">
              <label className="form-label flex align-center gap-sm" style={{ fontWeight: 500, marginBottom: '8px' }}>
                <Percent size={16} className="text-secondary" />
                Max Discount Limit (%)
              </label>
              <input 
                type="number" 
                name="max_discount_percent"
                className="form-input" 
                value={formData.max_discount_percent}
                onChange={handleChange}
                placeholder="e.g. 15"
                max="100"
                min="0"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}
              />
              <small className="text-secondary" style={{ display: 'block', marginTop: '4px' }}>Maximum allowed total discount per bill.</small>
            </div>
          </div>
          
          <div className="flex gap-md mt-md">
            <div className="form-group flex-1">
              <label className="form-label flex align-center gap-sm" style={{ fontWeight: 500, marginBottom: '8px' }}>
                <Percent size={16} className="text-secondary" />
                Date Format
              </label>
              <select 
                name="date_format"
                className="form-select" 
                value={formData.date_format}
                onChange={handleChange}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}
              >
                <option value="AD">Gregorian Date (AD)</option>
                <option value="BS">Nepali Date (Bikram Sambat - BS)</option>
              </select>
              <small className="text-secondary" style={{ display: 'block', marginTop: '4px' }}>Choose the default calendar format used across the system.</small>
            </div>
            <div className="flex-1"></div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GeneralSettings;
