import { PUBLIC_API_BASE_URL } from '@/shared/constants/constant';
import type { SignInData, SignUpData } from '../types';

export class AuthService {
  async signIn(data: SignInData) {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Dang nhap that bai');
    }

    return result;
  }

  async signUp(data: SignUpData) {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/auth/sign-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Dang ky that bai');
    }

    return result;
  }
}
