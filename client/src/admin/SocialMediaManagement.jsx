import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { Share2, Settings, MessageSquare, Edit3, Save, Trash2, Send, Clock, Plus, Facebook, Instagram, Phone, Inbox } from 'lucide-react';
import Modal from '../components/Modal';

export default function SocialMediaManagement() {
  const [activeTab, setActiveTab] = useState('publish'); // 'publish', 'inbox', 'config'
  const { showToast } = useToast();

  // --- Data States ---
  const [configs, setConfigs] = useState([]);
  const [posts, setPosts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inboxFilter, setInboxFilter] = useState('all'); // 'all', 'facebook', 'instagram', 'whatsapp'

  // --- Modals ---
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [postForm, setPostForm] = useState({ content: '', media_url: '', platforms_selected: [], scheduled_for: '' });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'config') {
        const res = await api.get('/social/configs');
        setConfigs(res.data);
      } else if (activeTab === 'publish') {
        const res = await api.get('/social/posts');
        setPosts(res.data);
      } else if (activeTab === 'inbox') {
        const res = await api.get('/social/messages');
        setMessages(res.data);
      }
    } catch (err) {
      showToast('Failed to load data', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const PLATFORMS = ['facebook', 'instagram', 'tiktok', 'whatsapp'];

  // --- Handlers: Config ---
  const handleConfigSave = async (platform, key, value) => {
    try {
      await api.post('/social/configs', { platform, config_key: key, config_value: value });
      showToast('Configuration saved', 'success');
      fetchData();
    } catch (err) {
      showToast('Failed to save config', 'error');
    }
  };

  const getConfigValue = (platform, key) => {
    const c = configs.find(c => c.platform === platform && c.config_key === key);
    return c ? c.config_value : '';
  };

  // --- Handlers: Publish ---
  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (postForm.platforms_selected.length === 0) {
      return showToast('Select at least one platform', 'warning');
    }
    try {
      await api.post('/social/posts', { 
        ...postForm, 
        status: postForm.scheduled_for ? 'scheduled' : 'draft' 
      });
      showToast(postForm.scheduled_for ? 'Post scheduled successfully' : 'Post drafted successfully', 'success');
      setIsPostModalOpen(false);
      fetchData();
    } catch (err) {
      showToast('Failed to create post', 'error');
    }
  };

  const handlePostDelete = async (id) => {
    if (confirm('Delete this post?')) {
      try {
        await api.delete(`/social/posts/${id}`);
        showToast('Post deleted', 'success');
        fetchData();
      } catch (err) {
        showToast('Failed to delete post', 'error');
      }
    }
  };

  // --- Handlers: Inbox ---
  const [replyMessage, setReplyMessage] = useState('');
  const handleReply = async (receiverId, platform) => {
    if (!replyMessage) return;
    try {
      await api.post('/social/messages', {
        platform,
        receiver_id: receiverId,
        message_content: replyMessage
      });
      showToast('Message sent', 'success');
      setReplyMessage('');
      fetchData();
    } catch (err) {
      showToast('Failed to send message', 'error');
    }
  };

  return (
    <div className="admin-content" style={{ animation: 'fadeIn 0.4s ease-out' }}>
      
      {/* Top Action Bar & Description */}
      <div className="flex justify-between align-center mb-lg" style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)' }}>
        <div>
          <p className="text-secondary" style={{ margin: 0, fontSize: '15px' }}>
            Manage Developer APIs, unified publishing, and incoming messages across all platforms.
          </p>
        </div>
        <div className="flex gap-sm">
          {activeTab === 'publish' && (
            <button 
              className="btn btn-primary flex align-center gap-sm" 
              style={{ padding: '10px 20px', borderRadius: '50px', boxShadow: '0 4px 15px rgba(255, 71, 87, 0.3)' }}
              onClick={() => { setPostForm({ content: '', media_url: '', platforms_selected: [], scheduled_for: '' }); setIsPostModalOpen(true); }}
            >
              <Plus size={18} /> New Post
            </button>
          )}
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex gap-sm mb-lg" style={{ background: 'var(--bg-elevated)', padding: '6px', borderRadius: '50px', width: 'fit-content' }}>
        <button 
          className={`btn ${activeTab === 'publish' ? 'btn-primary' : ''} flex align-center gap-sm`}
          style={{ borderRadius: '50px', padding: '10px 24px', background: activeTab === 'publish' ? 'var(--accent-gradient)' : 'transparent', border: 'none', color: activeTab === 'publish' ? '#fff' : 'var(--text-secondary)' }}
          onClick={() => setActiveTab('publish')}
        >
          <Edit3 size={18} /> Publisher
        </button>
        <button 
          className={`btn ${activeTab === 'inbox' ? 'btn-primary' : ''} flex align-center gap-sm`}
          style={{ borderRadius: '50px', padding: '10px 24px', background: activeTab === 'inbox' ? 'var(--accent-gradient)' : 'transparent', border: 'none', color: activeTab === 'inbox' ? '#fff' : 'var(--text-secondary)' }}
          onClick={() => setActiveTab('inbox')}
        >
          <MessageSquare size={18} /> Inbox
        </button>
        <button 
          className={`btn ${activeTab === 'config' ? 'btn-primary' : ''} flex align-center gap-sm`}
          style={{ borderRadius: '50px', padding: '10px 24px', background: activeTab === 'config' ? 'var(--accent-gradient)' : 'transparent', border: 'none', color: activeTab === 'config' ? '#fff' : 'var(--text-secondary)' }}
          onClick={() => setActiveTab('config')}
        >
          <Settings size={18} /> API Configs
        </button>
      </div>

      {/* PUBLISHER TAB */}
      {activeTab === 'publish' && (
        <div style={{ animation: 'fadeInUp 0.4s ease-out' }}>
          {isLoading ? <p className="text-center py-lg text-secondary">Loading posts...</p> : posts.length === 0 ? (
            <div className="flex-center flex-col py-xl" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '60px 20px', border: '1px dashed var(--border-color)' }}>
              <Edit3 size={48} className="text-muted mb-md" />
              <h3 className="mb-sm">No Posts Drafted</h3>
              <p className="text-secondary text-center mb-md">Start building your audience by scheduling your first post.</p>
              <button className="btn btn-primary flex align-center gap-sm" onClick={() => { setPostForm({ content: '', media_url: '', platforms_selected: [], scheduled_for: '' }); setIsPostModalOpen(true); }}>
                <Plus size={18} /> Create Post
              </button>
            </div>
          ) : (
            <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px', display: 'grid' }}>
              {posts.map(post => (
                <div key={post.id} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', borderRadius: 'var(--radius-lg)', transition: 'transform 0.2s', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow)' }}>
                  <div className="flex justify-between align-center">
                    <span className={`badge ${post.status === 'published' ? 'badge-success' : post.status === 'scheduled' ? 'badge-info' : 'badge-warning'}`}>
                      {post.scheduled_for ? 'SCHEDULED' : post.status.toUpperCase()}
                    </span>
                    <button className="btn-icon text-danger" onClick={() => handlePostDelete(post.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {post.scheduled_for && (
                    <div className="text-secondary flex align-center gap-xs" style={{ fontSize: '12px' }}>
                      <Clock size={14} /> Scheduled for: {new Date(post.scheduled_for).toLocaleString()}
                    </div>
                  )}
                  <p style={{ margin: 0, fontSize: '15px' }}>{post.content || 'No text content'}</p>
                  {post.media_url && <img src={post.media_url} alt="Media" style={{ width: '100%', borderRadius: '8px', maxHeight: '150px', objectFit: 'cover' }} />}
                  <div className="flex gap-sm mt-sm">
                    {post.platforms_selected?.map(p => (
                      <span key={p} className="badge badge-info" style={{ fontSize: '12px' }}>{p}</span>
                    ))}
                  </div>
                  {post.status === 'draft' && (
                    <button className="btn btn-secondary w-full mt-sm flex justify-center align-center gap-sm">
                      <Send size={16} /> Publish Now
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* INBOX TAB */}
      {activeTab === 'inbox' && (
        <div className="card" style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)', padding: '0', overflow: 'hidden', animation: 'fadeInUp 0.4s ease-out' }}>
          
          {/* Inbox Header */}
          <div className="flex justify-between align-center p-md" style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Inbox size={20} className="text-info" /> Message Inbox
              </h3>
            </div>
            
            <div className="flex gap-xs" style={{ background: 'var(--bg-card)', padding: '4px', borderRadius: '50px' }}>
              {[
                { id: 'all', label: 'All', icon: Inbox },
                { id: 'whatsapp', label: 'WhatsApp', icon: Phone },
                { id: 'facebook', label: 'Facebook', icon: Facebook },
                { id: 'instagram', label: 'Instagram', icon: Instagram }
              ].map(filter => (
                <button 
                  key={filter.id}
                  className={`btn btn-sm flex align-center gap-xs`}
                  style={{ 
                    textTransform: 'capitalize', 
                    borderRadius: '50px',
                    padding: '6px 16px',
                    background: inboxFilter === filter.id ? 'var(--bg-primary)' : 'transparent',
                    border: 'none',
                    color: inboxFilter === filter.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: inboxFilter === filter.id ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setInboxFilter(filter.id)}
                >
                  <filter.icon size={14} />
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          
          <div style={{ padding: '24px' }}>
            {isLoading ? <p className="text-center text-secondary py-md">Loading messages...</p> : messages.filter(m => inboxFilter === 'all' || m.platform === inboxFilter).length === 0 ? (
              <div className="flex-center flex-col py-xl">
                <Inbox size={48} className="text-muted mb-md" />
                <h4 className="text-secondary">No messages found</h4>
                <p className="text-muted" style={{ fontSize: '14px' }}>Incoming Webhook messages will appear here.</p>
              </div>
            ) : (
            <div className="flex flex-col gap-sm">
              {messages.filter(m => inboxFilter === 'all' || m.platform === inboxFilter).map(msg => (
                <div key={msg.id} style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: msg.direction === 'outgoing' ? 'var(--bg-elevated)' : 'transparent', marginLeft: msg.direction === 'outgoing' ? '40px' : '0', marginRight: msg.direction === 'incoming' ? '40px' : '0' }}>
                  <div className="flex justify-between align-center mb-xs">
                    <strong style={{ textTransform: 'capitalize' }}>{msg.direction === 'incoming' ? msg.sender_id : 'You'} ({msg.platform})</strong>
                    <span className="text-secondary" style={{ fontSize: '12px' }}>{new Date(msg.created_at).toLocaleString()}</span>
                  </div>
                  <p style={{ margin: 0 }}>{msg.message_content}</p>
                  {msg.direction === 'incoming' && (
                    <div className="flex gap-sm mt-sm">
                      <input 
                        type="text" 
                        placeholder="Type a reply..." 
                        className="form-input" 
                        style={{ flex: 1 }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setReplyMessage(e.target.value);
                            handleReply(msg.sender_id, msg.platform);
                            e.target.value = '';
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      )}

      {/* CONFIG TAB */}
      {activeTab === 'config' && (
        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '24px', display: 'grid', animation: 'fadeInUp 0.4s ease-out' }}>
          {PLATFORMS.map(platform => (
            <div key={platform} className="card" style={{ borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)', transition: 'transform 0.2s', padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <div style={{ background: 'var(--bg-elevated)', padding: '10px', borderRadius: '12px' }}>
                  {platform === 'facebook' ? <Facebook size={24} className="text-info" /> :
                   platform === 'instagram' ? <Instagram size={24} className="text-danger" /> :
                   platform === 'whatsapp' ? <Phone size={24} className="text-success" /> :
                   <Share2 size={24} className="text-primary" />}
                </div>
                <h3 style={{ textTransform: 'capitalize', margin: 0, fontSize: '20px' }}>
                  {platform}
                </h3>
              </div>
              
              <div className="form-group mb-md">
                <label className="form-label text-secondary" style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Access Token / API Key</label>
                <div className="flex gap-sm mt-xs">
                  <input 
                    type="password" 
                    className="form-input" 
                    defaultValue={getConfigValue(platform, 'access_token')}
                    id={`config_${platform}_access_token`}
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}
                  />
                  <button className="btn btn-secondary" style={{ borderRadius: '8px' }} onClick={() => handleConfigSave(platform, 'access_token', document.getElementById(`config_${platform}_access_token`).value)}>Save</button>
                </div>
              </div>

              <div className="form-group mb-md">
                <label className="form-label text-secondary" style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{platform === 'whatsapp' ? 'Phone Number ID' : 'App ID / Page ID'}</label>
                <div className="flex gap-sm mt-xs">
                  <input 
                    type="text" 
                    className="form-input" 
                    defaultValue={getConfigValue(platform, 'app_id')}
                    id={`config_${platform}_app_id`}
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}
                  />
                  <button className="btn btn-secondary" style={{ borderRadius: '8px' }} onClick={() => handleConfigSave(platform, 'app_id', document.getElementById(`config_${platform}_app_id`).value)}>Save</button>
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label text-secondary" style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Public Profile URL</label>
                <div className="flex gap-sm mt-xs">
                  <input 
                    type="text" 
                    className="form-input" 
                    defaultValue={getConfigValue(platform, 'profile_url')}
                    id={`config_${platform}_profile_url`}
                    placeholder={`https://${platform}.com/...`}
                    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}
                  />
                  <button className="btn btn-secondary" style={{ borderRadius: '8px' }} onClick={() => handleConfigSave(platform, 'profile_url', document.getElementById(`config_${platform}_profile_url`).value)}>Save</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* POST MODAL */}
      <Modal isOpen={isPostModalOpen} onClose={() => setIsPostModalOpen(false)} title="Draft New Post">
        <form onSubmit={handlePostSubmit}>
          <div className="form-group mb-md">
            <label className="form-label">Content / Caption</label>
            <textarea 
              className="form-input" 
              rows="4" 
              value={postForm.content}
              onChange={(e) => setPostForm({ ...postForm, content: e.target.value })}
              required
            ></textarea>
          </div>
          
          <div className="form-group mb-md">
            <label className="form-label">Media URL (Image/Video Link)</label>
            <input 
              type="url" 
              className="form-input" 
              value={postForm.media_url}
              onChange={(e) => setPostForm({ ...postForm, media_url: e.target.value })}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="form-group mb-lg">
            <label className="form-label">Select Platforms</label>
            <div className="flex gap-sm flex-wrap">
              {['facebook', 'instagram', 'tiktok'].map(p => (
                <label key={p} className="flex align-center gap-xs" style={{ cursor: 'pointer', background: 'var(--bg-elevated)', padding: '8px 12px', borderRadius: '6px' }}>
                  <input 
                    type="checkbox" 
                    checked={postForm.platforms_selected.includes(p)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPostForm({ ...postForm, platforms_selected: [...postForm.platforms_selected, p] });
                      } else {
                        setPostForm({ ...postForm, platforms_selected: postForm.platforms_selected.filter(plat => plat !== p) });
                      }
                    }}
                  />
                  <span style={{ textTransform: 'capitalize' }}>{p}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group mb-lg">
            <label className="form-label">Schedule Post (Optional)</label>
            <div className="flex align-center gap-sm">
              <Clock size={18} className="text-secondary" />
              <input 
                type="datetime-local" 
                className="form-input" 
                value={postForm.scheduled_for}
                onChange={(e) => setPostForm({ ...postForm, scheduled_for: e.target.value })}
              />
            </div>
            <small className="text-secondary mt-xs block">Leave blank to publish immediately, or pick a future date to schedule.</small>
          </div>

          <div className="flex justify-end gap-sm">
            <button type="button" className="btn btn-secondary" onClick={() => setIsPostModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary flex align-center gap-sm">
              <Save size={16} /> {postForm.scheduled_for ? 'Schedule Post' : 'Save Draft'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
