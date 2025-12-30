import React from 'react';
import { User } from '@src/entities/user/model/types';
import styles from './Header.module.css';
import LanguageSwitcher from './LanguageSwitcher';
import { useLanguage } from '@/src/app/providers/useLanguage';
import fullLogo from '@src/assets/full-logo.png';

interface HeaderProps {
  user: User | null;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onOpenLogin, onOpenRegister }) => {
  const { t } = useLanguage();

  return (
    <header className={styles.lendingHeader}>
      <div className={styles.headerContainer}>
        <div className={styles.logoSection}>
          <img src={fullLogo} alt="Quotex logo" className={styles.logoImage} />
        </div>

        <nav className={styles.navSection}>
          <a href="#features">{t('landing.featuresTitle')}</a>
          <a href="#how-it-works">{t('landing.howItWorks')}</a>
          <a href="#arbitrage">{t('trading.title')}</a>
          <a href="/for-investors">{t('trading.forInvestors')}</a>
        </nav>

        <div className={styles.authSection}>
          <LanguageSwitcher />
          
          {user ? (
            <div className={styles.userInfo}>
              <span>{user.login || user.email}</span>
            </div>
          ) : (
            <div className={styles.authButtons}>
              <button className={styles.loginBtn} onClick={onOpenLogin}>
                {t('landing.login')}
              </button>
              <button className={styles.registerBtn} onClick={onOpenRegister}>
                {t('landing.register')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;