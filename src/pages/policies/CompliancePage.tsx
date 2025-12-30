import React from 'react';
import { Link } from 'react-router-dom';
import './PoliciesPage.css';

const CompliancePage: React.FC = () => {
  return (
    <div className="policies-page">
      <div className="policies-container">
        <Link to="/" className="back-button">← Back to Home</Link>
        
        <h1>Compliance & Data Processing Policy</h1>
        <div className="last-updated">Last Updated: {new Date().toLocaleDateString('en-US')}</div>

        <section>
          <h2>1. General Provisions</h2>
          <p>
            BlockMindAI adheres to high standards of data processing and compliance with regulatory requirements
            in cryptocurrency trading. This policy describes our approaches to compliance and
            personal data processing.
          </p>
        </section>

        <section>
          <h2>2. Legal Basis</h2>
          <p>
            <strong>Jurisdiction:</strong> Moldova<br />
            <strong>Licenses:</strong> FVR000468, FTB001327
          </p>
          <p>
            We operate in accordance with:
          </p>
          <ul>
            <li>Moldova's personal data protection legislation</li>
            <li>GDPR (General Data Protection Regulation) - where applicable</li>
            <li>International KYC/AML standards</li>
            <li>Cryptocurrency market regulatory requirements</li>
          </ul>
        </section>

        <section>
          <h2>3. KYC (Know Your Customer)</h2>
          <h3>3.1. User Verification</h3>
          <p>
            As part of anti-money laundering (AML) compliance, we may request:
          </p>
          <ul>
            <li>Identity verification (identity documents)</li>
            <li>Proof of address</li>
            <li>Information about source of funds</li>
          </ul>

          <h3>3.2. Verification Levels</h3>
          <p>
            Verification requirements may vary depending on transaction volume and user jurisdiction.
          </p>
        </section>

        <section>
          <h2>4. AML/CFT (Anti-Money Laundering)</h2>
          <p>
            BlockMindAI implements anti-money laundering and counter-terrorism financing policies:
          </p>
          <ul>
            <li>Monitoring of suspicious transactions</li>
            <li>Checking users against sanctions lists</li>
            <li>Cooperation with law enforcement when necessary</li>
            <li>Maintaining transaction logs in accordance with legislation</li>
          </ul>
        </section>

        <section>
          <h2>5. Personal Data Processing</h2>
          <h3>5.1. Processing Principles</h3>
          <ul>
            <li><strong>Lawfulness</strong> - data is processed on legal grounds</li>
            <li><strong>Transparency</strong> - you are informed about processing purposes</li>
            <li><strong>Minimization</strong> - we collect only necessary data</li>
            <li><strong>Accuracy</strong> - we maintain data accuracy</li>
            <li><strong>Storage limitation</strong> - we store data no longer than necessary</li>
            <li><strong>Security</strong> - we apply appropriate protection measures</li>
          </ul>

          <h3>5.2. Categories of Processed Data</h3>
          <ul>
            <li>Identification data (name, email, phone)</li>
            <li>Authentication data (encrypted passwords, tokens)</li>
            <li>Trading data (transaction history, balances)</li>
            <li>Technical data (IP addresses, logs)</li>
            <li>Verification data (KYC documents)</li>
          </ul>
        </section>

        <section>
          <h2>6. Data Subject Rights</h2>
          <p>You have the following rights regarding your personal data:</p>
          <ul>
            <li><strong>Right of access</strong> - obtain information about processed data</li>
            <li><strong>Right of rectification</strong> - correct inaccurate data</li>
            <li><strong>Right to erasure</strong> - request data deletion ("right to be forgotten")</li>
            <li><strong>Right to restriction</strong> - restrict data use</li>
            <li><strong>Right to portability</strong> - receive data in structured format</li>
            <li><strong>Right to object</strong> - object to processing in certain cases</li>
          </ul>
        </section>

        <section>
          <h2>7. Data Security</h2>
          <h3>7.1. Technical Measures</h3>
          <ul>
            <li>Data encryption (AES-256 for storage, TLS for transmission)</li>
            <li>Role-based access control</li>
            <li>Regular backups</li>
            <li>24/7 security monitoring</li>
            <li>Penetration testing</li>
          </ul>

          <h3>7.2. Organizational Measures</h3>
          <ul>
            <li>Staff training on data protection</li>
            <li>Employee confidentiality policies</li>
            <li>Incident response plan</li>
            <li>Regular security audits</li>
          </ul>
        </section>

        <section>
          <h2>8. Breach Notification</h2>
          <p>
            In case of a data breach that may pose a risk to your rights and freedoms,
            we will notify you and relevant regulatory authorities within 72 hours of discovery.
          </p>
        </section>

        <section>
          <h2>9. International Transfers</h2>
          <p>
            When transferring data outside Moldova, we ensure:
          </p>
          <ul>
            <li>Adequate level of data protection in recipient country</li>
            <li>Use of Standard Contractual Clauses (SCC)</li>
            <li>Compliance with GDPR requirements when transferring to EU</li>
          </ul>
        </section>

        <section>
          <h2>10. Third Parties and Processors</h2>
          <p>
            We work only with trusted data processors who provide
            an appropriate level of protection. All third-party processors are bound by data processing agreements.
          </p>
        </section>

        <section>
          <h2>11. Data Retention and Deletion</h2>
          <h3>11.1. Retention Periods</h3>
          <ul>
            <li>Account data - while account is active</li>
            <li>Trading history - 5 years (regulatory requirement)</li>
            <li>KYC data - 5 years after account closure</li>
            <li>Security logs - 1 year</li>
          </ul>

          <h3>11.2. Deletion Procedure</h3>
          <p>
            After retention periods expire or upon request (where applicable), data is permanently deleted
            using secure deletion methods.
          </p>
        </section>

        <section>
          <h2>12. Complaints and Inquiries</h2>
          <p>
            If you believe your data protection rights have been violated, you can:
          </p>
          <ul>
            <li>Contact our support</li>
            <li>File a complaint with Moldova's data protection supervisory authority</li>
            <li>Seek legal remedy</li>
          </ul>
        </section>

        <section>
          <h2>13. DPO Contact Information</h2>
          <p>
            For data processing and compliance questions, contact our Data Protection Officer:
          </p>
          <ul>
            <li>Telegram: <a href="https://t.me/BlockMind_support" target="_blank" rel="noopener noreferrer">@BlockMind_support</a></li>
            <li>WhatsApp: <a href="https://api.whatsapp.com/send?phone=37256038411" target="_blank" rel="noopener noreferrer">+37256038411</a></li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default CompliancePage;
