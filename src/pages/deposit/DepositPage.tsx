import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { NewDepositContent } from "./NewDepositContent";
import { WithdrawalContent } from "@src/pages/withdrawal/WithdrawalContent";
import { TransactionHistory } from "./TransactionHistory";
import { PromocodesContent } from "./PromocodesContent";
import { TradingHeader } from "@src/widgets/trading-header/TradingHeader";
import { useLanguage } from "@src/app/providers/useLanguage";
import { SidebarProvider } from "@src/shared/contexts/SidebarContext";
import { useSidebar } from "@src/shared/contexts/SidebarContext";
import { MobileMenuProvider } from "@src/shared/contexts/MobileMenuContext";
import "./DepositPage.css";

export function DepositPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useLanguage();
    
    // Определяем активную вкладку на основе пути
    const getActiveTab = () => {
        if (location.pathname.includes('/withdraw')) return 'withdraw';
        if (location.pathname.includes('/transaction-history')) return 'history';
        if (location.pathname.includes('/deposit/payment')) return 'payment';
        if (location.pathname.includes('/promocodes')) return 'promocodes';
        return 'deposit';
    };
    
    const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'history' | 'payment' | 'promocodes'>(getActiveTab);
    
    const handleTabChange = (tab: 'deposit' | 'withdraw' | 'history' | 'promocodes') => {
        setActiveTab(tab);
        if (tab === 'deposit') {
            navigate('/deposit');
        } else if (tab === 'withdraw') {
            navigate('/withdraw');
        } else if (tab === 'history') {
            navigate('/transaction-history');
        } else if (tab === 'promocodes') {
            navigate('/promocodes');
        }
    };
    
    return (
        <MobileMenuProvider>
            <SidebarProvider>
                <DepositPageContent 
                    navigate={navigate}
                    location={location}
                    t={t}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    handleTabChange={handleTabChange}
                />
            </SidebarProvider>
        </MobileMenuProvider>
    );
}

function DepositPageContent({ 
    navigate, 
    location, 
    t, 
    activeTab, 
    setActiveTab, 
    handleTabChange 
}: {
    navigate: ReturnType<typeof useNavigate>;
    location: ReturnType<typeof useLocation>;
    t: ReturnType<typeof useLanguage>['t'];
    activeTab: 'deposit' | 'withdraw' | 'history' | 'promocodes';
    setActiveTab: (tab: 'deposit' | 'withdraw' | 'history' | 'promocodes') => void;
    handleTabChange: (tab: 'deposit' | 'withdraw' | 'history' | 'promocodes') => void;
}) {
    const { hideLeftPanel } = useSidebar();
    
    // Скрываем сайдбар и применяем стили при монтировании компонента
    useEffect(() => {
        hideLeftPanel();
        
        // Добавляем класс на body для применения стилей
        document.body.classList.add('deposit-page-active');
        document.documentElement.classList.add('deposit-page-active');
        
        // Восстанавливаем при размонтировании
        return () => {
            document.body.classList.remove('deposit-page-active');
            document.documentElement.classList.remove('deposit-page-active');
        };
    }, [hideLeftPanel]);
    
    return (
        <div className="deposit-page-wrapper">
            <TradingHeader />
            <div className="deposit-page-container">
                <nav className="deposit-page-nav">
                    <button
                        className={`deposit-nav-tab ${activeTab === 'deposit' ? 'active' : ''}`}
                        onClick={() => handleTabChange('deposit')}
                    >
                        {t('deposit.title', { defaultValue: 'Deposit funds' })}
                    </button>
                    <button
                        className={`deposit-nav-tab ${activeTab === 'withdraw' ? 'active' : ''}`}
                        onClick={() => handleTabChange('withdraw')}
                    >
                        {t('withdrawal.title', { defaultValue: 'Withdraw Funds' })}
                    </button>
                    <button
                        className={`deposit-nav-tab ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => handleTabChange('history')}
                    >
                        {t('payments.paymentsHistory', { defaultValue: 'Payments History' })}
                    </button>
                    <button
                        className={`deposit-nav-tab ${activeTab === 'promocodes' ? 'active' : ''}`}
                        onClick={() => handleTabChange('promocodes')}
                    >
                        {t('payments.promocodesTab', { defaultValue: 'Promocodes' })}
                    </button>
                </nav>
                
                <div className="deposit-page-content">
                    {activeTab === 'deposit' && <NewDepositContent />}
                    {activeTab === 'withdraw' && <WithdrawalContent />}
                    {activeTab === 'history' && <TransactionHistory />}
                    {activeTab === 'promocodes' && <PromocodesContent />}
                </div>
            </div>
        </div>
    );
}

