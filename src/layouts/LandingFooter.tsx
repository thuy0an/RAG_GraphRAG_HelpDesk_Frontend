export default function LandingFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-gray-600 md:flex-row md:items-center md:justify-between md:px-6">
        <p>© {new Date().getFullYear()} AI HelpDesk. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <a href="/" className="hover:text-gray-900">
            Home
          </a>
        </div>
      </div>
    </footer>
  );
}

