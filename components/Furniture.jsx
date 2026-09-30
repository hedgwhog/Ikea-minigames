import { characterImage } from "@/lib/constants";

// A player's furniture picture (public/furniture/<id>.png)
export default function Furniture({ id, className = "h-10 w-10" }) {
  return <img src={characterImage(id)} alt={id} className={`object-contain ${className}`} />;
}
