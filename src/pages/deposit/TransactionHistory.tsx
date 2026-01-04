import { useEffect, useState, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@src/shared/lib/hooks";
import { selectWithdrawalHistory, selectWithdrawalLoading } from "@src/entities/withdrawal/model/selectors";
import { fetchWithdrawalHistory } from "@src/entities/withdrawal/model/slice";
import { depositApi } from "@src/shared/api";
import { useLanguage } from "@src/app/providers/useLanguage";
import usdt from "@src/assets/currency/USDT.png";
import btc from "@src/assets/currency/BTC.png";
import ltc from "@src/assets/currency/LTC.png";
import eth from "@src/assets/currency/ETH.png";

interface Deposit {
    id: number;
    amount: number;
    wallet_type: string;
    status: string;
    createdAt: string;
    updatedAt?: string;
    transaction_hash?: string | null;
}

interface Withdrawal {
    id: number;
    amount: number;
    wallet_type: string;
    status: string;
    createdAt: string;
    updatedAt?: string;
    transaction_hash?: string | null;
}

type TransactionType = 'deposit' | 'withdrawal';

interface Transaction {
    id: number;
    amount: number;
    wallet_type: string;
    status: string;
    createdAt: string;
    type: TransactionType;
    transaction_hash?: string | null;
}

const currencyIcons: Record<string, JSX.Element> = {
    usdt: <img src={usdt} alt="usdt" width={20} height={20} />,
    btc: <img src={btc} alt="btc" width={20} height={20} />,
    eth: <img src={eth} alt="eth" width={20} height={20} />,
    ltc: <img src={ltc} alt="ltc" width={20} height={20} />,
};

export function TransactionHistory() {
    const { t } = useLanguage();
    const dispatch = useAppDispatch();
    const withdrawalHistory = useAppSelector(selectWithdrawalHistory);
    const withdrawalLoading = useAppSelector(selectWithdrawalLoading);
    
    const [deposits, setDeposits] = useState<Deposit[]>([]);
    const [depositsLoading, setDepositsLoading] = useState(false);
    const [depositsError, setDepositsError] = useState<string | null>(null);
    
    // Фильтры
    const [typeFilter, setTypeFilter] = useState<'all' | 'deposit' | 'withdrawal'>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    useEffect(() => {
        dispatch(fetchWithdrawalHistory());
    }, [dispatch]);

    useEffect(() => {
        const loadDeposits = async () => {
            setDepositsLoading(true);
            setDepositsError(null);
            
            try {
                const depositsData = await depositApi.getUserDeposits();
                setDeposits(depositsData || []);
            } catch (error) {
                if (error instanceof Error) {
                    setDepositsError(error.message);
                } else {
                    setDepositsError(t('deposit.loadingDepositsError', { defaultValue: 'Failed to load deposits' }));
                }
            } finally {
                setDepositsLoading(false);
            }
        };

        loadDeposits();
    }, [t]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${month}/${day}/${year} ${hours}:${minutes}`;
    };

    const getStatusText = (status: string, type: TransactionType) => {
        if (type === 'deposit') {
            switch (status) {
                case 'pending': return t('deposit.statusPending', { defaultValue: 'Pending' });
                case 'completed': return t('deposit.statusCompleted', { defaultValue: 'Completed' });
                case 'rejected': return t('deposit.statusRejected', { defaultValue: 'Rejected' });
                default: return status;
            }
        } else {
            switch (status) {
                case 'completed': return t('withdrawal.statusCompleted', { defaultValue: 'Completed' });
                case 'pending_fee': return t('withdrawal.statusPendingFee', { defaultValue: 'Pending Fee' });
                case 'pending': return t('withdrawal.statusPending', { defaultValue: 'Pending' });
                case 'processing': return t('withdrawal.statusProcessing', { defaultValue: 'Processing' });
                case 'rejected': return t('withdrawal.statusRejected', { defaultValue: 'Rejected' });
                case 'failed': return t('withdrawal.statusFailed', { defaultValue: 'Failed' });
                case 'cancelled': return t('withdrawal.statusCancelled', { defaultValue: 'Cancelled' });
                default: return status;
            }
        }
    };

    const allTransactions = useMemo<Transaction[]>(() => {
        const depositTransactions: Transaction[] = deposits.map(deposit => ({
            id: deposit.id,
            amount: deposit.amount,
            wallet_type: deposit.wallet_type,
            status: deposit.status,
            createdAt: deposit.createdAt,
            type: 'deposit' as TransactionType,
            transaction_hash: deposit.transaction_hash,
        }));

        const withdrawalTransactions: Transaction[] = withdrawalHistory.map(withdrawal => ({
            id: withdrawal.id,
            amount: withdrawal.amount,
            wallet_type: withdrawal.wallet_type,
            status: withdrawal.status,
            createdAt: withdrawal.createdAt,
            type: 'withdrawal' as TransactionType,
            transaction_hash: withdrawal.transaction_hash,
        }));

        const combined = [...depositTransactions, ...withdrawalTransactions];
        
        return combined.sort((a, b) => {
            const date_a = new Date(a.createdAt).getTime();
            const date_b = new Date(b.createdAt).getTime();
            return date_b - date_a;
        });
    }, [deposits, withdrawalHistory]);

    // Применяем фильтры
    const filteredTransactions = useMemo<Transaction[]>(() => {
        let filtered = allTransactions;

        // Фильтр по типу
        if (typeFilter !== 'all') {
            filtered = filtered.filter(t => t.type === typeFilter);
        }

        // Фильтр по статусу
        if (statusFilter !== 'all') {
            filtered = filtered.filter(t => t.status === statusFilter);
        }

        return filtered;
    }, [allTransactions, typeFilter, statusFilter]);

    // Получаем уникальные статусы для фильтра
    const availableStatuses = useMemo(() => {
        const statuses = new Set<string>();
        allTransactions.forEach(t => statuses.add(t.status));
        return Array.from(statuses).sort();
    }, [allTransactions]);

    const loading = depositsLoading || withdrawalLoading;

    if (loading && allTransactions.length === 0) {
        return (
            <div className="deposit-empty-state">
                <div className="loading-spinner"></div>
                <p>{t('deposit.loadingDeposits', { defaultValue: 'Loading transactions...' })}</p>
            </div>
        );
    }

    if (allTransactions.length === 0) {
        return (
            <div className="deposit-empty-state">
                <div className="deposit-empty-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                        <path d="M7 18L17 8M17 8H7M17 8V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
                <h3>{t('payments.noHistory', { defaultValue: 'No transactions yet' })}</h3>
                <p>{t('payments.noHistorySubtext', { defaultValue: 'All your deposits and withdrawals will be here' })}</p>
            </div>
        );
    }

    return (
        <div className="user-deposits-section">
            <div className="deposits-header">
                <h3 className="section-title">{t('payments.paymentsHistory', { defaultValue: 'Payments History' })}</h3>
            </div>

            {depositsError && (
                <div className="deposits-error" style={{ marginBottom: '16px', padding: '12px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '8px', color: '#856404' }}>
                    ⚠️ {t('deposit.loadingDepositsError', { defaultValue: 'Error loading deposits' })}: {depositsError}
                </div>
            )}

            {/* Фильтры */}
            <div className="history-filters">
                <div className="history-filter-tabs">
                    <button
                        className={`history-filter-tab ${typeFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setTypeFilter('all')}
                    >
                        {t('payments.filterAll', { defaultValue: 'All' })}
                    </button>
                    <button
                        className={`history-filter-tab ${typeFilter === 'deposit' ? 'active' : ''}`}
                        onClick={() => setTypeFilter('deposit')}
                    >
                        {t('deposit.typeDeposit', { defaultValue: 'Deposits' })}
                    </button>
                    <button
                        className={`history-filter-tab ${typeFilter === 'withdrawal' ? 'active' : ''}`}
                        onClick={() => setTypeFilter('withdrawal')}
                    >
                        {t('withdrawal.typeWithdrawal', { defaultValue: 'Withdrawals' })}
                    </button>
                </div>
                
                <select
                    className="date-input"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ minWidth: '150px' }}
                >
                    <option value="all">{t('payments.filterAllStatuses', { defaultValue: 'All Statuses' })}</option>
                    {availableStatuses.map(status => {
                        // Находим первую транзакцию с этим статусом для определения типа
                        const sampleTransaction = allTransactions.find(t => t.status === status);
                        const transactionType = sampleTransaction?.type || 'deposit';
                        return (
                            <option key={status} value={status}>
                                {getStatusText(status, transactionType)}
                            </option>
                        );
                    })}
                </select>
            </div>

            {filteredTransactions.length === 0 ? (
                <div className="deposit-empty-state" style={{ marginTop: '20px' }}>
                    <p>{t('payments.noFilteredTransactions', { defaultValue: 'No transactions match the selected filters' })}</p>
                </div>
            ) : (
                <div className="deposits-history-table">
                    <div className="table-header">
                        <div className="table-cell">ID</div>
                        <div className="table-cell">{t('withdrawal.date', { defaultValue: 'Date' })}</div>
                        <div className="table-cell">{t('withdrawal.amount', { defaultValue: 'Amount' })}</div>
                        <div className="table-cell">{t('withdrawal.method', { defaultValue: 'Method' })}</div>
                        <div className="table-cell">{t('withdrawal.type', { defaultValue: 'Type' })}</div>
                        <div className="table-cell">{t('withdrawal.status', { defaultValue: 'Status' })}</div>
                        <div className="table-cell">{t('withdrawal.bonusAmount', { defaultValue: 'Bonus amount' })}</div>
                    </div>
                    {filteredTransactions.map((transaction) => {
                    const currencyIcon = currencyIcons[transaction.wallet_type.toLowerCase()];
                    const typeText = transaction.type === 'deposit' 
                        ? t('deposit.typeDeposit', { defaultValue: 'Deposit' })
                        : t('withdrawal.typeWithdrawal', { defaultValue: 'Withdrawal' });
                    
                    return (
                        <div key={`${transaction.type}-${transaction.id}`} className="table-row">
                            <div className="table-cell id-cell">{transaction.id}</div>
                            <div className="table-cell date-cell">{formatDate(transaction.createdAt)}</div>
                            <div className="table-cell amount-cell">
                                ${transaction.amount}
                            </div>
                            <div className="table-cell method-cell">
                                <span className="method-badge">
                                    {currencyIcon}
                                    <span>{transaction.wallet_type?.toUpperCase() || transaction.wallet_type}</span>
                                </span>
                            </div>
                            <div className="table-cell type-cell">{typeText}</div>
                            <div className="table-cell status-cell">
                                <span className={`status-badge status-${transaction.status}`}>
                                    {getStatusText(transaction.status, transaction.type)}
                                </span>
                            </div>
                            <div className="table-cell bonus-cell">
                                {transaction.type === 'withdrawal' ? '—' : '$0'}
                            </div>
                        </div>
                    );
                })}
                </div>
            )}
        </div>
    );
}

