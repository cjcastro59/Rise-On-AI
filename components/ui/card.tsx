import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: "light-gray" | "lavender" | "white";
  interactive?: boolean;
}

export function Card({ children, className = "", variant = "light-gray", interactive = false }: CardProps) {
  const bgClass = variant === "lavender" ? "bg-lavender/20" : variant === "white" ? "bg-white" : "bg-light-gray";
  const interactiveClass = interactive
    ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all duration-150"
    : "";
  return (
    <div
      className={`${bgClass} rounded-2xl border border-light-gray shadow-sm ${interactiveClass} ${className}`}
    >
      {children}
    </div>
  );
}