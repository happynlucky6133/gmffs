import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  webpack(config) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    config.resolve = {
      ...config.resolve,
      conditionNames: [
        "workerd",
        ...(config.resolve?.conditionNames ?? []),
      ],
    };

    return config;
  },
};

export default nextConfig;
