import { useCallback, useEffect, useRef, useState, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { useAppSelector, useAppDispatch } from "@src/shared/lib/hooks";
import { selectProfile } from "@src/entities/user/model/selectors";
import { useLanguage } from "@src/app/providers/useLanguage";
import { ensureHttps } from "@src/shared/lib/ensureHttps";
import { formatTraderCodeForDisplay } from "@src/shared/lib/traderCodeUtils";
import { formatCurrency, CURRENCY_INFO, SupportedCurrency, getCurrencyInfo } from "@src/shared/lib/currency/currencyUtils";
import { languages } from "@src/shared/lib/languages";
import { getLevelInfo } from "@src/shared/ui/BalanceLevelBadge";
import { updateUserProfile, setUser } from "@src/entities/user/model/slice";
import { LanguageCurrencyModal } from "@src/widgets/language-currency-modal/LanguageCurrencyModal";
import { logout } from "@src/features/auth/authCheck";
import { userApi } from "@src/shared/api/user/userApi";
import userIcon from "@src/assets/avatar.svg";
import "./ProfilePopup.css";

interface ProfilePopupProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ProfilePopup({ isOpen, onClose }: ProfilePopupProps) {
    const dispatch = useAppDispatch();
    const profile = useAppSelector(selectProfile);
    const { t, language } = useLanguage();
    const navigate = useNavigate();
    const popupRef = useRef<HTMLDivElement>(null);
    const logoutPopoverRef = useRef<HTMLDivElement | null>(null);
    const avatarInputRef = useRef<HTMLInputElement | null>(null);
    const [isLanguageCurrencyModalOpen, setIsLanguageCurrencyModalOpen] = useState(false);
    const [modalTab, setModalTab] = useState<'language' | 'currency'>('language');
    const [logoutConfirm, setLogoutConfirm] = useState(false);
    const [isAvatarUploadModalOpen, setIsAvatarUploadModalOpen] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const [idCopied, setIdCopied] = useState(false);

    const levelInfo = getLevelInfo(Number(profile?.balance || 0));
    const profileImageSrc = ensureHttps(profile?.avatarUrl || profile?.avatar_url) || userIcon;
    const userCurrency = profile?.currency || 'USD';
    
    // Debug: Log currency changes
    useEffect(() => {
        console.log('[ProfilePopup] Currency changed:', userCurrency, 'profile?.currency:', profile?.currency);
    }, [userCurrency, profile?.currency]);

    const getLevelNumber = (amount: number): string => {
        if (amount >= 2500) return "5";
        if (amount >= 500) return "4";
        if (amount >= 200) return "3";
        if (amount >= 50) return "2";
        return "1";
    };

    const getLevelName = (levelNumber: string): string => {
        const levelNames: Record<string, string> = {
            "1": "Newbie",
            "2": "Beginner",
            "3": "Experienced",
            "4": "Trader",
            "5": "VIP trader"
        };
        return levelNames[levelNumber] || "Newbie";
    };

    const levelNumber = getLevelNumber(Number(profile?.balance || 0));
    const levelName = getLevelName(levelNumber);
    
    const formatDate = (dateString?: string) => {
        if (!dateString) return '—';
        try {
            const localeMap: Record<string, string> = {
                'en': 'en-US',
                'ru': 'ru-RU',
                'it': 'it-IT',
                'fr': 'fr-FR',
                'ar': 'ar-SA',
                'tr': 'tr-TR',
                'fa': 'fa-IR',
                'hr': 'hr-HR',
                'bn': 'bn-BD',
                'sw': 'sw-KE',
                'nl': 'nl-NL',
                'ha': 'ha-NG',
                'az': 'az-AZ',
                'ka': 'ka-GE',
                'pt': 'pt-PT',
                'pl': 'pl-PL',
                'th': 'th-TH',
                'ms': 'ms-MY',
                'ja': 'ja-JP',
                'sr': 'sr-RS',
                'hi': 'hi-IN',
                'uk': 'uk-UA',
                'ky': 'ky-KG',
                'yo': 'yo-NG',
                'af': 'af-ZA',
                'uz': 'uz-UZ',
                'es': 'es-ES',
                'id': 'id-ID',
                'vi': 'vi-VN',
                'zh': 'zh-CN',
                'ko': 'ko-KR',
                'ro': 'ro-RO',
                'el': 'el-GR',
                'tl': 'tl-PH',
                'kk': 'kk-KZ',
                'ig': 'ig-NG',
                'tg': 'tg-TJ',
                'hy': 'hy-AM',
                'de': 'de-DE',
                'cs': 'cs-CZ'
            };
            const locale = localeMap[language] || 'en-US';
            const date = new Date(dateString);
            return date.toLocaleDateString(locale, { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        } catch {
            return '—';
        }
    };

    const handleOpenProfile = useCallback(() => {
        onClose();
        navigate("/profile");
    }, [navigate, onClose]);

    const handleOpenLanguageModal = useCallback(() => {
        setModalTab('language');
        setIsLanguageCurrencyModalOpen(true);
    }, []);

    const handleOpenCurrencyModal = useCallback(() => {
        setModalTab('currency');
        setIsLanguageCurrencyModalOpen(true);
    }, []);

    const handleLogoutRequest = useCallback(() => {
        setLogoutConfirm(true);
    }, []);

    const closeLogoutConfirm = useCallback(() => {
        setLogoutConfirm(false);
    }, []);

    const confirmLogout = useCallback(() => {
        closeLogoutConfirm();
        logout();
    }, [closeLogoutConfirm]);

    const handleOpenDeposit = useCallback(() => {
        onClose();
        navigate("/deposit");
    }, [navigate, onClose]);

    const handleCopyId = useCallback(async () => {
        if (!profile?.id) return;
        
        const traderCode = formatTraderCodeForDisplay(profile.id);
        try {
            await navigator.clipboard.writeText(traderCode);
            setIdCopied(true);
            setTimeout(() => setIdCopied(false), 2000);
        } catch (error) {
            // Fallback for browsers that don't support clipboard API
            const textArea = document.createElement('textarea');
            textArea.value = traderCode;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                setIdCopied(true);
                setTimeout(() => setIdCopied(false), 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
            document.body.removeChild(textArea);
        }
    }, [profile?.id]);

    const handleAvatarUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        setAvatarError(null);

        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            setAvatarError(t('profile.avatarTooLarge', { defaultValue: 'Maximum size is 5 MB' }));
            event.target.value = '';
            return;
        }

        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            setAvatarError(t('profile.avatarInvalidType', { defaultValue: 'Allowed formats: PNG, JPG, WEBP or GIF' }));
            event.target.value = '';
            return;
        }

        setAvatarUploading(true);

        try {
            const updatedUser = await userApi.uploadAvatar(file);
            dispatch(setUser(updatedUser));
            setIsAvatarUploadModalOpen(false);
            if (event.target) {
                event.target.value = '';
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message || '' : '';
            const normalized = errorMessage.toLowerCase();

            if (normalized.includes('format') || normalized.includes('формат')) {
                setAvatarError(t('profile.avatarInvalidType', { defaultValue: 'Allowed formats: PNG, JPG, WEBP or GIF' }));
            } else if (normalized.includes('5mb') || normalized.includes('5 мб')) {
                setAvatarError(t('profile.avatarTooLarge', { defaultValue: 'Maximum size is 5 MB' }));
            } else {
                setAvatarError(errorMessage || t('profile.updateError', { defaultValue: 'Failed to update avatar' }));
            }
        } finally {
            setAvatarUploading(false);
        }
    }, [dispatch, t]);


    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                if (logoutConfirm) {
                    closeLogoutConfirm();
                } else {
                    onClose();
                }
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose, logoutConfirm, closeLogoutConfirm]);

    useEffect(() => {
        const handleDocumentClick = (event: MouseEvent) => {
            if (!logoutConfirm) return;
            const target = event.target as Node;
            if (logoutPopoverRef.current && !logoutPopoverRef.current.contains(target)) {
                closeLogoutConfirm();
            }
        };

        if (logoutConfirm) {
            document.addEventListener('mousedown', handleDocumentClick);
            return () => {
                document.removeEventListener('mousedown', handleDocumentClick);
            };
        }
    }, [logoutConfirm, closeLogoutConfirm]);

    if (!isOpen) return null;

    const popupContent = (
        <div className={`profile-popup ${isOpen ? 'visible' : ''}`} ref={popupRef} onClick={(e) => e.stopPropagation()}>
            <div className="profile-popup__header">
                <div className="profile-popup__user-header">
                    <div 
                        className={`profile-popup__avatar profile-popup__avatar--level-${levelInfo.variant} profile-popup__avatar--clickable`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsAvatarUploadModalOpen(true);
                        }}
                        title={t('profile.replacePhoto', { defaultValue: 'Replace photo' }) || 'Replace photo'}
                    >
                        <img 
                            src={profileImageSrc} 
                            alt={t("profile.title") || "Profile"} 
                        />
                    </div>
                    <div className="profile-popup__user-main">
                        <div className="profile-popup__name-row">
                            <span className="profile-popup__name">
                                {profile?.firstname && profile?.lastname 
                                    ? `${profile.firstname} ${profile.lastname}`
                                    : profile?.login || profile?.email || t('profile.user')}
                            </span>
                            <span className={`profile-popup__level-badge profile-popup__level-badge--${levelInfo.variant}`}>
                                {levelName}
                            </span>
                        </div>
                        <div 
                            className={`profile-popup__id ${idCopied ? 'profile-popup__id--copied' : ''}`}
                            onClick={handleCopyId}
                            style={{ cursor: profile?.id ? 'pointer' : 'default' }}
                            title={profile?.id ? (idCopied ? (t('common.copied') || 'Copied!') : (t('common.copy') || 'Copy')) : undefined}
                        >
                            <span className="profile-popup__id-text">
                                {profile?.id ? formatTraderCodeForDisplay(profile.id) : '—'}
                            </span>
                            {profile?.id && (
                                <span className="profile-popup__id-copy-icon">
                                    {idCopied ? (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                            <path
                                                d="M20 6L9 17L4 12"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    ) : (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                            <path
                                                d="M16 8V5C16 3.89543 15.1046 3 14 3H5C3.89543 3 3 3.89543 3 5V14C3 15.1046 3.89543 16 5 16H8M10 8H19C20.1046 8 21 8.89543 21 10V19C21 20.1046 20.1046 21 19 21H10C8.89543 21 8 20.1046 8 19V10C8 8.89543 8.89543 8 10 8Z"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    )}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <button className="profile-popup__close" onClick={onClose} aria-label={t('common.close') || 'Close'}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <div className="profile-popup__body">
                <div className="profile-popup__content">
                    <div className="profile-popup__info-item profile-popup__info-item--language">
                        <span className="profile-popup__info-label">{t('common.language') || 'Language'}</span>
                        <button
                            className="profile-popup__language-button"
                            onClick={handleOpenLanguageModal}
                        >
                            <span className="profile-popup__language-button-text">
                                {languages.find(l => l.code === language)?.nativeName || language.toUpperCase()}
                            </span>
                            <svg className="profile-popup__language-arrow" width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="1 1 5 5 9 1"></polyline>
                            </svg>
                        </button>
                    </div>

                    <div className="profile-popup__info-item profile-popup__info-item--action">
                        <span className="profile-popup__info-label">{t('profile.verification', { defaultValue: 'Verification' }) || 'Verification'}</span>
                        <span className="profile-popup__info-value">
                            {profile?.email_verified || (profile as any)?.kyc_verified ? (
                                <span className="profile-popup__verification-badge profile-popup__verification-badge--verified">
                                    {t('profile.verified', { defaultValue: 'Verified' }) || 'Verified'}
                                </span>
                            ) : (
                                <span className="profile-popup__verification-badge profile-popup__verification-badge--not-verified">
                                    {t('profile.notVerified', { defaultValue: 'Not Verified' }) || 'Not Verified'}
                                </span>
                            )}
                        </span>
                    </div>

                    {profile?.balance_profit && Number(profile.balance_profit) > 0 && (
                        <div className="profile-popup__info-item">
                            <span className="profile-popup__info-label">{t('trading.profit')}</span>
                            <span className="profile-popup__info-value profile-popup__info-value--profit">
                                {formatCurrency(Number(profile.balance_profit), userCurrency)}
                            </span>
                        </div>
                    )}

                    {profile?.currency && (
                        <div className="profile-popup__info-item profile-popup__info-item--currency">
                            <span className="profile-popup__info-label">{t('profile.currency') || 'Currency'}</span>
                            <button
                                className="profile-popup__currency-button"
                                onClick={handleOpenCurrencyModal}
                            >
                                <span className="profile-popup__currency-button-text">
                                    {userCurrency}
                                </span>
                                <svg className="profile-popup__currency-arrow" width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="1 1 5 5 9 1"></polyline>
                                </svg>
                            </button>
                        </div>
                    )}

                    {(profile?.ref_balance || profile?.total_ref_earnings || profile?.ref_count) && (
                        <>
                            {profile?.ref_balance !== undefined && (
                                <div className="profile-popup__info-item">
                                    <span className="profile-popup__info-label">{t('profile.refBalance') || 'Referral Balance'}</span>
                                    <span className="profile-popup__info-value">
                                        {formatCurrency(Number(profile.ref_balance || 0), userCurrency)}
                                    </span>
                                </div>
                            )}
                            {profile?.total_ref_earnings !== undefined && (
                                <div className="profile-popup__info-item">
                                    <span className="profile-popup__info-label">{t('profile.totalRefEarnings') || 'Total Earnings'}</span>
                                    <span className="profile-popup__info-value">
                                        {formatCurrency(Number(profile.total_ref_earnings || 0), userCurrency)}
                                    </span>
                                </div>
                            )}
                            {profile?.ref_count !== undefined && (
                                <div className="profile-popup__info-item">
                                    <span className="profile-popup__info-label">{t('profile.refCount') || 'Referrals'}</span>
                                    <span className="profile-popup__info-value">{profile.ref_count || 0}</span>
                                </div>
                            )}
                        </>
                    )}

                    {profile?.email && (
                        <div className="profile-popup__info-item">
                            <span className="profile-popup__info-label">{t('profile.email')}</span>
                            <span className="profile-popup__info-value">{profile.email}</span>
                        </div>
                    )}

                    {profile?.phone && (
                        <div className="profile-popup__info-item">
                            <span className="profile-popup__info-label">{t('profile.phone')}</span>
                            <span className="profile-popup__info-value">{profile.phone}</span>
                        </div>
                    )}

                    {profile?.createdAt && (
                        <div className="profile-popup__info-item">
                            <span className="profile-popup__info-label">{t('profile.memberSince')}</span>
                            <span className="profile-popup__info-value">{formatDate(profile.createdAt)}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="profile-popup__footer">
                <div className="profile-popup__footer-buttons">
                    <button 
                        className="profile-popup__open-profile-button"
                        onClick={handleOpenProfile}
                    >
                        {t('profile.openFullProfile') || t('profile.title') || 'Open Profile'}
                    </button>
                    <button 
                        className="profile-popup__deposit-button"
                        onClick={handleOpenDeposit}
                    >
                        {t('deposit.topUp', { defaultValue: 'Top up' }) || 'Top up'}
                    </button>
                </div>
                <button 
                    className="profile-popup__logout-button"
                    onClick={handleLogoutRequest}
                    title={t('menu.logout') || 'Logout'}
                >
                    <svg className="profile-popup__logout-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    {t('menu.logout') || 'Logout'}
                </button>
            </div>
        </div>
    );

    return (
        <>
            {typeof document !== 'undefined' && createPortal(popupContent, document.body)}
            {logoutConfirm && typeof document !== 'undefined' && createPortal(
                <>
                    <div
                        className="profile-popup__logout-overlay"
                        role="presentation"
                        onClick={closeLogoutConfirm}
                    />
                    <div
                        ref={logoutPopoverRef}
                        className="profile-popup__logout-popover"
                        role="dialog"
                        aria-modal="true"
                    >
                        <p className="profile-popup__logout-message">{t('auth.logoutConfirm') || 'Are you sure you want to logout?'}</p>
                        <div className="profile-popup__logout-actions">
                            <button
                                type="button"
                                className="profile-popup__logout-btn profile-popup__logout-btn--primary"
                                onClick={confirmLogout}
                            >
                                {t('auth.logoutConfirmYes', { defaultValue: t('menu.logout') || 'Logout' })}
                            </button>
                            <button
                                type="button"
                                className="profile-popup__logout-btn profile-popup__logout-btn--ghost"
                                onClick={closeLogoutConfirm}
                            >
                                {t('auth.logoutConfirmCancel', { defaultValue: 'Cancel' })}
                            </button>
                        </div>
                    </div>
                </>,
                document.body
            )}
            <LanguageCurrencyModal
                isOpen={isLanguageCurrencyModalOpen}
                onClose={() => setIsLanguageCurrencyModalOpen(false)}
                initialTab={modalTab}
            />
            {isAvatarUploadModalOpen && typeof document !== 'undefined' && createPortal(
                <>
                    <div
                        className="profile-popup__avatar-upload-overlay"
                        role="presentation"
                        onClick={() => {
                            setIsAvatarUploadModalOpen(false);
                            setAvatarError(null);
                        }}
                    />
                    <div
                        className="profile-popup__avatar-upload-modal"
                        role="dialog"
                        aria-modal="true"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="profile-popup__avatar-upload-header">
                            <h3 className="profile-popup__avatar-upload-title">
                                {t('profile.uploadAvatar', { defaultValue: 'Replace photo' }) || 'Replace photo'}
                            </h3>
                            <button
                                type="button"
                                className="profile-popup__avatar-upload-close"
                                onClick={() => {
                                    setIsAvatarUploadModalOpen(false);
                                    setAvatarError(null);
                                }}
                                aria-label={t('common.close') || 'Close'}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div className="profile-popup__avatar-upload-content">
                            <input
                                ref={avatarInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                                onChange={handleAvatarUpload}
                                style={{ display: 'none' }}
                                id="avatar-upload-input"
                            />
                            <label
                                htmlFor="avatar-upload-input"
                                className="profile-popup__avatar-upload-label"
                                style={{
                                    cursor: avatarUploading ? 'not-allowed' : 'pointer',
                                    opacity: avatarUploading ? 0.6 : 1
                                }}
                            >
                                <div className="profile-popup__avatar-upload-icon">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="17 8 12 3 7 8"></polyline>
                                        <line x1="12" y1="3" x2="12" y2="15"></line>
                                    </svg>
                                </div>
                                <span className="profile-popup__avatar-upload-text">
                                    {avatarUploading 
                                        ? (t('common.uploading', { defaultValue: 'Uploading...' }) || 'Uploading...')
                                        : (t('profile.uploadAvatar', { defaultValue: 'Upload avatar' }) || 'Upload avatar')
                                    }
                                </span>
                                <span className="profile-popup__avatar-upload-hint">
                                    {t('profile.avatarHint', { defaultValue: 'PNG, JPG, WEBP or GIF up to 5 MB' }) || 'PNG, JPG, WEBP or GIF up to 5 MB'}
                                </span>
                            </label>
                            {avatarError && (
                                <div className="profile-popup__avatar-upload-error">
                                    {avatarError}
                                </div>
                            )}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </>
    );
}
