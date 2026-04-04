/**
 * API client - centralized fetch calls to the Flask backend.
 */
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const getOverview = () => api.get('/api/overview');
export const getTimeseries = (granularity = 'daily', subreddit = null) => {
  const params = { granularity };
  if (subreddit) params.subreddit = subreddit;
  return api.get('/api/timeseries', { params });
};
export const getNetwork = () => api.get('/api/network');
export const searchPosts = (q, k = 10) => api.get('/api/search', { params: { q, k } });
export const getClusters = (k = 5) => api.get('/api/clusters', { params: { k } });
export const getEmbeddings = (max = 2000) => api.get('/api/embeddings', { params: { max } });
export const getSummary = (chartType, chartData) =>
  api.post('/api/summary', { chart_type: chartType, chart_data: chartData });
export const getPosts = (params = {}) => api.get('/api/posts', { params });
export const getHealth = () => api.get('/api/health');

export default api;
