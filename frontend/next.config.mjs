/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // next/image blocks any host not listed here. Pexels serves the seeded demo
    // photography (backend/scripts/demoImages.js); Cloudinary serves real uploads.
    // placehold.co stays for coverImageOf's unit tests and any database seeded
    // before the Pexels catalogue landed.
    remotePatterns: [
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
};

export default nextConfig;
