import { defineConfig } from 'vitest/config';

/** 'src/zones/<khu>/themes/<id>/…' → 'theme-<id>'. */
const themeChunk = (id: string): string | null => {
  const m = /[\\/]src[\\/]zones[\\/][^\\/]+[\\/]themes[\\/]([^\\/]+)[\\/]/.exec(id);
  return m ? `theme-${m[1]}` : null;
};
/** Module chỉ tới được qua import động zones/outside/secretActs.ts (bốn sự kiện bí mật mặc định). */
const LAZY_SECRETS = /[\\/]src[\\/]zones[\\/]outside[\\/]secret(Acts|Ufo|Rocket|Dragon|DragonShaders|Jet|JetHeart|JetShaders|Halo)\.ts$/;

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rolldownOptions: {
      output: {
        // Chia chunk (docs/THEMES.md mục 5 "Tải lười"): boot (src/boot.ts + phụ thuộc tĩnh) · vendor (three, pitchy: ít đổi,
        // cache lâu) · app (game + builder mặc định + UI) · secrets (tải khi Hype cao) · theme-<id> (tải khi chọn phong cách).
        // Nhóm tải lười KHÔNG kéo theo phụ thuộc: phụ thuộc dùng chung phải nằm ở chunk tải trước, nếu không app sẽ import
        // tĩnh chunk lười và tải nó ngay lúc mở trang.
        codeSplitting: {
          groups: [
            { name: 'boot', tags: ['$initial'], priority: 30 },
            { name: 'vendor', test: /[\\/]node_modules[\\/]/, priority: 20 },
            { name: 'secrets', test: LAZY_SECRETS, priority: 17, includeDependenciesRecursively: false },
            { name: themeChunk, priority: 16, includeDependenciesRecursively: false },
            // main.ts có top-level await (chờ chunk phong cách lúc mở trang) → để ở chunk RIÊNG: nếu chung chunk với module
            // mà chunk phong cách import, import động chunk phong cách sẽ chờ chính main.ts → kẹt (deadlock).
            { name: 'app', test: /[\\/]src[\\/](?!main\.ts$)/, priority: 10 },
          ],
        },
      },
    },
  },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
