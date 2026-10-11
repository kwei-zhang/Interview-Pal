"use client";
export default function ErrorPage({reset}: {error: Error; reset: () => void}) { return <div className="empty-state" role="alert"><h2>Something went wrong.</h2><p>Try loading this page again. Your saved work is still in your workspace.</p><button className="button button-primary" onClick={reset}>Try again</button></div>; }
