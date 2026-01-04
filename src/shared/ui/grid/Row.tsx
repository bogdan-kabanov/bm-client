import React from 'react';
import './Grid.css';

export interface RowProps {
    children: React.ReactNode;
    className?: string;
    gutter?: 'none' | 'sm' | 'md' | 'lg';
}

export const Row: React.FC<RowProps> = ({ 
    children, 
    className = '',
    gutter = 'md'
}) => {
    const gutterClass = `grid-row-gutter-${gutter}`;
    
    return (
        <div className={`grid-row ${gutterClass} ${className}`.trim()}>
            {children}
        </div>
    );
};

