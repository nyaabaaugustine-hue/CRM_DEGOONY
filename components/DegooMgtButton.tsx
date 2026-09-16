"use client";

import PremiumRedirect from "@/components/PremiumRedirect";

export default function DegooMgtButton() {
  return (
    <PremiumRedirect
      tileClass="dash-degoony"
      icon="💼"
      label="DEGOONY CLIENT MGT"
      sub="Degoony client management admin portal"
      url="https://php-nyaabaaugustine-hue.wasmer.app/admin/"
      overlayClass="overlay-degoony"
      loaderTitle="DEGOONY Client Management"
      loaderIcon="💼"
    />
  );
}