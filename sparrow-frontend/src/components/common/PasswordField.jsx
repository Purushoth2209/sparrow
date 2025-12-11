import React, { useState } from 'react';

const PasswordField = ({ value, onChange, placeholder = 'Password', inputClassName = 'login-input', containerClassName = 'password-field' }) => {
  const [visible, setVisible] = useState(false);

  const toggle = () => setVisible((v) => !v);

  return (
    <div className={containerClassName} style={{ position: 'relative' }}>
      <input
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={inputClassName}
        autoComplete="current-password"
      />
      <button
        type="button"
        aria-label={visible ? 'Hide password' : 'Show password'}
        onClick={toggle}
        className="eye-toggle"
        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        {visible ? (
          // Eye open icon
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ) : (
          // Eye closed icon
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.94" />
            <path d="M1 1l22 22" />
            <path d="M9.88 9.88A3 3 0 0 0 12 15a3 3 0 0 0 2.12-.88" />
            <path d="M7.11 7.11A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.77 21.77 0 0 1-3.06 4.38" />
          </svg>
        )}
      </button>
    </div>
  );
};

export default PasswordField;


