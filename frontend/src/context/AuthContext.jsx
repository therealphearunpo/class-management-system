import React, { createContext, useContext, useReducer, useCallback } from 'react';

import { ACCOUNT_ROLES, getRoleLabel, normalizeRole } from '../constants/roles';
import { studentsData } from '../data/students';
import { authAPI } from '../services/api';
import { generateAvatarByGender, normalizeGender } from '../utils/avatar';
import { buildStudentPassword, normalizeStudentAccount, normalizeStudentIds } from '../utils/studentAuth';

const AuthContext = createContext(null);
const ADMIN_CENTER_EMAILS = [
  'nim.cheyseth.2824@rupp.edu.kh',
  'thet.englang.2824@rupp.edu.kh',
  'po.phearun.2824@rupp.edu.kh',
  'admin.center@school.local',
];
const ADMIN_CENTER_PASSWORD = 'Admin1234';
const LOCAL_STUDENTS_KEY = 'students_local_v2';

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
        error: null 
      };
    case 'LOGIN_FAILURE':
      return { ...state, loading: false, error: action.payload };
    case 'LOGOUT':
      return { ...state, isAuthenticated: false, user: null, loading: false };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'UPDATE_PROFILE':
      return { ...state, user: action.payload };
    default:
      return state;
  }
}

function normalizeUser(user) {
  if (!user) return user;
  const normalizedEmail = String(user.email || '').trim().toLowerCase();
  const isAdminCenterMember = ADMIN_CENTER_EMAILS.includes(normalizedEmail);
  const normalizedRole = isAdminCenterMember ? ACCOUNT_ROLES.ADMIN : normalizeRole(user.role);
  const normalizedGender = normalizeGender(user.gender, 'male');
  return {
    ...user,
    isAdminCenterMember,
    gender: normalizedGender,
    role: normalizedRole,
    roleLabel: getRoleLabel(normalizedRole),
  };
}

