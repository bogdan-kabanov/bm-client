import { memo, ReactNode, useMemo } from 'react';
import './AppSkeleton.css';

interface SkeletonItemConfig {
    id: string;
    shape?: 'rect' | 'circle';
    width?: string;
    height?: string;
}

const SIDE_ITEMS: SkeletonItemConfig[] = [
    { id: 'avatar', shape: 'circle', width: '48px', height: '48px' },
    { id: 'name', width: '80%', height: '16px' },
    { id: 'progress', width: '60%', height: '12px' },
    { id: 'button', width: '100%', height: '40px' },
    { id: 'list-item-1', width: '100%', height: '48px' },
    { id: 'list-item-2', width: '100%', height: '48px' },
    { id: 'list-item-3', width: '100%', height: '48px' },
];

const HEADER_ITEMS: SkeletonItemConfig[] = [
    { id: 'logo', width: '140px', height: '28px' },
    { id: 'controls', width: '220px', height: '36px' },
    { id: 'actions', width: '160px', height: '36px' },
];

export type AppSkeletonProps = {
    message?: string;
    headerContent?: ReactNode;
    sidebarContent?: ReactNode;
    mainContent?: ReactNode;
    asideContent?: ReactNode;
    showSidebar?: boolean;
    showAside?: boolean;
};

const DefaultHeader = () => (
    <>
        {HEADER_ITEMS.map(({ id, width, height }) => (
            <div key={id} className="app-skeleton__chip placeholder" style={{ width, height }} />
        ))}
    </>
);

const DefaultSidebar = () => (
    <>
        {SIDE_ITEMS.map(({ id, shape = 'rect', width, height }) => (
            <div
                key={id}
                className={`app-skeleton__item placeholder ${shape === 'circle' ? 'is-circle' : ''}`}
                style={{ width, height }}
            />
        ))}
    </>
);

const DefaultMain = () => (
    <>
        <div className="app-skeleton__main-chart placeholder" />
        <div className="app-skeleton__main-rows">
            {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="app-skeleton__row placeholder">
                    <div className="app-skeleton__row-col placeholder" />
                    <div className="app-skeleton__row-col placeholder" />
                    <div className="app-skeleton__row-col placeholder" />
                    <div className="app-skeleton__row-col placeholder" />
                </div>
            ))}
        </div>
    </>
);

const DefaultAside = () => (
    <>
        <div className="app-skeleton__aside-card placeholder" />
        <div className="app-skeleton__aside-list">
            {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="app-skeleton__aside-item placeholder" />
            ))}
        </div>
    </>
);

const AppSkeletonComponent = ({
    message,
    headerContent,
    sidebarContent,
    mainContent,
    asideContent,
    showSidebar = true,
    showAside = true,
}: AppSkeletonProps) => {
    const bodyClassName = useMemo(() => {
        const modifiers: string[] = [];
        if (!showSidebar) modifiers.push('app-skeleton__body--no-sidebar');
        if (!showAside) modifiers.push('app-skeleton__body--no-aside');
        return ['app-skeleton__body', ...modifiers].join(' ');
    }, [showSidebar, showAside]);

    return (
        <div className="app-skeleton">
            <header className="app-skeleton__header placeholder">
                {headerContent ?? <DefaultHeader />}
            </header>

            <div className={bodyClassName}>
                {showSidebar && (
                    <aside className="app-skeleton__sidebar">
                        {sidebarContent ?? <DefaultSidebar />}
                    </aside>
                )}

                <main className="app-skeleton__main">
                    {mainContent ?? <DefaultMain />}
                </main>

                {showAside && (
                    <aside className="app-skeleton__aside">
                        {asideContent ?? <DefaultAside />}
                    </aside>
                )}
            </div>

            {message && <p className="app-skeleton__message">{message}</p>}
        </div>
    );
};

export const AppSkeleton = memo(AppSkeletonComponent);

