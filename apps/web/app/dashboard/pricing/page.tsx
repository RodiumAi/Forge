import { redirect } from "next/navigation";

/** The upgrade page moved to the billing page's plan cards. */
export default function DashboardPricingPage() {
  redirect("/billing#plans");
}
