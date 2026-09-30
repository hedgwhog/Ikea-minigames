/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" = the build also makes a small self-contained server in .next/standalone.
  // Vercel ignores it; cPanel (Namecheap) uses it. See README -> cPanel.
  output: "standalone",
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"], // test on your phone in the same wifi
};
export default nextConfig;
