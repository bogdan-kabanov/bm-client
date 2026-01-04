import { Routes, Route, Navigate } from 'react-router-dom';
import {
    TradingPage,
    ProfilePage,
    BotsPage,
    ReferralsPage,
    EmailVerifyPage,
    GoogleCallbackPage,
    PrivacyPolicyPage,
    TermsPage,
    RiskDisclosurePage,
    CompanyPage
} from './lazyComponents';
import { DepositPage } from '@src/pages/deposit/DepositPage';
import { TradesHistoryModalProvider } from '@src/shared/contexts/TradesHistoryModalContext';
import { SignalsModalProvider } from '@src/shared/contexts/SignalsModalContext';

interface PrivateRoutesProps {
    autoAccessGranted: boolean;
}

export const PrivateRoutes = ({ autoAccessGranted }: PrivateRoutesProps) => {
    return (
        <TradesHistoryModalProvider>
            <SignalsModalProvider>
                <Routes>
                    <Route path="/" element={<Navigate to="/trading" replace />} />
                    <Route path="/trading" element={<TradingPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route
                        path="/bots"
                        element={autoAccessGranted ? <BotsPage /> : <Navigate to="/trading" replace />}
                    />
                    <Route path="/deposit" element={<DepositPage />} />
                    <Route path="/deposit/payment/:id" element={<DepositPage />} />
                    <Route path="/deposit/payment" element={<DepositPage />} />
                    <Route path="/withdraw" element={<DepositPage />} />
                    <Route path="/transaction-history" element={<DepositPage />} />
                    <Route path="/promocodes" element={<DepositPage />} />
                    <Route path="/referrals" element={<ReferralsPage />} />
                    <Route path="/email/verify" element={<EmailVerifyPage />} />
                    <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/risk-disclosure" element={<RiskDisclosurePage />} />
                    <Route path="/company" element={<CompanyPage />} />
                </Routes>
            </SignalsModalProvider>
        </TradesHistoryModalProvider>
    );
};

