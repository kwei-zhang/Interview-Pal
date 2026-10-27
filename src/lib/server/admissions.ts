import { createHash, randomBytes } from "node:crypto";
import { databaseFunction, withDatabase } from "./database";

export const secretHash = (value: string) => createHash("sha256").update(value).digest("hex");
export async function createAdmission(input: {email: string; displayName: string; inviteCode?: string}, reconnect: boolean) {
  const admissionToken = randomBytes(32).toString("hex");
  await withDatabase(db => databaseFunction(db, "private.create_admission", [input.email, input.displayName,
    input.inviteCode ? secretHash(input.inviteCode) : null, reconnect, secretHash(admissionToken)]));
  return admissionToken;
}
