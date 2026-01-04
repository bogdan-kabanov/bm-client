import React from 'react';
import './Grid.css';

export interface ColProps {
    children: React.ReactNode;
    xs?: number | 'auto';
    sm?: number | 'auto';
    md?: number | 'auto';
    lg?: number | 'auto';
    xl?: number | 'auto';
    className?: string;
}

export const Col: React.FC<ColProps> = ({ 
    children, 
    xs,
    sm,
    md,
    lg,
    xl,
    className = ''
}) => {
    const classes: string[] = ['grid-col'];
    
    if (xs !== undefined) classes.push(`grid-col-xs-${xs}`);
    if (sm !== undefined) classes.push(`grid-col-sm-${sm}`);
    if (md !== undefined) classes.push(`grid-col-md-${md}`);
    if (lg !== undefined) classes.push(`grid-col-lg-${lg}`);
    if (xl !== undefined) classes.push(`grid-col-xl-${xl}`);
    
    // Если не указаны размеры, колонка занимает всю ширину
    if (xs === undefined && sm === undefined && md === undefined && lg === undefined && xl === undefined) {
        classes.push('grid-col-xs-12');
    }
    
    return (
        <div className={`${classes.join(' ')} ${className}`.trim()}>
            {children}
        </div>
    );
};

