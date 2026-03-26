import React, { useEffect } from 'react';

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import AssignmentsPage from './components/Assignments/AssignmentsPage';
import AttendancePage from './components/Attendance/AttendancePage';
import LoginPage from './components/Auth/LoginPage';
import CalendarPage from './components/Calendar/CalendarPage';
import DashboardPage from './components/Dashboard/DashboardPage';
import DeveloperToolsPage from './components/DeveloperTools/DeveloperToolsPage';
import ExamsPage from './components/Exams/ExamsPage';
import Layout from './components/Layout/Layout';
import MarksheetsPage from './components/Marksheets/MarksheetsPage';
import MessagesPage from './components/Messages/MessagesPage';
import ProfilePage from './components/Profile/ProfilePage';
import ReportsPage from './components/Reports/ReportsPage';
import SchedulePage from './components/Schedule/SchedulePage';
import StudentLookupPage from './components/Students/StudentLookupPage';
import StudentsPage from './components/Students/StudentsPage';
import { ACCOUNT_ROLES, getRoleHomePath, normalizeRole } from './constants/roles';
import { AttendanceProvider } from './context/AttendanceContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

const STUDENT_DATA_RESET_KEY = 'student_data_reset_v1';
const STUDENT_STORAGE_KEYS = ['students_local_v2', 'marksheets_local_v2'];

function PrivateRoute({ children, allowedRoles }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles?.length) {
    const currentRole = normalizeRole(user?.role);
    if (!allowedRoles.includes(currentRole)) {
      return <Navigate to={getRoleHomePath(currentRole)} replace />;
    }
  }

  return children;
}

function AppRoutes() {
  const { checkAuth, isAuthenticated, user, loading } = useAuth();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : isAuthenticated ? (
          <Navigate to={getRoleHomePath(user?.role)} replace />
        ) : (
          <Navigate to="/login" replace />
        )
      } />
      <Route path="/dashboard" element={
        <PrivateRoute allowedRoles={[ACCOUNT_ROLES.STUDENT, ACCOUNT_ROLES.TEACHER, ACCOUNT_ROLES.ADMIN]}>
          <Layout>
            <DashboardPage />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/attendance" element={
        <PrivateRoute allowedRoles={[ACCOUNT_ROLES.TEACHER, ACCOUNT_ROLES.ADMIN]}>
          <Layout>
            <AttendancePage />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/students" element={
        <PrivateRoute allowedRoles={[ACCOUNT_ROLES.ADMIN]}>
          <Layout>
            <StudentsPage />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/student-lookup" element={
        <PrivateRoute allowedRoles={[ACCOUNT_ROLES.ADMIN]}>
          <Layout>
            <StudentLookupPage />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/schedule" element={
        <PrivateRoute allowedRoles={[ACCOUNT_ROLES.STUDENT, ACCOUNT_ROLES.TEACHER, ACCOUNT_ROLES.ADMIN]}>
          <Layout>
            <SchedulePage />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/marksheets" element={
        <PrivateRoute allowedRoles={[ACCOUNT_ROLES.STUDENT, ACCOUNT_ROLES.ADMIN]}>
          <Layout>
            <MarksheetsPage />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/assignments" element={
        <PrivateRoute allowedRoles={[ACCOUNT_ROLES.STUDENT, ACCOUNT_ROLES.TEACHER]}>
          <Layout>
            <AssignmentsPage />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/exams" element={
        <PrivateRoute allowedRoles={[ACCOUNT_ROLES.STUDENT, ACCOUNT_ROLES.TEACHER, ACCOUNT_ROLES.ADMIN]}>
          <Layout>
            <ExamsPage />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/reports" element={
        <PrivateRoute allowedRoles={[ACCOUNT_ROLES.ADMIN]}>
          <Layout>
            <ReportsPage />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/developer-tools" element={
        <PrivateRoute allowedRoles={[ACCOUNT_ROLES.ADMIN]}>
          <Layout>
            <DeveloperToolsPage />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/calendar" element={
        <PrivateRoute allowedRoles={[ACCOUNT_ROLES.STUDENT, ACCOUNT_ROLES.TEACHER, ACCOUNT_ROLES.ADMIN]}>
          <Layout>
            <CalendarPage />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/messages" element={
        <PrivateRoute allowedRoles={[ACCOUNT_ROLES.ADMIN]}>
          <Layout>
            <MessagesPage />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/profile" element={
        <PrivateRoute allowedRoles={[ACCOUNT_ROLES.STUDENT, ACCOUNT_ROLES.TEACHER, ACCOUNT_ROLES.ADMIN]}>
          <Layout>
            <ProfilePage />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const rawBase = process.env.PUBLIC_URL;
  const routerBase = rawBase && rawBase !== '.' ? rawBase : '/';

  useEffect(() => {
    try {
      if (localStorage.getItem(STUDENT_DATA_RESET_KEY) === 'done') return;
      STUDENT_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      localStorage.setItem(STUDENT_DATA_RESET_KEY, 'done');
    } catch (_error) {
      // Ignore storage cleanup failures.
    }
  }, []);

  return (
    <BrowserRouter basename={routerBase}>
      <ThemeProvider>
        <AuthProvider>
          <AttendanceProvider>
            <AppRoutes />
          </AttendanceProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
