'use client';

import React from 'react';

const LanguageDropdown = ({ isEn, langOpen, setLangOpen, handleSwitchLang, dropdownRef }) => {
    return (
        <div className="iky-login__lang-dropdown" ref={dropdownRef}>
            <button
                type="button"
                className="iky-login__lang-trigger"
                onClick={() => setLangOpen((p) => !p)}
            >
                <span className="iky-login__lang-badge">{isEn ? 'EN' : 'VI'}</span>
                <span className="iky-login__lang-name">{isEn ? 'English' : 'Tiếng Việt'}</span>
                <span className="iky-login__caret">▾</span>
            </button>

            {langOpen && (
                <div className="iky-login__lang-menu">
                    <button type="button" onClick={() => handleSwitchLang('vi')}>
                        VI - Tiếng Việt
                    </button>
                    <button type="button" onClick={() => handleSwitchLang('en')}>
                        EN - English
                    </button>
                </div>
            )}
        </div>
    );
};

export default LanguageDropdown;
