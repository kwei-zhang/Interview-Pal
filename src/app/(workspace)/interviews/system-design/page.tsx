import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function SystemDesignInterviewPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>System design interview</h1>
          <p>This practice mode is coming soon.</p>
        </div>
      </div>
      <Link href="/interviews" className="button button-secondary">
        <ArrowLeft size={15} aria-hidden="true"/>
        Back to mock interviews
      </Link>
    </>
  );
}
