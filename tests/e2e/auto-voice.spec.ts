import { test, expect } from "@playwright/test";

test.beforeEach(async ({page}) => {
  await page.route("**/api/config", route => route.fulfill({json: {runnerConfigured: false, agentConfigured: true}}));
  await page.route("**/api/interview-agent", route => {
    const request = route.request().postDataJSON();
    return route.fulfill({json: request.action === "voice" ? {sdp: "v=0\r\no=test-answer"} : {text: "Yes, empty inputs are allowed."}});
  });
  await page.addInitScript(() => {
    localStorage.setItem("interview-pal.plain-editor", "true");
    const track = {enabled: true, stopped: false, stop() {this.stopped = true;}};
    const stream = {getAudioTracks: () => [track], getTracks: () => [track]};
    const state = {track, captures: 0, responses: 0, closed: 0, delayPermission: false, releasePermission: () => {}, toolOutputs: [] as unknown[], inject: (_message: unknown) => {}};
    Object.assign(window, {voiceTest: state});
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {configurable: true, value: async () => {
      state.captures++;
      if (state.delayPermission) await new Promise<void>(resolve => {state.releasePermission = resolve;});
      track.stopped = false; track.enabled = true;
      return stream;
    }});
    class Channel {
      readyState = "connecting";
      onopen?: () => void;
      onclose?: () => void;
      onmessage?: (event: {data: string}) => void;
      send(data: string) {
        const message = JSON.parse(data);
        if (message.type === "conversation.item.create" && message.item.type === "function_call_output") state.toolOutputs.push(message.item);
        if (message.type !== "response.create") return;
        state.responses++;
        const id = `opening-${state.responses}`;
        queueMicrotask(() => {
          this.onmessage?.({data: JSON.stringify({type: "response.output_audio_transcript.done", item_id: id, transcript: "Hello! Let's begin with the selected interview question."})});
          this.onmessage?.({data: JSON.stringify({type: "response.done", response: {status: "completed"}})});
        });
      }
      close() {this.readyState = "closed"; this.onclose?.();}
    }
    class Peer {
      channel = new Channel();
      addTrack() {}
      createDataChannel() {state.inject = message => this.channel.onmessage?.({data: JSON.stringify(message)}); return this.channel;}
      async createOffer() {return {type: "offer", sdp: "v=0\r\no=test-offer"};}
      async setLocalDescription() {}
      async setRemoteDescription() {this.channel.readyState = "open"; this.channel.onopen?.();}
      close() {state.closed++;}
    }
    Object.assign(window, {RTCPeerConnection: Peer});
  });
});

for (const type of ["coding", "behavioral"]) {
  test(`${type} opens the microphone and starts the interviewer automatically; mute and resume work`, async ({page}) => {
    let voiceRequests = 0;
    page.on("request", request => {if (request.url().endsWith("/api/interview-agent") && request.postDataJSON().action === "voice") voiceRequests++;});
    await page.goto(`/interviews?type=${type}`);
    await page.getByRole("button", {name: "Enter practice room"}).click();
    await expect(page.getByRole("button", {name: "Stop microphone"})).toBeVisible();
    await expect(page.getByRole("log")).toContainText("Hello! Let's begin");
    expect(voiceRequests).toBe(1);
    await expect.poll(() => page.evaluate(() => (window as unknown as {voiceTest: {captures: number}}).voiceTest.captures)).toBe(1);
    await page.getByRole("button", {name: "Stop microphone"}).click();
    await expect(page.getByRole("button", {name: "Start microphone"})).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as {voiceTest: {track: {enabled: boolean}}}).voiceTest.track.enabled)).toBe(false);
    await page.getByRole("button", {name: "Start microphone"}).click();
    await expect(page.getByRole("button", {name: "Stop microphone"})).toBeVisible();
    expect(voiceRequests).toBe(1);
    await page.getByRole("link", {name: "Leave and save for later"}).click();
    await expect(page.getByRole("heading", {name: "Pick up a previous session"})).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as {voiceTest: {track: {stopped: boolean}}}).voiceTest.track.stopped)).toBe(true);
    await page.getByRole("link", {name: /transcript entries saved/}).click();
    await expect(page.getByRole("button", {name: "Stop microphone"})).toBeVisible();
    expect(voiceRequests).toBe(2);
    await expect(page.locator(".transcript-message.interviewer")).toHaveCount(1);
    expect(await page.evaluate(() => (window as unknown as {voiceTest: {responses: number}}).voiceTest.responses)).toBe(1);
  });
}

