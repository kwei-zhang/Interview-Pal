import { InterviewRoom } from "@/components/interview-room";
export default async function RoomPage({params}: {params: Promise<{id: string}>}) {
  return <InterviewRoom id={(await params).id}/>;
}
