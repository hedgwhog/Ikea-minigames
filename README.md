# The Showroom: IKEA party minigames

Next.js 16, React 19, Tailwind 4, plain JavaScript. 1 to 6 players, 5 games.

```bash
npm install
npm run dev   # http://localhost:3000  (open several tabs = several players)
```

Add your pictures: see `public/IMAGES.md`.

## Hosting

### Vercel
1. Push to GitHub, import the repo in Vercel.
2. Storage tab -> connect **Upstash for Redis** (or any Redis) to Production + Preview. Vercel **needs** a
   database: every request can run on a different server.
3. Redeploy, then open `https://your-site.vercel.app/api/health` -> `"ready": true`.

### cPanel (Namecheap)
You build on your own computer and upload the result, so the server doesn't have to install or build anything.

1. On your computer (Node 20.9 or newer):
   ```bash
   npm install
   npm run cpanel
   ```
   This makes the folder `cpanel-upload/` (with your pictures from `public/` inside).
2. Zip the **contents** of that folder, including the hidden `.next` folder:
   ```bash
   cd cpanel-upload && zip -r ../showroom.zip . && cd ..
   ```
3. cPanel -> **File Manager** -> make a folder `showroom` in your home folder (**not** inside `public_html`),
   upload `showroom.zip` into it and **Extract**.
4. cPanel -> **Setup Node.js App** -> **Create Application**:
   - Node.js version: **20** or higher (Next.js 16 needs 20.9+)
   - Application mode: Production
   - Application root: `showroom`
   - Application URL: your domain (the root, not a sub-folder)
   - Application startup file: `app.js`

   Click **Create**. You do NOT need "Run NPM Install" (everything is already inside).
5. Open `https://your-domain/api/health`.

**Database on cPanel:** without one, rooms live in the app's memory. That works, but rooms are lost when
cPanel restarts or pauses the app, and if cPanel ever runs two copies of the app, players can end up in
different memories. For a reliable site, add your Upstash keys under **Environment variables** in the
Node.js App screen (`KV_REST_API_URL` and `KV_REST_API_TOKEN`, the same values as on Vercel), then **Restart**.
Vercel and cPanel can even share one Upstash database.

**Updating:** run `npm run cpanel` again, upload + extract (overwrite), then click **Restart** in Setup Node.js App.
New pictures also need a restart (the server reads the `public` folder when it starts).

## Folder map
```
app/            pages (server components), server actions, API routes
components/     the UI (client components), one file per game in components/games/
context/        RoomContext (room data for everyone), ThemeContext (light / dark)
hooks/          useInterval, useKeys, useTimeLeft
lib/            the rules: room.js, games/*.js, store.js (database), products.js (IKEA API)
proxy.js        Next.js middleware
```

## Tech stack: where to find it
| What | Where |
|---|---|
| **useContext** | `context/RoomContext.jsx`, `context/ThemeContext.jsx`, used in every game |
| **useMemo** | ThemeContext value, RoomContext value, Scoreboard sort (`components/Room.jsx`), meatballs from seed (`MeatballCatch.jsx`), map walls (`CartBumper.jsx`) |
| **Middleware** | `proxy.js`: runs before every `/room/XXXX` page. Fixes lower-case codes and sends invalid ones home. React itself has no `useMiddleware` hook; middleware is a Next.js feature (called `proxy.js` since Next 16, `middleware.js` before). |
| useState, useEffect, useRef, useReducer, useCallback | games and contexts |
| Custom hooks | `hooks/` |
| **React client APIs** | `useActionState` (HomeButtons, Room, PriceGuess), `useFormStatus` (Room), `useOptimistic` + `startTransition` (Lobby), `use(promise)` + `<Suspense>` (OpenRooms), `createContext` |
| **React server APIs** | Server Components (`app/page.jsx`, `app/layout.jsx`, room page), Server Functions `"use server"` (`app/actions.js`), `cache()` (`lib/products.js`), `cookies()` (layout reads the theme) |
| Route Handlers | `app/api/rooms/[code]/route.js`, `app/api/health/route.js` |

## Light / dark mode (the lamp)
Click the lamp on the homepage, or pull the cord that hangs from the header on every other page. The choice is saved in a cookie, so the server renders the right mode right away.
Creative uses:
- **Hide & Seek**: in dark mode the room is dark, you search with a flashlight (your mouse or finger), and the seeker's flashlight shows where they look.
- **Cart Bumper**: the closed part of the store is much darker at night.
- **Meatball Catch**: golden meatballs glow brighter in the dark.

## How the games talk to the server
- Normal actions (pick furniture, guess, tap, hide): `POST /api/rooms/CODE`.
- Fast games (Meatball Catch, Cart Bumper): every player moves **in their own browser** (smooth)
  and sends their position ~10x per second as "live" data. Each player has their own slot in
  the database, so players never overwrite each other.
- The server decides points, lives and who is out. Prices and hiding spots stay secret until revealed.

## Rooms clean themselves up
Every 15 seconds the browser tells the server "still here", but only if the player moved the mouse,
touched the screen or pressed a key. Nothing for 1 minute = removed from the room. An empty room is deleted.
This also happens when someone opens the homepage, so forgotten rooms disappear even if nobody has them open.

## The games
1. **Meatball Catch**: all bowls on one big field. The meatballs come from a shared seed, so every
   screen shows the same ones. Caught by someone = gone for everyone.
2. **Price Guess**: 5 real IKEA products (IKEA's public search API, no key needed). Guess in EUR or SEK;
   exchange rates come from Frankfurter (free, European Central Bank data). Change the country in `lib/products.js`.
3. **Sofa Says**: every button is a real product (photo + name). More buttons and less time each round.
4. **Cart Bumper**: a whole IKEA (showroom, restaurant, Småland, market hall, self-serve, cash registers, bistro)
   in `lib/games/bumperMap.js`. Random spawns, the light shrinks to a random spot.
   Space = push, E = dash, Q = switch push mode: Ring (around you, short), Wall (one side, longer), Beam (thin, very far).
5. **Hide & Seek**: the seeker checks one spot per round (always a spot where somebody hides).
   Each spot works once per player, not hiding = caught.

## Change things
| What | Where |
|---|---|
| Furniture (players) | `CHARACTERS` in `lib/constants.js` + picture in `public/furniture/` |
| Hiding spots | `SPOTS` in `lib/constants.js` + picture in `public/spots/` |
| IKEA country / search words | top of `lib/products.js` |
| Store layout | `ZONES` and `WALLS` in `lib/games/bumperMap.js` |
| Colours | top of `app/globals.css` |
