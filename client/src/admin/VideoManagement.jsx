import React, { useState, useEffect } from 'react';
import { Video, CheckCircle, Clock, Phone, User, Calendar } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';

export default function VideoManagement() {
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/adventures/videos');
      setVideos(res.data);
    } catch (error) {
      showToast('Failed to load video requests', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const markAsSent = async (id) => {
    if (window.confirm('Are you sure you have sent the video to this customer?')) {
      try {
        await api.patch(`/adventures/videos/${id}/send`, { is_sent: true });
        showToast('Video marked as sent!', 'success');
        fetchVideos();
      } catch (error) {
        showToast('Failed to update status', 'error');
      }
    }
  };

  const pendingVideos = videos.filter(v => !v.is_sent);
  const sentVideos = videos.filter(v => v.is_sent);

  return (
    <div className="admin-content" style={{ animation: 'fadeIn 0.3s ease-in-out', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="admin-header flex justify-between align-center mb-lg">
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '24px', fontWeight: 600 }}>Video Management</h2>
          <p className="text-secondary" style={{ margin: '5px 0 0 0', fontSize: '14px' }}>Track and fulfill customer video requests</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center align-center" style={{ height: '200px' }}>
          <div className="spinner"></div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, overflow: 'hidden' }}>
          
          {/* Top Section: Pending Videos */}
          <div className="card" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
            <h3 className="flex align-center gap-sm m-0 mb-md" style={{ color: 'var(--warning)', fontWeight: 700 }}>
              <Clock size={20} /> Pending Requests ({pendingVideos.length})
            </h3>
            
            {pendingVideos.length === 0 ? (
              <div className="text-center text-muted p-lg" style={{ background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                <Video size={48} style={{ opacity: 0.5, marginBottom: '10px' }} />
                <div>No pending video requests!</div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '10px' }}>
                {pendingVideos.map(video => (
                  <div key={video.id} className="card" style={{ flex: '0 0 300px', padding: '20px', border: '1px solid var(--glass-border)', background: 'var(--bg-secondary)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <div className="flex justify-between align-center mb-md pb-md" style={{ borderBottom: '1px dashed var(--glass-border)' }}>
                      <div className="font-bold text-primary" style={{ fontSize: '18px' }}>Ord #{video.order_id}</div>
                      <span style={{ fontSize: '12px', background: 'var(--warning-light)', color: 'var(--warning)', padding: '4px 8px', borderRadius: '12px', fontWeight: 700 }}>PENDING</span>
                    </div>
                    
                    <div className="flex flex-col gap-sm mb-lg">
                      <div className="flex align-center gap-sm font-medium">
                        <User size={16} className="text-muted" /> {video.customer_name || 'Guest'}
                      </div>
                      <div className="flex align-center gap-sm font-bold" style={{ fontSize: '18px' }}>
                        <Phone size={16} className="text-muted" /> {video.phone_number}
                      </div>
                      <div className="flex align-center gap-sm text-muted" style={{ fontSize: '13px' }}>
                        <Calendar size={14} /> {new Date(video.created_at).toLocaleString()}
                      </div>
                    </div>

                    <button 
                      className="btn btn-primary w-full flex-center justify-center gap-sm"
                      style={{ padding: '12px', fontWeight: 700, borderRadius: '8px' }}
                      onClick={() => markAsSent(video.id)}
                    >
                      <CheckCircle size={18} /> Mark as Sent
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Section: Sent Log */}
          <div className="card flex-1 flex flex-col" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', minHeight: 0 }}>
            <h3 className="flex align-center gap-sm m-0 mb-md" style={{ color: 'var(--success)', fontWeight: 700 }}>
              <CheckCircle size={20} /> Sent History ({sentVideos.length})
            </h3>

            <div className="flex-1 overflow-y-auto" style={{ border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-tertiary)', zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Order ID</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Customer</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Phone Number</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Requested At</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {sentVideos.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center text-muted" style={{ padding: '30px' }}>No sent videos yet</td>
                    </tr>
                  ) : (
                    sentVideos.map(video => (
                      <tr key={video.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>#{video.order_id}</td>
                        <td style={{ padding: '12px 16px' }}>{video.customer_name || 'Guest'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{video.phone_number}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{new Date(video.created_at).toLocaleString()}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--success)', fontWeight: 500 }}>{new Date(video.sent_at).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .spinner {
          width: 40px; height: 40px;
          border: 4px solid rgba(230, 57, 70, 0.2);
          border-left-color: var(--primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
