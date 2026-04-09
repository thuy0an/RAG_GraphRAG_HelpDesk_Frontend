export default function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[80%] items-center justify-between px-4 md:px-6">
        <a href="/" className="text-lg font-bold text-gray-900">
          AI HelpDesk
        </a>

        <nav className="flex items-center gap-2 md:gap-3">
          <a
            href="/user_portal"
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cổng người dùng
          </a>
          <a
            href="/auth"
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Đăng nhập
          </a>
        </nav>
      </div>
    </header>
  );
}

