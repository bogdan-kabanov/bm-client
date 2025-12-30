import { apiClient } from '../client';

export const depositApi = {
  submitTransaction: (transactionHash: string, walletType: string, amount: number, promocode?: string | null) => 
    apiClient<{ 
      success: boolean; 
      data: any; 
      message: string;
    }>('/deposits', {
      method: 'POST',
      body: {
        transaction_hash: transactionHash,
        wallet_type: walletType,
        amount: amount,
        ...(promocode && { promocode })
      }
    }),

  getUserDeposits: () => 
    apiClient<any[]>('/deposits/user'),

  getDepositById: (id: number) => 
    apiClient<any>(`/deposits/${id}`),
};
