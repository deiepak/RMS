import React from 'react';
import { ITEM_STATUS, ORDER_STATUS, TABLE_STATUS } from '../utils/helpers';

const allStatuses = { ...ITEM_STATUS, ...ORDER_STATUS, ...TABLE_STATUS };

const StatusBadge = ({ status, size = 'md' }) => {
  const config = allStatuses[status] || { label: status, color: 'var(--text-secondary)' };
  const sizeClass = size === 'sm' ? 'badge-sm' : '';

  return (
    <span
      className={`badge ${sizeClass}`}
      style={{
        color: config.color,
        backgroundColor: `color-mix(in srgb, ${config.color} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${config.color} 30%, transparent)`,
      }}
    >
      {config.label}
    </span>
  );
};

export default StatusBadge;
