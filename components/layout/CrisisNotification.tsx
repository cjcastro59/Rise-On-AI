"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { checkNegativeTrend } from "@/lib/sentiment";

export default function CrisisNotification() {
  const [showNotification, setShowNotification] = useState(false);
  const [isSevere, setIsSevere] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [trendData, setTrendData] = useState({ negativeCount: 0, totalCount: 0 });
  const { user } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    // Check if user has dismissed the notification in the last 24 hours
    const lastDismissed = localStorage.getItem("crisisNotificationDismissed");
    if (lastDismissed) {
      const lastDismissedDate = new Date(parseInt(lastDismissed));
      const hoursSinceDismissed =
        (Date.now() - lastDismissedDate.getTime()) / (1000 * 60 * 60);
      if (hoursSinceDismissed < 24) {
        setDismissed(true);
        return;
      }
    }

    const fetchAndCheck = async () => {
      if (!user) return;

      // Fetch the last 10 entries — include the ML-predicted sentiment column
      // so we never run keyword matching on raw text.
      const { data: entries } = await supabase
        .from("journal_entries")
        .select("content, mood, created_at, sentiment")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (entries) {
        // Severe = most-recent entry has ML-predicted distress sentiment
        const severe =
          entries.length > 0 &&
          (entries[0].sentiment as string | null) === "distress";

        // Trend = checkNegativeTrend reads the stored `sentiment` column
        const trend = checkNegativeTrend(entries, 0.5, 5, 10);
        setTrendData({ negativeCount: trend.negativeCount, totalCount: trend.totalCount });

        setIsSevere(severe);
        setShowNotification(severe || trend.hasNegativeTrend);
      }
    };

    fetchAndCheck();
  }, [user, supabase]);

  const handleDismiss = () => {
    setShowNotification(false);
    setDismissed(true);
    localStorage.setItem("crisisNotificationDismissed", Date.now().toString());
  };

  if (!showNotification || dismissed) return null;

  return (
    <Card className={`mb-6 p-6 border-2 ${
      isSevere
        ? "bg-gradient-to-r from-soft-red/20 to-soft-red/10 border-soft-red/50"
        : "bg-gradient-to-r from-soft-red/10 to-lavender/30 border-soft-red/30"
    }`}>
      <div className="flex items-start gap-4">
        <div className="text-3xl flex-shrink-0">{isSevere ? "🚨" : "💙"}</div>
        <div className="flex-1">
          <h3 className="text-lg font-dm-serif text-dark-text mb-2">
            {isSevere
              ? "We're concerned about what you're going through."
              : "We've noticed you've been feeling down lately."}
          </h3>
          <p className="text-sm font-inter text-dark-text/70 mb-4">
            {isSevere
              ? "Your safety is our top priority. Please reach out for help right away — you don't have to face this alone."
              : `${trendData.negativeCount} out of your last ${trendData.totalCount} entries have been challenging.
                You don't have to go through this alone — help is available.`}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/support">
              <Button className="bg-soft-red hover:bg-soft-red/90">
                Get Help Now
              </Button>
            </Link>
            {!isSevere && (
              <Button variant="secondary" onClick={handleDismiss}>
                Remind Me Later
              </Button>
            )}
          </div>
        </div>
        {!isSevere && (
          <button
            onClick={handleDismiss}
            className="text-dark-text/40 hover:text-dark-text text-lg"
            aria-label="Close notification"
          >
            ✕
          </button>
        )}
      </div>
    </Card>
  );
}
