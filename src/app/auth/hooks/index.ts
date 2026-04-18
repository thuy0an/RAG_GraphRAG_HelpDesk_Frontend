import { useMutation } from '@tanstack/react-query'
import { queryClient } from '@/shared/lib/ReactQuery'
import { useAuthStore } from '../store';
import { AuthService } from '../service/index';
import type { SignInData, SignUpData } from '../types';
import { message } from 'antd';

const authService = new AuthService();

export function useSignIn() {
  const { login, getUserRole } = useAuthStore();

  return useMutation({
    mutationFn: (data: SignInData) => authService.signIn(data),
    onSuccess: (res: any) => {
      if (res.result?.access_token) {
        login(res.result.access_token);
        window.location.href = '/smart_doc';
      }
    },
    onError: (error: any) => {
      message.error(error.message || 'Dang nhap that bai. Vui long thu lai.');
    }
  }, queryClient);
}

export function useSignUp() {
  const { login, getUserRole } = useAuthStore();

  return useMutation({
    mutationFn: (data: SignUpData) => authService.signUp(data),
    onSuccess: (res: any) => {
      message.success('Dang ky thanh cong');
      if (res.result?.access_token) {
        login(res.result.access_token);
        window.location.href = '/smart_doc';
      }
    },
    onError: (error: any) => {
      message.error(error.message || 'Dang ky that bai. Vui long thu lai.');
    }
  }, queryClient);
}
