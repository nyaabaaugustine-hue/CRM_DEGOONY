import Link from "next/link";
import Outbox from "@/components/Outbox";
import FleetMgtButton from "@/components/FleetMgtButton";
import DegooMgtButton from "@/components/DegooMgtButton";
import SubmissionsSummary from "@/components/SubmissionsSummary";

export default function Home() {
  return (
    <>
      <header className="top home-top">
        <div className="brand">
          <h1>Evergreen Logistics</h1>
          <span>Daily Vehicle Readiness</span>
        </div>
      </header>
      <main className="home">
        <SubmissionsSummary />
        <Outbox />
        <div className="dash-grid">
          <Link href="/inspect" className="dash-tile dash-inspect dash-hero">
            <span className="dash-icon">🛡️</span>
            <span className="dash-text">
              <span className="dash-label">INSPECTION</span>
              <span className="dash-sub">Pre &amp; post vehicle checks</span>
            </span>
          </Link>
          <Link href="/driver" className="dash-tile dash-driver">
            <span className="dash-icon">🚚</span>
            <span className="dash-text">
              <span className="dash-label">DRIVER REGISTRATION</span>
              <span className="dash-sub">Job application &amp; interview form</span>
            </span>
          </Link>
          <Link href="/vehicle-client" className="dash-tile dash-client">
            <span className="dash-icon">🗂️</span>
            <span className="dash-text">
              <span className="dash-label">VEHICLE CLIENT MGT</span>
              <span className="dash-sub">Client transactions, receipts &amp; documents</span>
            </span>
          </Link>
          <FleetMgtButton />
          <DegooMgtButton />
        </div>
      </main>
    </>
  );
}