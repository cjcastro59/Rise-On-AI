import { isMaintenanceModeActive } from "@/lib/maintenance";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Redirect to maintenance page if active — auth pages are still accessible
  // during maintenance only for owners who need to log in.
  // Owners bypass maintenance in their respective protected layouts.
  if (await isMaintenanceModeActive()) {
    redirect("/maintenance");
  }

  return <>{children}</>;
}
