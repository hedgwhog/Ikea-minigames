"use client";
import { useActionState } from "react";
import { useRoom } from "@/context/RoomContext";
import { useTimeLeft } from "@/hooks/useTimeLeft";
import { nameOf } from "@/lib/constants";
import { convert, CURRENCIES } from "@/lib/games/price";
import ProductImage, { money } from "./ProductImage";

export default function PriceGuess() {
  const { me, room, send } = useRoom();
  const game = room.game;
  const seconds = useTimeLeft(game.endsAt);
  const reveal = game.stage === "reveal" && game.last;

  // useActionState with a normal function: gets the form data, `pending` while sending
  const [, guess, pending] = useActionState(async (_, form) => {
    await send({ type: "game", value: form.get("guess"), currency: form.get("currency") });
  }, null);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 [&>*]:min-w-0">
      <div className="rounded-xl bg-white p-4">
        <ProductImage product={game.item} className="mx-auto aspect-square w-full max-w-xs" />
      </div>

      <div className="space-y-4">
        <p className="text-sm font-bold text-muted">Product {game.q + 1} of 5 · {Math.ceil(seconds)}s</p>
        <div>
          <span className="tag text-xl">{game.item.name}</span>
          <p className="mt-1 text-muted">{game.item.type}</p>
        </div>

        {reveal ? (
          <div className="space-y-2">
            <p className="text-4xl font-black text-blue [[data-theme=dark]_&]:text-yellow">{money(reveal.price, reveal.currency)}</p>
            {CURRENCIES.filter((c) => c !== reveal.currency).map((c) => (
              <p key={c} className="text-muted">≈ {money(convert(reveal.price, reveal.currency, c, game.rates), c)}</p>
            ))}
            {Object.entries(reveal.gained).map(([id, points]) => (
              <p key={id} className="flex justify-between rounded-lg bg-page px-3 py-2">
                <b>{nameOf(room, id)}</b>
                <span>{reveal.typed[id] ? money(reveal.typed[id].value, reveal.typed[id].currency) : "no guess"} · +{points}</span>
              </p>
            ))}
          </div>
        ) : game.guessed.includes(me) ? (
          <p className="font-bold">Locked in! Waiting for the others ({game.guessed.length}/{game.playerIds.length})</p>
        ) : (
          <form action={guess} key={game.q} className="space-y-2">
            <div className="flex gap-2">
              {CURRENCIES.map((c) => (
                <label key={c} className="cursor-pointer rounded-full border-2 border-line px-4 py-1 font-bold has-[:checked]:border-blue has-[:checked]:bg-blue has-[:checked]:text-white">
                  <input type="radio" name="currency" value={c} defaultChecked={c === (CURRENCIES.includes(game.item.currency) ? game.item.currency : "EUR")} className="sr-only" />
                  {c === "EUR" ? "€ EUR" : "kr SEK"}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <input name="guess" type="number" min="0" required autoFocus placeholder="Your guess"
                className="w-full min-w-0 flex-1 rounded-full border-2 border-ink bg-page px-4 text-lg font-bold" />
              <button className="btn-blue" disabled={pending}>Guess</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
