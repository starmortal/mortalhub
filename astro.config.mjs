import { defineConfig } from 'astro/config';
import rehypeCodeBlocks from './src/lib/rehype-code-blocks.mjs';
import rehypeImgAttrs from './src/lib/rehype-img-attrs.mjs';
import rehypeLegacyShortcodes from './src/lib/rehype-legacy-shortcodes.mjs';
import remarkImageGrid from './src/lib/remark-image-grid.mjs';
import remarkLegacyShortcodes from './src/lib/remark-legacy-shortcodes.mjs';
import shikiCodeBlocks from './src/lib/shiki-code-blocks.mjs';

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://hub.supermortal.cn',
  server: {
    port: 26102,
  },
  redirects: {
    '/projects': '/about',
  },
  markdown: {
    remarkPlugins: [remarkLegacyShortcodes, remarkImageGrid],
    rehypePlugins: [rehypeLegacyShortcodes, rehypeImgAttrs, rehypeCodeBlocks],
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      transformers: [shikiCodeBlocks()],
    },
  },
});
