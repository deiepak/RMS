import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { LogOut, Video, StopCircle, Monitor } from 'lucide-react';

export default function CameramanPortal() {
  const { user, logout } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [tvs, setTvs] = useState([]);
  const [selectedTv, setSelectedTv] = useState('all');
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  
  const [isLive, setIsLive] = useState(false);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnections = useRef(new Map());

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

      socket.on('tv:answer', async ({ senderId, sdp }) => {
        const pc = peerConnections.current.get(senderId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        }
      });

      socket.on('tv:candidate', ({ senderId, candidate }) => {
        const pc = peerConnections.current.get(senderId);
        if (pc) {
          pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });

      return () => {
        socket.off('tv:list');
        socket.off('tv:answer');
        socket.off('tv:candidate');
      };
    }
  }, [socket, user, navigate]);

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        const devs = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = devs.filter(d => d.kind === 'videoinput');
        setDevices(videoDevs);
        if (videoDevs.length > 0) {
          setSelectedDevice(videoDevs[0].deviceId);
        }
      } catch (e) {
        showToast('Camera permission denied', 'error');
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

  const handleGoLive = async () => {
    if (!localStreamRef.current) {
      return showToast('No camera stream available', 'error');
    }
    if (tvs.length === 0) {
      return showToast('No active TVs found', 'error');
    }

    setIsLive(true);
    socket.emit('tv:start_live', { targetId: selectedTv === 'all' ? null : selectedTv });

    const targetTvs = selectedTv === 'all' ? tvs : tvs.filter(t => t.id === selectedTv);

    for (const tv of targetTvs) {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('tv:candidate', { targetId: tv.id, candidate: e.candidate });
        }
      };

      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socket.emit('tv:offer', { targetId: tv.id, sdp: offer });
      peerConnections.current.set(tv.id, pc);
    }
  };

  const handleStopLive = () => {
    setIsLive(false);
    socket.emit('tv:stop_live', { targetId: selectedTv === 'all' ? null : selectedTv });
    
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
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
      </main>
    </div>
  );
}
