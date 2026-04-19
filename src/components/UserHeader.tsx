import { useState } from 'react';

export default function UserHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[80%] items-center px-4 md:px-6">
        <a href="/" className="text-lg font-bold text-gray-900">
          AI HelpDesk
        </a>
      </div>
    </header>
  );
}
