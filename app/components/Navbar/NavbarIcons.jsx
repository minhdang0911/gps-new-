/**
 * NavIconOverview — Modern electric scooter side-view
 * Traced từ reference image: large body silhouette, clearly scooter (not bicycle)
 * White-only, transparent bg, 50×32 viewBox
 */
export const NavIconOverview = ({ active = false }) => (
    <svg width="32" height="32" viewBox="0 0 50 32" fill="none"
        xmlns="http://www.w3.org/2000/svg" opacity={active ? 1 : 0.9}>

        {/* ════════════════════════════════════════════
            MAIN BODY SILHOUETTE — single connected shape
            (front cowl → handlebar → seat → rear → step-through → front)
        ════════════════════════════════════════════ */}
        <path
            d="
              M 12 8
              C 10 8 8 10 8 13
              C 8 16 9 18 11 20
              L 37 20
              C 39 20 41 18 42 16
              C 43 14 43 11 41 9
              C 39 7 35 6 28 5.5
              L 22 5
              C 20 5 18 5.5 16 6.5
              L 14 8 Z
            "
            fill="white" fillOpacity="0.22"
            stroke="white" strokeWidth="1.3" strokeLinejoin="round"
        />

        {/* ════ COCKPIT / FRONT COWL — bulge trước cao ════ */}
        <path
            d="M 12 8 C 10 7 9 9 9 12 C 9 14 10 16 11 18 L 15 18 L 15 8 Z"
            fill="white" fillOpacity="0.15"
            stroke="white" strokeWidth="1" strokeLinejoin="round"
        />

        {/* ════ SEAT — thick, long, padded ════ */}
        <path
            d="M 22 5 C 24 3.5 30 3.5 36 4.5 L 38 6.5 L 22 7 Z"
            fill="white" fillOpacity="0.4"
            stroke="white" strokeWidth="1" strokeLinejoin="round"
        />

        {/* ════ REAR BODY PANEL (phần sau rõ hơn) ════ */}
        <path
            d="M 36 5 C 40 5.5 43 8 43 12 C 43 15 41 18 38 19.5 L 36 19.5 L 36 5 Z"
            fill="white" fillOpacity="0.12"
            stroke="white" strokeWidth="1" strokeLinejoin="round"
        />

        {/* ════ HANDLEBAR ════ */}
        <path d="M 14 6.5 L 22 5.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="14" y1="6.5" x2="14" y2="9.5" stroke="white" strokeWidth="2" strokeLinecap="round" />

        {/* ════ MIRRORS ════ */}
        <line x1="15" y1="6.5" x2="14" y2="3.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        <ellipse cx="13.5" cy="3" rx="1.8" ry="1.1" fill="white" fillOpacity="0.5" stroke="white" strokeWidth="0.9" />
        <line x1="21" y1="5.5" x2="22" y2="2.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
        <ellipse cx="22.5" cy="2" rx="1.8" ry="1.1" fill="white" fillOpacity="0.5" stroke="white" strokeWidth="0.9" />

        {/* ════ HEADLIGHT — tròn, nổi bật ════ */}
        <circle cx="10" cy="10" r="3.2" fill="white" fillOpacity="0.35" stroke="white" strokeWidth="1.3" />
        <circle cx="10" cy="10" r="1.8" fill="white" fillOpacity="0.95" />

        {/* ════ FRONT FORK — dày, rõ ════ */}
        <path d="M 11 19 L 13 12" stroke="white" strokeWidth="2.2" strokeLinecap="round" />

        {/* ════ STEP BOARD (chân đặt) ════ */}
        <path d="M 14 21 L 37 21" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.5" />

        {/* ════ FRONT WHEEL — dày, spoke rõ ════ */}
        <circle cx="10" cy="26" r="5.5" stroke="white" strokeWidth="2.5" fill="none" />
        <circle cx="10" cy="26" r="2.2" stroke="white" strokeWidth="1.2" fill="white" fillOpacity="0.25" />
        {/* 5 spokes */}
        <line x1="10" y1="21.5" x2="10" y2="23.8" stroke="white" strokeWidth="0.9" strokeOpacity="0.7" />
        <line x1="14" y1="23"   x2="12.3" y2="24.5" stroke="white" strokeWidth="0.9" strokeOpacity="0.7" />
        <line x1="12.8" y1="28.5" x2="11.4" y2="27" stroke="white" strokeWidth="0.9" strokeOpacity="0.7" />
        <line x1="7.2" y1="28.5" x2="8.6" y2="27"  stroke="white" strokeWidth="0.9" strokeOpacity="0.7" />
        <line x1="6"   y1="23"   x2="7.7" y2="24.5" stroke="white" strokeWidth="0.9" strokeOpacity="0.7" />

        {/* ════ REAR WHEEL — dày, spoke rõ ════ */}
        <circle cx="39" cy="26" r="5.5" stroke="white" strokeWidth="2.5" fill="none" />
        <circle cx="39" cy="26" r="2.2" stroke="white" strokeWidth="1.2" fill="white" fillOpacity="0.25" />
        <line x1="39" y1="21.5" x2="39" y2="23.8" stroke="white" strokeWidth="0.9" strokeOpacity="0.7" />
        <line x1="43" y1="23"   x2="41.3" y2="24.5" stroke="white" strokeWidth="0.9" strokeOpacity="0.7" />
        <line x1="41.8" y1="28.5" x2="40.4" y2="27" stroke="white" strokeWidth="0.9" strokeOpacity="0.7" />
        <line x1="36.2" y1="28.5" x2="37.6" y2="27" stroke="white" strokeWidth="0.9" strokeOpacity="0.7" />
        <line x1="35"   y1="23"   x2="36.7" y2="24.5" stroke="white" strokeWidth="0.9" strokeOpacity="0.7" />

        {/* ════ FRONT FENDER ════ */}
        <path d="M 8.5 21 C 7 22 6 24 6.5 26" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round" />

        {/* ════ REAR FENDER ════ */}
        <path d="M 42 20 C 44 21 44.5 24 43.5 26" stroke="white" strokeWidth="1.3" fill="none" strokeLinecap="round" />

        {/* ════ LIGHTNING BOLT — EV badge ════ */}
        <path d="M 29 8 L 27.5 11 L 29.5 11 L 28 14"
            stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.75" />
    </svg>
);
