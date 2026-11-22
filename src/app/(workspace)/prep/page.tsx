import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prepAreas } from "@/lib/prep-areas";
import styles from "./prep.module.css";

export default function PrepPage() {
  return <>
    <div className="page-heading"><h1>Interview prep</h1></div>
    <nav aria-label="Prep areas" className={styles.grid}>
      {prepAreas.map(({href, label, icon: Icon, description}) => (
        <Link key={href} href={href} aria-label={label} className={`card ${styles.entry}`}>
          <div className={styles.icons}>
            <span className="focus-icon"><Icon size={18} aria-hidden="true"/></span>
            <ArrowRight size={16} aria-hidden="true"/>
          </div>
          <h2>{label}</h2>
          <p>{description}</p>
        </Link>
      ))}
    </nav>
  </>;
}
