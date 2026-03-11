import React, { createContext, useCallback, useContext, useReducer } from 'react';

import { ACCOUNT_ROLES, getRoleLabel, normalizeRole } from '../constants/roles';
import { authAPI } from '../services/api';
import { generateAvatarByGender, normalizeGender } from '../utils/avatar';

const AuthContext = createContext(null);
const ADMIN_CENTER_EMAILS = [
  'nim.cheyseth.2824@rupp.edu.kh',
  'thet.englang.2824@rupp.edu.kh',
  'po.phearun.2824@rupp.edu.kh',
  'admin.center@school.local',
];

const initialState = {
  user: null,
  isAuthenticated: false,
  loading: true,
  error: null,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, loading: true, error: null };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        loading: false,
        isAuthenticated: true,
        user: action.payload,
        error: null,
      };
    case 'LOGIN_FAILURE':
      return { ...state, loading: false, error: action.payload };
    case 'LOGOUT':
      return { ...state, isAuthenticated: false, user: null, loading: false, error: null };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'UPDATE_PROFILE':
      return { ...state, user: action.payload };
    default:
      return state;
  }
}

function normalizeUser(user) {
  if (!user) return null;
  const normalizedEmail = String(user.email || '').trim().toLowerCase();
  const isAdminCenterMember = ADMIN_CENTER_EMAILS.includes(normalizedEmail);
  const normalizedRole = isAdminCenterMember ? ACCOUNT_ROLES.ADMIN : normalizeRole(user.role);
  const normalizedGender = normalizeGender(user.gender, 'male');

  return {
    ...user,
    email: normalizedEmail,
    isAdminCenterMember,
    gender: normalizedGender,
    role: normalizedRole,
    roleLabel: getRoleLabel(normalizedRole),
    avatar:
      user.avatar ||
      generateAvatarByGender(normalizedEmail || user.name || 'user', normalizedGender),
  };
}

function clearStoredAuth() {
  localStorage.removeItem('auth_user');
  localStorage.removeItem('auth_token');
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const login = useCallback(async (email, password) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const response = await authAPI.login({ email: normalizedEmail, password });
      const token = response?.data?.token;
      const user = normalizeUser(response?.data?.user);

      if (!token || !user) {
        throw new Error('Login response is missing required user data');
      }

      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
      return { success: true, role: user.role };
    } catch (error) {
      clearStoredAuth();
      const message = error?.response?.data?.message || error?.message || 'Login failed';
      dispatch({ type: 'LOGIN_FAILURE', payload: message });
      return { success: false, error: message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch (_error) {
      // Local logout should still complete if the API is unavailable.
    }

    clearStoredAuth();
    dispatch({ type: 'LOGOUT' });
  }, []);

  const checkAuth = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      const response = await authAPI.me();
      const user = normalizeUser(response?.data?.user);

      if (!user) {
        throw new Error('Authenticated user payload is missing');
      }

      localStorage.setItem('auth_user', JSON.stringify(user));
      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
    } catch (_error) {
      clearStoredAuth();
      dispatch({ type: 'LOGOUT' });
    }
  }, []);

  const updateProfile = useCallback(async (updates) => {
    if (!state.user) {
      return { success: false, error: 'No authenticated user found.' };
    }

    const currentRole = normalizeRole(state.user.role);
    const nextUser = {
      ...state.user,
      ...updates,
      role: currentRole,
      roleLabel: getRoleLabel(currentRole),
      isAdminCenterMember: currentRole === ACCOUNT_ROLES.ADMIN,
    };

    nextUser.gender = normalizeGender(nextUser.gender, normalizeGender(state.user.gender, 'male'));
    if (!nextUser.avatar) {
      const avatarSeed = nextUser.email || nextUser.name || 'user';
      nextUser.avatar = generateAvatarByGender(avatarSeed, nextUser.gender);
    }

    dispatch({ type: 'UPDATE_PROFILE', payload: nextUser });
    try {
      localStorage.setItem('auth_user', JSON.stringify(nextUser));
      return { success: true, user: nextUser };
    } catch (_error) {
      return {
        success: true,
        user: nextUser,
        warning: 'Profile updated for this session. Storage is full, so it may not persist after refresh.',
      };
    }
  }, [state.user]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, checkAuth, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
