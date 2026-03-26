import React, { useEffect, useState } from 'react';

import { HiEye, HiEyeOff } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';

import { getRoleHomePath } from '../../constants/roles';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login, loading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate(getRoleHomePath(user?.role), { replace: true });
    }
  }, [isAuthenticated, navigate, user?.role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    const result = await login(email, password);
    if (result.success) {
      navigate(getRoleHomePath(result.role));
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b1738] via-[#122655] to-[#1d3b82] px-4 py-8 flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.10),transparent_38%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.10),transparent_35%)]" />
      <div className="relative w-full max-w-md rounded-3xl border border-blue-200/40 bg-white/95 backdrop-blur p-8 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-[#1f2f67] to-[#3755b0] text-white flex items-center justify-center font-bold text-sm shadow-lg">
            HS
          </div>
          <h1 className="mt-4 text-2xl font-extrabold text-[#1f2f67]">High School Portal</h1>
          <p className="mt-1 text-sm text-gray-500">School Class Management System</p>
        </div>

        <div className="mt-6 rounded-xl bg-[#f3f7ff] border border-blue-100 p-3 text-xs text-blue-800">
          Admin, Teacher, and Student account type is detected automatically from your email.
        </div>

        {error && (
          <div className="mt-4 bg-red-100 text-red-700 p-3 rounded-lg border border-red-200 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="email" className="block text-gray-700 mb-2 text-sm font-medium">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="name@school.edu"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-gray-700 mb-2 text-sm font-medium">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 pr-10 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#243671] to-[#2b3f86] text-white py-2.5 rounded-lg hover:opacity-95 disabled:opacity-50 font-semibold"
          >
            {loading ? 'Loading...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-500">
          Public High School System - Cambodia
        </p>
      </div>
    </div>
  );
}
