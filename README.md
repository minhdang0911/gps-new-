# GPS Tracking — Frontend (Next.js)

## Mô tả
Hệ thống **GPS Tracking** phục vụ quản lý thiết bị định vị và giám sát hành trình xe theo thời gian thực.  
Ứng dụng hỗ trợ theo dõi vị trí, trạng thái thiết bị, pin, lịch sử di chuyển (playback), xử lý sự kiện realtime qua MQTT (SOS, khóa/mở khóa), báo cáo và giao diện quản trị nội bộ.

Frontend được xây dựng bằng **Next.js (App Router)**, sử dụng **Ant Design**, tích hợp **Goong API** cho tìm kiếm địa chỉ và **MQTT** cho dữ liệu realtime.

---

## Công nghệ sử dụng
- Next.js (React)
- Ant Design
- MQTT (WebSocket)
- Goong Map / Goong Autocomplete
- i18n (EN / VI)
- JWT Authentication & Role-based Access

---

## Yêu cầu môi trường
- Node.js >= 18
- npm / pnpm / yarn

---

## Cài đặt

Clone repository:
```bash
git clone <repo-url> gps
cd gps
```

Cài dependencies:
```bash
npm install
# hoặc
pnpm install
# hoặc
yarn install
```

---

## Biến môi trường (.env)

Tạo file `.env` từ `.env.example`:

```env
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_GOONG_API_KEY=
NEXT_PUBLIC_MQTT_URL=
NEXT_PUBLIC_MQTT_USERNAME=
NEXT_PUBLIC_MQTT_PASSWORD=
```

> Lưu ý: Khi deploy production (Vercel/Docker), set các biến này trực tiếp trên platform.

---

## Chạy môi trường development

```bash
npm run dev
# hoặc
pnpm dev
# hoặc
yarn dev
```

Truy cập:  
http://localhost:3000

---

## Build & Production

```bash
npm run build
npm run start
```

- `build`: build ứng dụng Next.js
- `start`: chạy server production

### Deploy đề xuất
- **Vercel**: Connect repo GitHub/GitLab, cấu hình Environment Variables.

---

## Scripts
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "jest --coverage"
  }
}
```

---

## Cấu trúc thư mục
```
├─ app/
│  ├─ (auth)/
│  ├─ (main)/
│  ├─ components/
│  ├─ hooks/
│  ├─ lib/
│  ├─ locales/
│  ├─ manage/
│  ├─ report/
│  ├─ support/
│  ├─ util/
│  ├─ layout.jsx
│  ├─ page.jsx
│  └─ globals.css
├─ public/
├─ middleware.ts
├─ next.config.ts
├─ package.json
├─ tsconfig.json
└─ .env
```

---

## MQTT
- Nhận và xử lý dữ liệu realtime từ MQTT Broker.
- Convention topic: `device/{imei}/#`
- Ví dụ trạng thái:
  - `sos = 1` → thiết bị khóa / SOS
  - `sos = 0` hoặc không có → hoạt động bình thường
- Client kết nối qua WebSocket MQTT.

---

## API & Error Handling
Chuẩn response từ backend:
```json
{
  "status": 400,
  "errors": ["Invalid device id"]
}
```

Frontend xử lý:
- `message.error()` cho lỗi chung
- `form.setFields()` cho lỗi theo field

---

## Debug & Logging
- Dev: `console.log`
- Production: khuyến nghị tích hợp Sentry / LogRocket
- MQTT: bật debug log để trace message realtime

---

## Ghi chú
- Đây là frontend cho hệ thống GPS nội bộ.
- Backend, MQTT broker và database được triển khai riêng.
- Tài liệu này phục vụ dev nội bộ & bàn giao dự án.
