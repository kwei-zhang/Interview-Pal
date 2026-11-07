import type { ProjectInterviewSnapshot } from "@/lib/types";
import { FormattedBullet } from "./formatted-bullet";

export function ProjectInterviewContext({project}: {project: ProjectInterviewSnapshot}) {
  return <section className="card review-section" aria-label="Project interview material">
    <h3>Resume bullet points</h3>
    <ul style={{listStyle: "disc"}}>{project.bullets.map((text, index) => <li key={index}><FormattedBullet text={text}/></li>)}</ul>
    <p className="field-hint">Saved when this interview started.</p>
  </section>;
}
