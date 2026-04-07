import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { queryClient } from '@/lib/ReactQuery'
import { useLocalStorage } from './useLocalStorage';
import useCookie from './useCookie';
import { useAuthStore } from './authStore';
import { PUBLIC_API_BASE_URL } from '@/constants/constant';
import { message } from 'antd';
import LandingFooter from '@/layouts/LandingFooter';

interface SignInData {
  username: string
  password: string
}

export default function Sign() {
  const { login, logout, token, payload, getUserRole } = useAuthStore()

  const [formData, setFormData] = useState<SignInData>({
    username: 'u1',
    password: '123'
  })

  const signInMutation = useMutation({
    mutationFn: async (request: SignInData) => {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/auth/sign-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
      let data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Đăng nhập thất bại');
      }

      return data
    }
  }, queryClient)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    signInMutation.mutate(formData, {
      onSuccess: (res: any) => {
        if (res.data?.access_token) {
          console.log("Updating token...")
          login(res.data.access_token)
          window.location.href = '/user_portal';
        }
      },
      onError: (error: any) => {
        message.error(error.message || 'Đăng nhập thất bại. Vui lòng thử lại.')
      }
    })
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-6 text-center">
            Đăng nhập
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                required
              />
            </div>

            <button
              type="submit"
              disabled={signInMutation.isPending}
              className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {signInMutation.isPending ? '...' : 'Đăng nhập'}
            </button>
          </form>

          {/* <div>{JSON.stringify(payload)}</div> */}
        </div>
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  )
}