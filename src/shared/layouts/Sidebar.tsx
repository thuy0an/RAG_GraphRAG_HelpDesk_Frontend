import { useAuthStore } from '@/app/auth/store';
import { useRoleNavigation } from '@/shared/hooks/useRoleNavigation';

interface MenuItem {
  label: string;
  href: string;
  icon?: string;
  allowedRoles: ('AGENT' | 'ADMIN')[];
}

const menuItems: MenuItem[] = [
  { label: 'Dashboard', href: '/management', icon: 'dashboard', allowedRoles: ['AGENT', 'ADMIN'] },
  { label: 'Tickets', href: '/management/tickets', icon: 'ticket', allowedRoles: ['AGENT', 'ADMIN'] },
  { label: 'Users', href: '/management/users', icon: 'users', allowedRoles: ['ADMIN'] },
  { label: 'Settings', href: '/management/settings', icon: 'settings', allowedRoles: ['ADMIN'] },
];

export default function Sidebar() {
  const { isAgent, isAdmin, getUserRole } = useAuthStore();
  const { getDashboardUrl } = useRoleNavigation();
  
  const userRole = getUserRole();

  const visibleMenuItems = menuItems.filter(item => 
    item.allowedRoles.includes(userRole as 'AGENT' | 'ADMIN')
  );

  const handleNavigation = (href: string) => {
    window.location.href = href;
  };

  return (
    <aside className="w-64 bg-white shadow-md flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold text-gray-800">AI HelpDesk</h1>
        <p className="text-sm text-gray-500">Management</p>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {visibleMenuItems.map((item) => (
            <li key={item.href}>
              <button
                onClick={() => handleNavigation(item.href)}
                className="w-full text-left px-4 py-2 rounded-md hover:bg-blue-50 hover:text-blue-600 transition-colors"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4 border-t">
        <button
          onClick={() => handleNavigation('/user')}
          className="w-full text-left px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          ← Back to User App
        </button>
      </div>
    </aside>
  );
}
