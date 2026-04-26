import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "default" | "primary" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

export default function Button({ variant = "default", className = "", children, ...rest }: Props) {
  const variantClass =
    variant === "primary" ? "btn-old btn-old-primary" : variant === "ghost" ? "btn-old btn-old-ghost" : "btn-old";
  return (
    <button className={`${variantClass} ${className}`} {...rest}>
      {children}
    </button>
  );
}
