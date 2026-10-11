import Link from "next/link";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import type { Difficulty } from "@/lib/types";

export function PageHeading({eyebrow, title, description, action}: {eyebrow: string; title: string; description: string; action?: React.ReactNode}) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action && <div className="heading-action">{action}</div>}</div>;
}
export function Badge({children, tone = "neutral"}: {children: React.ReactNode; tone?: "neutral" | "purple" | "green" | "amber" | "red"}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function DifficultyBadge({difficulty}: {difficulty: Difficulty}) {
  return <Badge tone={difficulty === "Easy" ? "green" : difficulty === "Medium" ? "amber" : "red"}>{difficulty}</Badge>;
}
export function EmptyState({icon, title, description, action}: {icon?: React.ReactNode; title: string; description: string; action?: React.ReactNode}) {
  return <div className="empty-state">{icon && <div className="empty-icon">{icon}</div>}<h3>{title}</h3><p>{description}</p>{action}</div>;
}
export function SectionTitle({title, subtitle, href, linkLabel = "View all"}: {title: string; subtitle?: string; href?: string; linkLabel?: string}) {
  return <div className="section-title"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{href && <Link href={href} className="text-link">{linkLabel}<ArrowUpRight size={15}/></Link>}</div>;
}
export function LoadingState({label = "Loading your workspace…"}: {label?: string}) {
  return <div className="loading-state"><LoaderCircle className="spin" size={22}/><span>{label}</span></div>;
}
export const prettyLanguage = (language: string) => ({python: "Python", javascript: "JavaScript", typescript: "TypeScript"}[language] || language);
export function relativeDate(value: string) {
  const date = new Date(value), days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString("en", {month: "short", day: "numeric"});
}
