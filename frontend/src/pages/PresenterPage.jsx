// src/pages/PresenterPage.jsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  X,
  Monitor,
  Smartphone,
  Layout as LayoutIcon,
  Eye,
  Share2
} from 'lucide-react';
import { presentationApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';

function PresenterPage() {
  const { presentationId } = useParams();
  const [presentation, setPresentation] = useState(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const iframeRef = useRef(null);
  const { token } = useAuth();
  const navigate = useNavigate();

  const BASE_WIDTH = 1280;
  const BASE_HEIGHT = 720;
  const [scale, setScale] = useState(1);
  const [fitMode, setFitMode] = useState('contain');

  const updateScale = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    let s;
    switch (fitMode) {
      case 'width':
        s = w / BASE_WIDTH;
        break;
      case 'height':
        s = h / BASE_HEIGHT;
        break;
      default:
        s = Math.min(w / BASE_WIDTH, h / BASE_HEIGHT);
    }
    setScale(s);
  };

  useEffect(() => {
    fetchPresentation();
  }, [presentationId, token]);

  useEffect(() => {
    let controlsTimeout;

    const resetControlsTimeout = () => {
      setShowControls(true);
      setShowInfo(true);
      clearTimeout(controlsTimeout);
      controlsTimeout = setTimeout(() => {
        setShowControls(false);
        setShowInfo(false);
      }, 3000);
    };

    resetControlsTimeout();

    const handleMouseMove = () => {
      if (!document.fullscreenElement) {
        resetControlsTimeout();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(controlsTimeout);
    };
  }, []);

  const fetchPresentation = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await presentationApi.getPresentation(presentationId, token);
      setPresentation(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch presentation');
      if (err.response?.status === 404) {
        setTimeout(() => navigate('/dashboard'), 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(currentSlideIndex - 1);
    }
  };

  const goToNextSlide = () => {
    if (presentation && currentSlideIndex < presentation.slides.length - 1) {
      setCurrentSlideIndex(currentSlideIndex + 1);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message} `);
      });
      setFullscreen(true);
      setShowControls(false); // Hide controls immediately
      setShowInfo(false);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setFullscreen(false);
        setShowControls(true); // Show controls immediately
        setShowInfo(true);
      }
    }
    setTimeout(updateScale, 50);
  };

  const cycleFitMode = () => {
    setFitMode(prev => prev === 'contain' ? 'width' : prev === 'width' ? 'height' : 'contain');
  };

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowLeft':
        goToPreviousSlide();
        break;
      case 'ArrowRight':
      case ' ':
        goToNextSlide();
        break;
      case 'f':
        toggleFullscreen();
        break;
      case 'c':
        cycleFitMode();
        break;
      case 'Escape':
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          navigate('/dashboard');
        }
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data && e.data.type === 'PRESENTER_KEYDOWN') {
        handleKeyDown({ key: e.data.key });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('message', handleMessage);
    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', updateScale);
    updateScale();
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('orientationchange', updateScale);
    };
  }, [currentSlideIndex, presentation, fitMode]);

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.src = getSlideUrl();
    }
  }, [currentSlideIndex, presentation]);

  const getSlideUrl = () => {
    if (!presentation || !presentation.slides || presentation.slides.length === 0) {
      return '';
    }

    const slideFile = presentation.slides[currentSlideIndex];
    const rawPath = String(presentation.folderPath || '');
    const norm = rawPath.replace(/\\/g, '/');
    const lower = norm.toLowerCase();
    let webPath = '';
    const idx = lower.indexOf('uploads/');
    if (idx !== -1) {
      webPath = norm.slice(idx);
    } else if (norm.startsWith('uploads')) {
      webPath = norm;
    } else {
      const parts = norm.split('/').filter(Boolean);
      let presDir = '';
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].startsWith('presentation_')) {
          presDir = parts[i];
          break;
        }
      }
      if (presDir) {
        webPath = `uploads/${presDir}`;
      } else if (presentation._id) {
        webPath = `uploads/${presentation._id}`;
      }
    }
    if (!webPath) return '';
    if (!webPath) return '';

    // Get base URL by removing '/api' from the configured API URL
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const baseUrl = apiUrl.replace(/\/api$/, '');

    return `${baseUrl}/${webPath}/${slideFile}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error || !presentation) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-xl mb-4">{error || 'Presentation not found'}</p>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
      {/* Top Controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-50 bg-gradient-to-b from-black/80 to-transparent"
          >
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="text-white hover:bg-white/10"
              >
                <X size={20} />
              </Button>
            </div>

            <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full p-1 border border-white/10">
              <button
                onClick={cycleFitMode}
                className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                title={`Fit: ${fitMode.toUpperCase()}`}
              >
                {fitMode === 'contain' && <LayoutIcon size={18} />}
                {fitMode === 'width' && <Monitor size={18} />}
                {fitMode === 'height' && <Smartphone size={18} />}
              </button>
              <div className="w-px h-4 bg-white/20" />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert('Link copied to clipboard!');
                }}
                className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                title="Share Presentation"
              >
                <Share2 size={18} />
              </button>
              <div className="w-px h-4 bg-white/20" />
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                title="Toggle Fullscreen"
              >
                {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 relative flex items-center justify-center">
        <div
          style={{
            width: BASE_WIDTH,
            height: BASE_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: 'center center'
          }}
          className="relative shadow-2xl"
        >
          <iframe
            ref={iframeRef}
            src={getSlideUrl()}
            title="Presentation Slide"
            className="w-full h-full border-0 bg-white"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation allow-pointer-lock"
          />
        </div>
      </div>

      {/* Navigation Arrows */}
      <AnimatePresence>
        {showControls && (
          <>
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onClick={goToPreviousSlide}
              disabled={currentSlideIndex === 0}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm transition-colors z-40"
            >
              <ChevronLeft size={32} />
            </motion.button>

            <motion.button
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onClick={goToNextSlide}
              disabled={currentSlideIndex === presentation.slides.length - 1}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm transition-colors z-40"
            >
              <ChevronRight size={32} />
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Info */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent z-40"
          >
            <div className="max-w-4xl mx-auto flex justify-between items-end">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">{presentation.title}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-300">
                  <span>Slide {currentSlideIndex + 1} / {presentation.slides.length}</span>
                  <span className="w-1 h-1 rounded-full bg-gray-500" />
                  <span>{presentation.user.name}</span>
                  <span className="w-1 h-1 rounded-full bg-gray-500" />
                  <span className="flex items-center gap-1"><Eye size={14} /> {presentation.views || 0}</span>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-4 text-xs text-gray-400 bg-black/30 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
                <span className="flex items-center gap-1"><span className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10">←</span> Prev</span>
                <span className="flex items-center gap-1"><span className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10">→</span> Next</span>
                <span className="flex items-center gap-1"><span className="px-1.5 py-0.5 bg-white/10 rounded border border-white/10">F</span> Fullscreen</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PresenterPage;
