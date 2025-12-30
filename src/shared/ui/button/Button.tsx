import {
    AnchorHTMLAttributes,
    ButtonHTMLAttributes,
    ReactNode,
    forwardRef,
    Ref,
} from "react";
import classNames from "classnames";
import styles from "./Button.module.css";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "link";
type ButtonSize = "sm" | "md" | "lg" | "auto";

type BaseProps = {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    className?: string;
};

type ButtonAsButton = BaseProps & {
    as?: "button";
} & ButtonHTMLAttributes<HTMLButtonElement>;

type ButtonAsAnchor = BaseProps & {
    as: "a";
} & AnchorHTMLAttributes<HTMLAnchorElement>;

type ButtonProps = ButtonAsButton | ButtonAsAnchor;

const isAnchor = (props: ButtonProps): props is ButtonAsAnchor => props.as === "a";

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>((props, ref) => {
    const {
        as = "button",
        variant = "primary",
        size = "md",
        fullWidth = false,
        leftIcon,
        rightIcon,
        className,
        children,
        ...rest
    } = props;

    const classes = classNames(
        styles.button,
        styles[`button--variant-${variant}`],
        styles[`button--size-${size}`],
        {
            [styles["button--fullWidth"]]: fullWidth,
            [styles["button--link"]]: variant === "link",
        },
        className
    );

    if (isAnchor(props)) {
        return (
            <a ref={ref as Ref<HTMLAnchorElement>} className={classes} {...rest}>
                {leftIcon && <span className={styles.button__icon}>{leftIcon}</span>}
                {children}
                {rightIcon && <span className={styles.button__icon}>{rightIcon}</span>}
            </a>
        );
    }

    return (
        <button ref={ref as Ref<HTMLButtonElement>} className={classes} {...rest}>
            {leftIcon && <span className={styles.button__icon}>{leftIcon}</span>}
            {children}
            {rightIcon && <span className={styles.button__icon}>{rightIcon}</span>}
        </button>
    );
});

Button.displayName = "Button";

export type { ButtonProps };

