interface TabToggleProps {
  activeTab: 'login' | 'register';
  onTabChange: (tab: 'login' | 'register') => void;
}

export default function TabToggle({ activeTab, onTabChange }: TabToggleProps) {
  return (
    <div className="flex mb-6 border-b">
      <button
        onClick={() => onTabChange('login')}
        className={`flex-1 py-2 text-center font-medium transition-colors ${
          activeTab === 'login'
            ? 'border-b-2 border-blue-500 text-blue-500'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Dang nhap
      </button>
      <button
        onClick={() => onTabChange('register')}
        className={`flex-1 py-2 text-center font-medium transition-colors ${
          activeTab === 'register'
            ? 'border-b-2 border-blue-500 text-blue-500'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Dang ky
      </button>
    </div>
  );
}
