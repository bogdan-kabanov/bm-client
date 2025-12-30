import { useCallback, useMemo } from "react";
import { useAppSelector } from "@src/shared/lib/hooks";
import {
    selectTransactions,
    selectTransactionsError,
    selectTransactionsLoading
} from "@src/entities/transactions/model/selectors";
import { tradingStore } from "@src/entities/trading/model/trading-store";
import { useLanguage } from "@src/app/providers/useLanguage";
import './TradingTransactions.css';

export function TradingTransactions() {
    const { t } = useLanguage();
    const transactions = useAppSelector(selectTransactions);
    const transactionsLoading = useAppSelector(selectTransactionsLoading);
    const transactionsError = useAppSelector(selectTransactionsError);
    const store = tradingStore;

    const formatNumber = useCallback((num: number | string) => {
        try {
            const numberValue = typeof num === 'string' ? parseFloat(num) : num;
            if (isNaN(numberValue)) return '0.00';
            return numberValue.toFixed(2);
        } catch (error) {
            return '0.00';
        }
    }, []);

    const formatDate = useCallback((dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            dateStyle: 'short',
            timeStyle: 'short'
        });
    }, []);

    const formatCurrencyPair = useCallback((currencyPair: string) => {
        const [firstCurrency] = currencyPair.split('_');
        return `${firstCurrency}_${firstCurrency}`;
    }, []);

    const renderTransactions = useMemo(() => {
        if (transactionsLoading) {
            return (
                <div className="loading-transactions">
                    <div className="loading-spinner"></div>
                    <p>{t('trading.loadingTransactions')}</p>
                </div>
            );
        }
        if (transactionsError) {
            return (
                <div className="transactions-error">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 8V12M12 16H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
                              stroke="#ff006e" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <p>{transactionsError}</p>
                </div>
            );
        }
        if (transactions.length > 0) {
            return transactions.slice(0, 5).map((transaction) => (
                <div
                    key={transaction.id}
                    className={`transaction-card ${transaction.type.toLowerCase()} ${store.isNewTransaction(transaction.id) ? 'new-transaction' : ''}`}
                >
                    <div className="transaction-icon">
                        {transaction.type === "REPLENISHMENT" ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M12 22V2M12 2L16 6M12 2L8 6"
                                      stroke="#37a1ff" strokeWidth="2"
                                      strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2V22M12 22L16 18M12 22L8 18"
                                      stroke="#ff006e" strokeWidth="2"
                                      strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}
                    </div>
                    <div className="transaction-details">
                        <div className="transaction-pair">{formatCurrencyPair(transaction.currency_pair)}</div>
                        <div className="transaction-date">{formatDate(transaction.createdAt)}</div>
                    </div>
                    <div className={`transaction-amount ${transaction.type.toLowerCase()}`}>
                        {transaction.type === "REPLENISHMENT" ? "+" : ""}
                        {formatNumber(transaction.amount)} USDT
                    </div>
                </div>
            ));
        }
        return (
            <div className="empty-transactions">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <path d="M16 8V5L19 2L20 4L22 5L19 8H16ZM16 8L12 11.5M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
                          stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"
                          strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p>{t('trading.noTransactions')}</p>
            </div>
        );
    }, [transactions, transactionsLoading, transactionsError, store, formatDate, formatNumber, formatCurrencyPair, t]);

    return (
        <div className="trading-transactions">
            <h3 className="panel-title">Trading History</h3>
            <div className="transactions-list">
                {renderTransactions}
            </div>
        </div>
    );
}