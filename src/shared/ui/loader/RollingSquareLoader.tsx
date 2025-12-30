import { memo } from 'react';
import './RollingSquareLoader.css';

interface RollingSquareLoaderProps {
    message?: string;
    size?: 'small' | 'medium' | 'large';
    className?: string;
}

const RollingSquareLoaderComponent = ({ 
    message, 
    size = 'medium',
    className = '' 
}: RollingSquareLoaderProps) => {
    return (
        <div className={`rolling-square-loader rolling-square-loader--${size} ${className}`}>
            <div className="rolling-square-loader__spinner" />
            {message && (
                <p className="rolling-square-loader__message">{message}</p>
            )}
        </div>
    );
};

export const RollingSquareLoader = memo(RollingSquareLoaderComponent);

