// src/services/api.js
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// Create axios instance with base URL
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// User authentication functions
export const userApi = {
  // Register user
  register: (userData) => api.post('/users/register', userData),

  // Login user
  login: (credentials) => api.post('/users/login', credentials),

  // Get current user details
  me: (token) => api.get('/users/me', { headers: { Authorization: `Bearer ${token}` } }),
};

// Presentation functions
export const presentationApi = {
  // Get all presentations for a user
  getPresentations: (token) =>
    api.get('/presentations', {
      headers: { Authorization: `Bearer ${token}` }
    }),

  // Get a single presentation
  getPresentation: (id, token) =>
    api.get(`/presentations/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    }),

  // Upload a presentation
  uploadPresentation: (formData, token) =>
    api.post('/presentations/upload', formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    }),

  // Update a presentation
  updatePresentation: (id, data, token) =>
    api.put(`/presentations/${id}`, data, {
      headers: { Authorization: `Bearer ${token}` }
    }),

  // Delete a presentation
  deletePresentation: (id, token) =>
    api.delete(`/presentations/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    }),

  // Fetch unique filters (domains and authors)
  getFilters: (token) =>
    api.get('/presentations/filters', {
      headers: { Authorization: `Bearer ${token}` }
    }),
};

export default api;
