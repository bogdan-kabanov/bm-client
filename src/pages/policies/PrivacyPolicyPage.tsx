import React from 'react';
import { Link } from 'react-router-dom';
import './PoliciesPage.css';
import { SidebarProvider } from '@src/shared/contexts/SidebarContext';
import { MobileMenuProvider } from '@src/shared/contexts/MobileMenuContext';
import { Sidebar } from '@src/widgets/sidebar/Sidebar';
import { TradingHeader } from '@src/widgets/trading-header/TradingHeader';
import { Header } from '@src/widgets/header/Header';

const PrivacyPolicyPage: React.FC = () => {
  return (
    <MobileMenuProvider>
      <SidebarProvider>
        <div className="wrapper-body">
          <TradingHeader />
          <div className="app-layout-wrapper">
            <Sidebar />
            <div className="page-content">
              <div className="policies-page">
                <div className="policies-container">
        <Link to="/" className="back-button">← Back to Home</Link>
        
        <h1>Privacy Policy</h1>
        <div className="last-updated">Last Updated: {new Date().toLocaleDateString('en-US')}</div>

        <section>
          <h2>Introduction</h2>
          <p>
            We recognize the importance of safeguarding your personal information and respecting your privacy. We understand that you value discretion and expect your data to be handled with care. That's why we are fully committed to protecting the privacy of every user ("you" or "user") of our services.
          </p>
          <p>
            This Privacy Policy describes how we collect, use, and disclose your personal information when you access or interact with our websites, applications, and any other digital platforms through which we deliver our services (collectively referred to as the "Services").
          </p>
          <p>
            This Policy forms an integral part of our Service Agreement and is incorporated into it by reference.
          </p>
          <p>
            We strongly encourage you to read this Privacy Policy thoroughly and use it to make informed choices about your interactions with us. By using our Services, you acknowledge and agree to the terms outlined in this Privacy Policy. Continued use of the Services following any updates constitutes your acceptance of the revised Policy.
          </p>
        </section>

        <section>
          <h2>Data Usage</h2>
          <p>
            We may collect, use, store and transfer different kinds of personal data about you and for different purposes. For your use, we made the table with data categories, purposes of their use, and lawful bases for processing.
          </p>
          
          <h3>Data Categories Table</h3>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data Type</th>
                  <th>Examples of Information We May Collect</th>
                  <th>Purposes of Processing</th>
                  <th>Lawful Bases for Processing</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Identity Data</strong></td>
                  <td>First name, last name, and patronymic (if available), date of birth, gender, passport, ID, driver's license number, or photo.</td>
                  <td>Account management, fraud prevention, security, compliance with AML, CTF, and other applicable laws and regulations, advertising, and personalization of user experience.</td>
                  <td>1. Necessary to perform our contract with you.<br />2. Necessary to comply with our legal obligations.<br />3. Necessary for our legitimate interests.</td>
                </tr>
                <tr>
                  <td><strong>Contact Data</strong></td>
                  <td>Billing address, email address, and telephone numbers.</td>
                  <td>Account management, application functionality, fraud prevention, security, compliance with AML, CTF, and other applicable laws and regulations, developer communications, advertising, and personalization of user experience.</td>
                  <td>1. Perform contract.<br />2. Legal obligations.<br />3. Legitimate interests.</td>
                </tr>
                <tr>
                  <td><strong>Audio and Video Data</strong></td>
                  <td>Full audio or video recordings of calls that you receive from us or make to us. (Not relevant for iOS/Android apps)</td>
                  <td>Account management, fraud prevention, security, compliance with legal obligations, developer communications, promotional activities, client support.</td>
                  <td>1. Contract.<br />2. Legal obligation.</td>
                </tr>
                <tr>
                  <td><strong>Conformity Data</strong></td>
                  <td>Education, employment status, trading experience, self-assessment tests.</td>
                  <td>Fraud prevention, AML/CTF compliance, account management.</td>
                  <td>1. Contract.<br />2. Legal obligations.</td>
                </tr>
                <tr>
                  <td><strong>Marketing & Communication Data</strong></td>
                  <td>Marketing preferences, communication settings.</td>
                  <td>Compliance, marketing analytics, personalization, promotions, service provision.</td>
                  <td>1. Contract.<br />2. Legal obligations.<br />3. Legitimate interests.</td>
                </tr>
                <tr>
                  <td><strong>Location Data</strong></td>
                  <td>Residency country, time zone, interface language, etc. (Not relevant for iOS/Android apps)</td>
                  <td>Account management, fraud prevention, AML/CTF compliance, developer communications, personalization.</td>
                  <td>1. Contract.<br />2. Legal obligations.</td>
                </tr>
                <tr>
                  <td><strong>Payment Data</strong></td>
                  <td>Wallet details, bank card details, issuing bank, card number, cardholder name, expiration date, CVV2/CVC2, card photos.</td>
                  <td>Fraud prevention, AML/CTF compliance, service provision, user experience personalization.</td>
                  <td>1. Contract.<br />2. Legal obligations.<br />3. Legitimate interests.</td>
                </tr>
                <tr>
                  <td><strong>Economic Profile Data</strong></td>
                  <td>Occupation, purpose of investment, income, net wealth, expected annual investment amount, sources of funds.</td>
                  <td>Fraud prevention, AML/CTF compliance, account management.</td>
                  <td>1. Contract.<br />2. Legal obligations.</td>
                </tr>
                <tr>
                  <td><strong>KYC Data</strong></td>
                  <td>Identity documents such as passport, ID card, driver's license, utility bills.</td>
                  <td>Fraud prevention, AML/CTF compliance, account management.</td>
                  <td>1. Contract.<br />2. Legal obligations.</td>
                </tr>
                <tr>
                  <td><strong>Special / Sensitive Data</strong></td>
                  <td>Annual income, biometric data, criminal convictions.</td>
                  <td>Fraud prevention, AML/CTF compliance.</td>
                  <td>1. Contract.<br />2. Legal obligations.<br />3. Consent.</td>
                </tr>
                <tr>
                  <td><strong>Financial Data</strong></td>
                  <td>Bank account details, tax identification numbers.</td>
                  <td>Account management, fraud prevention, AML/CTF compliance.</td>
                  <td>1. Contract.<br />2. Legal obligations.<br />3. Legitimate interests.</td>
                </tr>
                <tr>
                  <td><strong>Transaction Data & Purchase History</strong></td>
                  <td>Payments, withdrawals, exchanges, trading history, balance, profit, ROI metric, trade direction.</td>
                  <td>Account management, AML/CTF compliance, personalization.</td>
                  <td>1. Contract.<br />2. Legal obligations.<br />3. Legitimate interests.</td>
                </tr>
                <tr>
                  <td><strong>Technical Data</strong></td>
                  <td>IP address, login data, browser type, OS data, cookies, device identifiers.</td>
                  <td>Fraud prevention, security, advertising, analytics, personalization.</td>
                  <td>1. Contract.<br />2. Legal obligations.<br />3. Legitimate interests.</td>
                </tr>
                <tr>
                  <td><strong>Usage Data</strong></td>
                  <td>Website/app usage, registration date, trading cluster, complaints, performance logs.</td>
                  <td>Security, analytics, AML/CTF compliance, personalization.</td>
                  <td>1. Contract.<br />2. Legitimate interests.</td>
                </tr>
                <tr>
                  <td><strong>Profile Data</strong></td>
                  <td>Username, password, avatar, rank, XP, preferences, surveys, etc.</td>
                  <td>Account management, analytics, advertising, personalization.</td>
                  <td>1. Contract.<br />2. Legal obligations.<br />3. Legitimate interests.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            We process the aforementioned data:
          </p>
          <ul>
            <li>To perform our contractual obligations.</li>
            <li>To provide Services efficiently.</li>
            <li>To comply with AML/CTF and FATF obligations.</li>
            <li>To protect legitimate and vital interests.</li>
          </ul>
          <p>
            Legal bases include:
          </p>
          <ul>
            <li>Compliance with laws</li>
            <li>Contract execution</li>
            <li>Legitimate interests</li>
            <li>User consent</li>
          </ul>
          <p>
            Some data must be stored even after account deletion — as required by law.
          </p>
        </section>

        <section>
          <h2>Leaderboards</h2>
          <p>
            By using the platform, you agree to participate in the leaderboard system of Block Mind LTD and allow us to display:
          </p>
          <ul>
            <li>Your name or User ID</li>
            <li>Country flag icon</li>
            <li>Profile photo (optional)</li>
            <li>Rank</li>
            <li>Online status</li>
            <li>XP</li>
            <li>Total winnings (only as a metric, not actual sum)</li>
          </ul>
          <p>
            We may also generate trading signals based on your activity.
          </p>
          <p>
            <strong>We never show:</strong> Your actual trade amounts, Your balance, Exact monetary values. Only ROI %, direction, asset, and duration.
          </p>
        </section>

        <section>
          <h2>Cookies and Other Tracking Technologies</h2>
          <p>
            We use:
          </p>
          <ul>
            <li>Session cookies</li>
            <li>Persistent cookies</li>
            <li>Third-party cookies</li>
          </ul>
          <p>
            Cookies may support login, security, personalization, advertising, analytics. Users can disable cookies but some features may stop working.
          </p>
        </section>

        <section>
          <h2>With Whom We Share Information</h2>
          <p>
            Block Mind LTD may share information with:
          </p>
          <ol>
            <li><strong>Affiliates and Subsidiaries</strong><br />Internal operational data exchange.</li>
            <li><strong>Trusted Third-Party Providers</strong><br />For:
              <ul>
                <li>Identity verification</li>
                <li>Storage and processing</li>
                <li>Fraud prevention</li>
                <li>Advertising</li>
                <li>Analytics</li>
                <li>Cloud infrastructure</li>
              </ul>
            </li>
            <li><strong>Legal Compliance</strong><br />We may disclose data to comply with:
              <ul>
                <li>Laws</li>
                <li>Regulations</li>
                <li>Court orders</li>
                <li>Fraud investigations</li>
                <li>Other legitimate purposes</li>
              </ul>
            </li>
          </ol>
          <p>
            Ads display, Research, Technical support, IP protection, Anti-fraud monitoring, Security enforcement
          </p>
          <p>
            Every third party must comply with this Privacy Policy.
          </p>
        </section>

        <section>
          <h2>Third-Party Collection of Information</h2>
          <p>
            Links to external sites are not governed by Block Mind LTD. We disclaim responsibility for:
          </p>
          <ul>
            <li>Their content</li>
            <li>Their privacy practices</li>
            <li>Their data handling</li>
          </ul>
          <p>
            We also use Google Analytics for anonymized traffic analytics.
          </p>
        </section>

        <section>
          <h2>Advertisements</h2>
          <p>
            We may use:
          </p>
          <ul>
            <li>Interest-based ads</li>
            <li>Retargeting</li>
            <li>Third-party ad partners</li>
          </ul>
          <p>
            Users may opt-out via:
          </p>
          <ul>
            <li>NAI opt-out</li>
            <li>DAA opt-out</li>
          </ul>
        </section>

        <section>
          <h2>Personal Data Deletion and Rectification Requests</h2>
          <p>
            You may request:
          </p>
          <ul>
            <li>Correction</li>
            <li>Deletion (excluding legally preserved data)</li>
          </ul>
          <p>
            We retain data for up to 7 years for legal obligations.
          </p>
        </section>

        <section>
          <h2>Safeguarding and Transferring Your Information</h2>
          <p>
            Block Mind LTD applies industry-standard security measures. However, absolute protection cannot be guaranteed.
          </p>
        </section>

        <section>
          <h2>Marketing</h2>
          <p>
            We may use your personal data or share it with Marketing Affiliates to send promotional content.
          </p>
          <p>
            You can opt out by sending an email with "remove" in the subject. Service-related notifications will still be delivered.
          </p>
        </section>

        <section>
          <h2>Corporate Transactions</h2>
          <p>
            If Block Mind LTD undergoes merger, acquisition, restructuring — data may be transferred to the successor entity.
          </p>
        </section>

        <section>
          <h2>Account Deletion and Recovery</h2>
          <p>
            You may delete your account via app interface or by sending an email with the subject "delete account".
          </p>
          <p>
            Some data (e.g., transactions) must be retained for legal reasons.
          </p>
          <p>
            To restore an account — email: "restore account".
          </p>
        </section>

        <section>
          <h2>Updates or Amendments to This Privacy Policy</h2>
          <p>
            Block Mind LTD may update this Policy at any time. Latest version is always published on <a href="https://blockmind.company" target="_blank" rel="noopener noreferrer">https://blockmind.company</a>
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            Website: <a href="https://blockmind.company" target="_blank" rel="noopener noreferrer">https://blockmind.company</a>
          </p>
          <p>
            Email: <a href="mailto:support@blockmind.company">support@blockmind.company</a>
          </p>
        </section>
                </div>
              </div>
            </div>
          </div>
          <Header />
        </div>
      </SidebarProvider>
    </MobileMenuProvider>
  );
};

export default PrivacyPolicyPage;
