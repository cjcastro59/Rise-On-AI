import { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

// Matches the Counselor/Admin page header exactly: white rounded card,
// same radius, shadow, padding, and typography. Used to give Member pages
// the same header treatment instead of showing titles on the raw gradient.
export default function PageHeader({ title, subtitle, actions, className = "" }: PageHeaderProps) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm border border-gray-100 mb-8 ${className}`}>
      <div>
        <h1 className="text-2xl font-dm-serif text-dark-text mb-1">{title}</h1>
        {subtitle && <p className="text-sm text-dark-text/70 font-poppins">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
