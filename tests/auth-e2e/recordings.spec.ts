import {test,expect,type Page} from "@playwright/test";
import {adminId,memberId} from "../helpers/neon-database";
const mount=process.env.TEST_BASE_PATH||"";
const path=(value:string)=>`${mount}${value}`;
const origin="http://127.0.0.1:3102";
const headers={Origin:origin,"x-workspace-user-id":adminId};
async function login(page:Page,email="zhangkw0622@gmail.com",password="Admin-password-2026") {
  await page.goto(path("/login"));await page.getByLabel("Email",{exact:true}).fill(email);await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(new RegExp(`${origin}${mount}/?$`));
}

test("Private cloud recordings persist across reload, enforce ownership, download and delete",async({page,browser,request})=>{
  test.skip(!process.env.RECORDINGS_S3_ENDPOINT,"Run with configured recording storage to verify cloud uploads.");
  await login(page);
  const now=new Date().toISOString(),sessionId=crypto.randomUUID(),recordingId=crypto.randomUUID();
  const session={id:sessionId,type:"behavioral",roleId:"software-engineer",questionId:"team-collaboration",durationMinutes:30,timed:false,language:"python",status:"completed",startedAt:now,lastActiveAt:now,endedAt:now,elapsedSeconds:1,scratchpad:"",transcript:[],adapter:"agent"};
  const saved=await page.request.patch(path("/api/workspace"),{headers,data:{userId:adminId,mutation:{kind:"session",value:session}}});expect(saved.status()).toBe(200);
  const route=path(`/api/interviews/${sessionId}/recordings`);
  const bytes="Synthetic recording verification";
  const prepared=await page.request.post(route,{headers,data:{id:recordingId,mimeType:"audio/webm",sizeBytes:new TextEncoder().encode(bytes).length,durationMs:1000}});
  expect(prepared.status()).toBe(200);
  const {upload}=await prepared.json();
  try {
    const uploaded=await page.evaluate(async({upload,bytes})=>{const form=new FormData();for(const [key,value] of Object.entries(upload.fields))form.append(key,value as string);form.append("file",new Blob([bytes],{type:"audio/webm"}));return(await fetch(upload.url,{method:"POST",body:form})).status;},{upload,bytes});
    expect(uploaded).toBeGreaterThanOrEqual(200);expect(uploaded).toBeLessThan(300);
    const finalized=await page.request.post(`${route}/${recordingId}`,{headers});expect(finalized.status()).toBe(200);
    await page.goto(path(`/history/${sessionId}`));
    await expect(page.getByText(/Saved to your account/)).toBeVisible();
    await page.reload();await expect(page.getByRole("button",{name:"Download recording",exact:true})).toBeVisible();
    const downloading=page.waitForEvent("download");await page.getByRole("button",{name:"Download recording",exact:true}).click();expect((await downloading).suggestedFilename()).toContain(recordingId);
    const unauthenticated=await request.get(`${route}/${recordingId}`,{headers});expect(unauthenticated.status()).toBe(401);
    const context=await browser.newContext();const member=await context.newPage();
    try {
      await login(member,"member@example.test","Member-password-2026");
      const denied=await member.request.get(`${origin}${route}/${recordingId}`,{headers:{"x-workspace-user-id":memberId}});expect(denied.status()).toBe(404);
      const wrongAccount=await member.request.get(`${origin}${route}`,{headers:{"x-workspace-user-id":adminId}});expect(wrongAccount.status()).toBe(409);
    } finally {await context.close();}
    await page.getByRole("button",{name:"Delete recording 1",exact:true}).click();await page.getByRole("button",{name:"Confirm delete",exact:true}).click();
    await expect(page.getByText("No recordings saved for this session.")).toBeVisible();
    expect((await page.request.get(`${route}/${recordingId}`,{headers})).status()).toBe(404);
  } finally {
    await page.request.delete(`${route}/${recordingId}`,{headers});
    await page.request.patch(path("/api/workspace"),{headers,data:{userId:adminId,mutation:{kind:"delete-session",id:sessionId}}});
  }
});
