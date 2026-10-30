"use client";

import { useState } from "react";
import { Portal } from "@/components/ui/Portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userId: string) => void;
}

export default function AddStudentModal({ isOpen, onClose, onSuccess }: AddStudentModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ emailSent: boolean; warning?: string; tempPassword?: string } | null>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setFirstName(""); setLastName(""); setEmail("");
    setError(null); setResult(null);
  };

  const handleClose = () => { handleReset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null); setResult(null);
    try {
      const response = await fetch("/api/admin/create-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create account.");
      setResult({ emailSent: data.emailSent, warning: data.warning, tempPassword: data.tempPassword });
      onSuccess(data.userId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-dm-serif text-dark-text">Add Student Account</h2>
              <p className="text-xs text-slate-600 font-inter mt-0.5">Create account and send credentials via email</p>
            </div>
            <button onClick={handleClose} className="text-slate-600 hover:text-dark-text text-2xl leading-none">×</button>
          </div>
          <div className="p-6">
            {result ? (
              <div className="space-y-4">
                <div className={`rounded-xl p-4 border ${result.emailSent ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                  <p className={`text-sm font-semibold font-poppins ${result.emailSent ? "text-green-800" : "text-amber-800"}`}>
                    {result.emailSent ? "✅ Account created and email sent!" : "⚠️ Account created — email not sent"}
                  </p>
                  <p className={`text-xs font-inter mt-1 ${result.emailSent ? "text-green-700" : "text-amber-700"}`}>
                    {result.emailSent ? `Login credentials have been sent to ${email}.` : result.warning}
                  </p>
                </div>
                {!result.emailSent && result.tempPassword && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs font-poppins text-slate-600 uppercase tracking-wider mb-2">Temporary Password</p>
                    <p className="text-lg font-mono font-bold text-dark-text tracking-widest">{result.tempPassword}</p>
                    <p className="text-xs text-slate-500 font-inter mt-1">Share this with the student securely.</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={handleReset} className="flex-1">Add Another</Button>
                  <Button onClick={handleClose} className="flex-1">Done</Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-poppins text-slate-600 mb-1 block">First Name *</label>
                    <Input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Maria" required />
                  </div>
                  <div>
                    <label className="text-xs font-poppins text-slate-600 mb-1 block">Last Name</label>
                    <Input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="e.g. Santos" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-poppins text-slate-600 mb-1 block">Email Address *</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@plpasig.edu.ph" required />
                  <p className="text-xs text-slate-500 font-inter mt-1">Login credentials will be sent to this email.</p>
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-xs text-red-700 font-inter">{error}</p>
                  </div>
                )}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <p className="text-xs text-blue-700 font-inter leading-relaxed">
                    🔐 A secure temporary password will be auto-generated and emailed to the student. They should change it after first login via Settings → Security.
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">Cancel</Button>
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? "Creating Account..." : "Create & Send Email"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
