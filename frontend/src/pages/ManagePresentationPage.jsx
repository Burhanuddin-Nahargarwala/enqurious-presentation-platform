import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileCode, Save, ArrowLeft, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { presentationApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/ui/Layout';
import { Button } from '../components/ui/Button';
import SlideEditor from '../components/SlideEditor';

function ManagePresentationPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { token } = useAuth();

    const [files, setFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileContent, setFileContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingContent, setLoadingContent] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        fetchFiles();
    }, [id, token]);

    const fetchFiles = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await presentationApi.getFiles(id, token);
            setFiles(res.data);
        } catch (err) {
            setError('Failed to load files');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = async (filename) => {
        setSelectedFile(filename);
        setLoadingContent(true);
        setError('');
        setSuccess('');
        try {
            const res = await presentationApi.getFileContent(id, encodeURIComponent(filename), token);
            setFileContent(res.data.content);
        } catch (err) {
            setError(`Failed to load content for ${filename}`);
            console.error(err);
        } finally {
            setLoadingContent(false);
        }
    };

    const handleSave = async () => {
        if (!selectedFile) return;

        setSaving(true);
        setError('');
        setSuccess('');
        try {
            await presentationApi.updateFileContent(id, encodeURIComponent(selectedFile), fileContent, token);
            setSuccess('File saved successfully');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError('Failed to save file');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Layout>
            <div className="h-[calc(100vh-100px)] flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                            <ArrowLeft size={20} className="mr-2" />
                            Back
                        </Button>
                        <h1 className="text-2xl font-bold text-secondary-900">Manage Presentation</h1>
                    </div>
                    {selectedFile && (
                        <Button onClick={handleSave} disabled={saving || loadingContent}>
                            {saving ? <RefreshCw className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />}
                            Save Changes
                        </Button>
                    )}
                </div>

                <div className="flex-1 flex gap-6 overflow-hidden">
                    {/* File List Sidebar */}
                    <div className="w-1/4 bg-white rounded-xl border border-secondary-200 overflow-y-auto flex flex-col">
                        <div className="p-4 border-b border-secondary-100 bg-secondary-50">
                            <h3 className="font-semibold text-secondary-900">Files</h3>
                        </div>
                        <div className="flex-1 p-2 space-y-1">
                            {loading ? (
                                <div className="flex justify-center p-4">
                                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600"></div>
                                </div>
                            ) : files.length === 0 ? (
                                <p className="text-center text-secondary-500 p-4 text-sm">No files found</p>
                            ) : (
                                files.map((file) => (
                                    <button
                                        key={file}
                                        onClick={() => handleFileSelect(file)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${selectedFile === file
                                                ? 'bg-primary-50 text-primary-700 font-medium'
                                                : 'text-secondary-600 hover:bg-secondary-50'
                                            }`}
                                    >
                                        <FileCode size={16} />
                                        <span className="truncate" title={file}>{file}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Editor Area */}
                    <div className="flex-1 bg-white rounded-xl border border-secondary-200 flex flex-col overflow-hidden">
                        {selectedFile ? (
                            <>
                                <div className="p-4 border-b border-secondary-100 flex justify-between items-center bg-secondary-50">
                                    <span className="font-mono text-sm text-secondary-700">{selectedFile}</span>
                                    {success && (
                                        <span className="text-green-600 text-sm flex items-center gap-1">
                                            <Check size={14} /> {success}
                                        </span>
                                    )}
                                    {error && (
                                        <span className="text-red-600 text-sm flex items-center gap-1">
                                            <AlertCircle size={14} /> {error}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 overflow-y-auto p-4">
                                    {loadingContent ? (
                                        <div className="flex justify-center items-center h-full">
                                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600"></div>
                                        </div>
                                    ) : (
                                        <SlideEditor
                                            code={fileContent}
                                            onChange={setFileContent}
                                        />
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-secondary-400">
                                <FileCode size={48} className="mb-4 opacity-50" />
                                <p>Select a file to edit</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
}

export default ManagePresentationPage;
