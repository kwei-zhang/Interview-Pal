import { register } from "@/lib/server/registration";
export const POST = (request: Request) => register(request, false);
