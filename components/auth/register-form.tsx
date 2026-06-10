"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RegisterForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [country, setCountry] = useState("");
  const [contentBaseline, setContentBaseline] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const { data: authData, error: authError } =
        await supabase.auth.signUp({
          email,
          password,
        });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (authData.user) {
        const { error: profileError } = await (supabase
          .from("user_profiles") as any)
          .insert({
            id: authData.user.id,
            full_name: `${firstName} ${lastName}`,
            email: email,
            role: "user",
          });

        if (profileError) {
          setError(profileError.message);
          return;
        }

        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleRegister} className="space-y-4 w-full">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            placeholder="First Name"
          />
        </div>
        <div>
          <Input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            placeholder="Last Name"
          />
        </div>
      </div>

      <div>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="Email Address"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            required
            placeholder="Age"
          />
        </div>
        <div>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full px-4 py-3 bg-light-gray border border-transparent rounded-lg text-sm font-poppins text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue"
          >
            <option value="">Gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full px-4 py-3 bg-light-gray border border-transparent rounded-lg text-sm font-poppins text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue"
          >
            <option value="">Country</option>
            <option value="philippines">Philippines</option>
            <option value="usa">USA</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <select
            value={contentBaseline}
            onChange={(e) => setContentBaseline(e.target.value)}
            className="w-full px-4 py-3 bg-light-gray border border-transparent rounded-lg text-sm font-poppins text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-blue"
          >
            <option value="">Current Mood Baseline</option>
            <option value="happy">Happy</option>
            <option value="calm">Calm</option>
            <option value="anxious">Anxious</option>
            <option value="sad">Sad</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Password"
            minLength={6}
          />
        </div>
        <div>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="Confirm Password"
            minLength={6}
          />
        </div>
      </div>

      <div className="flex items-start gap-2">
        <input type="checkbox" className="mt-1 accent-primary-blue" required />
        <p className="text-xs font-inter text-dark-text/70">
          I agree to the Privacy Policy. My mental health data is encrypted and never shared without consent.
        </p>
      </div>

      {error && (
        <div className="text-error-red text-xs bg-error-red/10 p-3 rounded-lg font-poppins">
          {error}
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full mt-2">
        {loading ? "Creating account..." : "Log In →"}
      </Button>
    </form>
  );
}