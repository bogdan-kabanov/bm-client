import React from 'react';
import { Link } from 'react-router-dom';
import './PoliciesPage.css';
import { SidebarProvider } from '@src/shared/contexts/SidebarContext';
import { MobileMenuProvider } from '@src/shared/contexts/MobileMenuContext';
import { Sidebar } from '@src/widgets/sidebar/Sidebar';
import { TradingHeader } from '@src/widgets/trading-header/TradingHeader';
import { Header } from '@src/widgets/header/Header';

const RiskDisclosurePage: React.FC = () => {
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
        
        <h1>Risk Disclosure</h1>
        <div className="last-updated">Last Updated: {new Date().toLocaleDateString('en-US')}</div>

        <section>
          <p>
            <strong>Domain:</strong> <a href="https://blockmind.company" target="_blank" rel="noopener noreferrer">https://blockmind.company</a>
          </p>
          <p>
            <strong>Official language:</strong> English
          </p>
          <p>
            The official language of the Company is English. For a more complete description of the Company's activity, please visit the English version of the site. Information translated into languages other than English is for information purposes only and has no legal force; the Company is not responsible for the accuracy of the information provided in other languages.
          </p>
        </section>

        <section>
          <h2>Risks Disclosure for Operations with Foreign Currency and Derivatives</h2>
          <p>
            This short warning, being an addition to the General Business Terms, is not intended to mention all risks and other important aspects of operations with foreign currency and derivatives. Considering the risks, you should not settle transactions of the aforementioned products if you are not aware of the nature of the contracts you enter into, the legal aspects of such relations within the context of such contracts, or the degree of your exposure to risk. Operations with foreign currency and derivatives are connected with a high level of risk, therefore they are not suitable for many people. You have to thoroughly evaluate to what extent such operations are suitable for you, taking into consideration your experience, aims, financial resources and other important factors.
          </p>
        </section>

        <section>
          <h2>1. Operations with Foreign Currency and Derivatives</h2>
          
          <h3>1.1 Leveraged Trading</h3>
          <p>
            Leveraged trading means that potential profits are magnified; it also means that losses are magnified. The lower the margin requirement, the higher the risk of potential losses if the market moves against you. Sometimes margins required can be as little as 0.5%.
          </p>
          <p>
            Be aware that when trading using margin, your losses can exceed your initial payment, and it is possible to lose much more money than you initially invested.
          </p>
          <p>
            Relatively inconsiderable market movements will have proportionally increasing impact on the amounts deposited, or intended to be deposited by you. This may work either for you or against you.
          </p>
          <p>
            If the market moves against your position, Block Mind may require you to urgently deposit additional funds. Failure to do so may result in forced closing of your positions, and you will bear responsibility for any resulting losses.
          </p>

          <h3>1.2 Orders and Risk-Reduction Strategies</h3>
          <p>
            Certain orders (e.g., stop-loss or stop-limit) may turn out to be inefficient if the market conditions prevent their execution (for example, low liquidity).
          </p>
          <p>
            Strategies using combinations of positions (spread, straddle, etc.) may not be less risky than simple long or short positions.
          </p>
        </section>

        <section>
          <h2>2. Additional Risks Specific to Foreign Currency and Derivatives Transactions</h2>
          
          <h3>2.1 Contract Conditions</h3>
          <p>
            You must obtain from your broker detailed information regarding obligations, execution terms, and settlement conditions (e.g., option expiration and exercise limitations).
          </p>
          <p>
            Under certain circumstances, exchanges may change contract requirements to reflect market changes.
          </p>

          <h3>2.2 Suspension or Restriction of Trade</h3>
          <p>
            Market conditions (e.g., illiquidity) or exchange rules (e.g., price limits) may make executing transactions difficult or impossible. This may result in increased losses.
          </p>

          <h3>2.3 Deposited Funds and Property</h3>
          <p>
            You should familiarize yourself with protective instruments that apply to your deposited security (money or other assets). Recovery of funds depends on local legislation and the standards of the jurisdiction in which the counterparty operates.
          </p>

          <h3>2.4 Commission Fees and Charges</h3>
          <p>
            Before trading, you must clearly understand all commissions, fees, and charges. These will affect your net profit or loss.
          </p>

          <h3>2.5 Transactions in Other Jurisdictions</h3>
          <p>
            Trading in foreign markets may expose you to additional risks. Local regulators may not enforce foreign regulatory rules.
          </p>

          <h3>2.6 Currency Risks</h3>
          <p>
            Transactions denominated in a foreign currency are affected by exchange rate fluctuations.
          </p>

          <h3>2.7 Liquidity Risk</h3>
          <p>
            If assets cannot be traded when needed, you may face losses or inability to close/open positions. Margin requirements may force you to add funds immediately.
          </p>

          <h3>2.8 Stop-Loss Limits</h3>
          <p>
            Stop-loss orders may not always be effective due to gaps or rapid price movements.
          </p>

          <h3>2.9 Execution Risk</h3>
          <p>
            There may be a lag between order placement and execution. Prices may differ from expected, especially when trading while markets are closed.
          </p>

          <h3>2.10 Counterparty Risk</h3>
          <p>
            This is the risk that the counterparty issuing the CFD defaults. If funds are not segregated, you may not receive your money back.
          </p>

          <h3>2.11 Trading Systems</h3>
          <p>
            Electronic systems may fail. Recovery of losses depends on the liability limits of the system providers.
          </p>

          <h3>2.12 Electronic Trading</h3>
          <p>
            Electronic trading platforms have specific risks (system failure, order issues, margin requirement delays, etc.).
          </p>

          <h3>2.13 Over-the-Counter Operations</h3>
          <p>
            OTC operations may involve difficulty closing positions, estimating value, or determining fair pricing. Regulation may be weaker.
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

export default RiskDisclosurePage;
