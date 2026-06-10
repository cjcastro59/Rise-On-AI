import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: "light-gray" | "lavender" | "white";
}

export function Card({ children, className = "", variant = "light-gray" }: CardProps) {
  const bgClass = variant === "lavender" ? "bg-lavender/20" : variant === "white" ? "bg-white" : "bg-light-gray";
  return (
    <div
      className={`${bgClass} rounded-2xl border border-light-gray shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}