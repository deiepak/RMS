import React from 'react';
import { VideoOff, AlertOctagon, RefreshCw } from 'lucide-react';

export default function CCTVErrorOverlay({ error, onRetry, isConnecting }) {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      color: '#f8fafc',
      padding: '24px',
      textAlign: 'center',
      zIndex: 10,
      borderRadius: 'inherit'
    }}>
      <div style={{
        background: 'rgba(239, 68, 68, 0.1)',
        padding: '16px',
        borderRadius: '50%',
        marginBottom: '16px',
        border: '1px solid rgba(239, 68, 68, 0.2)'
      }}>
        {isConnecting ? (
          <RefreshCw size={32} color="#3b82f6" className="spinner" />
        ) : (
          <VideoOff size={32} color="#ef4444" />
        )}
      </div>

      <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 600, color: isConnecting ? '#3b82f6' : '#f8fafc' }}>
        {isConnecting ? 'Establishing Proxy Connection...' : 'Camera Feed Unavailable'}
      </h3>
      
      <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: '#94a3b8', maxWidth: '80%' }}>
        {error || 'The DVR/NVR is currently unable to provide this live stream or the channel is offline. Retrying automatically...'}
      </p>

      {!isConnecting && onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: '#ffffff',
            border: 'none',
            padding: '8px 20px',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
          }}
          onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
        >
          <RefreshCw size={14} />
          Force Reconnect
        </button>
      )}
    </div>
  );
}
