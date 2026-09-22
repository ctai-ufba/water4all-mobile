/**
 * @file pwaAssets.test.ts
 * @summary Validity tests for the Web App Manifest and the static PWA assets.
 * @description Checks the files a browser reads before it will offer installation: the manifest's
 * required members, icons that exist at the sizes they claim, and the document links that point at
 * them. These assets are never imported by the app, so nothing else would notice a manifest typo
 * or a deleted icon until an installation silently stopped being offered.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SERVICE_WORKER_FILENAME } from '../services/serviceWorkerRegistration';

/** Vitest runs from the project root, which is where the untracked-by-the-bundler assets live. */
const PROJECT_ROOT = process.cwd();

/**
 * Reads a project file as text.
 *
 * @param relativePath - Path from the project root, in POSIX form.
 * @returns The file contents.
 * @throws When the file does not exist, which is the assertion these tests make.
 */
function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(PROJECT_ROOT, relativePath), 'utf-8');
}

/**
 * Reads the pixel dimensions a PNG declares in its header.
 *
 * @summary PNG dimensions.
 * @description Parses the 8-byte signature and the IHDR chunk, which the spec requires to be the
 * first chunk, so an icon is checked against the size the manifest advertises rather than trusted.
 *
 * @param relativePath - Path to the PNG from the project root.
 * @returns The image width and height in pixels.
 * @throws When the file is not a PNG.
 */
function readPngDimensions(relativePath: string): { width: number; height: number } {
  const bytes = readFileSync(resolve(PROJECT_ROOT, relativePath));
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  if (!bytes.subarray(0, 8).equals(signature)) {
    throw new Error(`${relativePath} is not a PNG`);
  }

  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

const manifest = JSON.parse(readProjectFile('public/manifest.webmanifest')) as {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: ManifestIcon[];
};

const indexHtml = readProjectFile('index.html');

describe('Web App Manifest', () => {
  it('declares the members a browser requires before offering installation', () => {
    expect(manifest.name).toBe('Water4All - Farm Water Monitoring');
    expect(manifest.short_name).toBe('Water4All');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.scope).toBeTruthy();
  });

  it('paints the agricultural deep slate shell, matching the document theme colour', () => {
    expect(manifest.theme_color).toBe('#020617');
    expect(manifest.background_color).toBe('#020617');
    // A mismatch shows as a colour flash between the splash screen and the app.
    expect(indexHtml).toContain(`<meta name="theme-color" content="${manifest.theme_color}" />`);
  });

  it('keeps every path relative, so one build serves both the site root and the Pages sub-path', () => {
    expect(manifest.start_url.startsWith('/')).toBe(false);
    expect(manifest.scope.startsWith('/')).toBe(false);
    manifest.icons.forEach((icon) => expect(icon.src.startsWith('/')).toBe(false));
  });

  it('offers the 192px and 512px icons launchers ask for', () => {
    const anyPurpose = manifest.icons.filter((icon) => icon.purpose === 'any');

    expect(anyPurpose.map((icon) => icon.sizes).sort()).toEqual(['192x192', '512x512']);
  });

  it('offers a maskable icon, so Android crops the plate rather than the mark', () => {
    const maskable = manifest.icons.filter((icon) => icon.purpose === 'maskable');

    expect(maskable).toHaveLength(1);
    expect(maskable[0].sizes).toBe('512x512');
  });

  it.each([
    ['icons/icon-192.png', 192],
    ['icons/icon-512.png', 512],
    ['icons/icon-maskable-512.png', 512],
  ])('ships %s as a PNG of the declared size', (src, size) => {
    const declared = manifest.icons.find((icon) => icon.src === src);

    expect(declared?.type).toBe('image/png');
    expect(readPngDimensions(`public/${src}`)).toEqual({ width: size, height: size });
  });
});

describe('PWA document links', () => {
  it('links the manifest relatively from the document', () => {
    expect(indexHtml).toContain('<link rel="manifest" href="./manifest.webmanifest" />');
  });

  it('links an apple-touch-icon, which is how iOS takes an icon to the home screen', () => {
    expect(indexHtml).toContain('<link rel="apple-touch-icon" href="./icons/icon-192.png" />');
    expect(readPngDimensions('public/icons/icon-192.png').width).toBe(192);
  });

  it('declares standalone web app capability for iOS', () => {
    expect(indexHtml).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
  });
});

describe('Service worker asset', () => {
  it('ships the worker the registration flow asks for, at the base path', () => {
    const worker = readProjectFile(`public/${SERVICE_WORKER_FILENAME}`);

    expect(worker).toContain("addEventListener('install'");
    expect(worker).toContain("addEventListener('fetch'");
  });

  it('precaches the app shell entry points the manifest and document depend on', () => {
    const worker = readProjectFile(`public/${SERVICE_WORKER_FILENAME}`);

    ['./index.html', './manifest.webmanifest', './icons/icon-192.png'].forEach((url) => {
      expect(worker).toContain(`'${url}'`);
    });
  });
});
