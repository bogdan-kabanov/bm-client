import { ComponentPropsWithoutRef, ElementType, ReactNode, forwardRef } from "react";
import classNames from "classnames";
import styles from "./Typography.module.css";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingWeight = "regular" | "medium" | "semibold" | "bold";
type HeadingTone = "default" | "muted" | "subtle";
type HeadingAlign = "left" | "center" | "right";

export type HeadingProps<T extends ElementType = "h2"> = {
    as?: T;
    level?: HeadingLevel;
    weight?: HeadingWeight;
    tone?: HeadingTone;
    align?: HeadingAlign;
    uppercase?: boolean;
    children: ReactNode;
    className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children">;

export const Heading = forwardRef<HTMLElement, HeadingProps>((props, ref) => {
    const {
        as,
        level = 2,
        weight = "semibold",
        tone = "default",
        align = "left",
        uppercase = false,
        className,
        children,
        ...rest
    } = props;

    const Component = (as ?? (`h${level}` as ElementType)) as ElementType;

    return (
        <Component
            ref={ref as never}
            className={classNames(
                styles.heading,
                styles[`heading--${level}`],
                styles[`heading--weight-${weight}`],
                styles[`heading--align-${align}`],
                tone !== "default" && styles[`heading--tone-${tone}`],
                uppercase && styles["heading--uppercase"],
                className
            )}
            {...rest}
        >
            {children}
        </Component>
    );
});

Heading.displayName = "Heading";

