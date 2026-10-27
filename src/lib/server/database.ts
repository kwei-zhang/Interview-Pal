import { Pool as NeonPool } from "@neondatabase/serverless";
import { Pool as LocalPool } from "pg";
import { HttpError } from "./http";

export interface Database {
  query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{rows: T[]}>;
}

function databaseError(error: unknown): never {
  const code = (error as {code?: string})?.code;
  if (code === "P0429") throw new HttpError(429, "Too many attempts. Please wait before trying again.");
  if (code === "42501") throw new HttpError(403, "Your account does not have access to this operation.", "access_denied");
  if (code === "22023") throw new HttpError(400, "Check your invitation and email. Existing users should use sign in, reconnect, or password recovery.");
  if (code === "23505") throw new HttpError(409, "This account or record already exists. Please sign in or retry.");
  if (error instanceof HttpError) throw error;
  throw new HttpError(503, "Your workspace could not connect. Please retry shortly.");
}

// Every request gets a bounded connection lifetime; transaction-local identity
// cannot leak into another account through a pooled connection.
export async function withDatabase<T>(operation: (db: Database) => Promise<T>, userId?: string): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new HttpError(503, "Configure Neon to enable your private workspace.");
  const hostname = new URL(connectionString).hostname;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  const Pool = local ? LocalPool : NeonPool;
  const pool = new Pool({connectionString, max: 1, connectionTimeoutMillis: 10000});
  const client = await pool.connect().catch(async error => {await pool.end(); databaseError(error);});
  const query = client.query.bind(client) as (sql: string, values?: unknown[]) => Promise<{rows: unknown[]}>;
  const db: Database = {query: async <R>(sql: string, values?: unknown[]) => {
    const result = await query(sql, values);
    return {rows: result.rows as R[]};
  }};
  try {
    const {rows} = await db.query<{unsafe: boolean}>(`select rolsuper or rolbypassrls or exists(
      select 1 from pg_class where oid='public.app_accounts'::regclass and pg_has_role(current_user,relowner,'USAGE')) as unsafe
      from pg_roles where rolname=current_user`);
    if (rows[0]?.unsafe !== false) throw new HttpError(503, "Use the restricted application database role, not the migration owner.");
    await db.query("begin");
    await db.query("select set_config('statement_timeout','15000',true), set_config('app.user_id',$1,true)", [userId || ""]);
    const result = await operation(db);
    await db.query("commit");
    return result;
  } catch (error) {
    await query("rollback").catch(() => {});
    databaseError(error);
  } finally {client.release(); await pool.end();}
}

export function userDatabase(userId: string) {
  return <T>(operation: (db: Database) => Promise<T>) => withDatabase(operation, userId);
}

export async function databaseFunction<T>(db: Database, name: string, args: unknown[] = []): Promise<T> {
  // Names are source-code constants, never request data. Reject unsafe identifiers.
  if (!/^(public|private)\.[a-z_]+$/.test(name)) throw new Error("Invalid database function");
  return (await db.query<{value: T}>(`select ${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) as value`, args)).rows[0].value;
}
