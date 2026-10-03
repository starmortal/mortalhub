// Harden post-content images. Everything here happens once, at build time — the
// browser only ever sees the finished attributes.
//
// 1. referrerpolicy="no-referrer"  — bypasses image-host hotlink protection
// 2. width/height                  — reserved box before the bytes arrive (CLS)
// 3. loading / fetchpriority       — first image is not queued behind the lazy
//                                    ones (LCP), the rest stay lazy
//
// Sizes come from probing the file header (PNG / JPEG / GIF / WebP). Reading the
// header only — never decoding the image — keeps this dependency-free and fast;
// results are memoised per build.
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PUBLIC_DIR = fileURLToPath(new URL('../../public', import.meta.url));

// path + mtime → [width, height] | null
const sizeCache = new Map();

const probePng = (buf) =>
  buf.length > 24 && buf.readUInt32BE(12) === 0x49484452
    ? [buf.readUInt32BE(16), buf.readUInt32BE(20)]
    : null;

const probeJpeg = (buf) => {
  let offset = 2;

  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buf[offset + 1];

    // Standalone markers carry no length field
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    // SOF0–SOF15 hold the frame size; C4/C8/CC are not frame headers
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return [buf.readUInt16BE(offset + 7), buf.readUInt16BE(offset + 5)];
    }

    const length = buf.readUInt16BE(offset + 2);

    if (length <= 0) {
      return null;
    }

    offset += 2 + length;
  }

  return null;
};

const probeGif = (buf) => [buf.readUInt16LE(6), buf.readUInt16LE(8)];

const probeWebp = (buf) => {
  const chunk = buf.toString('ascii', 12, 16);

  if (chunk === 'VP8 ') {
    return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  }

  if (chunk === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }

  if (chunk === 'VP8X') {
    const read24 = (at) => buf[at] | (buf[at + 1] << 8) | (buf[at + 2] << 16);
    return [read24(24) + 1, read24(27) + 1];
  }

  return null;
};

const probe = (buf) => {
  if (buf.length < 16) {
    return null;
  }

  if (buf.readUInt32BE(0) === 0x89504e47) {
    return probePng(buf);
  }

  if (buf[0] === 0xff && buf[1] === 0xd8) {
    return probeJpeg(buf);
  }

  const head = buf.toString('ascii', 0, 4);

  if (head === 'GIF8') {
    return probeGif(buf);
  }

  if (head === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return probeWebp(buf);
  }

  return null;
};

// Only images served from this site can be probed; remote and data: URLs are
// left alone, as are relative paths (their on-disk home isn't knowable here).
const readSize = (src) => {
  if (typeof src !== 'string' || !src.startsWith('/')) {
    return null;
  }

  const file = path.join(PUBLIC_DIR, src);

  try {
    const stamp = statSync(file).mtimeMs;
    const key = `${file}:${stamp}`;

    if (sizeCache.has(key)) {
      return sizeCache.get(key);
    }

    const size = probe(readFileSync(file));
    sizeCache.set(key, size);

    return size;
  } catch {
    sizeCache.set(`${file}:missing`, null);
    return null;
  }
};

const visit = (node, fn) => {
  if (!node) {
    return;
  }

  if (node.type === 'element') {
    fn(node);
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      visit(child, fn);
    }
  }
};

export default function rehypeImgAttrs() {
  return (tree, file) => {
    // An article that already has a cover renders it above the fold with high
    // priority, so the first body image doesn't need the same treatment.
    const hasCover = Boolean(file?.data?.astro?.frontmatter?.cover);
    let seen = 0;

    visit(tree, (node) => {
      if (node.tagName !== 'img') {
        return;
      }

      node.properties = node.properties ?? {};
      node.properties.referrerPolicy = 'no-referrer';
      node.properties.decoding ??= 'async';

      if (seen === 0 && !hasCover) {
        node.properties.loading ??= 'eager';
        node.properties.fetchpriority ??= 'high';
      } else {
        node.properties.loading ??= 'lazy';
      }

      seen += 1;

      if (node.properties.width == null || node.properties.height == null) {
        const size = readSize(node.properties.src);

        if (size) {
          node.properties.width = size[0];
          node.properties.height = size[1];
        }
      }
    });
  };
}
