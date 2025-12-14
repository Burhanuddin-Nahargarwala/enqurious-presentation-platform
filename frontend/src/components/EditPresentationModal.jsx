// src/components/EditPresentationModal.jsx
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

export function EditPresentationModal({ isOpen, onClose, presentation, onUpdate }) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        domain: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (presentation) {
            setFormData({
                title: presentation.title,
                description: presentation.description,
                domain: presentation.domain
            });
        }
    }, [presentation]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        await onUpdate(presentation._id, formData);
        setLoading(false);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-secondary-100">
                            <h3 className="text-lg font-semibold text-secondary-900">Edit Presentation</h3>
                            <button
                                onClick={onClose}
                                className="text-secondary-400 hover:text-secondary-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-secondary-700 mb-1">
                                    Title
                                </label>
                                <Input
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-secondary-700 mb-1">
                                    Domain
                                </label>
                                <Input
                                    value={formData.domain}
                                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-secondary-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={4}
                                    className="flex w-full rounded-lg border border-secondary-200 bg-white px-3 py-2 text-sm placeholder:text-secondary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
                                    required
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <Button type="button" variant="ghost" onClick={onClose}>
                                    Cancel
                                </Button>
                                <Button type="submit" isLoading={loading}>
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
