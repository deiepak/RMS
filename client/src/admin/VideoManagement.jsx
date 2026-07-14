import React, { useState, useEffect } from 'react';
import { Video, CheckCircle, Clock, Phone, User, Calendar, Download } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';

export default function VideoManagement() {
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'sent'
  const { showToast } = useToast();
  
  const [filters, setFilters] = useState({
    period: 'today',
    from: '',
    to: ''
  });

  const setDateRange = (period) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const endOfDay = new Date();
    endOfDay.setHours(23,59,59,999);
    
    let fromDate = new Date(today);
    
    if (period === 'today') {
      fromDate = today;
    } else if (period === 'week') {
      fromDate.setDate(today.getDate() - 7);
    } else if (period === 'month') {
      fromDate.setMonth(today.getMonth() - 1);
    }

    if (period !== 'custom') {
      setFilters(prev => ({
        ...prev,
        period,
        from: fromDate.toISOString().split('T')[0],
        to: endOfDay.toISOString().split('T')[0]
      }));
    } else {
      setFilters(prev => ({ ...prev, period }));
    }
  };

  useEffect(() => {
    setDateRange('today');
  }, []);

  useEffect(() => {
    if (filters.from && filters.to) {
      fetchVideos();
    }
  }, [filters]);

  const fetchVideos = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`/adventures/videos?from=${filters.from}%2000:00:00&to=${filters.to}%2023:59:59`);
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

  const handleExportCsv = () => {
    const dataToExport = activeTab === 'pending' ? pendingVideos : sentVideos;
    if (dataToExport.length === 0) {
      showToast('No data to export for the active tab', 'error');
      return;
    }

    const headers = activeTab === 'pending' 
      ? ['Order ID', 'Customer', 'Phone Number', 'Requested At', 'Status']
      : ['Order ID', 'Customer', 'Phone Number', 'Requested At', 'Sent At', 'Status'];

    const rows = dataToExport.map(v => {
      const base = [
        `#${v.order_id}`,
        `"${v.customer_name?.replace(/"/g, '""') || 'Guest'}"`,
        `"${v.phone_number}"`,
        new Date(v.created_at).toLocaleString().replace(/,/g, '')
      ];
      if (activeTab === 'pending') {
        return [...base, 'PENDING'];
      } else {
        return [...base, new Date(v.sent_at).toLocaleString().replace(/,/g, ''), 'SENT'];
      }
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `video-requests_${activeTab}_${filters.from}_to_${filters.to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="admin-content" style={{ animation: 'fadeIn 0.3s ease-in-out', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="admin-header flex justify-between align-center mb-lg">
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '24px', fontWeight: 600 }}>Video Management</h2>
          <p className="text-secondary" style={{ margin: '5px 0 0 0', fontSize: '14px' }}>Track and fulfill customer video requests</p>
        </div>
        <button className="btn btn-secondary flex align-center gap-sm" onClick={handleExportCsv} disabled={(activeTab === 'pending' ? pendingVideos : sentVideos).length === 0}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="card mb-lg" style={{ padding: 20 }}>
        <div className="flex gap-lg flex-wrap align-center">
          <div className="filter-bar">
            <button className={`filter-btn ${filters.period === 'today' ? 'active' : ''}`} onClick={() => setDateRange('today')}>Today</button>
            <button className={`filter-btn ${filters.period === 'week' ? 'active' : ''}`} onClick={() => setDateRange('week')}>This Week</button>
            <button className={`filter-btn ${filters.period === 'month' ? 'active' : ''}`} onClick={() => setDateRange('month')}>This Month</button>
            <button className={`filter-btn ${filters.period === 'custom' ? 'active' : ''}`} onClick={() => setDateRange('custom')}>Custom</button>
          </div>

          {filters.period === 'custom' && (
            <div className="flex gap-md align-center">
              <input type="date" className="form-input" value={filters.from} onChange={e => setFilters(prev => ({...prev, from: e.target.value}))} />
              <span>to</span>
              <input type="date" className="form-input" value={filters.to} onChange={e => setFilters(prev => ({...prev, to: e.target.value}))} />
            </div>
          )}
        </div>
      </div>

      <div className="tab-bar mb-lg" style={{ display: 'inline-flex' }}>
        <button className={`tab-item ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
          Pending Requests ({pendingVideos.length})
        </button>
        <button className={`tab-item ${activeTab === 'sent' ? 'active' : ''}`} onClick={() => setActiveTab('sent')}>
          Sent History ({sentVideos.length})
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center align-center" style={{ height: '200px' }}>
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="card flex-1 flex flex-col" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', minHeight: 0 }}>
          {activeTab === 'pending' ? (
            <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
              <h3 className="flex align-center gap-sm m-0 mb-md" style={{ color: 'var(--warning)', fontWeight: 700 }}>
                <Clock size={20} /> Pending Requests ({pendingVideos.length})
              </h3>
              
              <div className="flex-1 overflow-y-auto" style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', minHeight: 0 }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-tertiary)', zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Order ID</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Customer</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Phone Number</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Requested At</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingVideos.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center text-muted" style={{ padding: '40px' }}>
                          <Video size={48} style={{ opacity: 0.5, margin: '0 auto 10px auto', display: 'block' }} />
                          <div>No pending video requests!</div>
                        </td>
                      </tr>
                    ) : (
                      pendingVideos.map(video => (
                        <tr key={video.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                            #{video.order_id}
                            <span style={{ fontSize: '10px', background: 'var(--warning-light)', color: 'var(--warning)', padding: '2px 6px', borderRadius: '12px', fontWeight: 700, marginLeft: '8px' }}>PENDING</span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div className="flex align-center gap-sm font-medium">
                              <User size={14} className="text-muted" /> {video.customer_name || 'Guest'}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                            <div className="flex align-center gap-sm font-bold">
                              <Phone size={14} className="text-muted" /> {video.phone_number}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                            <div className="flex align-center gap-sm text-muted" style={{ fontSize: '13px' }}>
                              <Calendar size={14} /> {new Date(video.created_at).toLocaleString()}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <button 
                              className="btn btn-primary btn-sm flex align-center gap-sm ml-auto"
                              style={{ padding: '8px 16px', fontWeight: 700, borderRadius: '8px' }}
                              onClick={() => markAsSent(video.id)}
                            >
                              <CheckCircle size={16} /> Mark as Sent
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
              <h3 className="flex align-center gap-sm m-0 mb-md" style={{ color: 'var(--success)', fontWeight: 700 }}>
                <CheckCircle size={20} /> Sent History ({sentVideos.length})
              </h3>

              <div className="flex-1 overflow-y-auto" style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', minHeight: 0 }}>
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
          )}
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
