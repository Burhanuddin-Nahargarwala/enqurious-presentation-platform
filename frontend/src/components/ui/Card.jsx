import React from 'react';
import { motion } from 'framer-motion';
import { cn } from './Button';

export const Card = ({ className, children, hover = false, ...props }) => {
    return (
        <motion.div
            whileHover={hover ? { y: -5 } : {}}
            className={cn(
                'rounded-xl border border-secondary-200 bg-white text-secondary-950 shadow-sm',
                hover && 'hover:shadow-md transition-shadow duration-300',
                className
            )}
            {...props}
        >
            {children}
        </motion.div>
    );
};

export const CardHeader = ({ className, children, ...props }) => (
    <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props}>
        {children}
    </div>
);

export const CardTitle = ({ className, children, ...props }) => (
    <h3 className={cn('text-2xl font-semibold leading-none tracking-tight', className)} {...props}>
        {children}
    </h3>
);

export const CardContent = ({ className, children, ...props }) => (
    <div className={cn('p-6 pt-0', className)} {...props}>
        {children}
    </div>
);

export const CardFooter = ({ className, children, ...props }) => (
    <div className={cn('flex items-center p-6 pt-0', className)} {...props}>
        {children}
    </div>
);
