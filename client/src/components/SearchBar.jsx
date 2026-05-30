import React from 'react';
import { Search, ArrowUpDown } from 'lucide-react';

const SearchBar = ({
  value = '',
  onChange,
  placeholder = 'Search...',
  sortOptions = [],
  onSortChange,
  currentSort = '',
}) => {
  return (
    <div className="search-sort-bar">
      <div className="search-input-wrapper">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          className="form-input search-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {sortOptions.length > 0 && (
        <div className="sort-wrapper">
          <ArrowUpDown size={16} />
          <select
            className="form-select sort-select"
            value={currentSort}
            onChange={(e) => onSortChange(e.target.value)}
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
