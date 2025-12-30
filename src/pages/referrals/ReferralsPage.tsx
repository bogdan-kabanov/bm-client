import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@src/shared/lib/hooks";
import { selectProfile } from "@src/entities/user/model/selectors";
import {
  selectReferrals,
  selectReferralsLoading,
  selectReferralsError,
  selectRefBalance,
  selectRefCount,
  selectTotalRefEarnings,
} from "@src/entities/referral/model/selectors";
import { fetchReferrals, fetchReferralStats } from "@src/entities/referral/model/slice";
import { Referral } from "@src/entities/referral/model/types";
import "./ReferralsPage.css";
import {useLanguage} from "@src/app/providers/useLanguage.ts";
import { LanguageDropdown } from "@src/shared/ui/LanguageDropdown";
import { generateReferralHash } from "@src/shared/lib/referralHashUtils";
import { formatCurrency } from "@src/shared/lib/currency/currencyUtils";
import { SidebarProvider } from '@src/shared/contexts/SidebarContext';
import { MobileMenuProvider } from '@src/shared/contexts/MobileMenuContext';
import { Sidebar } from '@src/widgets/sidebar/Sidebar';
import { TradingHeader } from '@src/widgets/trading-header/TradingHeader';
import { Header } from '@src/widgets/header/Header';

