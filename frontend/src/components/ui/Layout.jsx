import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Upload, LogOut, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from './Button';

import logo from '../../assets/enqurious-logo.png';

export const Layout = ({ children }) => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: Upload, label: 'Upload', path: '/upload' },
    ];

    return (
        <div className="min-h-screen bg-secondary-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-secondary-200 fixed h-full z-10 hidden md:flex flex-col">
                <div className="p-6 border-b border-secondary-200">
                    <img src={logo} alt="Enqurious" className="h-8 object-contain" />
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                                    isActive
                                        ? 'bg-primary-50 text-primary-700 font-medium'
                                        : 'text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900'
                                )}
                            >
                                <item.icon size={20} />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-secondary-200">
                    <div className="flex items-center gap-3 px-4 py-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium text-secondary-900 truncate">{user?.name}</p>
                            <p className="text-xs text-secondary-500 truncate">{user?.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <LogOut size={18} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-secondary-200 z-20 px-4 py-3 flex items-center justify-between">
                <img src={logo} alt="Enqurious" className="h-8 object-contain" />
                <button onClick={handleLogout} className="text-secondary-600">
                    <LogOut size={20} />
                </button>
            </div>

            {/* Main Content */}
            <main className="flex-1 md:ml-64 p-4 md:p-8 pt-20 md:pt-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {children}
                </motion.div>
            </main>
        </div>
    );
};
