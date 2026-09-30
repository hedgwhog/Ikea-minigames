// Real IKEA products from IKEA's public search API (the same one the python library
// "ikea-api-client" uses). No API key needed. We call it from OUR server, so no CORS problems.
import { cache } from "react";

const MARKET = "se/en"; // country/language, e.g. "gb/en", "nl/nl", "us/en"
const WORDS = ["sofa", "lamp", "chair", "table", "shelf", "plant", "mug", "rug", "cushion", "mirror", "clock", "bed", "desk", "vase"];

async function search(word) {
  const url = `https://sik.search.blue.cdtapps.com/${MARKET}/search-result-page?types=PRODUCT&size=24&q=${word}`;
  // Next.js caches this answer for 1 hour, so we don't ask IKEA on every game
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`IKEA answered ${res.status}`);
  const items = (await res.json()).searchResultPage?.products?.main?.items ?? [];
  return items
    .map(({ product: p }) => ({
      id: String(p?.id ?? p?.itemNo),
      name: p?.name,
      type: p?.typeName,
      image: p?.mainImageUrl,
      price: p?.salesPrice?.numeral ?? p?.priceNumeral,
      currency: p?.salesPrice?.currencyCode ?? p?.currencyCode ?? "SEK",
    }))
    .filter((p) => p.name && p.image && p.price > 0);
}

// React SERVER API cache(): called several times in one request, it only runs once.
export const getProducts = cache(async () => {
  try {
    const words = [...WORDS].sort(() => Math.random() - 0.5).slice(0, 4);
    const all = (await Promise.all(words.map(search))).flat();
    const unique = [...new Map(all.map((p) => [p.name, p])).values()]; // one per name
    if (unique.length >= 16) return unique;
  } catch (e) {
    console.error("IKEA API failed, using backup products:", e.message);
  }
  return BACKUP;
});

// Used only when the IKEA API is down. Images: public/products/<id>.png (optional)
const BACKUP = [
  ["billy", "BILLY", "Bookcase", 599], ["poang", "POÄNG", "Armchair", 1295], ["kallax", "KALLAX", "Shelving unit", 699],
  ["malm", "MALM", "Bed frame", 2495], ["lack", "LACK", "Side table", 99], ["ektorp", "EKTORP", "Sofa", 4995],
  ["markus", "MARKUS", "Office chair", 1995], ["tertial", "TERTIAL", "Work lamp", 199], ["blahaj", "BLÅHAJ", "Soft toy", 249],
  ["frakta", "FRAKTA", "Shopping bag", 12], ["fejka", "FEJKA", "Artificial plant", 79], ["ingolf", "INGOLF", "Chair", 895],
  ["hemnes", "HEMNES", "Chest of drawers", 2995], ["ranarp", "RANARP", "Floor lamp", 699], ["stockholm", "STOCKHOLM", "Rug", 3995],
  ["dundra", "DUNDRA", "Cushion", 149],
].map(([id, name, type, price]) => ({ id, name, type, price, currency: "SEK", image: `/products/${id}.png` }));
