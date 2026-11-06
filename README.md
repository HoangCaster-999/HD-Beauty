# HD Beauty Manager

> Quản lý doanh thu nhân viên theo thời gian thực — Salon / Nail / Spa

## Stack

- **Next.js 15** App Router + React 19 + TypeScript
- **TailwindCSS** + Framer Motion + Lucide Icons
- **Firebase** Auth + Firestore + Storage
- **Recharts** — Biểu đồ doanh thu
- **React Hook Form** + Zod — Validation
- **PWA** — Cài như app trên điện thoại
- **Deploy** — Vercel

---

## Tính năng

| Chủ tiệm (Owner) | Nhân viên (Staff) |
|---|---|
| Dashboard realtime | Trang chủ cá nhân |
| Quản lý nhân viên | Nhập giao dịch |
| Quản lý dịch vụ | Xem lịch sử |
| Xem toàn bộ giao dịch | Đổi mật khẩu |
| Báo cáo theo tháng | Dark/Light mode |
| Xuất Excel / PDF / In | |
| Chart 30 ngày | |
| Top nhân viên & dịch vụ | |

---

## Cài đặt

### 1. Tạo Firebase Project

1. Vào [Firebase Console](https://console.firebase.google.com/)
2. **Create Project** → đặt tên (VD: `hd-beauty-manager`)
3. Tắt Google Analytics (tùy chọn)

### 2. Enable Authentication

1. Firebase Console → **Authentication** → **Get started**
2. **Sign-in method** → **Email/Password** → Enable → Save

### 3. Tạo Firestore Database

1. Firebase Console → **Firestore Database** → **Create database**
2. Chọn **Start in production mode**
3. Chọn region gần nhất (asia-southeast1)

### 4. Lấy Firebase Config

1. Firebase Console → **Project Settings** ⚙️ → **General**
2. Kéo xuống **Your apps** → **Web** → Register app
3. Copy `firebaseConfig`

### 5. Cấu hình .env.local

```bash
cp .env.example .env.local
```

Điền vào `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXX
```

### 6. Cài Security Rules Firestore

Firebase Console → **Firestore Database** → **Rules** → Copy nội dung file `firestore.rules` → **Publish**

### 7. Cài đặt & chạy

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000)

---

## Tạo tài khoản

### Tài khoản Owner

1. Vào Firebase Console → **Authentication** → **Users** → **Add user**
2. Điền email/password
3. Copy UID
4. Vào **Firestore** → **users** collection → **Add document**
   - Document ID: `[UID vừa copy]`
   - Điền fields:
     ```
     shopId: ""
     role: "owner"
     name: "Tên chủ tiệm"
     phone: "0901234567"
     email: "owner@example.com"
     active: true
     createdAt: [timestamp]
     ```
5. Đăng nhập → Tạo tiệm tại `/setup`

### Tài khoản Staff

Sau khi đăng nhập với tài khoản Owner:
1. Vào **Nhân viên** → Nhấn **+**
2. Điền thông tin nhân viên
3. Đưa email/password cho nhân viên

---

## Deploy Vercel

```bash
# Cài Vercel CLI
npm i -g vercel

# Deploy
vercel

# Hoặc kết nối GitHub repo tại vercel.com
```

**Thêm Environment Variables trên Vercel:**
- Dashboard Vercel → Project → **Settings** → **Environment Variables**
- Thêm tất cả variables từ `.env.local`

---

## Cấu trúc Project

```
src/
├── app/
│   ├── login/          # Trang đăng nhập
│   ├── setup/          # Tạo tiệm lần đầu
│   ├── owner/          # Tất cả trang Owner
│   │   ├── dashboard/  # Dashboard realtime
│   │   ├── staff/      # Quản lý nhân viên
│   │   ├── services/   # Quản lý dịch vụ
│   │   ├── transactions/ # Xem giao dịch
│   │   ├── reports/    # Báo cáo
│   │   └── profile/    # Hồ sơ & cài đặt
│   └── staff/          # Tất cả trang Staff
│       ├── home/       # Trang chủ nhân viên
│       ├── new/        # Nhập giao dịch mới
│       ├── history/    # Lịch sử giao dịch
│       └── profile/    # Hồ sơ
├── components/
│   ├── ui/             # Button, Input, Modal, Card...
│   ├── shared/         # StatCard, EmployeeCard...
│   ├── layout/         # Header, BottomNav
│   └── charts/         # RevenueChart, BarChart, PieChart
├── contexts/           # AuthContext, ThemeContext
├── hooks/              # useTransactions, useServices, useStaff
├── services/           # Firebase CRUD operations
├── lib/                # firebase.ts, utils.ts
└── types/              # TypeScript interfaces
```

---

## Firestore Collections

```
shops/{shopId}
  name, ownerId, createdAt

users/{userId}
  shopId, role, name, phone, email, active, createdAt

services/{serviceId}
  shopId, name, price, active, createdAt

transactions/{transactionId}
  shopId, staffId, staffName, customerName, customerPhone,
  serviceIds[], serviceNames[], totalAmount, note, createdAt
```

---

## Security Rules

File `firestore.rules` đảm bảo:
- Owner chỉ đọc/ghi dữ liệu tiệm của mình
- Staff chỉ tạo/đọc giao dịch trong tiệm của mình
- Staff không sửa được giao dịch của người khác
- Không tiệm nào truy cập được dữ liệu tiệm khác

---

## PWA — Cài lên điện thoại

- **Android**: Chrome → Menu → "Thêm vào Màn hình chính"
- **iPhone**: Safari → Share → "Thêm vào Màn hình chính"

---

## License

MIT © HD Beauty Manager
