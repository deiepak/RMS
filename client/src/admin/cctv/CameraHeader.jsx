import React from 'react';
import { RefreshCw, Radio, Video, Shield, HardDrive } from 'lucide-react';

export default function CameraHeader({ 
  layout, 
  setLayout, 
  onRefresh, 
  isRefreshing, 
  totalCameras, 
  onlineCount,
  dvrInfo 
}) {
  return (
    <div className="cctv-header-container" style={{
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      color: '#f8fafc',
      padding: '20px 28px',
      borderRadius: '16px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
      marginBottom: '28px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      backdropFilter: 'blur(12px)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              padding: '10px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
            }}>
              <Video size={26} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 700, letterSpacing: '-0.03em', background: 'linear-gradient(to right, #f8fafc, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                CCTV Live Monitoring
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={14} color="#10b981" /> Single Source of Truth: {dvrInfo?.vendor || 'Sintech'} ({dvrInfo?.ecosystem || 'XMeye Pro Compatible'})
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            padding: '8px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HardDrive size={16} color="#8b5cf6" />
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Channels: <strong>{totalCameras} / 36</strong></span>
            </div>
            <div style={{ width: '1px', height: '20px', background: 'rgba(255, 255, 255, 0.1)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={16} color="#10b981" />
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Online: <strong style={{ color: '#10b981' }}>{onlineCount}</strong></span>
            </div>
          </div>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#f8fafc',
              padding: '10px 18px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: isRefreshing ? 'wait' : 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
          >
            <RefreshCw size={16} className={isRefreshing ? 'spinner' : ''} />
            {isRefreshing ? 'Discovering...' : 'Refresh Status'}
          </button>
        </div>
      </div>
    </div>
  );
}
