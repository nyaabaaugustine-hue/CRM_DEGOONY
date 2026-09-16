"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  url: string;
  icon: string;
  label: string;
  sub: string;
  tileClass: string;
  overlayClass?: string;
  loaderTitle: string;
  loaderIcon?: string;
};

export default function PremiumRedirect({
  url,
  icon,
  label,
  sub,
  tileClass,
  overlayClass = "",
  loaderTitle,
  loaderIcon,
}: Props) {
  const [stage, setStage] = useState<"idle" | "loading" | "leaving">("idle");
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const open = () => {
    if (stage !== "idle") return;
    setStage("loading");
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    timerRef.current = window.setTimeout(() => {
      setStage("leaving");
      setVisible(false);
      timerRef.current = window.setTimeout(() => {
        window.location.href = url;
      }, 340);
    }, 1150);
  };

  return (
    <>
      <button
        type="button"
        className={`dash-tile ${tileClass}`}
        onClick={open}
        disabled={stage !== "idle"}
      >
        <span className="dash-icon">{icon}</span>
        <span className="dash-text">
          <span className="dash-label">{label}</span>
          <span className="dash-sub">{sub}</span>
        </span>
      </button>

      {stage !== "idle" && (
        <div className={`fleet-overlay ${overlayClass} ${visible ? "enter" : ""}`}>
          <div className="fleet-loader">
            <div className="fleet-emblem">
              <span className="fleet-ring" />
              <span className="fleet-emblem-icon">{loaderIcon || icon}</span>
            </div>
            <div className="fleet-bar-wrap">
              <div className="fleet-bar" />
            </div>
            <div className="fleet-text">
              <div className="fleet-title">{loaderTitle}</div>
              <div className="fleet-status">
                Connecting to secure portal<span className="fleet-dots">…</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}