import React from 'react';
import { Link } from 'react-router-dom';
import './PoliciesPage.css';
import { SidebarProvider } from '@src/shared/contexts/SidebarContext';
import { MobileMenuProvider } from '@src/shared/contexts/MobileMenuContext';
import { Sidebar } from '@src/widgets/sidebar/Sidebar';
import { TradingHeader } from '@src/widgets/trading-header/TradingHeader';
import { Header } from '@src/widgets/header/Header';

const CompanyPage: React.FC = () => {
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
        
        <h1>AML / KYC Policy</h1>
        <div className="last-updated">Last Updated: {new Date().toLocaleDateString('en-US')}</div>

        <section>
          <p>
            <strong>Domain:</strong> <a href="https://blockmind.company" target="_blank" rel="noopener noreferrer">https://blockmind.company</a>
          </p>
          <p>
            It is the policy of Block Mind LTD and its affiliates (hereinafter «The Company») to prohibit and actively pursue the prevention of money laundering and any activity that facilitates money laundering or the funding of terrorist or criminal activities. The Company requires its officers, employees and affiliates to adhere to these standards in preventing the use of its products and services for money laundering purposes.
          </p>
        </section>

        <section>
          <h2>Money Laundering Definition</h2>
          <p>
            Within the Policy, money laundering is generally defined as engaging in acts designed to conceal or disguise the true origins of criminally derived proceeds so that the unlawful proceeds appear to have been derived from legitimate origins or constitute legitimate assets.
          </p>
        </section>

        <section>
          <h2>Stages of Money Laundering</h2>
          <p>
            Generally, money laundering occurs in three stages.
          </p>
          <p>
            At the «placement» stage, cash generated from criminal activities is converted into monetary instruments (money orders, traveler's checks, bank deposits).
          </p>
          <p>
            At the «layering» stage, the funds are transferred or moved into other accounts or other financial institutions to further separate the funds from their criminal origin.
          </p>
          <p>
            At the «integration» stage, the funds are reintroduced into the economy through the purchase of legitimate assets, funding businesses, or used for further criminal activities.
          </p>
        </section>

        <section>
          <h2>Terrorist Financing</h2>
          <p>
            Terrorist financing may not involve criminal proceeds but often involves concealing the source or intended use of legitimate funds that will later support criminal or terrorist acts.
          </p>
        </section>

        <section>
          <h2>Compliance Requirements</h2>
          <p>
            Each employee of The Company whose duties are associated with the provision of products and services of Block Mind LTD, and who directly or indirectly deals with the clientele, is expected to know the requirements of applicable laws and regulations that affect their job responsibilities. It is the affirmative duty of such employees to comply with all relevant legal and regulatory requirements at all times.
          </p>
        </section>

        <section>
          <h2>Relevant Laws and Regulations</h2>
          <p>
            The relevant laws and regulations include, but are not limited to:
          </p>
          <ul>
            <li>«Customer Due Diligence for Banks» (2001)</li>
            <li>«General Guide to Account Opening and Customer Identification» (2003) of the Basel Committee of Banking Supervision</li>
            <li>FATF Forty + Nine Recommendations for Money Laundering</li>
            <li>USA Patriot Act (2001)</li>
            <li>Prevention and Suppression of Money Laundering Activities Law (1996)</li>
          </ul>
        </section>

        <section>
          <h2>Compliance Program</h2>
          <p>
            To ensure this general policy is properly implemented, the management of Block Mind LTD has established and maintains an ongoing compliance program. This program ensures adherence to applicable laws and regulations and prevents money laundering. The program coordinates regulatory requirements within a consolidated framework to manage risks related to money laundering and terrorist financing across all business units, functions, and legal entities.
          </p>
          <p>
            Each affiliate of Block Mind LTD is required to comply with AML and KYC policies.
          </p>
          <p>
            All identification documentation and service records shall be maintained for at least the minimum period required by local law.
          </p>
        </section>

        <section>
          <h2>Training Requirements</h2>
          <p>
            All new employees shall receive anti-money laundering training as part of the mandatory onboarding program. All applicable employees must complete AML and KYC training annually. Participation in additional AML-targeted training programs is required for all employees with day-to-day AML and KYC responsibilities.
          </p>
        </section>

        <section>
          <h2>Client Verification</h2>
          <p>
            The Company has the right to request that the Client confirm the registration information provided when opening a trading account at its discretion and at any time. To verify such data, Block Mind LTD may request notarized copies of:
          </p>
          <ul>
            <li>passport,</li>
            <li>driver's license,</li>
            <li>national identity card,</li>
            <li>bank statements or utility bills to confirm the residential address.</li>
          </ul>
          <p>
            In some cases, the Company may additionally request a photograph of the Client holding their identity document close to their face.
          </p>
          <p>
            Detailed requirements for client identification are specified in the AML Policy section on the Company's official website <a href="https://blockmind.company" target="_blank" rel="noopener noreferrer">https://blockmind.company</a>.
          </p>
        </section>

        <section>
          <h2>Verification Procedure</h2>
          <p>
            The verification procedure is not mandatory unless the Company requests it. The Client may voluntarily send copies of their identification documents to the client support department to ensure verification. However, for deposits/withdrawals via bank transfer, full verification of name and address is required due to the specifics of banking operations.
          </p>
        </section>

        <section>
          <h2>Data Updates</h2>
          <p>
            If any of the Client's personal data (full name, address, or phone number) has changed, the Client must immediately notify the Company's support department with a request to update this information or update it independently in the Client's Profile.
          </p>
          <p>
            12.1. To change the phone number used for registration, the Client must provide a document confirming ownership of the new number (e.g., service provider contract) along with a photo of the Client holding their ID next to their face. The personal data must match across both documents.
          </p>
        </section>

        <section>
          <h2>Document Authenticity</h2>
          <p>
            The Client is responsible for the authenticity of the documents (or copies) provided and acknowledges the right of Block Mind LTD to contact the issuing authorities of the relevant country to verify document authenticity.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            For inquiries about the company, contact us:
          </p>
          <ul>
            <li>Website: <a href="https://blockmind.company" target="_blank" rel="noopener noreferrer">https://blockmind.company</a></li>
            <li>Telegram: <a href="https://t.me/BlockMind_support" target="_blank" rel="noopener noreferrer">@BlockMind_support</a></li>
            <li>WhatsApp: <a href="https://api.whatsapp.com/send?phone=37256038411" target="_blank" rel="noopener noreferrer">+37256038411</a></li>
          </ul>
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

export default CompanyPage;
