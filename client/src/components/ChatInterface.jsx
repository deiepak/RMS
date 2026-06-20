import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { Send, Users, ChefHat, ConciergeBell, Clock, Mic, Square, X } from 'lucide-react';
import { timeAgo } from '../utils/helpers';
import { subscribeToEvent, unsubscribeFromEvent } from '../api/socket';

export default function ChatInterface({ fullHeight = true }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [stations, setStations] = useState([]);
  const [targetRole, setTargetRole] = useState('Everyone');
  const [targetStations, setTargetStations] = useState([]); 
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { showToast } = useToast();

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    fetchMessages();
    fetchStations();

    const handleNewMessage = () => {
      fetchMessages(); // Refresh history when a message arrives
    };

    subscribeToEvent('admin:message', handleNewMessage);
    subscribeToEvent('chat:message', handleNewMessage); // We will rename the event if needed, or just use admin:message

    return () => {
      unsubscribeFromEvent('admin:message', handleNewMessage);
      unsubscribeFromEvent('chat:message', handleNewMessage);
    };
  }, []);

  const fetchStations = async () => {
    try {
      const res = await api.get('/stations');
      setStations(res.data);
    } catch (error) {
      console.error('Failed to load stations');
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await api.get('/messages');
      setMessages(res.data);
    } catch (error) {
      showToast('Failed to load message history', 'error');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm; codecs="opus"')) {
        options = { mimeType: 'audio/webm; codecs="opus"' };
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      }
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      const streamId = Math.random().toString(36).substring(7); // unique id for this stream
      let chunkIndex = 0;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          // Send live chunk over socket
          const reader = new FileReader();
          reader.readAsDataURL(event.data);
          reader.onloadend = () => {
            const base64Data = reader.result;
            const { socket } = require('../api/socket');
            socket.emit('chat:voice-chunk', {
              target_role: targetRole,
              target_stations: targetRole !== 'Everyone' && targetStations.length > 0 ? targetStations : null,
              chunk: base64Data,
              streamId,
              isFirstChunk: chunkIndex === 0
            });
            chunkIndex++;
          };
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        // Also save the whole audio message to history
        if (audioBlob.size > 0) {
          try {
            setIsSending(true);
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            const audioBase64 = await new Promise((resolve) => {
              reader.onloadend = () => resolve(reader.result);
            });

            await api.post('/messages', { 
              target_role: targetRole, 
              content: '',
              target_stations: targetRole !== 'Everyone' && targetStations.length > 0 ? targetStations : null,
              audio_data: audioBase64
            });
            showToast('Voice message sent!', 'success');
            fetchMessages(); 
          } catch (error) {
            showToast('Failed to save voice message history', 'error');
          } finally {
            setIsSending(false);
          }
        }
      };

      mediaRecorder.start(250); // Emit chunks every 250ms for live walkie-talkie feel
      setIsRecording(true);
    } catch (err) {
      showToast('Microphone access denied or not available', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!content.trim()) return;

    try {
      setIsSending(true);
      await api.post('/messages', { 
        target_role: targetRole, 
        content,
        target_stations: targetRole !== 'Everyone' && targetStations.length > 0 ? targetStations : null,
        audio_data: null
      });
      showToast('Message sent successfully', 'success');
      setContent('');
      setTargetStations([]);
      fetchMessages(); 
    } catch (error) {
      showToast('Failed to send message', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const getTargetIcon = (target) => {
    switch(target) {
      case 'Everyone': return <Users size={16} />;
      case 'All Kitchen Staff': return <ChefHat size={16} />;
      case 'All Waiters': return <ConciergeBell size={16} />;
      default: return <Users size={16} />;
    }
  };

  const getTargetColor = (target) => {
    switch(target) {
      case 'Everyone': return 'var(--accent-primary)';
      case 'All Kitchen Staff': return 'var(--warning)';
      case 'All Waiters': return 'var(--info)';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div className="flex gap-lg" style={fullHeight ? { flex: 1, minHeight: 0, height: '100%' } : { display: 'flex', flexWrap: 'wrap' }}>
      <div className="card flex-1 flex-col" style={{ maxWidth: fullHeight ? 400 : '100%', minWidth: 300 }}>
        <div className="card-header">
          <h3 style={{ fontSize: 16 }}>Send Announcement</h3>
        </div>
        <div className="card-body flex-col gap-lg flex-1">
          <form onSubmit={handleSend} className="flex-col gap-md" style={{ height: '100%' }}>
            <div className="form-group">
              <label className="form-label">To (Target Audience)</label>
              <select className="form-select" value={targetRole} onChange={e => {
                setTargetRole(e.target.value);
                setTargetStations([]);
              }}>
                <option value="Everyone">Everyone (All Portals)</option>
                <option value="All Kitchen Staff">Kitchen Staff</option>
                <option value="All Waiters">Waiters</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            {targetRole !== 'Everyone' && targetRole !== 'Admin' && (
              <div className="form-group">
                <label className="form-label">Sub Channel (Target Stations)</label>
                <div className="bg-secondary p-sm" style={{ borderRadius: 'var(--radius)', maxHeight: '120px', overflowY: 'auto' }}>
                  <label className="flex align-center gap-sm" style={{ cursor: 'pointer', padding: '6px 8px' }}>
                    <input 
                      type="checkbox" 
                      checked={targetStations.length === 0}
                      onChange={() => setTargetStations([])}
                    />
                    <span>Broadcast to All</span>
                  </label>
                  {stations.filter(s => targetRole === 'All Kitchen Staff' ? s.type === 'kitchen' : s.type === 'waiter').map(station => (
                    <label key={station.id} className="flex align-center gap-sm" style={{ cursor: 'pointer', padding: '6px 8px' }}>
                      <input 
                        type="checkbox" 
                        checked={targetStations.includes(station.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTargetStations([...targetStations, station.id]);
                          } else {
                            setTargetStations(targetStations.filter(id => id !== station.id));
                          }
                        }}
                      />
                      <span>{station.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <label className="form-label flex justify-between align-center">
                Message Content (Voice or Text)
                {isRecording && <span className="text-danger flex align-center gap-sm" style={{ fontSize: 12, fontWeight: 'bold' }}><span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--danger)', display: 'inline-block', animation: 'pulse 1s infinite' }}></span> Recording...</span>}
              </label>
              
              <div className="flex flex-col gap-sm" style={{ flex: 1 }}>
                <textarea 
                  className="form-input" 
                  style={{ flex: 1, resize: 'none', minHeight: 100 }}
                  placeholder="Type your announcement here, OR use the microphone below for a voice broadcast."
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                ></textarea>
                
                <button 
                  type="button"
                  className={`btn ${isRecording ? 'btn-danger' : 'btn-secondary'} flex-center gap-sm`}
                  style={{ padding: '16px' }}
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onMouseLeave={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                >
                  {isRecording ? <><Square size={18} /> Release to Send</> : <><Mic size={18} /> Hold to Record Live Broadcast</>}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px' }} disabled={isSending || (!content.trim() && !isRecording)}>
              {isSending ? 'Sending...' : <><Send size={18} /> Send Text Broadcast</>}
            </button>
          </form>
        </div>
      </div>

      <div className="card flex-1 flex-col" style={{ minWidth: 300, maxHeight: fullHeight ? 'none' : '500px', overflow: 'hidden', display: 'flex' }}>
        <div className="card-header">
          <h3 style={{ fontSize: 16 }}>Broadcast History</h3>
        </div>
        <div className="card-body flex-col gap-md" style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          {messages.length === 0 ? (
            <div className="flex-center text-muted" style={{ height: '100%' }}>
              No messages sent yet
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} style={{ 
                padding: '16px', 
                backgroundColor: 'var(--bg-primary)', 
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div className="flex justify-between align-start mb-xs">
                  <div className="flex align-center gap-sm">
                    <div style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, borderRadius: '50%',
                      backgroundColor: 'var(--bg-secondary)', 
                      color: getTargetColor(msg.target_role)
                    }}>
                      {getTargetIcon(msg.target_role)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>To: {msg.target_role}</div>
                      {msg.target_stations && msg.target_stations.length > 0 && (
                        <div className="text-secondary" style={{ fontSize: 11 }}>Specific Stations</div>
                      )}
                    </div>
                  </div>
                  <div className="flex align-center gap-xs text-secondary" style={{ fontSize: 12 }}>
                    <Clock size={12} /> {timeAgo(new Date(msg.created_at))}
                  </div>
                </div>
                
                {msg.content && (
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: 'var(--bg-secondary)', 
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    lineHeight: 1.5
                  }}>
                    {msg.content}
                  </div>
                )}
                
                {msg.audio_data && (
                  <div className="mt-sm">
                    <audio src={msg.audio_data} controls style={{ width: '100%', height: '36px' }} />
                  </div>
                )}
                
                <div className="text-secondary text-right mt-xs" style={{ fontSize: 11 }}>
                  Sent by: <span style={{ fontWeight: 500 }}>{msg.sender_name}</span> ({msg.sender_role})
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
