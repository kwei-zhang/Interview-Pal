import { notFound } from "next/navigation";
import { problemById } from "@/lib/data/catalog";
import { CodingWorkspace } from "@/components/coding-workspace";
export default async function ProblemPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const problem = problemById(id);
  if (!problem) notFound();
  return <CodingWorkspace problem={problem}/>;
}
