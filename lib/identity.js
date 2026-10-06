// This way you can test things with multiple tabs in the same browser
export function getPlayerId() {
  let id = sessionStorage.getItem("playerId");
  if (!id) sessionStorage.setItem("playerId", (id = "p_" + Math.random().toString(36).slice(2, 10)));
  return id;
}
