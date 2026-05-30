import { formatToBS, formatToBSTime } from './nepaliDate';

/**
 * Format amount as NPR currency with Nepali grouping
 * e.g., 1234567 → "Rs. 12,34,567"
 */
export const formatCurrency = (amount) => {
  if (amount == null || isNaN(amount)) return 'Rs. 0';
  const num = Number(amount);
  const isNegative = num < 0;
  const abs = Math.abs(num).toFixed(2);
  const [intPart, decPart] = abs.split('.');
  
  // Nepali/Indian grouping: last 3 digits, then groups of 2
  let result = '';
  if (intPart.length <= 3) {
    result = intPart;
  } else {
    const lastThree = intPart.slice(-3);
    const remaining = intPart.slice(0, -3);
    const groups = [];
    for (let i = remaining.length; i > 0; i -= 2) {
      groups.unshift(remaining.slice(Math.max(0, i - 2), i));
    }
    result = groups.join(',') + ',' + lastThree;
  }
  
  // Remove trailing .00
  const formatted = decPart === '00' ? result : `${result}.${decPart}`;
  return `Rs. ${isNegative ? '-' : ''}${formatted}`;
};

/**
 * Format date: 'May 22, 2025' or '2080-05-12' (BS)
 */
export const formatDate = (date) => {
  if (!date) return '';
  const isBS = typeof window !== 'undefined' && localStorage.getItem('rms_date_format') === 'BS';
  if (isBS) return formatToBS(date);

  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format time: '2:30 PM'
 */
export const formatTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Format date + time: 'May 22, 2025, 2:30 PM' or '2080-05-12 14:30' (BS)
 */
export const formatDateTime = (date) => {
  if (!date) return '';
  const isBS = typeof window !== 'undefined' && localStorage.getItem('rms_date_format') === 'BS';
  if (isBS) return formatToBSTime(date);

  return `${formatDate(date)}, ${formatTime(date)}`;
};

/**
 * Relative time: '5 min ago'
 */
export const timeAgo = (date) => {
  if (!date) return '';
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(date);
};

/**
 * Generate random ID string
 */
export const generateId = () => {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
};

/**
 * Order status constants
 */
export const ORDER_STATUS = {
  active: { label: 'Active', color: 'var(--info)' },
  checkout_requested: { label: 'Checkout Requested', color: 'var(--warning)' },
  completed: { label: 'Completed', color: 'var(--success)' },
  cancelled: { label: 'Cancelled', color: 'var(--danger)' },
};

/**
 * Item status constants
 */
export const ITEM_STATUS = {
  pending: { label: 'Pending', color: 'var(--warning)', className: 'status-pending' },
  accepted: { label: 'Accepted', color: 'var(--info)', className: 'status-accepted' },
  preparing: { label: 'Preparing', color: 'var(--info)', className: 'status-preparing' },
  prepared: { label: 'Prepared', color: 'var(--success)', className: 'status-prepared' },
  ready: { label: 'Ready', color: 'var(--success)', className: 'status-ready' },
  picked_up: { label: 'Picked Up', color: 'var(--accent-tertiary)', className: 'status-delivered' },
  delivered: { label: 'Delivered', color: 'var(--success)', className: 'status-delivered' },
  rejected: { label: 'Rejected', color: 'var(--danger)', className: 'status-rejected' },
};

/**
 * Table status constants
 */
export const TABLE_STATUS = {
  available: { label: 'Available', color: 'var(--success)', className: 'status-available' },
  occupied: { label: 'Occupied', color: 'var(--warning)', className: 'status-occupied' },
  reserved: { label: 'Reserved', color: 'var(--info)', className: 'status-reserved' },
};
