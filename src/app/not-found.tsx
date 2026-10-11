import Link from "next/link";
export default function NotFound() { return <div className="setup-page"><div className="setup-card"><span className="eyebrow">404</span><h1>This page got lost.</h1><p>Return to your workspace to keep practicing.</p><Link href="/" className="button button-primary">Back to overview</Link></div></div>; }
