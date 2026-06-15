import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { LogOut, Video, StopCircle, Monitor } from 'lucide-react';

export default function CameramanPortal() {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [tvs, setTvs] = useState([]);
  const [selectedTv, setSelectedTv] = useState('all');
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  
  const [isLive, setIsLive] = useState(false);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const canvasRef = useRef(null);
  const liveIntervalRef = useRef(null);
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    if (!user || user.role !== 'cameraman') {
      navigate('/');
      return;
    }

    if (socket) {
      socket.emit('tv:get_list');
      
      socket.on('tv:list', (list) => {
        setTvs(list);
      });

      return () => {
        socket.off('tv:list');
      };
    }
  }, [socket, user, navigate]);

  useEffect(() => {
    const getDevices = async () => {
      if (!navigator.mediaDevices) {
        setCameraError('Camera access requires a secure HTTPS connection. Please use the localtunnel link or set up HTTPS.');
        return;
      }
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        const devs = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = devs.filter(d => d.kind === 'videoinput');
        setDevices(videoDevs);
        if (videoDevs.length > 0) {
          setSelectedDevice(videoDevs[0].deviceId);
        }
      } catch (e) {
        setCameraError('Camera permission denied or camera not available.');
      }
    };
    getDevices();
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      startLocalVideo(selectedDevice);
    }
    return () => {
      stopLocalVideo();
    };
  }, [selectedDevice]);

  const startLocalVideo = async (deviceId) => {
    stopLocalVideo();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false // audio not required per specs unless asked
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (e) {
      showToast('Error accessing camera', 'error');
    }
  };

  const stopLocalVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
  };

  const handleGoLive = () => {
    if (!localStreamRef.current || !localVideoRef.current) {
      return showToast('No camera stream available', 'error');
    }
    if (tvs.length === 0) {
      return showToast('No active TVs found', 'error');
    }

    setIsLive(true);
    socket.emit('tv:start_live', { targetId: selectedTv === 'all' ? null : selectedTv });

    // Stream video frames via Socket.io at ~10 FPS
    liveIntervalRef.current = setInterval(() => {
      if (localVideoRef.current && canvasRef.current) {
        const video = localVideoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        const targetAspectRatio = 16 / 9;
        const videoAspectRatio = video.videoWidth / video.videoHeight;
        
        let sx = 0, sy = 0, sWidth = video.videoWidth, sHeight = video.videoHeight;
        
        if (videoAspectRatio > targetAspectRatio) {
          sWidth = video.videoHeight * targetAspectRatio;
          sx = (video.videoWidth - sWidth) / 2;
        } else if (videoAspectRatio < targetAspectRatio) {
          sHeight = video.videoWidth / targetAspectRatio;
          sy = (video.videoHeight - sHeight) / 2;
        }

        if (canvas.width !== Math.floor(sWidth) || canvas.height !== Math.floor(sHeight)) {
          canvas.width = Math.floor(sWidth);
          canvas.height = Math.floor(sHeight);
        }

        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
        const frameData = canvas.toDataURL('image/jpeg', 0.6); // Compress to 60% quality

        socket.emit('tv:video_frame', { 
          targetId: selectedTv === 'all' ? null : selectedTv,
          frame: frameData
        });
      }
    }, 100); // 100ms = 10 FPS
  };

  const handleStopLive = () => {
    setIsLive(false);
    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
    }
    socket.emit('tv:stop_live', { targetId: selectedTv === 'all' ? null : selectedTv });
  };

  return (
    <div className="flex flex-col" style={{ height: '100vh', background: 'var(--bg-primary)' }}>
      <header className="flex justify-between align-center p-md" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        <h2 className="m-0 flex align-center gap-sm"><Video size={24} className="text-primary"/> Cameraman Portal</h2>
        <button className="btn btn-secondary flex align-center gap-sm" onClick={logout}>
          <LogOut size={16} /> Logout
        </button>
      </header>

      <main className="flex-1 flex flex-col align-center p-lg" style={{ gap: '24px' }}>
        {cameraError ? (
          <div className="card p-xl" style={{ width: '100%', maxWidth: 800, textAlign: 'center' }}>
            <h3 className="text-danger mb-md">Camera Access Failed</h3>
            <p className="text-secondary">{cameraError}</p>
          </div>
        ) : (
          <div className="card p-xl" style={{ width: '100%', maxWidth: 800 }}>
            <div className="flex gap-md mb-lg">
              <div className="form-group flex-1">
                <label className="form-label">Select Camera</label>
              <select 
                className="form-select" 
                value={selectedDevice} 
                onChange={e => setSelectedDevice(e.target.value)}
                disabled={isLive}
              >
                {devices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId}`}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group flex-1">
              <label className="form-label flex align-center gap-xs"><Monitor size={16}/> Broadcast Target</label>
              <select 
                className="form-select" 
                value={selectedTv} 
                onChange={e => setSelectedTv(e.target.value)}
                disabled={isLive}
              >
                <option value="all">All TVs ({tvs.length})</option>
                {tvs.map(tv => (
                  <option key={tv.id} value={tv.id}>{tv.name} ({tv.id})</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 12, overflow: 'hidden' }}>
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {isLive && (
              <div className="badge badge-danger" style={{ position: 'absolute', top: 16, right: 16, animation: 'pulse 2s infinite' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', display: 'inline-block', marginRight: 8 }}></span>
                LIVE
              </div>
            )}
          </div>

          <div className="flex-center mt-xl">
            {!isLive ? (
              <button className="btn btn-primary btn-lg" onClick={handleGoLive} style={{ width: 200, height: 60, fontSize: 18, borderRadius: 30 }}>
                <Video size={24} style={{ marginRight: 8 }}/> Go Live
              </button>
            ) : (
              <button className="btn btn-danger btn-lg" onClick={handleStopLive} style={{ width: 200, height: 60, fontSize: 18, borderRadius: 30 }}>
                <StopCircle size={24} style={{ marginRight: 8 }}/> Stop Live
              </button>
            )}
          </div>
          </div>
        )}
      </main>

      {/* Hidden canvas for frame extraction */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
