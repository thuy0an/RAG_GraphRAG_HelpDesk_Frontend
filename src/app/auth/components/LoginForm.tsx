import { useState } from 'react';
import type { SignInData } from '../types';

interface LoginFormProps {
  onSubmit: (data: SignInData) => void;
  isPending: boolean;
}

export default function LoginForm({ onSubmit, isPending }: LoginFormProps) {
  const [signInData, setSignInData] = useState<SignInData>({
    username: 'u1',
    password: '123'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(signInData);
  };

  return (
    <>
      <h2 className="text-2xl font-bold mb-6 text-center">
        Dang nhap
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
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
          disabled={isPending}
          className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
        >
          {isPending ? '...' : 'Dang nhap'}
        </button>
      </form>
    </>
  );
}
