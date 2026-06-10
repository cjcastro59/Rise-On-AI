import { Card } from "../ui/card";

interface JournalCardProps {
  date: string;
  excerpt: string;
  mood: string;
}

export function JournalCard({ date, excerpt, mood }: JournalCardProps) {
  return (
    <Card className="p-6">
      <div className="flex justify-between items-start mb-2">
        <p className="text-sm text-gray-500">{date}</p>
        <span className="px-2 py-1 bg-gray-100 rounded-full text-xs">{mood}</span>
      </div>
      <p className="text-gray-700">{excerpt}</p>
    </Card>
  );
}