function readLocalStudents() {
  try {
    const raw = localStorage.getItem(LOCAL_STUDENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeUniqueStudents(items) {
  const map = new Map();
  items.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const idKey = item.id !== undefined && item.id !== null ? `id:${item.id}` : null;
    const emailKey = item.email ? `email:${String(item.email).toLowerCase()}` : null;
    const nameKey = `name:${String(item.name || '').toLowerCase()}-${String(item.class || '')}-${String(item.rollNo || index)}`;
    const key = idKey || emailKey || nameKey;
    map.set(key, item);
  });
  return Array.from(map.values());
}

function getStudentAccounts() {
  const localStudents = readLocalStudents();
  const merged = mergeUniqueStudents([...localStudents, ...studentsData]);
  const withStudentIds = normalizeStudentIds(merged);
  return withStudentIds.map((student, index) => normalizeStudentAccount(student, student.id ?? index + 1));
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const login = useCallback(async (email, password, selectedRole = null) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (!email || !password) {
        throw new Error('Invalid credentials');
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const studentAccounts = getStudentAccounts();
      const matchedStudent = studentAccounts.find(
        (student) => String(student.email || '').toLowerCase() === normalizedEmail
      );

      try {
        const response = await authAPI.login({ email: normalizedEmail, password });
        const apiUser = response?.data?.user || {};
        const token = response?.data?.token;
        const normalizedRole = normalizeRole(apiUser.role);

        const user = {
          id: apiUser.id || matchedStudent?.id || 1,
          name: apiUser.name || matchedStudent?.name || 'User',
          email: apiUser.email || normalizedEmail,
          role: normalizedRole,
          roleLabel: getRoleLabel(normalizedRole),
          isAdminCenterMember: normalizedRole === ACCOUNT_ROLES.ADMIN,
          phone: '',
          gender: normalizeGender(apiUser.gender || matchedStudent?.gender, 'male'),
          avatar:
            matchedStudent?.avatar ||
            generateAvatarByGender(
              normalizedEmail,
              normalizeGender(apiUser.gender || matchedStudent?.gender, 'male')
            ),
          studentId: matchedStudent?.studentId || '',
          class: matchedStudent?.class || '',
          section: matchedStudent?.section || '',
          shift: matchedStudent?.shift || '',
          rollNo: matchedStudent?.rollNo ?? '',
          dateOfBirth: matchedStudent?.dateOfBirth || '',
        };

        dispatch({ type: 'LOGIN_SUCCESS', payload: user });
        localStorage.setItem('auth_user', JSON.stringify(user));
        if (token) {
          localStorage.setItem('auth_token', token);
        }
        return { success: true, role: normalizedRole };
      } catch (_apiError) {
        const username = normalizedEmail.split('@')[0];
        const formattedName = username
          .split(/[._-]/)
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
        const isAdminCenterMember = ADMIN_CENTER_EMAILS.includes(normalizedEmail);

        const inferredRole = isAdminCenterMember
          ? ACCOUNT_ROLES.ADMIN
          : (matchedStudent ? ACCOUNT_ROLES.STUDENT : ACCOUNT_ROLES.TEACHER);
        const normalizedRole = selectedRole ? normalizeRole(selectedRole) : inferredRole;

        if (normalizedRole === ACCOUNT_ROLES.ADMIN) {
          if (!isAdminCenterMember) {
            throw new Error('This email is not in the Admin Center list.');
          }
          if (password !== ADMIN_CENTER_PASSWORD) {
            throw new Error('Invalid Admin Center password.');
          }
        }

        if (normalizedRole === ACCOUNT_ROLES.TEACHER && isAdminCenterMember) {
          throw new Error('This account is reserved for Admin Center. Please choose Admin Center role.');
        }

        if (normalizedRole === ACCOUNT_ROLES.STUDENT) {
          if (!matchedStudent) {
            throw new Error('Student email was not found. Please use the email from Student Lookup.');
          }
          const expectedPassword = buildStudentPassword(matchedStudent);
          if (String(password).trim().toLowerCase() !== expectedPassword.toLowerCase()) {
            throw new Error('Invalid student password. Use lastname + DDMMYYYY.');
          }
        }

        const user = {
          id: matchedStudent?.id || 1,
          name: matchedStudent?.name || formattedName || 'User',
          email: normalizedEmail,
          role: normalizedRole,
          roleLabel: getRoleLabel(normalizedRole),
          isAdminCenterMember,
          phone: '',
          gender: normalizeGender(matchedStudent?.gender, 'male'),
          avatar:
            matchedStudent?.avatar ||
            generateAvatarByGender(normalizedEmail, normalizeGender(matchedStudent?.gender, 'male')),
          studentId: matchedStudent?.studentId || '',
          class: matchedStudent?.class || '',
          section: matchedStudent?.section || '',
          shift: matchedStudent?.shift || '',
          rollNo: matchedStudent?.rollNo ?? '',
          dateOfBirth: matchedStudent?.dateOfBirth || '',
        };
        dispatch({ type: 'LOGIN_SUCCESS', payload: user });
        localStorage.setItem('auth_user', JSON.stringify(user));
        localStorage.setItem('auth_token', 'mock-jwt-token-' + Date.now());
        return { success: true, role: normalizedRole };
      }
    } catch (error) {
      dispatch({ type: 'LOGIN_FAILURE', payload: error.message });
      return { success: false, error: error.message };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    dispatch({ type: 'LOGOUT' });
  }, []);

  const checkAuth = useCallback(() => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const storedUser = localStorage.getItem('auth_user');
      const token = localStorage.getItem('auth_token');
      
      if (storedUser && token) {
        const normalizedUser = normalizeUser(JSON.parse(storedUser));
        dispatch({ type: 'LOGIN_SUCCESS', payload: normalizedUser });
        localStorage.setItem('auth_user', JSON.stringify(normalizedUser));
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
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
    };

    if (currentRole === ACCOUNT_ROLES.STUDENT) {
      // Students cannot escalate role or alter identity-critical academic fields.
      nextUser.role = ACCOUNT_ROLES.STUDENT;
      nextUser.email = state.user.email;
      nextUser.studentId = state.user.studentId;
      nextUser.class = state.user.class;
      nextUser.section = state.user.section;
      nextUser.shift = state.user.shift;
      nextUser.rollNo = state.user.rollNo;
      nextUser.dateOfBirth = state.user.dateOfBirth;
      nextUser.gender = state.user.gender;
      nextUser.isAdminCenterMember = false;
    } else if (currentRole === ACCOUNT_ROLES.ADMIN) {
      nextUser.role = ACCOUNT_ROLES.ADMIN;
      nextUser.isAdminCenterMember = true;
    } else {
      // Teachers cannot escalate role from profile editing.
      nextUser.role = ACCOUNT_ROLES.TEACHER;
      nextUser.isAdminCenterMember = false;
    }

    const normalizedRole = normalizeRole(nextUser.role);
    nextUser.gender = normalizeGender(nextUser.gender, normalizeGender(state.user.gender, 'male'));
    nextUser.roleLabel = getRoleLabel(normalizedRole);

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
