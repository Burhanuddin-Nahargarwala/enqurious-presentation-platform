import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

export const Tooltip = ({ children, content }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const triggerRef = useRef(null);

    useEffect(() => {
        if (isVisible && triggerRef.current) {
            const updatePosition = () => {
                const rect = triggerRef.current.getBoundingClientRect();
                setPosition({
                    top: rect.top,
                    left: rect.left + rect.width / 2
                });
            };

            updatePosition();
            window.addEventListener('scroll', updatePosition);
            window.addEventListener('resize', updatePosition);

            return () => {
                window.removeEventListener('scroll', updatePosition);
                window.removeEventListener('resize', updatePosition);
            };
        }
    }, [isVisible]);

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                className="w-full" // Ensure it takes full width of container to not break layout
            >
                {children}
            </div>
            {createPortal(
                <AnimatePresence>
                    {isVisible && (
                        <motion.div
                            initial={{ opacity: 0, y: 5, scale: 0.95 }}
                            animate={{ opacity: 1, y: -8, scale: 1 }}
                            exit={{ opacity: 0, y: 5, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            style={{ top: position.top, left: position.left }}
                            className="fixed z-[9999] px-3 py-1.5 text-xs font-medium text-white bg-secondary-900 rounded-md shadow-xl -translate-x-1/2 -translate-y-full pointer-events-none whitespace-nowrap"
                        >
                            {content}
                            <div className="absolute w-2 h-2 bg-secondary-900 rotate-45 -bottom-1 left-1/2 -translate-x-1/2" />
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
};
