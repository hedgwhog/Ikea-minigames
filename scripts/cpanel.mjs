import { cpSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

execSync("npx next build", { stdio: "inherit" });

const out = "cpanel-upload";
rmSync(out, { recursive: true, force: true });
cpSync(".next/standalone", out, { recursive: true });
cpSync(".next/static", `${out}/.next/static`, { recursive: true }); 
if (existsSync("public")) cpSync("public", `${out}/public`, { recursive: true });

writeFileSync(`${out}/app.js`, 'require("./server.js");\n');
console.log(`\nDone! Zip the "${out}" folder and upload it to cPanel (see README).`);
