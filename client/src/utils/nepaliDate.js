import NepaliDate from 'nepali-date-converter';

/**
 * Converts a standard JavaScript Date (AD) to Nepali Date (BS) string
 * @param {Date|string} adDate - The Gregorian date
 * @returns {string} Formatted Nepali Date (e.g. 2080-05-12)
 */
export const formatToBS = (adDate) => {
  try {
    const date = new Date(adDate);
    if (isNaN(date.getTime())) return '-';
    
    // Convert to Nepali Date
    const nepaliDate = new NepaliDate(date);
    return nepaliDate.format('YYYY-MM-DD');
  } catch (err) {
    console.error('Failed to convert to Nepali date', err);
    return new Date(adDate).toLocaleDateString();
  }
};

/**
 * Converts a standard JavaScript Date (AD) to Nepali Date Time (BS) string
 * @param {Date|string} adDate - The Gregorian date
 * @returns {string} Formatted Nepali Date with Time
 */
export const formatToBSTime = (adDate) => {
  try {
    const date = new Date(adDate);
    if (isNaN(date.getTime())) return '-';
    
    const nepaliDate = new NepaliDate(date);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${nepaliDate.format('YYYY-MM-DD')} ${timeStr}`;
  } catch (err) {
    return new Date(adDate).toLocaleString();
  }
};
