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
  // Get all presentations (public)
  getPresentations: (token) =>
    api.get('/presentations', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }),

  // Get a single presentation (public)
  getPresentation: (id, token) =>
    api.get(`/presentations/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
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

  // Fetch unique filters (public)
  getFilters: (token) =>
    api.get('/presentations/filters', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }),

  // Get all files in a presentation (public)
  getFiles: (id, token) =>
    api.get(`/presentations/${id}/files`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }),

  // Get content of a specific file (public)
  getFileContent: (id, filename, token) =>
    api.get(`/presentations/${id}/files/${filename}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }),

  // Update content of a specific file
  updateFileContent: (id, filename, content, token) =>
    api.put(`/presentations/${id}/files/${filename}`, { content }, {
      headers: { Authorization: `Bearer ${token}` }
    }),
  // Create a new presentation (empty)
  createPresentation: (data, token) =>
    api.post('/presentations/create', data, {
      headers: { Authorization: `Bearer ${token}` }
    }),

  // Create a new file in a presentation
  createFile: (id, filename, content, token) =>
    api.post(`/presentations/${id}/files`, { filename, content }, {
      headers: { Authorization: `Bearer ${token}` }
    }),

  // Delete a specific file
  deleteFile: (id, filename, token) =>
    api.delete(`/presentations/${id}/files/${filename}`, {
      headers: { Authorization: `Bearer ${token}` }
    }),
};

export default api;
