/**
 * @file MapClusterIcons.jsx
 * @description Các helper tạo SVG và biểu tượng cụm (Cluster) hiển thị trên Leaflet.
 */

export const createClusterSvg = (count, online, total, type) => {
    const isProv = type === 'province';
    const cfg = isProv
        ? { bg: '#1d4ed8', border: '#93c5fd', glow: count >= 50 }
        : { bg: '#7c3aed', border: '#c4b5fd', glow: false };

    // Phân cấp kích thước chuẩn:
    // Cụm nhỏ (1-2 thiết bị): 20px (nhỏ gọn, không lấn át bản đồ)
    // Cụm trung bình (3-20 thiết bị): 25px
    // Cụm lớn (Hà Nội, TP.HCM): 36px kèm hiệu ứng vòng sáng nổi bật
    const size = count >= 50 ? 36 : count >= 10 ? 28 : count >= 3 ? 24 : 20;
    const r = size / 2;
    const fontSize = count >= 50 ? 12 : count >= 10 ? 10 : 9;

    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    ${cfg.glow ? `<circle cx="${r}" cy="${r}" r="${r - 1}" fill="none" stroke="#60a5fa" stroke-width="2.5" opacity="0.65"/>` : ''}
    <circle cx="${r}" cy="${r}" r="${r - (cfg.glow ? 2.5 : 1.2)}" fill="${cfg.bg}" stroke="${cfg.border}" stroke-width="1.8" opacity="0.95"/>
    <text x="${r}" y="${r + 0.5}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}px" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">${count}</text>
  </svg>`;
};

export const createDevicePinSvg = (isOnline) => {
    const color = isOnline ? '#22c55e' : '#ef4444';
    const border = isOnline ? '#15803d' : '#b91c1c';

    return `<svg width="22" height="28" viewBox="0 0 24 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 18 12 18s12-9 12-18c0-6.63-5.37-12-12-12z" fill="${color}" stroke="${border}" stroke-width="1.5"/>
    <circle cx="12" cy="11" r="4.5" fill="#ffffff"/>
  </svg>`;
};
