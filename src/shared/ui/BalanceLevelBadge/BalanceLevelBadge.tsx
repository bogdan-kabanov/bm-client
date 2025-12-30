import classNames from "classnames";
import "./BalanceLevelBadge.css";

interface BalanceLevelBadgeProps {
  amount: number;
  className?: string;
}

type LevelVariant = "green" | "yellow" | "purple" | "red";

interface LevelInfo {
  label: string;
  variant: LevelVariant;
}

export const getLevelInfo = (amount: number): LevelInfo => {
  if (amount >= 2500) {
    return { label: "VIP trader", variant: "red" };
  }

  if (amount >= 500) {
    return { label: "Trader", variant: "yellow" };
  }

  if (amount >= 200) {
    return { label: "Experienced", variant: "purple" };
  }

  if (amount >= 50) {
    return { label: "Beginner", variant: "yellow" };
  }

  return { label: "Newbie", variant: "green" };
};

export const BalanceLevelBadge = ({ amount, className }: BalanceLevelBadgeProps) => {
  const levelInfo = getLevelInfo(amount);

  return (
    <div className={classNames("balance-level", `balance-level--${levelInfo.variant}`, className)}>
      <span className="balance-level__icon" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M13 2L4 14H11L10 22L19 10H12L13 2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="balance-level__label">{levelInfo.label}</span>
    </div>
  );
};

