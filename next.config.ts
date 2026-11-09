import type { NextConfig } from "next";

// Статический экспорт для GitHub Pages: запускается только при STATIC_EXPORT=1
// (локальная разработка и обычный продакшен продолжают работать как раньше)
const isStaticExport = process.env.STATIC_EXPORT === "1";

// Для GitHub Pages (репозиторий <user>/whiteboard) базовый путь = /whiteboard.
// Имя репозитория можно переопределить через NEXT_PUBLIC_BASE_PATH.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/whiteboard";

const nextConfig: NextConfig = isStaticExport
  ? {
      output: "export",
      basePath,
      trailingSlash: true,
      images: { unoptimized: true },
      typescript: { ignoreBuildErrors: true },
      reactStrictMode: false,
    }
  : {
      output: "standalone",
      typescript: { ignoreBuildErrors: true },
      reactStrictMode: false,
    };

export default nextConfig;
