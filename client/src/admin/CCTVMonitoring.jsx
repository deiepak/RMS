import React, { useState, useEffect } from 'react';
import { cctvApi } from '../api/cctv';
import CameraHeader from './cctv/CameraHeader';
import CameraGrid from './cctv/CameraGrid';
import CameraPlayer from './cctv/CameraPlayer';
import { useToast } from '../contexts/ToastContext';
import { X } from 'lucide-react';

export default function CCTVMonitoring() {
  const [cameras, setCameras] = useState([]);
  const [layout, setLayout] = useState(16); // Default 16 channels
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [enlargedCamera, setEnlargedCamera] = useState(null);
  const { showToast } = useToast();

  const dvrInfo = {
    vendor: "Sintech",
    ecosystem: "XMeye Pro Compatible",
    firmware: "V4.03.R11.C638025B",
    status: "Connected"
  };

  const fetchCameras = async (silent = false) => {
    try {
      setIsRefreshing(true);
      const data = await cctvApi.getCameras();
      setCameras(data.data || []);
      if (!silent) showToast('Camera status successfully refreshed from DVR', 'success');
    } catch (error) {
      console.error('Failed to fetch cameras:', error);
      showToast('Failed to connect to NVR/DVR for status update', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Log user opening the CCTV page
    cctvApi.logEvent({
      eventType: 'view_page',
      description: 'Admin accessed the CCTV Monitoring dashboard'
    }).catch(e => console.error(e));

    fetchCameras(true);

    // Auto-refresh camera availability every 30 seconds
    const interval = setInterval(() => {
      fetchCameras(true);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const onlineCount = cameras.filter(c => c.status === 'online').length;

  return (
    <div className="cctv-monitoring-page" style={{ padding: '0 12px', position: 'relative' }}>
      <CameraHeader
        layout={layout}
        setLayout={setLayout}
        onRefresh={() => fetchCameras(false)}
        isRefreshing={isRefreshing}
        totalCameras={cameras.length}
        onlineCount={onlineCount}
        dvrInfo={dvrInfo}
      />

      <CameraGrid
        cameras={cameras}
        layout={layout}
        onEnlarge={(camera) => setEnlargedCamera(camera)}
      />

      {/* Enlarged Modal View */}
      {enlargedCamera && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(16px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px'
          }}
          onClick={() => setEnlargedCamera(null)}
        >
          <div
            style={{
              position: 'relative',
              width: '90%',
              height: '90%',
              maxWidth: '1400px',
              maxHeight: '900px',
              backgroundColor: '#0f172a',
              borderRadius: '24px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.15)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setEnlargedCamera(null)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                color: '#ffffff',
                padding: '10px',
                borderRadius: '50%',
                cursor: 'pointer',
                zIndex: 50,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.8)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
            >
              <X size={24} />
            </button>

            <CameraPlayer
              camera={enlargedCamera}
              isEnlarged={true}
              onEnlarge={() => {}}
            />
          </div>
        </div>
      )}
    </div>
  );
}
