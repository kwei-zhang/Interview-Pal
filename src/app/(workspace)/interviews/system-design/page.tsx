import { redirect } from "next/navigation";

export default function SystemDesignInterviewPage() {
  redirect("/interviews?type=system-design");
}
