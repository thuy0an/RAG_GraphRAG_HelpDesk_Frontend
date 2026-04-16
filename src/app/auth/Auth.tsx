import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { queryClient } from '@/lib/ReactQuery'
import { useAuthStore } from './authStore';
import { PUBLIC_API_BASE_URL } from '@/constants/constant';
import { message } from 'antd';
import LandingFooter from '@/layouts/LandingFooter';

interface SignInData {
  username: string
  password: string
}

interface SignUpData {
  username: string
  email: string
  password: string
  role: string
  department_id: string | null
}

export default function Sign() {
  const { login, logout, token, payload, getUserRole } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')

  const [signInData, setSignInData] = useState<SignInData>({
    username: 'u1',
    password: '123'
  })

  const [signUpData, setSignUpData] = useState<SignUpData>({
    username: '',
    email: '',
    password: '',
    role: 'CUSTOMER',
    department_id: null
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
        throw new Error(data.message || 'Dang nhap that bai');
      }

      return data
    }
  }, queryClient)

  const signUpMutation = useMutation({
    mutationFn: async (request: SignUpData) => {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/auth/sign-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
      let data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Dang ky that bai');
      }

      return data
    }
  }, queryClient)

  const handleSignInSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    signInMutation.mutate(signInData, {
      onSuccess: (res: any) => {
        if (res.data?.access_token) {
          console.log("Updating token...")
          login(res.data.access_token)
          const userRole = getUserRole()
          const redirectPath = new URLSearchParams(window.location.search).get('redirect')

          if (redirectPath) {
            if (redirectPath.startsWith('/user_portal') && userRole !== 'CUSTOMER') {
              window.location.href = '/management';
            } else if (redirectPath.startsWith('/management') && userRole === 'CUSTOMER') {
              window.location.href = '/user_portal';
            } else {
              window.location.href = redirectPath;
            }
          } else {
            if (userRole === 'CUSTOMER') {
              window.location.href = '/user_portal';
            } else {
              window.location.href = '/management';
            }
          }
        }
      },
      onError: (error: any) => {
        message.error(error.message || 'Dang nhap that bai. Vui long thu lai.')
      }
    })
  }

  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    signUpMutation.mutate(signUpData, {
      onSuccess: (res: any) => {
        message.success('Dang ky thanh cong')
        if (res.data?.access_token) {
          login(res.data.access_token)
          const userRole = getUserRole()
          const redirectPath = new URLSearchParams(window.location.search).get('redirect')

          if (redirectPath) {
            if (redirectPath.startsWith('/user_portal') && userRole !== 'CUSTOMER') {
              window.location.href = '/management';
            } else if (redirectPath.startsWith('/management') && userRole === 'CUSTOMER') {
              window.location.href = '/user_portal';
            } else {
              window.location.href = redirectPath;
            }
          } else {
            if (userRole === 'CUSTOMER') {
              window.location.href = '/user_portal';
            } else {
              window.location.href = '/management';
            }
          }
        }
      },
      onError: (error: any) => {
        message.error(error.message || 'Dang ky that bai. Vui long thu lai.')
      }
    })
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
          {/* Tab Toggle */}
          <div className="flex mb-6 border-b">
            <button
              onClick={() => setActiveTab('login')}
              className={`flex-1 py-2 text-center font-medium transition-colors ${
                activeTab === 'login'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Dang nhap
            </button>
            <button
              onClick={() => setActiveTab('register')}
              className={`flex-1 py-2 text-center font-medium transition-colors ${
                activeTab === 'register'
                  ? 'border-b-2 border-blue-500 text-blue-500'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Dang ky
            </button>
          </div>

          {activeTab === 'login' ? (
            <>
              <h2 className="text-2xl font-bold mb-6 text-center">
                Dang nhap
              </h2>

              <form onSubmit={handleSignInSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Username</label>
                  <input
                    type="text"
                    value={signInData.username}
                    onChange={(e) => setSignInData({ ...signInData, username: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <input
                    type="password"
                    value={signInData.password}
                    onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={signInMutation.isPending}
                  className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  {signInMutation.isPending ? '...' : 'Dang nhap'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-6 text-center">
                Dang ky
              </h2>

              <form onSubmit={handleSignUpSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Username</label>
                  <input
                    type="text"
                    value={signUpData.username}
                    onChange={(e) => setSignUpData({ ...signUpData, username: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <input
                    type="password"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={signUpMutation.isPending}
                  className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                >
                  {signUpMutation.isPending ? '...' : 'Dang ky'}
                </button>
              </form>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  )
}