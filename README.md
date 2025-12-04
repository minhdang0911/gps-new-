# GPS Tracking — Next.js

**Mô tả ngắn:**
Dự án này là **hệ thống GPS Tracking** của công ty, phục vụ việc quản lý thiết bị định vị, giám sát hành trình xe theo thời gian thực, lưu lịch sử di chuyển, xử lý sự kiện từ MQTT (trạng thái thiết bị, khoá/mở khoá, SOS), và cung cấp giao diện quản trị cho nội bộ.

Frontend được xây bằng **Next.js **, sử dụng Ant Design, kết nối tới các API nội bộ, Goong API (autocomplete địa chỉ), và MQTT broker.

---

## Nội dung README này

-   Giới thiệu
-   Yêu cầu
-   Cài đặt
-   Biến môi trường (`.env`)
-   Chạy ở môi trường phát triển
-   Build & Deploy
-   Chạy test & lint
-   Kiến trúc thư mục
-   Tài nguyên & API liên quan (Goong, MQTT)
-   Xử lý lỗi & logging

---

## 1. Yêu cầu

-   Node.js >= 18
-   npm / pnpm / yarn (tuỳ bạn quen)

## 2. Cài đặt (lần đầu)

1. Clone repo:

```bash
git clone <repo-url> gps
cd gps
```

2. Cài dependencies:

```bash
# npm
npm install
# hoặc pnpm
pnpm install
# hoặc yarn
yarn
```

3. Tạo file `.env` từ mẫu `.env.example` (xem phần sau)

## 3. `.env`

```env
# Next.js
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_GOONG_API_KEY=
NEXT_PUBLIC_MQTT_URL=
NEXT_PUBLIC_MQTT_USERNAME=
NEXT_PUBLIC_MQTT_PASSWORD=
```

> Ghi chú: nếu deploy lên môi trường production (Vercel / Docker), đặt các biến môi trường tương ứng trên platform.

## 4. Chạy ở môi trường phát triển

Chạy Next.js server (hot-reload):

```bash
npm run dev
# hoặc
pnpm dev
# hoặc
yarn dev
```

Mở `http://localhost:3000` để xem app. API route của Next.js (nếu có) nằm dưới `/app/lib/api` (app router)

## 5. Build & Production

Build cho production:

```bash
npm run build
npm run start
```

-   `npm run build` sẽ tạo `.next` (Next.js app router).
-   `npm run start` chạy Next.js server ở chế độ production.

### Deploy gợi ý

-   **Vercel:** push repo lên GitHub/GitLab và connect Vercel, set biến môi trường trên Vercel UI.

## 6. Test, lint, format

Trong repo có sẵn các script (nếu không, thêm vào `package.json`):

```json
{
    "scripts": {
        "dev": "next dev",
        "build": "next build",
        "start": "next start",
        "lint": "eslint . --ext .ts,.tsx,.js,.jsx",
        "format": "prettier --write .",
        "test": "jest --coverage"
    }
}
```

Chạy:

```bash
npm run lint
npm run format
npm run test
```

## 7. Kiến trúc thư mục

```
├─ .next/
├─ app/
│  ├─ (auth)/
│  ├─ (main)/
│  ├─ assets/
│  ├─ components/
│  ├─ cruise/
│  ├─ hooks/
│  ├─ lib/
│  ├─ locales/
│  ├─ manage/
│  ├─ report/
│  ├─ support/
│  ├─ util/
│  ├─ layout.jsx
│  ├─ page.jsx
│  ├─ globals.css
│  └─ favicon.ico
├─ lib/
├─ public/
├─ node_modules/
├─ .env
├─ .env.example
├─ middleware.ts
├─ next.config.ts
├─ package.json
├─ package-lock.json
└─ tsconfig.json
```

````



### MQTT
- Ứng dụng nhận/đẩy trạng thái thiết bị qua MQTT broker.
- Tên topic tuỳ convention: `device/{imei}/`,
- Xử lý case: khóa trả `sos = 1` = khóa, `sos = 0` hoặc không trả = mở/hoạt động.
- Nếu dùng websocket -> kết nối từ client tới broker websocket endpoint.

## 8. Xử lý lỗi & phản hồi API
- Các API server phải trả chuẩn:

```json
{
   "status":200
  "errors": ["username phải có ít nhất 5 ký tự"]
}
````

-   Frontend cần show `message.error` hoặc `form.setFields` tương ứng. Format lỗi có thể là:

    -   `errors: string[]` — list lỗi chung
    -   `fields: { fieldName: string, message: string }[]` — lỗi từng field

## 9 Debug & logs

-   Dùng `console.log` cho dev, enable Sentry hoặc LogRocket ở production.
-   Với MQTT, bật debug log cho client lib để dễ trace message.
