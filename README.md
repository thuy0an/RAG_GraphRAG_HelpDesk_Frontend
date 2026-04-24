# SmartDoc AI - Intelligent Document Q&A System (Frontend)

Giao diện web cho hệ thống SmartDoc AI, xây dựng với Astro + React. Người dùng có thể upload tài liệu PDF/DOCX và đặt câu hỏi qua hai pipeline RAG: **PaCRAG** và **GraphRAG**.

---

- [Tech Stack](#tech-stack)
- [Yêu cầu](#yêu-cầu)
- [Cài đặt](#cài-đặt)
- [Biến môi trường](#biến-môi-trường)
- [Chạy dev server](#chạy-dev-server)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Tính năng](#tính-năng)
- [Giấy phép](#giấy-phép)

## Tech Stack

| Thành phần | Công nghệ |
|---|---|
| Framework | Astro 5 (SSR mode) |
| UI | React 18 + Ant Design 6 |
| Styling | Tailwind CSS 4 |
| State | Zustand 5 |
| Data fetching | TanStack Query 5 |
| Charts | Ant Design Charts 2 |
| Language | TypeScript |
| Package manager | npm / bun |

---

## Yêu cầu

- **Node.js 18+**
- **Backend** đang chạy tại `http://localhost:8080`

---

## Cài đặt

```bash
cd AI_HelpDesk_Frontend
npm install
```

## Biến môi trường

Tạo file `.env`:

```env
PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
PUBLIC_WS_BASE_URL=ws://localhost:8080/api/v1
PUBLIC_PROJECT_ENV=development
```

---

## Chạy dev server

```bash
npm run dev
```

Mở trình duyệt tại `http://localhost:3000`

---

## Cấu trúc thư mục

```
AI_HelpDesk_Frontend/
├── src/
│   ├── app/
│   │   ├── index.astro                        # Home page
│   │   └── (User)/
│   │       └── user_portal/
│   │           ├── chat/                       # Chat components
│   │           ├── UserPortal.tsx             # Main wrapper
│   │           ├── UserPortalChat.tsx         # Chat interface
│   │           └── smartchatbot/
│   │               └── index.astro            # Chat page
│   ├── components/
│   │   └── UserHeader.tsx                     # Header component
│   ├── constants/
│   │   └── constant.ts                        # API URLs
│   ├── layouts/
│   │   ├── Rootlayout.astro                   # HTML layout
│   │   └── QueryProvider.tsx                  # TanStack Query
│   ├── lib/
│   │   └── ReactQuery.tsx                     # Query client
│   ├── styles/
│   │   └── global.css                         # Global styles
│   └── utils/
│       └── logger.ts                          # Logger utility
├── public/                                    # Static assets
├── .env                                       # Environment variables
├── astro.config.mjs                           # Astro configuration
└── package.json
```

---

## Tính năng

### Chat Interface
- **Upload tài liệu**: PDF/DOCX upload vào backend
- **PaCRAG Chat**: Streaming response với trích dẫn nguồn
- **GraphRAG Chat**: Query qua knowledge graph
- **Compare Mode**: So sánh PaCRAG vs GraphRAG side-by-side
- **Conversation History**: Lưu trữ và quản lý lịch sử chat
- **Real-time Metrics**: Hiển thị performance metrics

### UI Components
- **Ant Design**: Modern UI components
- **Responsive Design**: Tối ưu cho desktop và mobile
- **Charts**: Visualization cho metrics comparison
- **Markdown Support**: Render markdown responses

---

## Giấy phép

Dự án được phát hành theo giấy phép **GNU General Public License v3.0 (GPL-3.0)**.
