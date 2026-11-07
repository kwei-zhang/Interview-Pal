import {test,expect} from "@playwright/test";
import {mountedPath} from "../helpers/paths";
import {emptyWorkspace} from "../../src/lib/types";

const workspace=emptyWorkspace();
workspace.resumeBullets=[{id:"33333333-3333-4333-8333-333333333333",projectId:"44444444-4444-4444-8444-444444444444",project:"Payment API",position:0,text:"Built idempotent retries.",updatedAt:"2026-10-10T12:00:00Z"}];
test.beforeEach(async({page})=>{
  await page.route("**/api/config",route=>route.fulfill({json:{agentConfigured:true}}));
  await page.route("**/api/interview-agent",route=>route.fulfill({json:route.request().postDataJSON().action==="feedback"?{feedback:{source:"agent",summary:"Saved interview.",strengths:[],improvements:[],evidence:[],nextActions:[],dimensions:[]}}:{sdp:"v=0\r\no=test-answer"}}));
  await page.addInitScript(serialized=>{
    if(!localStorage.getItem("interview-pal.workspace.v1"))localStorage.setItem("interview-pal.workspace.v1",serialized);
    localStorage.setItem("interview-pal.plain-editor","true");
    HTMLMediaElement.prototype.play=async()=>{};
    let localStream:MediaStream;
    const audio=new AudioContext();
    const tone=(frequency:number)=>{const oscillator=audio.createOscillator(),gain=audio.createGain(),destination=audio.createMediaStreamDestination();oscillator.frequency.value=frequency;gain.gain.value=.1;oscillator.connect(gain).connect(destination);oscillator.start();return destination.stream;};
    const remote=tone(880);
    Object.defineProperty(navigator.mediaDevices,"getUserMedia",{configurable:true,value:async()=>{await audio.resume();localStream=tone(440);return localStream;}});
    class Channel {
      readyState="connecting";onopen?:()=>void;onclose?:()=>void;onmessage?:(event:{data:string})=>void;
      send(message:string){if(JSON.parse(message).type==="response.create")queueMicrotask(()=>this.onmessage?.({data:JSON.stringify({type:"response.output_audio_transcript.done",item_id:crypto.randomUUID(),transcript:"Let's discuss your work."})}));}
      close(){this.readyState="closed";this.onclose?.();}
    }
    class Peer {
      channel=new Channel();ontrack?:(event:{streams:MediaStream[]})=>void;
      addTrack(){}createDataChannel(){return this.channel;}
      async createOffer(){return {sdp:"v=0\r\no=test-offer"};}async setLocalDescription(){}
      async setRemoteDescription(){this.ontrack?.({streams:[remote]});this.channel.readyState="open";this.channel.onopen?.();}
      close(){}
    }
    Object.assign(window,{RTCPeerConnection:Peer});
  },JSON.stringify(workspace));
});

for(const type of ["coding","behavioral","project"]){
  test(`${type} records both sides, saves on finish, downloads and deletes`,async({page})=>{
    const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
    await page.goto(mountedPath(`/interviews?type=${type}&timed=false`));
    await page.getByRole("button",{name:"Enter practice room"}).click();
    await expect(page.getByRole("button",{name:"Record interview",exact:true})).toBeEnabled();
    await page.getByRole("button",{name:"Record interview",exact:true}).click();
    await expect(page.getByText("Recording your microphone and interviewer audio",{exact:true})).toBeVisible();
    // Allow a real MediaRecorder to produce audio from two synthetic sources.
    await page.waitForTimeout(1200);
    if(type === "project") {await page.getByRole("button",{name:"Stop microphone",exact:true}).click();await page.waitForTimeout(1200);}
    await page.getByRole("button",{name:"Finish session"}).click();
    await expect(page).toHaveURL(/\/history\/[a-f0-9-]+$/);
    await expect(page.getByRole("button",{name:"Download recording",exact:true})).toBeVisible();
    const powers=await page.locator("audio[aria-label='Local interview recording']").evaluate(async(element:HTMLAudioElement)=>{
      const blob=await(await fetch(element.src)).arrayBuffer();const context=new AudioContext();
      const buffer=await context.decodeAudioData(blob);const samples=buffer.getChannelData(0);
      const start=Math.floor(buffer.sampleRate*.2),length=Math.min(samples.length-start,Math.floor(buffer.sampleRate*.5));
      const power=(frequency:number,offset=start)=>{let real=0,imaginary=0;for(let i=0;i<length;i++){const phase=2*Math.PI*frequency*i/buffer.sampleRate;real+=samples[offset+i]*Math.cos(phase);imaginary+=samples[offset+i]*Math.sin(phase);}return Math.hypot(real,imaginary)/length;};
      const result=[power(440),power(880),buffer.duration,...(buffer.duration>2?[power(440,Math.floor(buffer.sampleRate*1.6)),power(880,Math.floor(buffer.sampleRate*1.6))]:[])];await context.close();return result;
    });
    expect(powers[0]).toBeGreaterThan(.01);expect(powers[1]).toBeGreaterThan(.01);expect(powers[2]).toBeGreaterThan(.7);
    if(type === "project"){expect(powers[3]).toBeLessThan(.003);expect(powers[4]).toBeGreaterThan(.01);}
    await page.reload();await expect(page.getByRole("button",{name:"Download recording",exact:true})).toBeVisible();
    const download=page.waitForEvent("download");await page.getByRole("button",{name:"Download recording",exact:true}).click();
    expect((await download).suggestedFilename()).toMatch(/^interview-.*\.webm$/);
    await page.getByRole("button",{name:"Delete recording 1",exact:true}).click();
    await page.getByRole("button",{name:"Confirm delete",exact:true}).click();
    await page.reload();await expect(page.getByText("No recordings saved for this session.")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("Refreshing during recording recovers saved chunks without recording again automatically",async({page})=>{
  await page.goto(mountedPath("/interviews?type=behavioral&timed=false"));
  await page.getByRole("button",{name:"Enter practice room"}).click();
  await page.getByRole("button",{name:"Record interview",exact:true}).click();
  await expect.poll(()=>page.evaluate(async()=>{
    return await new Promise<number>(resolve=>{const request=indexedDB.open("interview-pal-recordings",1);request.onsuccess=()=>{const db=request.result;const all=db.transaction("chunks").objectStore("chunks").count();all.onsuccess=()=>{resolve(all.result);db.close();};};});
  }),{timeout:10000}).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole("button",{name:"Download recording",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Record interview",exact:true})).toBeEnabled();
  await expect(page.getByText("Recording your microphone and interviewer audio",{exact:true})).toHaveCount(0);
  await page.screenshot({path:"/private/tmp/interview-pal-recording-recovered.png",fullPage:true});
});

test("Browser storage failure keeps a downloadable in-memory copy and reports that it is not saved",async({page})=>{
  await page.goto(mountedPath("/interviews?type=behavioral&timed=false"));
  await page.getByRole("button",{name:"Enter practice room"}).click();
  await page.getByRole("button",{name:"Record interview",exact:true}).click();
  await page.evaluate(()=>{
    const original=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value,key){if(this.name==="chunks")throw new DOMException("Test quota failure","QuotaExceededError");return original.call(this,value,key);};
  });
  await page.waitForTimeout(800);
  await page.getByRole("button",{name:"Stop recording",exact:true}).click();
  await expect(page.getByText(/Not saved — download before leaving/)).toBeVisible();
  const downloading=page.waitForEvent("download");await page.getByRole("button",{name:"Download recording",exact:true}).click();
  expect((await downloading).suggestedFilename()).toMatch(/\.webm$/);
});
