import { useState } from 'react'
import { useSignIn, useSignUp } from './hooks/index';
import LandingFooter from '@/shared/layouts/LandingFooter';
import TabToggle from './components/TabToggle';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';

export default function Sign() {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login')

  const signInMutation = useSignIn();
  const signUpMutation = useSignUp();

  const handleSignInSubmit = (data: any) => {
    signInMutation.mutate(data);
  }

  const handleSignUpSubmit = (data: any) => {
    signUpMutation.mutate(data);
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
          {/* Tab Toggle */}
          <TabToggle activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === 'login' ? (
            <LoginForm onSubmit={handleSignInSubmit} isPending={signInMutation.isPending} />
          ) : (
            <RegisterForm onSubmit={handleSignUpSubmit} isPending={signUpMutation.isPending} />
          )}
        </div>
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  )
}