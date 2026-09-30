// npm run cpanel
// Builds the site and puts everything cPanel needs in ONE folder: cpanel-upload/
// Zip that folder, upload it in cPanel, done. (No "npm install" or building on the server.)
import { cpSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

execSync("npx next build", { stdio: "inherit" });

const out = "cpanel-upload";
rmSync(out, { recursive: true, force: true });
cpSync(".next/standalone", out, { recursive: true }); // server.js + the node_modules it needs
cpSync(".next/static", `${out}/.next/static`, { recursive: true }); // css / js
if (existsSync("public")) cpSync("public", `${out}/public`, { recursive: true }); // your pictures

// cPanel's Node.js app starts "app.js" by default: make it start the Next.js server
writeFileSync(`${out}/app.js`, 'require("./server.js");\n');
console.log(`\nDone! Zip the "${out}" folder and upload it to cPanel (see README).`);
