import { useAuthStore } from '@/app/auth/store';

export const useRoleNavigation = () => {
  const { getUserRole } = useAuthStore();
  
  const navigateToRoleBasedPage = () => {
    const userRole = getUserRole();
    
    if (userRole === 'AGENT' || userRole === 'ADMIN') {
      window.location.href = '/management';
    } else {
      window.location.href = '/user';
    }
  };
  
  const getDashboardUrl = () => {
    const userRole = getUserRole();
    
    if (userRole === 'AGENT' || userRole === 'ADMIN') {
      return '/management';
    }
    return '/user';
  };
  
  return { 
    navigateToRoleBasedPage,
    getDashboardUrl
  };
};
