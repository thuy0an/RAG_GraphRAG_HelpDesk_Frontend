# AI HelpDesk Frontend

Frontend của hệ thống hỗ trợ khách hàng thông minh 

## 🚀 Project Structure

Cấu trúc thư mục của dự án AI HelpDesk Frontend:

```
├── public/                     # Static assets (images, icons, etc.)
├── src/
│   ├── app/                    # Các trang chính của ứng dụng
│   │   ├── auth/              # Xác thực người dùng
│   │   │   ├── login.astro
│   │   │   └── register.astro
│   │   ├── management/        # Quản trị viên
│   │   │   ├── chat/
│   │   │   ├── dashboard/
│   │   │   └── settings/
│   │   └── user/              # Giao diện người dùng
│   │       ├── UserChat.tsx
│   │       └── dashboard/
│   ├── components/            # Components tái sử dụng
│   │   ├── ui/               # UI components cơ bản
│   │   ├── forms/            # Form components
│   │   └── layout/           # Layout components
│   ├── constants/            # Constants và configurations
│   │   └── constant.ts
│   ├── context/              # React Context providers
│   ├── features/             # Feature-based modules
│   ├── hooks/                # Custom React hooks
│   ├── layouts/              # Astro layouts
│   │   └── RootLayout.astro
│   ├── lib/                  # Utility functions
│   └── styles/               # Global styles
├── .env                      # Environment variables
├── .gitignore
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

## 🔧 Environment Variables

Tạo file `.env` tại root directory với các biến sau:

```env
# API Configuration
PUBLIC_API_BASE_URL=http://localhost:8080

# WebSocket Configuration
PUBLIC_WS_BASE_URL=ws://localhost:8080

# Project Environment (development/production)
PUBLIC_PROJECT_ENV=development
```

| Variable | Required | Description |
|----------|----------|-------------|
| `PUBLIC_API_BASE_URL` | ✅ | Base URL cho REST API calls |
| `PUBLIC_WS_BASE_URL` | ✅ | Base URL cho WebSocket connections |
| `PUBLIC_PROJECT_ENV` | ✅ | Môi trường chạy (development/production) |

## 🚀 Deployment
| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `bun install`             | Cài đặt dependencies                            |
| `bun dev`                 | Khởi động dev server tại `localhost:4321`        |
| `bun build`               | Build production site đến `./dist/`             |
| `bun preview`             | Xem trước bản build trước khi deploy            |
| `bun astro ...`           | Chạy CLI commands như `astro add`, `astro check` |

## 🛠 Tech Stack
- **Framework**: Astro
- **Language**: TypeScript
- **Package Manager**: Bun
- **Styling**: Tailwind CSS (nếu có)
- **UI Components**: Custom components