test("Failed automatic voice connection releases the microphone and allows typed chat", async ({page}) => {
  await page.route("**/api/interview-agent", route => route.fulfill({json: route.request().postDataJSON().action === "voice" ? {error: "Voice provider unavailable"} : {text: "Yes, empty inputs are allowed."}, status: route.request().postDataJSON().action === "voice" ? 503 : 200}));
  await page.goto("/interviews?question=contains-duplicate-ii");
  await page.getByRole("button", {name: "Enter practice room"}).click();
  await expect(page.locator(".inline-alert[role=alert]")).toContainText("Voice provider unavailable");
  await expect(page.getByRole("log")).toContainText("Let's work on Contains Duplicate II");
  expect(await page.evaluate(() => (window as unknown as {voiceTest: {track: {stopped: boolean}}}).voiceTest.track.stopped)).toBe(true);
  await page.getByLabel("Your response", {exact: true}).fill("Can the input be empty?");
  await page.getByRole("button", {name: "Send response"}).click();
  await expect(page.getByRole("log")).toContainText("Yes, empty inputs are allowed.");
});

test("Leaving while microphone permission is pending cancels startup and releases a late stream", async ({page}) => {
  await page.goto("/interviews");
  await page.evaluate(() => {(window as unknown as {voiceTest: {delayPermission: boolean}}).voiceTest.delayPermission = true;});
  await page.getByRole("button", {name: "Enter practice room"}).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as {voiceTest: {captures: number}}).voiceTest.captures)).toBe(1);
  await page.getByRole("link", {name: "Leave and save for later"}).click();
  await expect(page.getByRole("heading", {name: "Pick up a previous session"})).toBeVisible();
  await page.evaluate(() => (window as unknown as {voiceTest: {releasePermission: () => void}}).voiceTest.releasePermission());
  await expect.poll(() => page.evaluate(() => (window as unknown as {voiceTest: {track: {stopped: boolean}}}).voiceTest.track.stopped)).toBe(true);
  expect(await page.evaluate(() => (window as unknown as {voiceTest: {responses: number}}).voiceTest.responses)).toBe(0);
});

test("Voice verification uses the current snapshot once, returns tool output, and survives reload", async ({page}) => {
  let checks = 0;
  await page.route("**/api/interview-agent", async route => {
    const body = route.request().postDataJSON();
    if (body.action !== "verify") return route.fulfill({json: {sdp: "v=0\r\no=test-answer"}});
    checks++;
    expect(body.context.code).toContain("any(nums[i] == nums[j]");
    expect(body.context.language).toBe("python");
    return route.fulfill({json: {attempts: [{id: crypto.randomUUID(), provider: "openai-code-interpreter", sessionId: body.session.id, problemId: body.session.questionId, problemVersion: 1, language: "python", code: body.context.code, mode: "submit", createdAt: new Date().toISOString(), result: {status: "passed", stdout: "", tests: [{name: "Duplicate case", passed: true, expected: true, actual: true}]}}]}});
  });
  await page.goto("/interviews?question=contains-duplicate-ii&timed=false");
  await page.getByRole("button", {name: "Enter practice room"}).click();
  await expect(page.getByRole("button", {name: "Stop microphone"})).toBeVisible();
  await page.getByLabel("Solution code", {exact: true}).fill("def containsNearbyDuplicate(nums, k):\n    return any(nums[i] == nums[j] and j - i <= k for i in range(len(nums)) for j in range(i + 1, len(nums)))");
  await page.evaluate(() => {
    const state = (window as unknown as {voiceTest: {inject: (m: unknown) => void}}).voiceTest;
    const message = {type: "response.done", response: {status: "completed", output: [{type: "function_call", name: "verify_code", call_id: "call_verify", arguments: "{}"}]}};
    state.inject(message); state.inject(message);
  });
  await expect(page.locator(".test-panel")).toContainText("1 / 1 tests");
  expect(checks).toBe(1);
  const outputs = await page.evaluate(() => (window as unknown as {voiceTest: {toolOutputs: {call_id: string; output: string}[]}}).voiceTest.toolOutputs);
  expect(outputs).toHaveLength(1); expect(outputs[0].call_id).toBe("call_verify");
  expect(JSON.parse(outputs[0].output).status).toBe("passed");
  await page.getByLabel("Solution code", {exact: true}).fill("def containsNearbyDuplicate(nums, k): return False");
  await expect(page.locator(".test-panel")).toContainText("earlier code snapshot");
  await page.reload();
  await expect(page.locator(".test-panel")).toContainText("1 / 1 tests");
  await expect(page.locator(".test-panel")).toContainText("earlier code snapshot");
});
