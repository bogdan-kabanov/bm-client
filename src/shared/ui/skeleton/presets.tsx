import { ReactNode } from 'react';
import { AppSkeletonProps } from './AppSkeleton';

const createRows = (count: number, className: string) =>
    Array.from({ length: count }).map((_, index) => <div key={index} className={`placeholder ${className}`} />);

const TradingSidebar = () => (
    <div className="trading-skeleton__sidebar">
        <div className="placeholder trading-skeleton__sidebar-search" />
        <div className="trading-skeleton__sidebar-group">
            {createRows(5, 'trading-skeleton__sidebar-item')}
        </div>
        <div className="trading-skeleton__sidebar-subtitle placeholder" />
        <div className="trading-skeleton__sidebar-group">
            {createRows(6, 'trading-skeleton__sidebar-item')}
        </div>
    </div>
);

const TradingMain = () => (
    <div className="trading-skeleton">
        <div className="trading-skeleton__top-cards">
            {createRows(4, 'trading-skeleton__top-card')}
        </div>
        <div className="trading-skeleton__chart-block">
            <div className="placeholder trading-skeleton__chart" />
            <div className="trading-skeleton__book">
                <div className="placeholder trading-skeleton__book-header" />
                <div className="trading-skeleton__book-list">
                    {createRows(6, 'trading-skeleton__book-row')}
                </div>
            </div>
        </div>
        <div className="trading-skeleton__bottom-panels">
            <div className="placeholder trading-skeleton__bottom-panel" />
            <div className="placeholder trading-skeleton__bottom-panel" />
        </div>
    </div>
);

const TradingAside = () => (
    <div className="trading-skeleton__aside">
        <div className="placeholder trading-skeleton__aside-card" />
        <div className="trading-skeleton__aside-list">
            {createRows(4, 'trading-skeleton__aside-item')}
        </div>
    </div>
);

const ProfileMain = () => (
    <div className="profile-skeleton">
        <div className="profile-skeleton__header placeholder" />
        <div className="profile-skeleton__stats">
            {createRows(3, 'profile-skeleton__stat')}
        </div>
        <div className="profile-skeleton__sections">
            <div className="placeholder profile-skeleton__section" />
            <div className="placeholder profile-skeleton__section" />
        </div>
        <div className="profile-skeleton__table">
            <div className="placeholder profile-skeleton__table-head" />
            {createRows(5, 'profile-skeleton__table-row')}
        </div>
    </div>
);

const GenericMain = () => (
    <div className="generic-skeleton">
        <div className="generic-skeleton__hero placeholder" />
        <div className="generic-skeleton__grid">
            {createRows(6, 'generic-skeleton__card')}
        </div>
    </div>
);

const GenericSidebar = () => (
    <div className="generic-skeleton__sidebar">
        {createRows(4, 'generic-skeleton__sidebar-item')}
    </div>
);

const PublicMain = () => (
    <div className="public-skeleton">
        <div className="public-skeleton__hero placeholder" />
        <div className="public-skeleton__features">
            {createRows(3, 'public-skeleton__feature')}
        </div>
        <div className="public-skeleton__cta placeholder" />
        <div className="public-skeleton__cards">
            {createRows(4, 'public-skeleton__card')}
        </div>
    </div>
);

type SkeletonPreset = Partial<Omit<AppSkeletonProps, 'message'>>;

const createPreset = (config: SkeletonPreset): SkeletonPreset => config;

export const getTradingSkeletonPreset = (): SkeletonPreset =>
    createPreset({
        sidebarContent: <TradingSidebar />,
        mainContent: <TradingMain />,
        asideContent: <TradingAside />,
    });

export const getProfileSkeletonPreset = (): SkeletonPreset =>
    createPreset({
        mainContent: <ProfileMain />,
        showAside: false,
    });

export const getGenericSkeletonPreset = (): SkeletonPreset =>
    createPreset({
        sidebarContent: <GenericSidebar />,
        mainContent: <GenericMain />,
        showAside: false,
    });

export const getPublicSkeletonPreset = (): SkeletonPreset =>
    createPreset({
        showSidebar: false,
        showAside: false,
        mainContent: <PublicMain />,
    });

