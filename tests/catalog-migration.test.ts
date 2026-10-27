import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { authFixture } from "./helpers/auth-database";
import previousCatalog from "../src/lib/data/neetcode150.json";
import { codingCollection, problems } from "../src/lib/data/catalog";

test("Catalog migration and reseeding preserve saved work and allow drafts for all new questions", async () => {
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111";
  try {
    await db.exec(authFixture);
    await db.exec(readFileSync("supabase/migrations/202610100001_foundation.sql", "utf8"));
    await db.exec("insert into public.role_tracks(id,name) values ('software-engineer','Software engineer'); insert into public.question_collections(id,role_id,name) values ('neetcode-150','software-engineer','NeetCode 150')");
    for (const p of previousCatalog) await db.query("insert into public.problems(id,collection_id,data) values ($1,'neetcode-150',$2)", [p.id, {...p, collectionId: "neetcode-150"}]);
    for (const id of ["two-sum", "contains-duplicate"]) {
      await db.query("insert into public.code_drafts(user_id,problem_id,language,data) values ($1,$2,'python',$3)", [owner, id, {code: `saved ${id}`}]);
      await db.query("insert into public.problem_progress(user_id,problem_id,data) values ($1,$2,$3)", [owner, id, {status: "solved", notes: `notes ${id}`}]);
    }
    const migration = readFileSync("supabase/migrations/202610270001_top_interview_150.sql", "utf8");
    // Both the upgrade and later fresh-seed application must be idempotent.
    await db.exec(migration);
    await db.exec(migration);
    await db.exec(readFileSync("supabase/seed.sql", "utf8"));
    const active = await db.query<{id: string; data: {collectionId: string}}>("select id,data from public.problems where collection_id=$1 order by id", [codingCollection.id]);
    assert.deepEqual(active.rows.map(p => p.id), problems.map(p => p.id).sort());
    assert.ok(active.rows.every(p => p.data.collectionId === codingCollection.id));
    assert.deepEqual((await db.query<{data: {code: string}}>("select data from public.code_drafts order by problem_id")).rows.map(r => r.data.code), ["saved contains-duplicate", "saved two-sum"]);
    assert.deepEqual((await db.query<{data: {notes: string}}>("select data from public.problem_progress order by problem_id")).rows.map(r => r.data.notes), ["notes contains-duplicate", "notes two-sum"]);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
    await db.exec("set role authenticated");
    for (const p of problems) await db.query("insert into public.code_drafts(user_id,problem_id,language,data) values ($1,$2,'typescript','{}')", [owner, p.id]);
    assert.equal((await db.query("select * from public.code_drafts where language='typescript'")).rows.length, 150);
  } finally {
    await db.close();
  }
});
