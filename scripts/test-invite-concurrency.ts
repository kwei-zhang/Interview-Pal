// Runs a real two-connection race without touching any configured Supabase project.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { authFixture } from "../tests/helpers/auth-database";

function run(binary: string, args: string[], sql?: string) {
  return new Promise<{code: number; output: string}>((resolve, reject) => {
    const child = spawn(binary, args, {stdio: ["pipe", "pipe", "pipe"]});
    let output = "";
    child.stdout.on("data", chunk => {output += chunk;}); child.stderr.on("data", chunk => {output += chunk;});
    child.on("error", reject); child.on("close", code => resolve({code: code ?? 1, output}));
    child.stdin.end(sql);
  });
}
async function main() {
  const root = await mkdtemp(join(tmpdir(), "interview-pal-pg-"));
  const data = join(root, "data");
  let started = false;
  // Unix-domain sockets only; this isolated cluster never binds a network port.
  const psql = ["-X", "-h", root, "-p", "55439", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"];
  try {
    for (const [binary, args] of [["initdb", ["-D", data, "-U", "postgres", "-A", "trust", "--no-locale", "-E", "UTF8"]],
      ["pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o", `-k ${root} -p 55439 -c listen_addresses=''`, "-w", "start"]]] as const) {
      const result = await run(binary, [...args]); if (result.code !== 0) throw new Error(result.output);
      if (binary === "pg_ctl") started = true;
    }
    let setup = authFixture;
    for (const file of ["202610100001_foundation.sql", "202610100002_interview_agent.sql", "202610100003_llm_judging.sql", "202610100004_invite_only_users.sql", "202610110005_invitation_diagnostics.sql", "202610110006_invitation_auth_rls.sql"])
      setup += await readFile(`supabase/migrations/${file}`, "utf8");
    setup += await readFile("supabase/bootstrap-admin.sql", "utf8");
    setup += `select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
      select public.admin_create_invitation('race@example.test',private.invite_hash(repeat('A',32)));`;
    const initialized = await run("psql", psql, setup);
    assert.equal(initialized.code, 0, initialized.output);
    const insertion = (id: string) => `begin; set role supabase_auth_admin;
      insert into auth.users(id,email,raw_user_meta_data) values ('${id}','race@example.test','{"invite_code":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}');
      select pg_sleep(0.25); commit;`;
    const race = await Promise.all([
      run("psql", psql, insertion("33333333-3333-4333-8333-333333333333")),
      run("psql", psql, insertion("44444444-4444-4444-8444-444444444444")),
    ]);
    assert.equal(race.filter(result => result.code === 0).length, 1, JSON.stringify(race));
    assert.match(race.find(result => result.code !== 0)!.output, /Invitation is invalid/);
    const counts = await run("psql", psql, `select count(*) from auth.users where email='race@example.test';
      select count(*) from private.invitations where email='race@example.test' and redeemed_at is not null;
      select count(*) from public.app_accounts where user_id in (select id from auth.users where email='race@example.test');`);
    assert.equal(counts.output.trim(), "1\n1\n1");
    console.log("PASS: two concurrent connections created exactly one user, one membership, and one redemption.");
  } finally {
    if (started) {
      const stopped = await run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
      if (stopped.code !== 0) throw new Error(`Could not stop temporary PostgreSQL at ${root}: ${stopped.output}`);
    }
    await rm(root, {recursive: true, force: true});
  }
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
