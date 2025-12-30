export interface CopyTradingTopTrader {
  traderUserId: number;
  traderName: string;
  code: string;
  isProfileActive: boolean;
  subscribersCount: number;
  activeSubscribers: number;
  totalProfit: number;
  totalVolume: number;
  totalTrades: number;
  lastCopiedAt: string | null;
  avatarUrl?: string | null;
  email?: string | null;
}
