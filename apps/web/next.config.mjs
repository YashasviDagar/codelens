/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@codelens/types", "@codelens/analyzer"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_URL ?? "http://localhost:4000"}/api/:path*`,
      },
    ];
  },
};
export default nextConfig;

