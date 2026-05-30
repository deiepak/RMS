import React from 'react';

const TabBar = ({ tabs = [], activeTab, onChange, variant = 'top' }) => {
  const containerClass = variant === 'bottom' ? 'bottom-tabs' : 'tab-bar';

  return (
    <div className={containerClass}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon && <span className="tab-icon">{tab.icon}</span>}
          <span className="tab-label">{tab.label}</span>
          {tab.badge != null && tab.badge > 0 && (
            <span className="tab-badge">{tab.badge > 99 ? '99+' : tab.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
};

export default TabBar;
