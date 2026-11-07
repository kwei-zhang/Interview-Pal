import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { applyMutation, emptyWorkspace, type ResumeBullet } from "../src/lib/types";
import { mutationSchema, resumeBulletSchema } from "../src/lib/validation";
import { loadWorkspace, saveMutation } from "../src/lib/server/workspace";
import { setupNeon, asNeonUser, adminId, memberId } from "./helpers/neon-database";
import { groupResumeProjects } from "../src/lib/resume-projects";

const bullet: ResumeBullet = {
  id: "33333333-3333-4333-8333-333333333333", project: "Checkout service",
  text: "Reduced payment failures by 30%.", updatedAt: "2026-10-10T12:00:00Z",
};

test("Project grouping preserves legacy material, separate project identities, and bullet order", () => {
  const projectId = "55555555-5555-4555-8555-555555555555";
  const bullets = [
    {...bullet, id: "second", projectId, position: 1, text: "Second point"},
    {...bullet, id: "legacy-a", text: "Existing point"},
    {...bullet, id: "first", projectId, position: 0, text: "First point"},
    {...bullet, id: "legacy-b", text: "Another existing point"},
    {...bullet, id: "unnamed", project: "", text: "Unlabeled point"},
    {...bullet, id: "separate", projectId: "66666666-6666-4666-8666-666666666666", position: 0},
  ];
  const projects = groupResumeProjects(bullets);
  assert.equal(projects.length, 4);
  assert.deepEqual(projects.find(project => project.id === projectId)?.bullets.map(bullet => bullet.text), ["First point", "Second point"]);
  assert.equal(projects.find(project => project.id === "legacy-name:Checkout service")?.bullets.length, 2);
  assert.equal(projects.find(project => project.id === "legacy-bullet:unnamed")?.bullets[0].text, "Unlabeled point");
  assert.equal(bullets[0].id, "second");
});

test("Resume bullets accept optional context and reject blank, oversized, or unexpected content", () => {
  assert.deepEqual(resumeBulletSchema.parse({...bullet, project: "  ", text: "  Built a service.  "}), {...bullet, project: "", text: "Built a service."});
  for (const invalid of [{text: " \n "}, {text: "a".repeat(4001)}, {project: "a".repeat(201)}, {id: "invalid"}, {userId: adminId}]) {
    assert.equal(resumeBulletSchema.safeParse({...bullet, ...invalid}).success, false);
  }
  assert.equal(mutationSchema.safeParse({kind: "resume-bullet", value: bullet}).success, true);
  assert.equal(mutationSchema.safeParse({kind: "delete-resume-bullet", id: bullet.id}).success, true);
  assert.equal(mutationSchema.safeParse({kind: "delete-resume-bullet", id: "invalid"}).success, false);
});

test("Editing and deleting a resume bullet preserve other workspace data", () => {
  const initial = emptyWorkspace();
  initial.profile.displayName = "Existing owner";
  const other = {...bullet, id: "44444444-4444-4444-8444-444444444444", text: "Another achievement."};
  let workspace = applyMutation(initial, {kind: "resume-bullet", value: bullet});
  workspace = applyMutation(workspace, {kind: "resume-bullet", value: other});
  workspace = applyMutation(workspace, {kind: "resume-bullet", value: {...bullet, text: "Updated achievement."}});
  assert.equal(workspace.resumeBullets.length, 2);
  assert.equal(workspace.resumeBullets[0].text, "Updated achievement.");
  workspace = applyMutation(workspace, {kind: "delete-resume-bullet", id: bullet.id});
  assert.deepEqual(workspace.resumeBullets, [other]);
  assert.equal(workspace.profile.displayName, "Existing owner");
  assert.deepEqual(initial.resumeBullets, []);
});

test("Resume bullets persist with stale-write protection and private account access", async () => {
  const db = new PGlite();
  try {
    await setupNeon(db);
    await asNeonUser(db, adminId);
    await saveMutation(db, adminId, {kind: "resume-bullet", value: bullet});
    assert.deepEqual((await loadWorkspace(db, adminId)).resumeBullets, [bullet]);
    const updated = {...bullet, text: "Reduced failures by 40%.", updatedAt: "2026-10-10T13:00:00Z"};
    await saveMutation(db, adminId, {kind: "resume-bullet", value: updated});
    await saveMutation(db, adminId, {kind: "resume-bullet", value: bullet});
    assert.deepEqual((await loadWorkspace(db, adminId)).resumeBullets, [updated]);

    await asNeonUser(db, memberId);
    assert.deepEqual((await loadWorkspace(db, memberId)).resumeBullets, []);
    assert.deepEqual((await loadWorkspace(db, adminId)).resumeBullets, []);
    await assert.rejects(saveMutation(db, memberId, {kind: "resume-bullet", value: updated}), /row-level security/);
    await assert.rejects(saveMutation(db, adminId, {kind: "resume-bullet", value: {...updated, id: "55555555-5555-4555-8555-555555555555"}}), /row-level security/);
    await saveMutation(db, adminId, {kind: "delete-resume-bullet", id: bullet.id});
    await asNeonUser(db, adminId);
    assert.deepEqual((await loadWorkspace(db, adminId)).resumeBullets, [updated]);

    await db.exec("reset role; create role resume_anonymous nologin; set role resume_anonymous");
    await assert.rejects(db.query("select * from public.resume_bullets"), /permission denied/);
    await asNeonUser(db, null);
    assert.equal((await db.query("select * from public.resume_bullets")).rows.length, 0);

    await asNeonUser(db, adminId);
    await saveMutation(db, adminId, {kind: "delete-resume-bullet", id: bullet.id});
    assert.deepEqual((await loadWorkspace(db, adminId)).resumeBullets, []);
  } finally {await db.close();}
});
