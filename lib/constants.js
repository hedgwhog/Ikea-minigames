export const MAX_ROOMS = 3;

// One piece of furniture per player. The furniture name is the player's name. (Images are in .png)
export const CHARACTERS = [
  { id: "billy", name: "BILLY" },
  { id: "klippan", name: "KLIPPAN" },
  { id: "poaen", name: "POÄNG" },
  { id: "lampan", name: "LAMPAN" },
  { id: "frakta", name: "FRAKTA" },
  { id: "lack", name: "LACK" },
];
export const MAX_PLAYERS = CHARACTERS.length;
export const characterImage = (id) => `/furniture/${id}.png`;

// The games. All the games are played in order
export const GAMES = [
  { id: "catch", title: "Meatball Catch", howto: "Everyone shares one kitchen. Catch the most meatballs. Golden ones are worth 5." },
  { id: "hide", title: "Hide & Seek", howto: "Hide in any open spot. The seeker checks one random spot, and then that spot is closed." },
  { id: "runner", title: "Warehouse Rush", howto: "Run through the warehouse, switch lanes, jump over boxes, crouch under shelves." },
  { id: "bumper", title: "Ikea Battle Royal", howto: "The store is closing. Stay in the light and knock the others out." },
  { id: "sofa", title: "Sofa Says", howto: "Tap the product the sofa asks for before the time runs out. 2 lives." },
  { id: "sniper", title: "Småland Field", howto: "Run to the finish behind cover, or snipe the runners. 1 point per finish or hit." },
  { id: "price", title: "Guess The Price", howto: "Real IKEA products. Guess the price, closer is more points." },
];

// Hide & Seek spots. Pictures: ./spots/[ID].png
export const SPOTS = [
  { id: "wardrobe", label: "In the Wardrobe" },
  { id: "bed", label: "Under the bed" },
  { id: "curtains", label: "Behind the Curtains" },
  { id: "sofa", label: "Behind the sofa" },
  { id: "desk", label: "Under the Desk" },
  { id: "bookcase", label: "Behind the Bookcase" },
  { id: "boxes", label: "In the box" },
  { id: "rug", label: "Under the Rug" },
  { id: "lounger", label: "Under the Lounger" },
];

export const nameOf = (room, id) => room.players[id]?.name ?? "Someone who left";