export function ReferralsPage() {
  const dispatch = useAppDispatch();
  const userData = useAppSelector(selectProfile);
  const referrals = useAppSelector(selectReferrals);
  const isLoading = useAppSelector(selectReferralsLoading);
  const error = useAppSelector(selectReferralsError);
  const refBalance = useAppSelector(selectRefBalance);
  const refCount = useAppSelector(selectRefCount);
  const totalEarnings = useAppSelector(selectTotalRefEarnings);
  const { t } = useLanguage();

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (userData?.id) {
      dispatch(fetchReferrals());
      dispatch(fetchReferralStats());
    }
  }, [dispatch, userData?.id]);

  const getReferralLink = () => {
    const refId = userData?.id;
    if (!refId) return '';
    // Генерируем хеш из ID пользователя
    const referralHash = generateReferralHash(refId);
    const baseUrl = window.location.origin;
    // Используем параметр invite вместо ref для скрытности
    return `${baseUrl}/?invite=${referralHash}`;
  };

  const copyReferralLink = () => {
    const referralLink = getReferralLink();
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = () => {
    if (userData?.id) {
      dispatch(fetchReferrals());
      dispatch(fetchReferralStats());
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return t('common.notAvailable');
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getUserDisplayName = (referral: Referral) => {
    if (referral.firstname && referral.lastname) {
      return `${referral.firstname} ${referral.lastname}`;
    }
    if (referral.firstname) {
      return referral.firstname;
    }
    return `${t('common.user')} ${referral.id}`;
  };

  const formatNumber = (value: number | string | undefined): string => {
    if (value === undefined || value === null) return "0.00";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return isNaN(num) ? "0.00" : num.toFixed(2);
  };

  const totalReferrals = referrals?.length || 0;
  const hasReferrals = totalReferrals > 0;
  const activeReferrals = referrals?.filter((r: Referral) => !r.banned).length || 0;
  const userCurrency = userData?.currency || 'USD';

  const headerRight = (
    <>
      <div className="balance-item">
        <span className="balance-label">{t('referrals.totalEarned')}</span>
        <span className="balance-value">{formatCurrency(totalEarnings, userCurrency)}</span>
      </div>
      <div className="balance-item">
        <span className="balance-label">{t('referrals.totalReferrals')}</span>
        <span className="balance-value">{refCount}</span>
      </div>
      <div className="balance-item">
        <span className="balance-label">{t('referrals.referralBalance')}</span>
        <span className="balance-value">{formatCurrency(refBalance, userCurrency)}</span>
      </div>
    </>
  );

  const pageHeader = (
    <div className="referrals-page__header">
      <div className="referrals-page__header-left">
        <h1 className="referrals-page__title">{t('referrals.title')}</h1>
        <div className="referrals-page__live-indicator">
          <span className="live-pulse"></span>
          {t('referrals.subtitle')}
        </div>
        <LanguageDropdown variant="trading" />
      </div>
      <div className="referrals-page__header-right">
        {headerRight}
      </div>
    </div>
  );

  if (!userData) {
    return (
      <MobileMenuProvider>
        <SidebarProvider>
          <div className="wrapper-body">
            <TradingHeader />
            <div className="app-layout-wrapper">
              <Sidebar />
              <div className="page-content">
                <div className="referrals-page wrapper-page">
                  {pageHeader}
                  <div className="error-message">{t('referrals.errorTitle')}</div>
                </div>
              </div>
            </div>
          </div>
        </SidebarProvider>
      </MobileMenuProvider>
    );
  }

  return (
    <MobileMenuProvider>
      <SidebarProvider>
        <div className="wrapper-body">
          <TradingHeader />
          <div className="app-layout-wrapper">
            <Sidebar />
            <div className="page-content">
              <div className="referrals-page wrapper-page">
      {pageHeader}
        <div className="referral-stats">
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 4L12 20M12 20L16 16M12 20L8 16" stroke="#37a1ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{formatCurrency(totalEarnings, userCurrency)}</div>
              <div className="stat-label">{t('referrals.totalEarned')}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                    d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 19 1 21M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13M16 3.13C16.8604 3.3503 17.623 3.8507 18.1676 4.55231C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88M13 7C13 9.20914 11.2091 11 9 11C6.79086 11 5 9.20914 5 7C5 4.79086 6.79086 3 9 3C11.2091 3 13 4.79086 13 7Z"
                    stroke="#37a1ff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{refCount}</div>
              <div className="stat-label">{t('referrals.totalReferrals')}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                    d="M12 2V4M12 2C6.47715 2 2 6.47715 2 12M12 2C17.5228 2 22 6.47715 22 12M12 20V22M12 22C17.5228 22 22 17.5228 22 12M12 22C6.47715 22 2 17.5228 2 12M4 12H2M22 12H20M4.07107 4.07107L4.34315 3.75736M4.07107 19.9289L6 18M19.9289 4.07107L18 6M19.6569 3.75736L19.9289 4.07107M19.9289 19.9289L18 18M4.34315 20.2426L4.07107 19.9289"
                    stroke="#37a1ff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{formatCurrency(refBalance, userCurrency)}</div>
              <div className="stat-label">{t('referrals.referralBalance')}</div>
            </div>
          </div>
        </div>

        <div className="referral-link-section">
          <h2 className="section-title">{t('referrals.yourReferralLink')}</h2>
          <div className="referral-link-container">
            <div className="referral-link">{getReferralLink()}</div>
            <button className={`copy-link-btn ${copied ? "copied" : ""}`} onClick={copyReferralLink}>
              {copied ? t('referrals.copied') : t('referrals.copyLink')}
              <span className="btn-glow"></span>
            </button>
          </div>
          <p className="referral-description">{t('referrals.referralDescription')}</p>
        </div>

        <div className="referrals-history">
          <div className="history-header">
            <h3 className="history-title">{t('referrals.yourReferrals')}</h3>
            <div className="history-stats">
            <span className="stat-item">
              {t('referrals.active')}: <strong>{activeReferrals}</strong>
            </span>
            </div>
          </div>

          <div className="referrals-list">
            {isLoading && (
                <div className="loading-referrals">
                  <div className="loading-spinner"></div>
                  <p>{t('referrals.loading')}</p>
                </div>
            )}

            {!isLoading && hasReferrals && (
                referrals.map((referral: Referral) => (
                    <div key={referral.id} className={`referral-card ${referral.banned ? "inactive" : "active"}`}>
                      <div className="referral-avatar">
                        {!referral.banned ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                              <path
                                  d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                                  stroke="#37a1ff"
                                  strokeWidth="2"
                              />
                              <path d="M8 12L11 15L16 9" stroke="#37a1ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                              <path
                                  d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                                  stroke="#FF0000"
                                  strokeWidth="2"
                              />
                              <path d="M15 9L9 15M9 9L15 15" stroke="#FF0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}
                      </div>

                      <div className="referral-details">
                        <div className="referral-username">{getUserDisplayName(referral)}</div>
                        <div className="referral-join-date">{t('referrals.joined')} {formatDate(referral.createdAt)}</div>
                      </div>

                      <div className={`referral-earned ${referral.banned ? "inactive" : "active"}`}>
                        {referral.banned ? t('referrals.banned') : formatCurrency(referral.balance_profit, userCurrency)}
                      </div>
                    </div>
                ))
            )}

            {!isLoading && !hasReferrals && (
                <div className="empty-referrals">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                    <path
                        d="M16 8V5L19 2L20 4L22 5L19 8H16ZM16 8L12 11.5M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
                        stroke="rgba(255,255,255,0.5)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                  </svg>
                  <p>{t('referrals.noReferrals')}</p>
                  <span>{t('referrals.noReferralsSubtext')}</span>
                </div>
            )}

            {error && !isLoading && !hasReferrals && (
                <div className="referrals-error">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path
                        d="M12 8V12M12 16H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
                        stroke="#FF0000"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                  </svg>
                  <p>{error}</p>
                  <button className="copy-link-btn" onClick={handleRetry} style={{ marginTop: "10px" }}>
                    {t('referrals.retry')}
                  </button>
                </div>
            )}
          </div>
        </div>
              </div>
            </div>
          </div>
          <Header />
        </div>
      </SidebarProvider>
    </MobileMenuProvider>
  );
}