import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { recordingStorage } from "../src/lib/server/recording-storage";

async function main() {
const storage=recordingStorage();
const key=`verification/${crypto.randomUUID()}`;
const bytes="Interview Pal storage verification";
const mime="audio/webm";
const upload=await storage.upload(key,mime,new TextEncoder().encode(bytes).byteLength);
const browser=await chromium.launch({channel:"chrome",headless:true});
try {
  const page=await browser.newPage();
  await page.goto("http://127.0.0.1:3001/");
  const status=await page.evaluate(async({upload,bytes,mime})=>{
    const form=new FormData();for(const [key,value] of Object.entries(upload.fields))form.append(key,value);
    form.append("file",new Blob([bytes],{type:mime}));
    return (await fetch(upload.url,{method:"POST",body:form})).status;
  },{upload,bytes,mime});
  assert.ok(status>=200&&status<300,`Upload status ${status}`);
  assert.deepEqual(await storage.head(key),{bytes:new TextEncoder().encode(bytes).byteLength,mime});
  const url=await storage.read(key,"recording.webm");
  const response=await fetch(url);assert.equal(await response.text(),bytes);
  assert.match(response.headers.get("content-disposition")||"",/attachment/);
  const unsigned=new URL(url);unsigned.search="";
  assert.equal((await fetch(unsigned)).status,403);
  console.log("Private browser upload, verified size/type, authenticated download, and anonymous denial passed.");
} finally {
  await browser.close();
  await storage.delete(key);
}

}
void main().catch(error=>{console.error(error instanceof Error?error.name+": "+error.message:"Storage check failed");process.exitCode=1;});
