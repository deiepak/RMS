import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ChefHat, ConciergeBell, Delete, QrCode, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import ThemeToggle from '../components/ThemeToggle';

const roles = [
  {
    id: 'admin',
    title: 'Admin Portal',
    subtitle: 'Manage everything',
    icon: Shield,
    gradient: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    glow: 'rgba(124, 58, 237, 0.4)',
    path: '/admin',
  },
  {
    id: 'kitchen',
    title: 'Kitchen Portal',
    subtitle: 'Manage orders & menu',
    icon: ChefHat,
    gradient: 'linear-gradient(135deg, #ea580c, #f59e0b)',
    glow: 'rgba(234, 88, 12, 0.4)',
    path: '/kitchen',
  },
  {
    id: 'waiter',
    title: 'Waiter Portal',
    subtitle: 'Serve customers',
    icon: ConciergeBell,
    gradient: 'linear-gradient(135deg, #0284c7, #06b6d4)',
    glow: 'rgba(2, 132, 199, 0.4)',
    path: '/waiter',
  },
];

const LandingPage = () => {
  const [pinModal, setPinModal] = useState(null); // role object
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const handleRoleClick = (role) => {
    setPinModal(role);
    setPin('');
    setError('');
  };

  const handleKeyPress = (digit) => {
    if (pin.length < 6) {
      setPin((prev) => prev + digit);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleSubmit = async () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(pinModal.id, pin);
      showToast(`Welcome to ${pinModal.title}!`, 'success');
      navigate(pinModal.path);
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid PIN. Please try again.';
      setError(msg);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-page">
      {/* Animated background */}
      <div className="landing-bg">
        <div className="landing-orb landing-orb-1" />
        <div className="landing-orb landing-orb-2" />
        <div className="landing-orb landing-orb-3" />
      </div>

      <div className="landing-content">
        <div className="landing-theme-toggle">
          <ThemeToggle />
        </div>

        <div className="landing-header animate-fadeIn">
          <h1 className="landing-title">{settings?.restaurant_name || 'Restaurant'}</h1>
          <p className="landing-subtitle">Restaurant Management System</p>
        </div>

        <div className="landing-roles">
          {roles.map((role, index) => {
            const Icon = role.icon;
            return (
              <button
                key={role.id}
                className="landing-role-card animate-slideUp"
                style={{
                  animationDelay: `${index * 0.1}s`,
                  '--card-gradient': role.gradient,
                  '--card-glow': role.glow,
                }}
                onClick={() => handleRoleClick(role)}
              >
                <div className="role-icon-wrapper" style={{ background: role.gradient }}>
                  <Icon size={32} color="white" />
                </div>
                <h3 className="role-title">{role.title}</h3>
                <p className="role-subtitle">{role.subtitle}</p>
              </button>
            );
          })}
        </div>

        <div className="landing-footer animate-fadeIn">
          <QrCode size={18} />
          <span>Customers: Scan the QR code at your table</span>
        </div>
      </div>

      {/* PIN Modal */}
      {pinModal && (
        <div className="modal-overlay" onClick={() => !loading && setPinModal(null)}>
          <div
            className="modal pin-modal animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pin-modal-header">
              <div
                className="pin-role-icon"
                style={{ background: pinModal.gradient }}
              >
                <pinModal.icon size={28} color="white" />
              </div>
              <h3>{pinModal.title}</h3>
              <p className="text-secondary">Enter your PIN to continue</p>
            </div>

            <div className="pin-dots">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`pin-dot ${i < pin.length ? 'filled' : ''}`}
                />
              ))}
            </div>

            {error && <p className="pin-error">{error}</p>}

            <div className="pin-keypad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <button
                  key={digit}
                  className="pin-key"
                  onClick={() => handleKeyPress(String(digit))}
                  disabled={loading}
                >
                  {digit}
                </button>
              ))}
              <button
                className="pin-key pin-key-action pin-key-clear"
                onClick={handleClear}
                disabled={loading}
              >
                C
              </button>
              <button
                className="pin-key"
                onClick={() => handleKeyPress('0')}
                disabled={loading}
              >
                0
              </button>
              <button
                className="pin-key pin-key-action pin-key-backspace"
                onClick={handleBackspace}
                disabled={loading}
              >
                <Delete size={22} />
              </button>
            </div>

            <button
              className="btn btn-primary w-full mt-md"
              onClick={handleSubmit}
              disabled={loading || pin.length < 4}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                'Login'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
