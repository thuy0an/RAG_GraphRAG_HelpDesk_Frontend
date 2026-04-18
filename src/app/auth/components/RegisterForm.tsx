import { useState } from 'react';
import type { SignUpData } from '../types';

interface RegisterFormProps {
  onSubmit: (data: SignUpData) => void;
  isPending: boolean;
}

export default function RegisterForm({ onSubmit, isPending }: RegisterFormProps) {
  const [signUpData, setSignUpData] = useState<SignUpData>({
    username: '',
    email: '',
    password: '',
    role: 'CUSTOMER',
    department_id: null
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(signUpData);
  };

  return (
    <>
      <h2 className="text-2xl font-bold mb-6 text-center">
        Dang ky
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
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
          disabled={isPending}
          className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
        >
          {isPending ? '...' : 'Dang ky'}
        </button>
      </form>
    </>
  );
}
