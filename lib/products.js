import { cache } from "react";

const MARKET = "se/en";
const WORDS = [
  "sofa", "lamp", "chair", "table", "shelf", "plant", "mug", "rug", "cushion", "mirror", "clock", "bed", "desk", "vase",
  "wardrobe", "bookcase", "armchair", "stool", "pillow", "duvet", "frame", "candle", "curtain", "towel",
  "basket", "bowl", "glass", "toy", "storage box", "plush",
];

async function search(word) {
  const url = `https://sik.search.blue.cdtapps.com/${MARKET}/search-result-page?types=PRODUCT&size=24&q=${encodeURIComponent(word)}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });   // Next.js caches this answer for 1 hour, so we don't ask IKEA on every game
  if (!res.ok) throw new Error(`IKEA answered ${res.status}`);
  const items = (await res.json()).searchResultPage?.products?.main?.items ?? [];
  return items
    .map(({ product: p }) => ({
      id: String(p?.id ?? p?.itemNo),
      name: p?.name,
      type: p?.typeName,
      image: p?.mainImageUrl,
      price: p?.salesPrice?.numeral ?? p?.priceNumeral,
      currency: p?.salesPrice?.currencyCode ?? p?.currencyCode ?? "EUR",
    }))
    .filter((p) => p.name && p.image && p.price > 0);
}

export const getProducts = cache(async () => {
  try {
    const words = [...WORDS].sort(() => Math.random() - 0.5).slice(0, 4);
    const all = (await Promise.all(words.map(search))).flat();
    const unique = [...new Map(all.map((p) => [p.name, p])).values()]; // one per name
    if (unique.length >= 16) return unique;
  } catch (e) {
    console.error("IKEA API failed");
  }
});
