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
      className={`px-5 py-2 rounded-full text-sm font-poppins font-medium
        transition-all duration-150
        flex items-center gap-2
        hover:scale-105 active:scale-95
        focus:outline-none focus:ring-2 focus:ring-primary-blue/40
        ${
          selected
            ? "bg-gradient-to-r from-primary-blue to-lavender text-white shadow-md scale-105"
            : "bg-light-gray text-dark-text hover:bg-primary-blue/20 hover:shadow-sm"
        }`}
    >
      {icon && <span className="text-lg">{icon}</span>}
      {mood}
    </button>
  );
}
