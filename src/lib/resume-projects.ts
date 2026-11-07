import type { ResumeBullet } from "./types";

export interface ResumeProject {
  id: string;
  name: string;
  bullets: ResumeBullet[];
  updatedAt: string;
}

export function groupResumeProjects(bullets: ResumeBullet[]): ResumeProject[] {
  const projects = new Map<string, ResumeProject>();
  for (const bullet of bullets) {
    // Existing resume material is grouped by its label until the project is edited.
    const id = bullet.projectId || (bullet.project.trim() ? `legacy-name:${bullet.project.trim()}` : `legacy-bullet:${bullet.id}`);
    let project = projects.get(id);
    if (!project) {
      project = {id, name: bullet.project, bullets: [], updatedAt: bullet.updatedAt};
      projects.set(id, project);
    }
    project.bullets.push(bullet);
    if (bullet.updatedAt > project.updatedAt) project.updatedAt = bullet.updatedAt;
  }
  for (const project of projects.values()) {
    project.bullets.sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER));
  }
  return [...projects.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
