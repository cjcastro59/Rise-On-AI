import Link from "next/link";
import { Card } from "../ui/card";

interface InsightCardProps {
  title: string;
  content: string;
  icon?: string;
}

export function InsightCard({ title, content, icon }: InsightCardProps) {
  return (
    <Card className="p-6 bg-white">
      <div className="flex items-start gap-4">
        {icon && <div className="w-12 h-12 bg-warning-yellow/30 rounded-xl flex items-center justify-center text-2xl">{icon}</div>}
        <div>
          <h3 className="font-poppins font-semibold text-dark-text mb-2">{title}</h3>
          <p className="font-inter text-dark-text/70 text-sm mb-4">{content}</p>
          <Link href="/insights" className="text-xs font-poppins font-semibold text-primary-blue hover:text-lavender">
            View Full Report →
          </Link>
        </div>
      </div>
    </Card>
  );
}
