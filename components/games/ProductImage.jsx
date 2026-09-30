// A product picture from the IKEA API (plain <img>, like everywhere else)
export default function ProductImage({ product, className = "" }) {
  return <img src={product.image} alt={product.name} className={`object-contain ${className}`} />;
}
export const money = (value, currency) =>
  new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
