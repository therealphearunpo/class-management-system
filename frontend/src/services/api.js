import axios from 'axios';

function getDefaultApiBaseUrl() {
  if (typeof window === 'undefined') {
    return 'http://localhost:3001/api';
  }

  const { hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001/api';
  }

  return `${window.location.origin}/api`;
}

const API_BASE_URL = (process.env.REACT_APP_API_URL || getDefaultApiBaseUrl()).replace(/\/+$/, '');
const TELEGRAM_REPORT_URL = `${API_BASE_URL}/telegram/attendance/telegram-report`;
const TELEGRAM_REPORT_PROXY_URL = '/api/telegram/attendance/telegram-report';

function buildTelegramReportCandidates() {
  const candidates = [];
  const seen = new Set();

  const push = (url) => {
    if (!url) return;
    const normalized = String(url).trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(normalized);
  };

  push(TELEGRAM_REPORT_URL);
  push(TELEGRAM_REPORT_PROXY_URL);
  return candidates;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    }

    return Promise.reject(error);
  }
);

// API endpoints
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export const studentsAPI = {
  getAll: (params) => api.get('/students', { params }),
  getById: (id) => api.get(`/students/${id}`),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.put(`/students/${id}`, data),
  delete: (id) => api.delete(`/students/${id}`),
  bulkCreate: (data) => api.post('/students/bulk', data),
};

export const attendanceAPI = {
  getToday: (params) => api.get('/attendance/today', { params }),
  mark: (data) => api.post('/attendance/mark', data),
  bulkMark: (data) => api.post('/attendance/bulk-mark', data),
  getHistory: (params) => api.get('/attendance/history', { params }),
  getStats: (params) => api.get('/attendance/stats', { params }),
  export: (params) => api.get('/attendance/export', { params, responseType: 'blob' }),
  sendTelegramReport: async (data) => {
    const post = async (url) => {
      const response = await fetch(url, {
        method: 'POST',
        body: data,
        mode: 'cors',
        credentials: 'omit',
      });
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json().catch(() => ({}))
        : {};
      if (!response.ok) {
        const error = new Error(
          payload?.message ||
            payload?.telegram?.description ||
            `Telegram report upload failed (${response.status})`
        );
        error.response = { data: payload, status: response.status };
        throw error;
      }
      return payload;
    };

    const urls = buildTelegramReportCandidates();
    let lastError = null;

    for (const url of urls) {
      try {
        return await post(url);
      } catch (error) {
        lastError = error;
        const isNetworkFailure =
          error?.name === 'TypeError' ||
          /failed to fetch|networkerror|network error/i.test(String(error?.message || ''));
        const status = Number(error?.response?.status || 0);
        const retryableHttpError = [404, 405, 408, 429, 500, 502, 503, 504].includes(status);

        if (!isNetworkFailure && !retryableHttpError) {
          throw error;
        }
      }
    }

    throw lastError || new Error('Telegram report upload failed');
  },
};

export const assignmentsAPI = {
  getAll: (params) => api.get('/assignments', { params }),
  getById: (id) => api.get(`/assignments/${id}`),
  create: (data) => api.post('/assignments', data),
  update: (id, data) => api.put(`/assignments/${id}`, data),
  delete: (id) => api.delete(`/assignments/${id}`),
  submit: (id, data) => api.post(
    `/assignments/${id}/submit`,
    data,
    data instanceof FormData
      ? { headers: { 'Content-Type': 'multipart/form-data' } }
      : undefined
  ),
  grade: (id, data) => api.post(`/assignments/${id}/grade`, data),
};

export const examsAPI = {
  getAll: (params) => api.get('/exams', { params }),
  getById: (id) => api.get(`/exams/${id}`),
  create: (data) => api.post('/exams', data),
  update: (id, data) => api.put(`/exams/${id}`, data),
  delete: (id) => api.delete(`/exams/${id}`),
  publishResults: (id, data) => api.post(`/exams/${id}/publish`, data),
};

export const marksheetsAPI = {
  getAll: (params) => api.get('/marksheets', { params }),
  getById: (id) => api.get(`/marksheets/${id}`),
  create: (data) => api.post('/marksheets', data),
  update: (id, data) => api.put(`/marksheets/${id}`, data),
  delete: (id) => api.delete(`/marksheets/${id}`),
  download: (id) => api.get(`/marksheets/${id}/download`, { responseType: 'blob' }),
};

export const messagesAPI = {
  getAll: (params) => api.get('/messages', { params }),
  create: (data) => api.post('/messages', data),
};

export const certificatesAPI = {
  getAll: (params) => api.get('/certificates', { params }),
  getById: (id) => api.get(`/certificates/${id}`),
  create: (data) => api.post('/certificates', data),
  update: (id, data) => api.put(`/certificates/${id}`, data),
  delete: (id) => api.delete(`/certificates/${id}`),
  issue: (id) => api.post(`/certificates/${id}/issue`),
  download: (id) => api.get(`/certificates/${id}/download`, { responseType: 'blob' }),
  sendEmail: (id) => api.post(`/certificates/${id}/email`),
};

export const reportsAPI = {
  getAttendanceReport: (params) => api.get('/reports/attendance', { params }),
  getPerformanceReport: (params) => api.get('/reports/performance', { params }),
  getDemographics: (params) => api.get('/reports/demographics', { params }),
  exportReport: (type, params) => api.get(`/reports/export/${type}`, { params, responseType: 'blob' }),
};

export default api;
