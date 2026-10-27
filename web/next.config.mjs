/** @type {import('next').NextConfig} */
export default {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: false,
  transpilePackages: ['@phosphor/shared'],
  devIndicators: false, // the dev badge sits on top of the hero's key hint
};
