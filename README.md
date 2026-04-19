# AI HelpDesk Frontend

Giao diện chatbot RAG cho hệ thống AI HelpDesk, xây dựng với Astro + React. Người dùng có thể upload tài liệu PDF/DOCX và đặt câu hỏi qua hai pipeline RAG song song: **PaCRAG** và **GraphRAG**.

---

## Mục lục

- [Tech Stack](#tech-stack)
- [Yêu cầu](#yêu-cầu)
- [Cài đặt](#cài-đặt)
- [Biến môi trường](#biến-môi-trường)
- [Chạy dev server](#chạy-dev-server)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Tính năng](#tính-năng)

---

## Tech Stack

| Thành phần | Công nghệ |
|---|---|
| Framework | Astro 5 (SSR mode) |
| UI | React 18 + Ant Design 6 |
| Styling | Tailwind CSS 4 |
| State | Zustand 5 |
| Data fetching | TanStack Query 5 |
| Charts | Ant Design Charts 2 |
| Markdown | react-markdown |
| Language | TypeScript |
| Package manager | npm / bun |

---

## Yêu cầu

- Node.js 18+
- Backend đang chạy tại `http://localhost:8080` (xem [AI_HelpDesk_Backend](../AI_HelpDesk_Backend/README.md))

---

## Cài đặt

```bash
cd AI_HelpDesk_Frontend

# npm
npm install

# hoặc bun
bun install
```

---

## Biến môi trường

Tạo file `.env` tại root của frontend:

```env
PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
PUBLIC_WS_BASE_URL=ws://localhost:8080/api/v1
PUBLIC_PROJECT_ENV=development
```

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `PUBLIC_API_BASE_URL` | ✅ | Base URL cho REST API |
| `PUBLIC_WS_BASE_URL` | ✅ | Base URL cho WebSocket |
| `PUBLIC_PROJECT_ENV` | ✅ | Môi trường (`development` / `production`) |

---

## Chạy dev server

```bash
# npm
npm run dev

# bun
bun dev
```

Mở trình duyệt tại `http://localhost:3000` — tự động redirect vào `/user_portal`.

### Các lệnh khác

| Lệnh | Mô tả |
|------|-------|
| `npm run dev` | Dev server tại `localhost:3000` |
| `npm run build` | Build production vào `./dist/` |
| `npm run preview` | Preview bản build |

---

## Cấu trúc thư mục

```
AI_HelpDesk_Frontend/
├── src/
│   ├── app/
│   │   ├── index.astro                        # Redirect → /user_portal
│   │   └── (User)/
│   │       └── user_portal/
│   │           ├── index.astro                # Entry point chatbot
│   │           ├── UserPortal.tsx             # Wrapper component
│   │           ├── UserPortalChat.tsx         # Toàn bộ chatbot UI
│   │           ├── ai/
│   │           │   └── index.astro            # Route /user_portal/ai
│   │           └── smartchatbot/
│   │               └── index.astro            # Route /user_portal/smartchatbot
│   ├── components/
│   │   └── UserHeader.tsx                     # Header đơn giản (logo)
│   ├── constants/
│   │   └── constant.ts                        # API URLs, Zustand stores
│   ├── layouts/
│   │   ├── Rootlayout.astro                   # HTML shell + QueryProvider
│   │   └── QueryProvider.tsx                  # TanStack Query provider
│   ├── lib/
│   │   └── ReactQuery.tsx                     # queryClient setup
│   ├── styles/
│   │   └── global.css                         # Global styles
│   └── utils/
│       └── logger.ts                          # Dev logger utility
├── public/                                    # Static assets
├── .env                                       # Biến môi trường (tạo thủ công)
├── astro.config.mjs                           # Astro config (SSR, port 3000)
├── package.json
└── tsconfig.json
```

---

## Tính năng

### AIChatWorkspace (trang full-screen)

Truy cập tại `/user_portal`, `/user_portal/ai`, hoặc `/user_portal/smartchatbot`.

**Upload tài liệu**
- Upload PDF / DOCX vào PaCRAG (Redis vector store)
- Upload vào Compare mode (cả PaCRAG + GraphRAG đồng thời)
- Xóa document, xóa toàn bộ vector store

**Chat với PaCRAG**
- Streaming response theo từng chunk
- Hiển thị nguồn trích dẫn (tên file, số trang)
- Lịch sử hội thoại có thể xóa

**Chat với GraphRAG**
- Query qua lexical graph (Neo4j + FAISS)
- Hiển thị entities và sources

**Compare mode (PaCRAG vs GraphRAG)**
- Upload file vào cả 2 pipeline
- Query song song, so sánh kết quả side-by-side
- Metrics: thời gian, relevance score, source coverage, confidence score, word count
- Re-ranking tùy chọn (LLM-based)
- Lịch sử compare runs

**Conversational RAG**
- Inject N lượt hội thoại gần nhất vào prompt (cấu hình ở backend)
- Follow-up questions hiểu ngữ cảnh

### UserPortalChat (floating widget)

Widget chat nổi góc phải màn hình, tích hợp trong `UserPortal`.

- Chế độ **AI**: chat với PaCRAG
- Chế độ **Chat**: WebSocket real-time với agent
