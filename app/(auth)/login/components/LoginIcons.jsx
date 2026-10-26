'use client';

import React from 'react';

export const UserCustomIcon = ({ isActive = false, size = 20, className = '', style, ...props }) => (
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        overflow="visible"
        className={className}
        style={{
            display: 'block',
            flexShrink: 0,
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            ...style,
        }}
        {...props}
    >
        {isActive ? (
            <>
                <path
                    d="M2.5 11 C1.8 12.8 1.8 14.7 2.5 16.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    opacity="0.85"
                />
                <path
                    d="M21.5 11 C22.2 12.8 22.2 14.7 21.5 16.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    opacity="0.85"
                />
            </>
        ) : null}

        <circle
            cx="12"
            cy="7"
            r="4.2"
            fill="currentColor"
            fillOpacity={isActive ? '0.28' : '0.18'}
            stroke="currentColor"
            strokeWidth="2"
        />

        <line
            x1="9.5"
            y1="6.8"
            x2="14.5"
            y2="6.8"
            stroke={isActive ? '#ffffff' : 'currentColor'}
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity={isActive ? 1 : 0.45}
        />

        <path
            d="M4.5 20.5 C4.5 15.8 7.8 13.5 12 13.5 C16.2 13.5 19.5 15.8 19.5 20.5"
            fill="currentColor"
            fillOpacity={isActive ? '0.28' : '0.18'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
        />

        <path
            d="M9 13.5 L12 17.5 L15 13.5"
            stroke="currentColor"
            strokeWidth="1.8"
            fill="#ffffff"
            strokeLinejoin="round"
        />

        <rect
            x="11.2"
            y="17.6"
            width="1.6"
            height="2.9"
            rx="0.5"
            fill="currentColor"
        />

        <line
            x1="6.5"
            y1="18.5"
            x2="8.5"
            y2="18.5"
            stroke="currentColor"
            strokeWidth="0.8"
            strokeLinecap="round"
            opacity="0.4"
        />
        <line
            x1="15.5"
            y1="18.5"
            x2="17.5"
            y2="18.5"
            stroke="currentColor"
            strokeWidth="0.8"
            strokeLinecap="round"
            opacity="0.4"
        />

        {isActive ? (
            <g style={{ transformOrigin: '19.2px 5px' }}>
                <circle cx="19.2" cy="5" r="4.3" fill="#2563eb" stroke="#ffffff" strokeWidth="1.3" />
                <path
                    d="M17.5 5.1 L18.7 6.3 L20.9 4"
                    stroke="#ffffff"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </g>
        ) : (
            <g opacity="0.6">
                <circle
                    cx="19.2"
                    cy="5"
                    r="3.2"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeDasharray="2.2 2"
                    fill="currentColor"
                    fillOpacity="0.08"
                />
                <circle cx="19.2" cy="5" r="1.1" fill="currentColor" />
            </g>
        )}
    </svg>
);

export const LockCustomIcon = ({ isOpen = false, size = 20, className = '', style, ...props }) => (
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        overflow="visible"
        className={className}
        style={{
            display: 'block',
            flexShrink: 0,
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            ...style,
        }}
        {...props}
    >
        {isOpen ? (
            <>
                <path
                    d="M6.5 10.5 V4.5 C6.5 1.2 17.5 1.2 17.5 4.5"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                />
                <circle cx="17.5" cy="10.5" r="1.4" fill="currentColor" />
                <circle cx="17.5" cy="10.5" r="0.6" fill="#ffffff" />
            </>
        ) : (
            <path
                d="M6.5 10.5 V7 C6.5 3.5 17.5 3.5 17.5 7 V10.5"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        )}

        <rect
            x="3"
            y="10.5"
            width="18"
            height="12"
            rx="4"
            fill="currentColor"
            fillOpacity={isOpen ? '0.26' : '0.18'}
            stroke="currentColor"
            strokeWidth="2"
        />

        <line
            x1="5.5"
            y1="13.5"
            x2="18.5"
            y2="13.5"
            stroke="currentColor"
            strokeWidth="0.8"
            strokeLinecap="round"
            opacity="0.35"
        />

        <circle cx="12" cy="16.5" r="3.2" fill="currentColor" />
        <rect x="10.8" y="18" width="2.4" height="3" rx="0.5" fill="currentColor" />

        <circle cx="12" cy="15.8" r="1.3" fill="#ffffff" />
        <rect x="11.2" y="16.8" width="1.6" height="3.4" rx="0.3" fill="#ffffff" />

        {isOpen ? (
            <g>
                <circle cx="19.5" cy="4.8" r="2.2" fill="#10b981" />
                <circle cx="19.5" cy="4.8" r="3.4" stroke="#10b981" strokeWidth="0.8" opacity="0.6" />
            </g>
        ) : (
            <g opacity="0.85">
                <circle cx="19.5" cy="4.8" r="2" fill="#ef4444" />
                <circle cx="19.5" cy="4.8" r="3.2" stroke="#ef4444" strokeWidth="0.7" opacity="0.4" />
            </g>
        )}
    </svg>
);

export const EyeOpenIcon = ({ size = 23, style, ...props }) => (
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        overflow="visible"
        style={{
            display: 'block',
            flexShrink: 0,
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            ...style,
        }}
        {...props}
    >
        <path
            d="M2.5 12 C5.5 6.5 18.5 6.5 21.5 12 C18.5 17.5 5.5 17.5 2.5 12 Z"
            fill="currentColor"
            fillOpacity="0.18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
        />

        <path
            d="M6.5 9 C9 7.2 15 7.2 17.5 9"
            stroke="#ffffff"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.85"
        />

        <circle
            cx="12"
            cy="12"
            r="4.4"
            stroke="currentColor"
            strokeWidth="1.8"
            fill="currentColor"
            fillOpacity="0.25"
        />

        <circle cx="12" cy="12" r="2.3" fill="currentColor" />

        <circle cx="13.4" cy="10.6" r="1.1" fill="#ffffff" />
        <circle cx="10.6" cy="13.4" r="0.6" fill="#ffffff" opacity="0.85" />

        <line x1="12" y1="5.2" x2="12" y2="6.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="12" y1="17.2" x2="12" y2="18.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

        <g>
            <circle cx="19.5" cy="4.8" r="2" fill="#10b981" />
            <circle cx="19.5" cy="4.8" r="3.2" stroke="#10b981" strokeWidth="0.8" opacity="0.6" />
        </g>
    </svg>
);

export const EyeCloseIcon = ({ size = 23, style, ...props }) => (
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        overflow="visible"
        style={{
            display: 'block',
            flexShrink: 0,
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            ...style,
        }}
        {...props}
    >
        <path
            d="M9.5 6.6 C10.3 6.4 11.1 6.3 12 6.3 C17.8 6.3 20.8 11.2 21.5 12 C20.6 13.8 18.8 15.6 16.5 16.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="currentColor"
            fillOpacity="0.14"
        />

        <path
            d="M7.5 7.5 C4.8 9.2 3.2 11.2 2.5 12 C3.5 14 6.8 17.7 12 17.7 C13.2 17.7 14.5 17.4 15.6 17"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.55"
        />

        <path
            d="M10.2 9.8 A 3.2 3.2 0 0 1 14.2 13.8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" opacity="0.5" />

        <line
            x1="3.2"
            y1="3.2"
            x2="20.8"
            y2="20.8"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
        />

        <line
            x1="5.5"
            y1="5.5"
            x2="18.5"
            y2="18.5"
            stroke="#ffffff"
            strokeWidth="0.9"
            strokeLinecap="round"
            opacity="0.75"
        />

        <g opacity="0.7">
            <circle cx="19.5" cy="4.8" r="1.8" fill="#9ca3af" />
            <circle cx="19.5" cy="4.8" r="3" stroke="#9ca3af" strokeWidth="0.7" strokeDasharray="1.5 1.5" opacity="0.5" />
        </g>
    </svg>
);
