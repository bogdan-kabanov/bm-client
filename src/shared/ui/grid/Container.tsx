import React from 'react';
import './Grid.css';

export interface ContainerProps {
    children: React.ReactNode;
    fluid?: boolean;
    className?: string;
}

export const Container: React.FC<ContainerProps> = ({ 
    children, 
    fluid = false,
    className = '' 
}) => {
    const containerClass = fluid 
        ? 'grid-container grid-container-fluid' 
        : 'grid-container';
    
    return (
        <div className={`${containerClass} ${className}`.trim()}>
            {children}
        </div>
    );
};

