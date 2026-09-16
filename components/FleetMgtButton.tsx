"use client";

import PremiumRedirect from "@/components/PremiumRedirect";

export default function FleetMgtButton() {
  return (
    <PremiumRedirect
      tileClass="dash-fleet"
      icon="🗺️"
      label="FLEET MGT"
      sub="Live tracking &amp; fleet management portal"
      url="https://track-client-nu.vercel.app/login"
      loaderTitle="Fleet Management"
      loaderIcon="🗺️"
    />
  );
}