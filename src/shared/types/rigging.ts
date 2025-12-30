export interface RiggingPlanStep {
  time: number;
  price: number;
}

export interface RiggingPlanPayload {
  startTime: number;
  endTime: number;
  steps: RiggingPlanStep[];
  outcome: 'win' | 'lose';
  targetPrice: number;
}

export interface RiggingPayload {
  outcome: 'win' | 'lose';
  targetPrice: number;
  plan: RiggingPlanPayload;
  actualMarketPrice?: number | null;
}

export type RiggingStatus = 'forward' | 'reverting' | 'done';

export interface RiggingState {
  tradeId: string;
  plan: RiggingPlanPayload;
  status: RiggingStatus;
  lastPrice: number;
  actualMarketPrice?: number | null;
  revertPlan?: RiggingPlanPayload;
  lastAnimatedPrice?: number | null;
}

