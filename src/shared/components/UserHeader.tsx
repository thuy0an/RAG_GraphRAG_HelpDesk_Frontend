import { useState } from 'react';
import { Dropdown, Button } from 'antd';
import type { MenuProps } from 'antd';
import { useAuthStore } from '@/app/auth/store';
import { UserOutlined, SettingOutlined, LogoutOutlined } from '@ant-design/icons';

export default function UserHeader() {
  const { logout, payload } = useAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    window.location.href = '/auth';
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Cài đặt tài khoản',
      onClick: () => {
        window.location.href = '/user_portal/settings';
      },
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      onClick: handleLogout,
    },
  ];

  const username = payload?.username || payload?.sub || 'User';

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[80%] items-center justify-between px-4 md:px-6">
        <a href="/" className="text-lg font-bold text-gray-900">
          AI HelpDesk
        </a>

        <div className="flex items-center gap-4">
          <Dropdown
            menu={{ items: menuItems }}
            trigger={['click']}
            open={dropdownOpen}
            onOpenChange={setDropdownOpen}
            placement="bottomRight"
          >
            <Button 
              type="text" 
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <UserOutlined />
              <span>Xin chào, {username}</span>
            </Button>
          </Dropdown>
        </div>
      </div>
    </header>
  );
}
