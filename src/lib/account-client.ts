import { appPath } from "./paths";

// Capture the workspace owner when the UI is mounted. Never derive this from
// mutable cookies at send time: another tab may have signed into another account.
export function createAccountFetch(userId: string | undefined, onAccessLost: () => void, fetcher: typeof fetch = (...args) => fetch(...args)): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (userId) headers.set("x-workspace-user-id", userId);
    const response = await fetcher(typeof input === "string" ? appPath(input) : input, {...init, headers, cache: "no-store"});
    if (userId && [401, 403, 409].includes(response.status)) {
      const body = await response.clone().json().catch(() => ({}));
      if (["unauthenticated", "account_changed", "access_denied"].includes(body.code)) onAccessLost();
    }
    return response;
  };
}

