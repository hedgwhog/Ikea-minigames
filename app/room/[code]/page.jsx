// Server component: reads the room code from the URL and hands it to the client parts.
import Room from "@/components/Room";
import { RoomProvider } from "@/context/RoomContext";

export default async function RoomPage({ params }) {
  const { code } = await params;
  return (
    <RoomProvider code={code.toUpperCase()}>
      <Room />
    </RoomProvider>
  );
}
