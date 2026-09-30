// Open /api/health to check the database. Shows variable NAMES only, never secrets.
import { storageReport } from "@/lib/store";

export const dynamic = "force-dynamic";
export const GET = () => Response.json(storageReport());
