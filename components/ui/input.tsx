import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full px-4 py-3 border border-transparent bg-light-gray rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-blue focus:bg-white focus:border-primary-blue/30 font-poppins text-dark-text transition-all duration-150 placeholder:text-dark-text/40 ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
