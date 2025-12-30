import React, { useState, useEffect } from 'react';
import styles from './ReferralIndicator.module.css';
import { decodeReferralHash, generateReferralHash } from '@src/shared/lib/referralHashUtils';

interface ReferralIndicatorProps {
  onClose?: () => void;
}

const ReferralIndicator: React.FC<ReferralIndicatorProps> = ({ onClose }) => {
  const [referralId, setReferralId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Проверяем URL параметры
    const urlParams = new URLSearchParams(window.location.search);
    // Проверяем новый параметр invite (приоритет) и старый ref (для обратной совместимости)
    const inviteParam = urlParams.get('invite');
    const refParam = urlParams.get('ref');
    
    if (inviteParam) {
      // Декодируем хеш из нового формата
      const refIdNum = decodeReferralHash(inviteParam);
      if (refIdNum) {
        setReferralId(String(refIdNum));
        localStorage.setItem('referral_id', String(refIdNum));
      }
    } else if (refParam) {
      // Обратная совместимость со старым форматом
      setReferralId(refParam);
      localStorage.setItem('referral_id', refParam);
    } else {
      // Проверяем localStorage
      const savedRefId = localStorage.getItem('referral_id');
      if (savedRefId) {
        setReferralId(savedRefId);
      }
    }
  }, []);

  const getReferralLink = () => {
    if (!referralId) return '';
    const baseUrl = window.location.origin;
    // Используем новый формат с хешем и параметром invite
    const refIdNum = parseInt(referralId, 10);
    if (!isNaN(refIdNum)) {
      const referralHash = generateReferralHash(refIdNum);
      return `${baseUrl}/?invite=${referralHash}`;
    }
    // Fallback на старый формат для обратной совместимости
    return `${baseUrl}/?ref=${referralId}`;
  };

  const copyReferralLink = () => {
    const referralLink = getReferralLink();
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!referralId) return null;

  return (
    <div className={styles.referralIndicator}>
      <div className={styles.referralContent}>
        <div className={styles.referralIcon}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className={styles.referralText}>
          <span className={styles.referralLabel}>Referral Link Active</span>
          <span className={styles.referralId}>ID: {referralId}</span>
        </div>
        <div className={styles.referralActions}>
          <button 
            className={`${styles.copyBtn} ${copied ? styles.copied : ''}`}
            onClick={copyReferralLink}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          {onClose && (
            <button 
              className={styles.closeBtn}
              onClick={onClose}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M18 6L6 18M6 6L18 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReferralIndicator;
