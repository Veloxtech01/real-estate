/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // next/image blocks any host not listed here. placehold.co serves the seeded demo
    // listings; Cloudinary will serve real uploads once media upload is built.
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
