import { writeFileSync } from "node:fs";
import { archivedProblems, codingCollection, problems } from "../src/lib/data/catalog";
import { definitions } from "../src/lib/problems/definitions";
import { behavioralQuestions } from "../src/lib/data/behavioral";
const sql = (v: unknown) => `'${(typeof v === "string" ? v : JSON.stringify(v)).replaceAll("'", "''")}'`;
const catalogStatements = [
  `insert into public.role_tracks(id,name,modules) values ('software-engineer','Software engineer','["coding","behavioral"]') on conflict (id) do update set name=excluded.name,modules=excluded.modules;`,
  `insert into public.question_collections(id,role_id,name,source_url) values ('neetcode-150','software-engineer','NeetCode 150','https://neetcode.io/practice/practice/neetcode150') on conflict (id) do update set name=excluded.name,source_url=excluded.source_url;`,
  `insert into public.question_collections(id,role_id,name,source_url) values (${sql(codingCollection.id)},'software-engineer',${sql(codingCollection.name)},${sql(codingCollection.sourceUrl)}) on conflict (id) do update set name=excluded.name,source_url=excluded.source_url;`,
  ...[...problems, ...archivedProblems].map(p => `insert into public.problems(id,collection_id,data) values (${sql(p.id)},${sql(p.collectionId)},${sql(p)}::jsonb) on conflict (id) do update set collection_id=excluded.collection_id,data=excluded.data;`),
];
const statements = [
  "-- Generated from Interview Pal's catalog and authored definitions. Run npm run seed:generate after catalog changes.",
  ...catalogStatements,
  ...Object.values(definitions).map(d => `insert into public.problem_definitions(problem_id,version,data) values (${sql(d.id)},${d.version},${sql(d)}::jsonb) on conflict (problem_id,version) do update set data=excluded.data;`),
  ...behavioralQuestions.map(q => `insert into public.behavioral_questions(id,role_id,data) values (${sql(q.id)},'software-engineer',${sql(q)}::jsonb) on conflict (id) do update set data=excluded.data;`),
];
writeFileSync("supabase/seed.sql", statements.join("\n") + "\n");
console.log(`Generated SQL for ${problems.length} active and ${archivedProblems.length} archived problems, ${Object.keys(definitions).length} original problem definitions, and ${behavioralQuestions.length} behavioral questions.`);
