"use client";

interface MoodCardProps {
  mood: string;
  icon?: string;
  selected?: boolean;
  onClick?: () => void;
}

export function MoodCard({ mood, icon, selected, onClick }: MoodCardProps) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2 rounded-full text-sm font-poppins font-medium transition-all flex items-center gap-2 ${
        selected
          ? "bg-gradient-to-r from-primary-blue to-lavender text-white shadow-sm"
          : "bg-light-gray text-dark-text hover:bg-primary-blue/20"
      }`}
    >
      {icon && <span className="text-lg">{icon}</span>}
      {mood}
    </button>
  );
}
