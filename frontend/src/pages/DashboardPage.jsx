// src/pages/DashboardPage.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { EditPresentationModal } from '../components/EditPresentationModal';
import { Tooltip } from '../components/ui/Tooltip';
import { Search, Filter, Eye, Trash2, Plus, Layout as LayoutIcon, Pencil } from 'lucide-react';
import { presentationApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/ui/Layout';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

function DashboardPage() {
  const [presentations, setPresentations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ search: '', domain: '', author: '' });
  const [availableDomains, setAvailableDomains] = useState([]);
  const [availableAuthors, setAvailableAuthors] = useState([]);
  const [editingPresentation, setEditingPresentation] = useState(null);
  const { token, user } = useAuth();

  useEffect(() => {
    fetchPresentations();
  }, [token, filters]);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const res = await presentationApi.getFilters(token);
        setAvailableDomains(res.data?.domains || []);
        setAvailableAuthors((res.data?.authors || []).map(a => a.name));
      } catch (e) {
        // ignore
      }
    };
    loadFilters();
  }, [token]);

  const fetchPresentations = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await presentationApi.getPresentations(token);
      let filteredPresentations = response.data;

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredPresentations = filteredPresentations.filter(p =>
          p.title.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower)
        );
      }

      if (filters.domain) {
        filteredPresentations = filteredPresentations.filter(p => p.domain === filters.domain);
      }

      if (filters.author) {
        filteredPresentations = filteredPresentations.filter(p =>
          p.user.name === filters.author
        );
      }

      setPresentations(filteredPresentations);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch presentations');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePresentation = async (presentationId) => {
    if (!window.confirm('Are you sure you want to delete this presentation?')) return;
    try {
      await presentationApi.deletePresentation(presentationId, token);
      setPresentations(presentations.filter(p => p._id !== presentationId));
    } catch (err) {
      alert('Failed to delete presentation');
    }
  };

  const handleUpdatePresentation = async (id, data) => {
    try {
      const res = await presentationApi.updatePresentation(id, data, token);
      setPresentations(presentations.map(p =>
        p._id === id ? { ...p, ...res.data } : p
      ));
    } catch (err) {
      alert('Failed to update presentation');
    }
  };

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-secondary-900">Dashboard</h1>
            <p className="text-secondary-500 mt-1">Manage and view your presentations</p>
          </div>
          <Link to="/upload">
            <Button>
              <Plus className="mr-2" size={20} />
              New Presentation
            </Button>
          </Link>
        </div>

        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" size={18} />
              <Input
                placeholder="Search presentations..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" size={18} />
              <select
                value={filters.domain}
                onChange={(e) => setFilters({ ...filters, domain: e.target.value })}
                className="w-full h-10 pl-10 pr-3 rounded-lg border border-secondary-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Domains</option>
                {availableDomains.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" size={18} />
              <select
                value={filters.author}
                onChange={(e) => setFilters({ ...filters, author: e.target.value })}
                className="w-full h-10 pl-10 pr-3 rounded-lg border border-secondary-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Authors</option>
                {availableAuthors.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
          </div>
        ) : presentations.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-secondary-300">
            <div className="mx-auto h-16 w-16 bg-secondary-100 rounded-full flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-secondary-400" />
            </div>
            <h3 className="text-lg font-medium text-secondary-900">No presentations found</h3>
            <p className="text-secondary-500 mt-1">Try adjusting your filters or upload a new presentation.</p>
          </div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {presentations.map((presentation) => (
              <motion.div key={presentation._id} variants={item}>
                <Card hover className="h-full flex flex-col overflow-hidden group">
                  <div className="h-40 bg-gradient-to-br from-primary-100 to-secondary-100 relative overflow-hidden">
                    {presentation.thumbnailPath ? (
                      <img
                        src={`http://localhost:5000${presentation.thumbnailPath.startsWith('/') ? '' : '/'}${presentation.thumbnailPath}`}
                        alt={presentation.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary-600 to-accent-600 text-white p-6 relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                        <div className="absolute -top-10 -left-10 w-40 h-40 bg-black/10 rounded-full blur-2xl"></div>

                        <LayoutIcon className="w-16 h-16 mb-3 text-white/90 relative z-10 drop-shadow-md" />
                        <span className="text-sm font-medium text-white/80 uppercase tracking-wider relative z-10">Presentation</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                  </div>

                  <CardHeader>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="inline-block px-2 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-medium mb-2">
                          {presentation.domain}
                        </span>
                        <Tooltip content={presentation.title}>
                          <CardTitle className="text-lg line-clamp-1">
                            {presentation.title}
                          </CardTitle>
                        </Tooltip>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-grow">
                    <p className="text-secondary-600 text-sm line-clamp-2">
                      {presentation.description}
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-xs text-secondary-500">
                      <div className="w-6 h-6 rounded-full bg-secondary-200 flex items-center justify-center font-bold text-secondary-700">
                        {presentation.user.name.charAt(0)}
                      </div>
                      <span>{presentation.user.name}</span>
                    </div>
                  </CardContent>

                  <CardFooter className="border-t border-secondary-100 bg-secondary-50/50 gap-2">
                    <Link to={`/present/${presentation._id}`} className="flex-1">
                      <Button variant="primary" size="sm" className="w-full">
                        <Eye className="mr-2" size={16} />
                        View
                      </Button>
                    </Link>
                    {user && user.id === presentation.user._id && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingPresentation(presentation)}
                          className="text-secondary-600 hover:text-primary-600 hover:bg-primary-50"
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePresentation(presentation._id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </>
                    )}
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <EditPresentationModal
        isOpen={!!editingPresentation}
        onClose={() => setEditingPresentation(null)}
        presentation={editingPresentation}
        onUpdate={handleUpdatePresentation}
      />
    </Layout>
  );
}

export default DashboardPage;
