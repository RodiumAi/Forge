"use client";

import { LandingPricing } from "@/components/landing/LandingPricing";
import { HomeLayout } from "@/components/HomeLayout";

export default function DashboardPricingPage() {
  return (
    <HomeLayout activeNav={null}>
      <div className="home-pricing">
        <LandingPricing hideFree />
      </div>
    </HomeLayout>
  );
}
