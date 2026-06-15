import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Trash2, MonitorPlay, Image as ImageIcon, Video, Plus, Clock } from 'lucide-react';

export default function TVContentManagement() {
  const [contentList, setContentList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const { showToast } = useToast();

  const fileInputRef = useRef(null);
  
  const [form, setForm] = useState({
    type: 'photo',
    file: null,
    duration_seconds: 10,
    occurrences_per_hour: 1,
    display_order: 0
  });

  const [videoDuration, setVideoDuration] = useState(0);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const res = await api.get('/tv/content');
      setContentList(res.data);
    } catch (e) {
      showToast('Failed to fetch TV content', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    setForm(prev => ({ ...prev, file, type: isVideo ? 'video' : 'photo' }));

    if (isVideo) {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        setVideoDuration(Math.round(video.duration));
        URL.revokeObjectURL(url);
      };
      video.src = url;
    } else {
      setVideoDuration(0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.file) {
      return showToast('Please select a file', 'error');
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('media', form.file);
    formData.append('type', form.type);
    formData.append('occurrences_per_hour', form.occurrences_per_hour);
    formData.append('display_order', form.display_order);
    
    // If it's video, use calculated duration. Else use form duration.
    formData.append('duration_seconds', form.type === 'video' ? videoDuration : form.duration_seconds);

    try {
      await api.post('/tv/content', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showToast('Content uploaded successfully', 'success');
      setForm({ type: 'photo', file: null, duration_seconds: 10, occurrences_per_hour: 1, display_order: 0 });
      if (fileInputRef.current) fileInputRef.current.value = '';
      setVideoDuration(0);
      fetchContent();
    } catch (err) {
      showToast(err.response?.data?.error || 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this media?')) return;
    try {
      await api.delete(`/tv/content/${id}`);
      showToast('Deleted successfully', 'success');
      fetchContent();
    } catch (e) {
      showToast('Failed to delete', 'error');
    }
  };

  // Calculate total seconds per hour
  const totalSeconds = contentList.reduce((acc, item) => {
    return acc + (item.duration_seconds * item.occurrences_per_hour);
  }, 0);

  const totalMinutes = Math.floor(totalSeconds / 60);
  const remainderSeconds = totalSeconds % 60;
  
  return (
    <div className="admin-content animate-fade-in">
      <div className="admin-header">
        <h2>TV Content Management</h2>
        <p className="text-secondary">Upload photos and videos to play on the park's TV displays.</p>
      </div>

      <div className="grid gap-xl" style={{ gridTemplateColumns: '350px 1fr' }}>
        <div className="card p-xl" style={{ alignSelf: 'start' }}>
          <h3 className="mb-lg flex align-center gap-sm">
            <Plus size={20} className="text-primary" /> Upload New Media
          </h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-md">
            <div className="form-group">
              <label className="form-label">Select File (Image/Video)</label>
              <input 
                type="file" 
                ref={fileInputRef}
                accept="image/*,video/*"
                className="form-input" 
                onChange={handleFileChange}
              />
            </div>
            
            {form.file && (
              <div className="badge badge-primary mb-sm" style={{ display: 'inline-block' }}>
                Detected: {form.type === 'video' ? 'Video' : 'Photo'} 
                {form.type === 'video' && ` (~${videoDuration}s)`}
              </div>
            )}

            {form.type === 'photo' && (
              <div className="form-group">
                <label className="form-label">Duration per display (seconds)</label>
                <input 
                  type="number" 
                  min="1" 
                  className="form-input" 
                  value={form.duration_seconds}
                  onChange={e => setForm({...form, duration_seconds: parseInt(e.target.value)})}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Occurrences per hour</label>
              <input 
                type="number" 
                min="1" 
                className="form-input" 
                value={form.occurrences_per_hour}
                onChange={e => setForm({...form, occurrences_per_hour: parseInt(e.target.value)})}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Display Order</label>
              <input 
                type="number" 
                className="form-input" 
                value={form.display_order}
                onChange={e => setForm({...form, display_order: parseInt(e.target.value)})}
              />
            </div>

            <button type="submit" className="btn btn-primary mt-sm" disabled={isUploading || !form.file}>
              {isUploading ? 'Uploading...' : 'Upload Content'}
            </button>
          </form>
        </div>

        <div className="card flex flex-col">
          <div className="card-header flex justify-between align-center" style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
            <h3 className="flex align-center gap-sm m-0">
              <MonitorPlay size={20} className="text-primary" /> Active Playlist
            </h3>
            <div className="badge badge-secondary flex align-center gap-xs" style={{ fontSize: 14 }}>
              <Clock size={16} /> 
              Total Playtime/Hr: {totalMinutes}m {remainderSeconds}s
              {totalSeconds > 3600 && <span className="text-danger ml-sm">(Exceeds 1 Hour!)</span>}
            </div>
          </div>
          <div className="card-body p-0" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Media</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Type</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Duration</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Occurrences/Hr</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Order</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Total/Hr</th>
                  <th style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan="7" className="text-center p-xl">Loading...</td></tr>
                ) : contentList.length === 0 ? (
                  <tr><td colSpan="7" className="text-center p-xl text-secondary">No media uploaded yet.</td></tr>
                ) : contentList.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '16px 20px' }}>
                      {item.type === 'photo' ? (
                        <div style={{ width: 60, height: 40, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                          <img src={item.file_url} alt="media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <div className="flex-center" style={{ width: 60, height: 40, borderRadius: 8, background: '#000', color: '#fff' }}>
                          <Video size={20} />
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span className="badge badge-secondary flex align-center gap-xs" style={{ display: 'inline-flex', textTransform: 'capitalize' }}>
                        {item.type === 'photo' ? <ImageIcon size={12}/> : <Video size={12}/>}
                        {item.type}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>{item.duration_seconds}s</td>
                    <td style={{ padding: '16px 20px' }}>{item.occurrences_per_hour}x</td>
                    <td style={{ padding: '16px 20px' }}>{item.display_order}</td>
                    <td style={{ padding: '16px 20px' }} className="font-bold">{item.duration_seconds * item.occurrences_per_hour}s</td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button className="btn btn-icon btn-sm text-danger" onClick={() => handleDelete(item.id)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
