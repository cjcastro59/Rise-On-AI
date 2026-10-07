import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const baseClasses =
                                                                                 "font-poppins font-medium rounded-full transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-blue/40";
    const variantClasses =
      variant === "primary"
        ? "bg-gradient-to-r from-primary-blue to-lavender text-white hover:opacity-90 hover:shadow-md"
        : variant === "ghost"
          ? "bg-transparent text-dark-text hover:bg-gray-100"
          : "bg-light-gray text-dark-text hover:bg-gray-200 hover:shadow-sm";
    const sizeClasses =
      size === "sm"
        ? "px-4 py-1.5 text-sm"
        : size === "lg"
          ? "px-8 py-3 text-base"
          : "px-6 py-2 text-sm";

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
