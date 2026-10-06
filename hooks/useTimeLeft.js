import { useEffect, useState } from "react";
import { useRoom } from "@/context/RoomContext";

export function useTimeLeft(endsAt) {
  const { now } = useRoom();
  const [, rerender] = useState(0);
  useEffect(() => {
    const id = setInterval(() => rerender((n) => n + 1), 200);
    return () => clearInterval(id);
  }, []);
  return endsAt ? Math.max(0, (endsAt - now()) / 1000) : null;
}
