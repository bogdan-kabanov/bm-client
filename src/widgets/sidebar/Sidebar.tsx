import { SidebarMenu } from './SidebarMenu';
import { useMobileMenu } from '@src/shared/contexts/MobileMenuContext';
import { useSidebar } from '@src/shared/contexts/SidebarContext';

export const Sidebar = () => {
    const { isMobileMenuOpen, closeMobileMenu } = useMobileMenu();
    const { isLeftPanelVisible } = useSidebar();

    return (
        <>
            {isMobileMenuOpen && (
                <div 
                    className="mobile-menu-overlay"
                    onClick={closeMobileMenu}
                    aria-hidden="true"
                />
            )}
            <div className={`app-sidebar ${isMobileMenuOpen ? 'app-sidebar--mobile-open' : ''} ${!isLeftPanelVisible ? 'app-sidebar--hidden' : ''}`}>
                <SidebarMenu />
            </div>
        </>
    );
};

