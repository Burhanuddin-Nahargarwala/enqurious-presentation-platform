// src/pages/UploadPage.jsx
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Upload, File, X, Check, AlertCircle, Plus, FileCode } from 'lucide-react';
import { presentationApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/ui/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

function UploadPage() {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' or 'create'
  const [file, setFile] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    domain: ''
  });
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const inputRef = useRef(null);

  const navigate = useNavigate();
  const { token } = useAuth();

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file) => {
    if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
      setFile(file);
      setError('');
    } else {
      setError('Please upload a ZIP file');
    }
  };

  const removeFile = () => {
    setFile(null);
    setError('');
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async () => {
    if (activeTab === 'upload' && !file) {
      setError('Please upload a presentation file');
      return;
    }
    if (!formData.title || !formData.description || !formData.domain) {
      setError('Please fill in all fields');
      return;
    }

    setUploading(true);
    setError('');

    try {
      if (activeTab === 'upload') {
        const data = new FormData();
        data.append('presentation', file);
        if (thumbnail) {
          data.append('thumbnail', thumbnail);
        }
        data.append('title', formData.title);
        data.append('description', formData.description);
        data.append('domain', formData.domain);

        await presentationApi.uploadPresentation(data, token);
        setSuccess(true);
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        // Create from scratch
        const data = new FormData();
        data.append('title', formData.title);
        data.append('description', formData.description);
        data.append('domain', formData.domain);
        if (thumbnail) {
          data.append('thumbnail', thumbnail);
        }

        const response = await presentationApi.createPresentation(data, token);
        setSuccess(true);
        setTimeout(() => {
          navigate(`/manage/${response.data.presentation._id}`);
        }, 1000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-secondary-900">
            {activeTab === 'upload' ? 'Upload Presentation' : 'Create Presentation'}
          </h1>
          <p className="text-secondary-500 mt-1">
            {activeTab === 'upload' ? 'Share your slides with the team' : 'Start building your presentation from scratch'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${activeTab === 'upload'
              ? 'bg-primary-600 text-white shadow-md'
              : 'bg-white text-secondary-600 hover:bg-secondary-50 border border-secondary-200'
              }`}
          >
            <Upload size={20} />
            Upload ZIP
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${activeTab === 'create'
              ? 'bg-primary-600 text-white shadow-md'
              : 'bg-white text-secondary-600 hover:bg-secondary-50 border border-secondary-200'
              }`}
          >
            <Plus size={20} />
            Create from Scratch
          </button>
        </div>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Presentation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Title
                </label>
                <Input
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Q4 Marketing Strategy"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Domain / Category
                </label>
                <Input
                  name="domain"
                  value={formData.domain}
                  onChange={handleInputChange}
                  placeholder="e.g., Marketing, Engineering, Sales"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="flex w-full rounded-lg border border-secondary-200 bg-white px-3 py-2 text-sm placeholder:text-secondary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
                  placeholder="Briefly describe what this presentation is about..."
                  required
                />
              </div>
            </div>

            {activeTab === 'upload' && (
              <div className="pt-4 border-t border-secondary-100">
                <label className="block text-sm font-medium text-secondary-700 mb-3">
                  Presentation File (ZIP)
                </label>
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors duration-200 ${dragActive
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-secondary-200 hover:border-primary-400 hover:bg-secondary-50'
                    }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    accept=".zip"
                    onChange={handleFileChange}
                  />

                  {!file ? (
                    <div className="flex flex-col items-center cursor-pointer" onClick={() => inputRef.current?.click()}>
                      <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-4">
                        <Upload size={32} />
                      </div>
                      <p className="text-lg font-medium text-secondary-900">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-sm text-secondary-500 mt-1">
                        ZIP files only (max 50MB)
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-secondary-200 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center">
                          <File size={20} />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-secondary-900 truncate max-w-[200px]">
                            {file.name}
                          </p>
                          <p className="text-xs text-secondary-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={removeFile}
                        className="p-2 text-secondary-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Thumbnail (optional)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setThumbnail(e.target.files[0])}
                  className="block w-full text-sm text-secondary-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-secondary-100 file:text-secondary-700
                    hover:file:bg-secondary-200
                    cursor-pointer"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg text-sm">
                <Check size={16} />
                {activeTab === 'upload' ? 'Upload successful! Redirecting...' : 'Presentation created! Redirecting to editor...'}
              </div>
            )}

            <div className="bg-secondary-50 p-4 rounded-lg">
              <h4 className="font-medium text-secondary-900 mb-2 flex items-center gap-2">
                <AlertCircle size={16} className="text-primary-600" />
                Instructions
              </h4>
              {activeTab === 'upload' ? (
                <ul className="text-sm text-secondary-600 space-y-1 list-disc list-inside">
                  <li>Upload a ZIP file containing your HTML slides.</li>
                  <li>Include a <code>manifest.json</code> to define slide order (optional).</li>
                  <li>Ensure all assets (images, css) are included in the ZIP.</li>
                </ul>
              ) : (
                <ul className="text-sm text-secondary-600 space-y-1 list-disc list-inside">
                  <li>Fill in the details to create an empty presentation.</li>
                  <li>You will be redirected to the <strong>Manage Page</strong>.</li>
                  <li>There, you can add new slides, write HTML code, and manage your presentation.</li>
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => navigate('/dashboard')}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={(!file && activeTab === 'upload') || !formData.title || !formData.description || !formData.domain || uploading || success}
                isLoading={uploading}
              >
                {uploading ? (activeTab === 'upload' ? 'Uploading...' : 'Creating...') : (activeTab === 'upload' ? 'Upload Presentation' : 'Create & Edit')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout >
  );
}

export default UploadPage;
