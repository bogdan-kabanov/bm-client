import { NewWithdrawalContent } from "./NewWithdrawalContent";

interface WithdrawalContentProps {
    showLanguageDropdown?: boolean;
}

export function WithdrawalContent({ showLanguageDropdown = true }: WithdrawalContentProps) {
    return <NewWithdrawalContent />;
}