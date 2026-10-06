import { getProducts } from "./products.js";
import { getRates } from "./rates.js";

export async function getExtras() {
  const [products, rates] = await Promise.all([getProducts(), getRates()]);
  return { products, rates };
}