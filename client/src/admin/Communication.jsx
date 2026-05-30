import React from 'react';
import ChatInterface from '../components/ChatInterface';

export default function Communication() {
  return (
    <div className="admin-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '16px' }}>
      <div className="admin-header">
        <h2>Communication</h2>
      </div>
      <ChatInterface fullHeight={true} />
    </div>
  );
}
