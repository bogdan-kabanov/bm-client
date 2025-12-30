import React, { memo } from 'react';

interface InfoCardProps {
    title: string;
    children: React.ReactNode;
    className?: string;
}

export const InfoCard = memo<InfoCardProps>(({ title, children, className = '' }) => {
    return (
        <div className={`info-card ${className}`}>
            {title && <h2 className="info-card__title">{title}</h2>}
            <div className="info-card__content">{children}</div>
        </div>
    );
});

InfoCard.displayName = 'InfoCard';

