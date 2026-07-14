import React, { useState, useEffect, useRef } from 'react';
import { cctvApi } from '../../api/cctv';
import { socket } from '../../api/socket';
import CCTVErrorOverlay from './CCTVErrorOverlay';

export default function CameraPlayer({ camera, onEnlarge, isEnlarged }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState(null);
  
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isVisibleRef = useRef(false);

  const startStreaming = async () => {
    if (!camera || camera.status === 'offline') {
      setIsConnecting(false);
      setError('DVR reports camera is currently offline or unreachable.');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      
      await cctvApi.startStream({ 
        cameraId: camera.id, 
        streamType: isEnlarged ? 'main' : 'sub' 
      });

      setIsConnecting(false);
      setIsPlaying(true);
    } catch (err) {
      console.error(`Failed to start stream for ${camera.id}:`, err);
      setIsConnecting(false);
      setError('Stream connection dropped or timed out. Auto-reconnecting...');
      
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isVisibleRef.current) {
          startStreaming();
        }
      }, 5000);
    }
  };

  const stopStreaming = async () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setIsPlaying(false);
    try {
      await cctvApi.stopStream({ 
        cameraId: camera.id,
        streamType: isEnlarged ? 'main' : 'sub'
      });
    } catch (e) {
      console.error('Error stopping stream:', e);
    }
  };

  useEffect(() => {
    const handleFrame = (data) => {
      if (data.cameraId === camera.id) {
        if (imgRef.current) {
          imgRef.current.src = `data:image/jpeg;base64,${data.frame}`;
        }
        setIsConnecting(false);
        setError(null);
        setIsPlaying(true);
      }
    };

    const handleError = (data) => {
      if (data.cameraId === camera.id) {
        setError(data.error || 'Live video stream disconnected.');
        setIsConnecting(false);
      }
    };

    socket.on('cctv_frame', handleFrame);
    socket.on('cctv_error', handleError);

    return () => {
      socket.off('cctv_frame', handleFrame);
      socket.off('cctv_error', handleError);
    };
  }, [camera.id]);

  useEffect(() => {
    isVisibleRef.current = true;
    startStreaming();

    return () => {
      isVisibleRef.current = false;
      stopStreaming();
    };
  }, [camera.id, isEnlarged]);

  const handleFullscreen = (e) => {
    e.stopPropagation();
    if (onEnlarge) {
      onEnlarge(camera);
      cctvApi.logEvent({
        eventType: 'view_camera',
        cameraId: camera.id,
        description: `Expanded camera ${camera.name} (Channel ${camera.channelNumber}) to enlarged view`
      }).catch(e => console.error(e));
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: isEnlarged ? '100%' : 'auto',
        aspectRatio: isEnlarged ? 'auto' : '16 / 9',
        backgroundColor: '#0f172a',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        cursor: isEnlarged ? 'default' : 'pointer',
        transition: 'all 0.25s ease'
      }}
      onClick={() => {
        if (!isEnlarged && onEnlarge) handleFullscreen({ stopPropagation: () => {} });
      }}
      onMouseOver={(e) => {
        if (!isEnlarged) e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
      }}
      onMouseOut={(e) => {
        if (!isEnlarged) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      }}
    >
      {/* Live Physical Video Feed Container */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', backgroundColor: '#000' }}>
        <img
          ref={imgRef}
          alt={`Live feed of ${camera.name}`}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: (isConnecting || error) ? 'none' : 'block' }}
        />
      </div>

      {/* Error or Connecting Overlays */}
      {(isConnecting || error) && (
        <CCTVErrorOverlay 
          error={error} 
          isConnecting={isConnecting} 
          onRetry={startStreaming} 
        />
      )}
    </div>
  );
}
