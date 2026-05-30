import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { subscribeToEvent, unsubscribeFromEvent } from '../api/socket';
import { Bell, Check, Users } from 'lucide-react';
import { timeAgo } from '../utils/helpers';

export default function AssistanceTab({ updateCounts }) {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    fetchRequests();

    const handleUpdate = () => fetchRequests();
    subscribeToEvent('assistance:requested', handleUpdate);
    subscribeToEvent('assistance:accepted', handleUpdate);
    subscribeToEvent('assistance:resolved', handleUpdate);

    // Auto-refresh timer for elapsed times
    const interval = setInterval(() => {
      setRequests(prev => [...prev]);
    }, 60000);

    return () => {
      unsubscribeFromEvent('assistance:requested', handleUpdate);
      unsubscribeFromEvent('assistance:accepted', handleUpdate);
      unsubscribeFromEvent('assistance:resolved', handleUpdate);
      clearInterval(interval);
    };
  }, []);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/assistance');
      setRequests(res.data);
      updateCounts(res.data.filter(r => r.status === 'pending').length);
    } catch (error) {
      showToast('Failed to load requests', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (id) => {
    try {
      await api.patch(`/assistance/${id}`, { status: 'accepted', assigned_waiter: user.name });
      showToast('Assigned to you', 'success');
      fetchRequests();
    } catch (error) {
      showToast('Failed to accept', 'error');
    }
  };

  const handleResolve = async (id) => {
    try {
      await api.patch(`/assistance/${id}`, { status: 'resolved' });
      showToast('Request resolved', 'success');
      fetchRequests();
    } catch (error) {
      showToast('Failed to resolve', 'error');
    }
  };

  if (isLoading && requests.length === 0) {
    return <div className="flex-center text-muted">Loading requests...</div>;
  }

  if (requests.length === 0) {
    return (
      <div className="flex-center flex-col text-muted" style={{ height: '60vh' }}>
        <Bell size={48} style={{ opacity: 0.5, marginBottom: 16 }} />
        <h3 style={{ fontSize: 20 }}>No assistance requests</h3>
      </div>
    );
  }

  return (
    <div className="flex-col gap-md">
      {requests.map(req => {
        const isMine = req.status === 'accepted' && req.assigned_waiter === user.name;
        const isOthers = req.status === 'accepted' && req.assigned_waiter !== user.name;

        return (
          <div key={req.id} className="card notification-card animate-fadeIn" style={{ 
            borderLeftColor: isMine ? 'var(--info)' : (isOthers ? 'var(--text-muted)' : 'var(--warning)'),
            backgroundColor: isMine ? 'rgba(59, 130, 246, 0.05)' : (isOthers ? 'var(--bg-secondary)' : 'rgba(245, 166, 35, 0.05)'),
            opacity: isOthers ? 0.6 : 1
          }}>
            <div className="card-body flex justify-between align-center">
              <div>
                <h3 style={{ fontSize: 20, marginBottom: 4 }}>Table {req.table_number}</h3>
                <div className="text-secondary flex align-center gap-sm" style={{ fontSize: 13 }}>
                  <Users size={14} /> {req.customer_name} • {timeAgo(new Date(req.created_at))}
                </div>
                {isOthers && (
                  <div className="mt-sm text-secondary" style={{ fontSize: 12 }}>
                    Handled by {req.assigned_waiter}
                  </div>
                )}
              </div>
              
              <div>
                {req.status === 'pending' ? (
                  <button className="btn btn-warning" onClick={() => handleAccept(req.id)}>
                    Accept
                  </button>
                ) : isMine ? (
                  <button className="btn btn-success" onClick={() => handleResolve(req.id)}>
                    <Check size={16} /> Resolved
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
