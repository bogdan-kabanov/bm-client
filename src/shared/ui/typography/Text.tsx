import { ComponentPropsWithoutRef, ElementType, ReactNode, forwardRef } from "react";
import classNames from "classnames";
import styles from "./Typography.module.css";

type TextSize = "xs" | "sm" | "md" | "lg" | "xl";
type TextWeight = "regular" | "medium" | "semibold" | "bold";
type TextTone = "default" | "muted" | "subtle" | "success" | "warning" | "danger";
type TextAlign = "left" | "center" | "right";

export type TextProps<T extends ElementType = "span"> = {
    as?: T;
    size?: TextSize;
    weight?: TextWeight;
    tone?: TextTone;
    align?: TextAlign;
    uppercase?: boolean;
    truncate?: boolean;
    className?: string;
    children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children">;

export const Text = forwardRef<HTMLElement, TextProps>((props, ref) => {
    const {
        as,
        size = "md",
        weight = "regular",
        tone = "default",
        align = "left",
        uppercase = false,
        truncate = false,
        className,
        children,
        ...rest
    } = props;

    const Component = (as ?? "span") as ElementType;

    return (
        <Component
            ref={ref as never}
            className={classNames(
                styles.text,
                styles[`text--size-${size}`],
                styles[`text--weight-${weight}`],
                styles[`text--align-${align}`],
                tone && styles[`text--tone-${tone}`],
                uppercase && styles["text--uppercase"],
                truncate && styles["text--truncate"],
                className
            )}
            {...rest}
        >
            {children}
        </Component>
    );
});

Text.displayName = "Text";

