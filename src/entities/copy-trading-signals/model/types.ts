export interface CopySubscriptionItem {
  id: number;
  traderUserId: number;
  traderName: string;
  code: string;
  isActive: boolean;
  totalCopiedTrades: number;
  totalProfit: number;
  totalVolume: number;
  activeCopiedTrades: number;
  lastCopiedAt?: string | null;
}

export interface CopyTradingSignalsState {
  isMenuOpen: boolean; // Deprecated: use isTopPartnersMenuOpen and isSubscriptionsMenuOpen
  isTopPartnersMenuOpen: boolean;
  isSubscriptionsMenuOpen: boolean;
  subscriptions: CopySubscriptionItem[];
  isLoading: boolean;
  error: string | null;
  success: string | null;
}

