import { Routes, Route, Navigate } from 'react-router-dom';
import {
    LandingPage,
    LandingPageV2,
    TermsPage,
    PrivacyPolicyPage,
    CompliancePage,
    RiskDisclosurePage,
    EmailVerifyPage,
    GoogleCallbackPage
} from './lazyComponents';

export const PublicRoutes = () => {
    return (
        <Routes>
            <Route path="/" element={<LandingPageV2 />} />
            <Route path="/ru" element={<Navigate to="/" replace />} />
            <Route path="/en" element={<Navigate to="/" replace />} />
            <Route path="/landing-classic" element={<LandingPage />} />
            <Route path="/landing-v2" element={<LandingPageV2 />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/compliance" element={<CompliancePage />} />
            <Route path="/risk-disclosure" element={<RiskDisclosurePage />} />
            <Route path="/email/verify" element={<EmailVerifyPage />} />
            <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
            <Route path="/trading" element={<Navigate to="/" replace />} />
            <Route path="/deposit" element={<Navigate to="/" replace />} />
            <Route path="/withdraw" element={<Navigate to="/" replace />} />
            <Route path="/transaction-history" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

