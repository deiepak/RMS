import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api/client';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';

export default function TVPortal() {
  const { user, logout } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();

  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [liveFeeds, setLiveFeeds] = useState(new Map()); // map of senderId -> media stream URL
  const peerConnections = useRef(new Map()); // map of senderId -> RTCPeerConnection

  const mediaRef = useRef(null);

  useEffect(() => {
    if (!user || user.role !== 'tv') {
      navigate('/');
      return;
    }

    if (socket) {
      socket.emit('tv:register', { name: user.name });

      const handleOffer = async ({ senderId, sdp }) => {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            socket.emit('tv:candidate', { targetId: senderId, candidate: e.candidate });
          }
        };

        pc.ontrack = (e) => {
          setLiveFeeds(prev => {
            const next = new Map(prev);
            next.set(senderId, e.streams[0]);
            return next;
          });
        };

        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('tv:answer', { targetId: senderId, sdp: answer });

        peerConnections.current.set(senderId, pc);
      };

      const handleCandidate = ({ senderId, candidate }) => {
        const pc = peerConnections.current.get(senderId);
        if (pc) pc.addIceCandidate(new RTCIceCandidate(candidate));
      };

      const handleStopLive = ({ senderId }) => {
        const pc = peerConnections.current.get(senderId);
        if (pc) pc.close();
        peerConnections.current.delete(senderId);
        setLiveFeeds(prev => {
          const next = new Map(prev);
          next.delete(senderId);
          return next;
        });
      };

      socket.on('tv:offer', handleOffer);
      socket.on('tv:candidate', handleCandidate);
      socket.on('tv:stop_live', handleStopLive);

      return () => {
        socket.off('tv:offer', handleOffer);
        socket.off('tv:candidate', handleCandidate);
        socket.off('tv:stop_live', handleStopLive);
      };
    }
  }, [socket, user, navigate]);

  useEffect(() => {
    // Fetch Playlist
    api.get('/tv/content').then(res => {
      // expand playlist based on occurrences
      let expanded = [];
      res.data.forEach(item => {
        for (let i = 0; i < item.occurrences_per_hour; i++) {
          expanded.push(item);
        }
      });
      setPlaylist(expanded);
    }).catch(console.error);
  }, []);

  // Media loop logic
  useEffect(() => {
    if (liveFeeds.size > 0 || playlist.length === 0) return;

    const currentMedia = playlist[currentIndex];
    if (currentMedia.type === 'photo') {
      const timer = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % playlist.length);
      }, currentMedia.duration_seconds * 1000);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, playlist, liveFeeds.size]);

  const handleVideoEnded = () => {
    setCurrentIndex((prev) => (prev + 1) % playlist.length);
  };

  const currentMedia = playlist[currentIndex];

  const renderLiveFeeds = () => {
    const feeds = Array.from(liveFeeds.values());
    let gridStyle = { width: '100vw', height: '100vh', display: 'grid' };
    
    if (feeds.length === 1) {
      gridStyle.gridTemplateColumns = '1fr';
    } else if (feeds.length === 2) {
      gridStyle.gridTemplateColumns = '1fr 1fr';
    } else {
      gridStyle.gridTemplateColumns = '1fr 1fr';
      gridStyle.gridTemplateRows = '1fr 1fr';
    }

    return (
      <div style={gridStyle}>
        {feeds.map((stream, idx) => (
          <video 
            key={idx}
            autoPlay 
            playsInline 
            style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
            ref={(el) => { if (el) el.srcObject = stream; }}
          />
        ))}
      </div>
    );
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden', position: 'relative' }}>
      {/* Hidden logout button in corner for admin convenience */}
      <button 
        onClick={logout} 
        className="btn btn-icon" 
        style={{ position: 'absolute', top: 20, right: 20, zIndex: 9999, background: 'rgba(0,0,0,0.5)', color: '#fff' }}
      >
        <LogOut size={20} />
      </button>

      {liveFeeds.size > 0 ? (
        renderLiveFeeds()
      ) : playlist.length > 0 && currentMedia ? (
        currentMedia.type === 'photo' ? (
          <img 
            src={`${import.meta.env.VITE_API_URL}${currentMedia.file_url}`} 
            alt="tv-content" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        ) : (
          <video 
            autoPlay 
            muted 
            ref={mediaRef}
            src={`${import.meta.env.VITE_API_URL}${currentMedia.file_url}`} 
            onEnded={handleVideoEnded}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        )
      ) : (
        <div className="flex-center" style={{ height: '100%', color: '#fff' }}>
          <h2>No TV Content Scheduled</h2>
        </div>
      )}
    </div>
  );
}
