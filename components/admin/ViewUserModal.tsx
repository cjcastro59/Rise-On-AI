"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { XIcon } from "../ui/icons/XIcon";

const supabase = createClient();

interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  email: string | null;
  role: string;
  age: number | null;
  gender: string | null;
  country: string | null;
  bio: string | null;
  created_at: string;
  is_active: boolean;
}

interface ViewUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export function ViewUserModal({ isOpen, onClose, userId }: ViewUserModalProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const fetchUser = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) throw error;
        setUser(data as User);
      } catch (error) {
        console.error("Error fetching user details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      ></div>
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl z-10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-dm-serif text-dark-text">
            User Details
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <XIcon className="w-5 h-5 text-dark-text/60" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue mx-auto mb-4"></div>
              <p className="text-dark-text/60 font-poppins">Loading user details...</p>
            </div>
          </div>
        ) : user ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-poppins text-dark-text/60 uppercase tracking-wider mb-1">
                  Full Name
                </p>
                <p className="text-sm font-poppins text-dark-text">
                  {user.first_name && user.last_name 
                    ? `${user.first_name} ${user.last_name}` 
                    : user.first_name || user.last_name || user.username || "Unknown"}
                </p>
              </div>
              <div>
                <p className="text-xs font-poppins text-dark-text/60 uppercase tracking-wider mb-1">
                  Username
                </p>
                <p className="text-sm font-poppins text-dark-text">
                  {user.username || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs font-poppins text-dark-text/60 uppercase tracking-wider mb-1">
                  Email
                </p>
                <p className="text-sm font-poppins text-dark-text">
                  {user.email || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs font-poppins text-dark-text/60 uppercase tracking-wider mb-1">
                  Role
                </p>
                <p className="text-sm font-poppins text-dark-text">
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </p>
              </div>
              <div>
                <p className="text-xs font-poppins text-dark-text/60 uppercase tracking-wider mb-1">
                  Age
                </p>
                <p className="text-sm font-poppins text-dark-text">
                  {user.age || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs font-poppins text-dark-text/60 uppercase tracking-wider mb-1">
                  Gender
                </p>
                <p className="text-sm font-poppins text-dark-text">
                  {user.gender || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs font-poppins text-dark-text/60 uppercase tracking-wider mb-1">
                  Country
                </p>
                <p className="text-sm font-poppins text-dark-text">
                  {user.country || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs font-poppins text-dark-text/60 uppercase tracking-wider mb-1">
                  Status
                </p>
                <p className="text-sm font-poppins">
                  {user.is_active !== false ? (
                    <span className="text-green-600">Active</span>
                  ) : (
                    <span className="text-gray-500">Deactivated</span>
                  )}
                </p>
              </div>
            </div>

            {user.bio && (
              <div>
                <p className="text-xs font-poppins text-dark-text/60 uppercase tracking-wider mb-1">
                  Bio
                </p>
                <p className="text-sm font-poppins text-dark-text">
                  {user.bio}
                </p>
              </div>
            )}

            <div>
              <p className="text-xs font-poppins text-dark-text/60 uppercase tracking-wider mb-1">
                Joined
              </p>
              <p className="text-sm font-poppins text-dark-text">
                {new Date(user.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric"
                })}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-dark-text/60 font-poppins">User not found</p>
          </div>
        )}

        <div className="flex justify-end mt-8">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-dark-text font-poppins text-sm rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
