// Who am I? A random id per browser TAB (sessionStorage), so you can test with several tabs.
export function getPlayerId() {
  let id = sessionStorage.getItem("playerId");
  if (!id) sessionStorage.setItem("playerId", (id = "p_" + Math.random().toString(36).slice(2, 10)));
  return id;
}
