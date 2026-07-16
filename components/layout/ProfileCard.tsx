"use client";

import Image from "next/image";
import Link from "next/link";

interface ProfileCardProps {
  href: string;
  avatarUrl?: string | null;
  name: string;
  role: string;
}

export default function ProfileCard({ href, avatarUrl, name, role }: ProfileCardProps) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Link
      href={href}
      className="group block p-4 bg-white/5 rounded-xl border border-white/10 mb-3 transition-all duration-200 hover:bg-white/10 hover:shadow-md cursor-pointer"
    >
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <Image src={avatarUrl} alt="Profile" width={40} height={40} className="rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 shrink-0 bg-gradient-to-r from-[#A8DADC] to-[#CDB4DB] rounded-full flex items-center justify-center text-[#1E293B] font-bold font-poppins text-sm">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-poppins text-white leading-tight truncate">{name}</p>
          <p className="text-[11px] text-white/50 font-poppins leading-snug">{role}</p>
          <p className="text-[11px] text-[#A8DADC] font-poppins underline leading-snug mt-0.5">Edit Profile</p>
        </div>
        <span className="shrink-0 text-white/50 text-sm transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white">
          →
        </span>
      </div>
    </Link>
  );
}
