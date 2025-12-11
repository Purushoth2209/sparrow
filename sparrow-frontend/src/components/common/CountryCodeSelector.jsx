import React, { useState, useRef, useEffect } from 'react';
import './CountryCodeSelector.css';

const CountryCodeSelector = ({ value, onChange, placeholder = "Select country" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Popular countries with their codes
  const countries = [
    { code: '+1', name: 'United States', flag: '🇺🇸' },
    { code: '+1', name: 'Canada', flag: '🇨🇦' },
    { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
    { code: '+91', name: 'India', flag: '🇮🇳' },
    { code: '+86', name: 'China', flag: '🇨🇳' },
    { code: '+81', name: 'Japan', flag: '🇯🇵' },
    { code: '+82', name: 'South Korea', flag: '🇰🇷' },
    { code: '+61', name: 'Australia', flag: '🇦🇺' },
    { code: '+49', name: 'Germany', flag: '🇩🇪' },
    { code: '+33', name: 'France', flag: '🇫🇷' },
    { code: '+39', name: 'Italy', flag: '🇮🇹' },
    { code: '+34', name: 'Spain', flag: '🇪🇸' },
    { code: '+7', name: 'Russia', flag: '🇷🇺' },
    { code: '+55', name: 'Brazil', flag: '🇧🇷' },
    { code: '+52', name: 'Mexico', flag: '🇲🇽' },
    { code: '+54', name: 'Argentina', flag: '🇦🇷' },
    { code: '+27', name: 'South Africa', flag: '🇿🇦' },
    { code: '+20', name: 'Egypt', flag: '🇪🇬' },
    { code: '+234', name: 'Nigeria', flag: '🇳🇬' },
    { code: '+254', name: 'Kenya', flag: '🇰🇪' },
    { code: '+92', name: 'Pakistan', flag: '🇵🇰' },
    { code: '+880', name: 'Bangladesh', flag: '🇧🇩' },
    { code: '+94', name: 'Sri Lanka', flag: '🇱🇰' },
    { code: '+977', name: 'Nepal', flag: '🇳🇵' },
    { code: '+880', name: 'Bangladesh', flag: '🇧🇩' },
    { code: '+93', name: 'Afghanistan', flag: '🇦🇫' },
    { code: '+98', name: 'Iran', flag: '🇮🇷' },
    { code: '+90', name: 'Turkey', flag: '🇹🇷' },
    { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
    { code: '+971', name: 'UAE', flag: '🇦🇪' },
    { code: '+974', name: 'Qatar', flag: '🇶🇦' },
    { code: '+965', name: 'Kuwait', flag: '🇰🇼' },
    { code: '+973', name: 'Bahrain', flag: '🇧🇭' },
    { code: '+968', name: 'Oman', flag: '🇴🇲' },
    { code: '+60', name: 'Malaysia', flag: '🇲🇾' },
    { code: '+65', name: 'Singapore', flag: '🇸🇬' },
    { code: '+66', name: 'Thailand', flag: '🇹🇭' },
    { code: '+84', name: 'Vietnam', flag: '🇻🇳' },
    { code: '+63', name: 'Philippines', flag: '🇵🇭' },
    { code: '+62', name: 'Indonesia', flag: '🇮🇩' },
    { code: '+64', name: 'New Zealand', flag: '🇳🇿' }
  ];

  // Filter countries based on search term
  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    country.code.includes(searchTerm)
  );

  // Find selected country
  const selectedCountry = countries.find(country => country.code === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCountrySelect = (country) => {
    onChange(country.code);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchTerm('');
    }
  };

  return (
    <div className="country-code-selector" ref={dropdownRef}>
      <div 
        className={`country-code-trigger signup-input-style ${isOpen ? 'open' : ''}`}
        onClick={handleToggle}
      >
        {selectedCountry ? (
          <span className="selected-country">
            <span className="country-flag">{selectedCountry.flag}</span>
            <span className="country-code">{selectedCountry.code}</span>
          </span>
        ) : (
          <span className="placeholder">{placeholder}</span>
        )}
        <span className="dropdown-arrow">▼</span>
      </div>

      {isOpen && (
        <div className="country-dropdown">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search countries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="country-search"
              autoFocus
            />
          </div>
          <div className="country-list">
            {filteredCountries.map((country, index) => (
              <div
                key={`${country.code}-${country.name}-${index}`}
                className={`country-option ${selectedCountry?.code === country.code ? 'selected' : ''}`}
                onClick={() => handleCountrySelect(country)}
              >
                <span className="country-flag">{country.flag}</span>
                <span className="country-name">{country.name}</span>
                <span className="country-code">{country.code}</span>
              </div>
            ))}
            {filteredCountries.length === 0 && (
              <div className="no-results">No countries found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CountryCodeSelector;
