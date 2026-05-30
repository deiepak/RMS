import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      className="btn-icon theme-toggle-btn"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      <span className={`theme-icon ${theme === 'dark' ? 'rotate-in' : 'rotate-out'}`}>
        {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
      </span>
    </button>
  );
};

export default ThemeToggle;
