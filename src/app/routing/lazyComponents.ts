import { lazy } from 'react';

const createRetryableLazyImport = (importFn: () => Promise<any>, retries = 3, delay = 1000) => {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        
        const attemptImport = () => {
            attempts++;
            importFn()
                .then(resolve)
                .catch((error) => {
                    const errorMessage = error?.message || String(error);
                    const statusCode = error?.status || error?.statusCode || '';
                    const isTimeoutError = 
                        errorMessage.includes("524") ||
                        errorMessage.includes("timeout") ||
                        errorMessage.includes("Timeout") ||
                        errorMessage.includes("Failed to fetch dynamically imported module") ||
                        statusCode === 524 ||
                        statusCode === 504;
                    
                    const isNetworkError = 
                        errorMessage.includes("Failed to fetch") ||
                        errorMessage.includes("CORS") ||
                        errorMessage.includes("NetworkError") ||
                        errorMessage.includes("NETWORK_ERROR") ||
                        errorMessage.includes("ERR_ABORTED") ||
                        errorMessage.includes("500") ||
                        errorMessage.includes("502") ||
                        errorMessage.includes("503");
                    
                    if (isTimeoutError && attempts < retries) {
                        console.warn(`[Lazy Component] Retry attempt ${attempts}/${retries} after timeout error:`, errorMessage);
                        setTimeout(attemptImport, delay * attempts);
                        return;
                    }
                    
                    if (isTimeoutError && attempts >= retries) {
                        console.error(`[Lazy Component] Max retries reached for timeout error. Reloading page...`);
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                        return;
                    }
                    
                    if (!isNetworkError && !isTimeoutError && (
                        errorMessage.includes("Failed to fetch dynamically imported module") || 
                        errorMessage.includes("404") ||
                        error.name === "ChunkLoadError" ||
                        errorMessage.includes("ERR_ABORTED")
                    )) {
                        setTimeout(() => {
                            window.location.reload();
                        }, 100);
                        return;
                    }
                    
                    if (isNetworkError) {
                        reject(new Error(`Network error: ${errorMessage}`));
                        return;
                    }
                    
                    reject(error);
                });
        };
        
        attemptImport();
    });
};

const createLazyComponent = (importFn: () => Promise<any>, componentName: string) => {
    return lazy(() => createRetryableLazyImport(importFn));
};

export const TradingPage = createLazyComponent(() => import('@pages/trading').then((m) => ({ default: m.TradingPage })), 'TradingPage');
export const ProfilePage = createLazyComponent(() => import('@pages/profile').then((m) => ({ default: m.ProfilePage })), 'ProfilePage');
export const BotsPage = createLazyComponent(() => import('@pages/bots/BotsPage').then((m) => ({ default: m.BotsPage })), 'BotsPage');
export const ReferralsPage = createLazyComponent(() => import('@pages/referrals/ReferralsPage').then((m) => ({ default: m.ReferralsPage })), 'ReferralsPage');
export const LandingPage = createLazyComponent(() => import('@pages/landing/LandingPage'), 'LandingPage');
export const LandingPageV2 = createLazyComponent(() => import('@pages/landing-v2/LandingPageV2'), 'LandingPageV2');
export const TermsPage = createLazyComponent(() => import('@pages/policies').then((m) => ({ default: m.TermsPage })), 'TermsPage');
export const PrivacyPolicyPage = createLazyComponent(() => import('@pages/policies').then((m) => ({ default: m.PrivacyPolicyPage })), 'PrivacyPolicyPage');
export const CompliancePage = createLazyComponent(() => import('@pages/policies').then((m) => ({ default: m.CompliancePage })), 'CompliancePage');
export const RiskDisclosurePage = createLazyComponent(() => import('@pages/policies').then((m) => ({ default: m.RiskDisclosurePage })), 'RiskDisclosurePage');
export const CompanyPage = createLazyComponent(() => import('@pages/policies').then((m) => ({ default: m.CompanyPage })), 'CompanyPage');
export const EmailVerifyPage = createLazyComponent(() => import('@pages/email-verify').then((m) => ({ default: m.EmailVerifyPage })), 'EmailVerifyPage');
export const GoogleCallbackPage = createLazyComponent(() => import('@pages/auth/GoogleCallbackPage').then((m) => ({ default: m.GoogleCallbackPage })), 'GoogleCallbackPage');

