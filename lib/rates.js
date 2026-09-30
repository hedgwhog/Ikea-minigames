// Exchange rates from Frankfurter (free, no key, European Central Bank data).
import { cache } from "react";

const BACKUP = { EUR: 1, SEK: 11.2, USD: 1.1, GBP: 0.85, NOK: 11.7, DKK: 7.46 };

export const getRates = cache(async () => {
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR", { next: { revalidate: 86400 } });
    const { rates } = await res.json();
    if (rates?.SEK) return { EUR: 1, ...rates };
  } catch {}
  return BACKUP;
});
