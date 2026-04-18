interface HeaderProps {
  username?: string;
  onLogout: () => void;
}

export default function Header({ username, onLogout }: HeaderProps) {
  const handleLogout = () => {
    onLogout();
    window.location.href = '/auth';
  };

  return (
    <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">
          Welcome, {username || 'User'}
        </h2>
      </div>
      
      <button
        onClick={handleLogout}
        className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
      >
        Logout
      </button>
    </header>
  );
}
