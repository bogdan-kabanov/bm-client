import { RootState } from "@src/app/store";

export const selectReferrals = (state: RootState) => state.referrals.referrals;
export const selectReferralStats = (state: RootState) => state.referrals.stats;
export const selectReferralsLoading = (state: RootState) => state.referrals.loading;
export const selectReferralsError = (state: RootState) => state.referrals.error;
export const selectRefBalance = (state: RootState) => state.referrals.stats?.ref_balance || "0";
export const selectRefCount = (state: RootState) => state.referrals.stats?.ref_count || 0;
export const selectTotalRefEarnings = (state: RootState) => state.referrals.stats?.total_ref_earnings || "0";