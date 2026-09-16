import { readFileSync } from 'node:fs';
import { registerServiceWorker } from './registerServiceWorker';

afterEach(() => { vi.unstubAllGlobals(); });

test('development is left alone, so the worker never serves stale modules', () => {
  const register = vi.fn();
  vi.stubGlobal('navigator', { serviceWorker: { register } });
  registerServiceWorker(false);
  window.dispatchEvent(new Event('load'));
  expect(register).not.toHaveBeenCalled();
});

test('production registers the worker, but only once the page has loaded', () => {
  const register = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { serviceWorker: { register } });
  registerServiceWorker(true);
  // Registering during startup competes with the first render for bandwidth.
  expect(register).not.toHaveBeenCalled();
  window.dispatchEvent(new Event('load'));
  expect(register).toHaveBeenCalledWith('/sw.js');
});

test('a browser without service workers is left alone', () => {
  vi.stubGlobal('navigator', {});
  expect(() => {
    registerServiceWorker(true);
    window.dispatchEvent(new Event('load'));
  }).not.toThrow();
});

test('a refused registration never reaches the user', async () => {
  const register = vi.fn().mockRejectedValue(new Error('storage blocked'));
  vi.stubGlobal('navigator', { serviceWorker: { register } });
  registerServiceWorker(true);
  window.dispatchEvent(new Event('load'));
  await Promise.resolve();
  expect(register).toHaveBeenCalled();
});

test('the manifest declares what an installable app needs', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
  expect(manifest.name).toBe('Sessionboard');
  expect(manifest.start_url).toBe('/');
  expect(manifest.scope).toBe('/');
  expect(manifest.display).toBe('standalone');
  expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/);
  expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/);
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  // Chrome wants a 192 and a 512 raster icon before it will offer to install.
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
});

test('the worker caches the shell and leaves other origins alone', () => {
  const sw = readFileSync('public/sw.js', 'utf8');
  expect(sw).toContain("'/'");
  expect(sw).toContain('/favicon.svg');
  expect(sw).toContain('/manifest.webmanifest');
  // Navigations must try the network first, or a new build would never be picked up.
  expect(sw).toContain("request.mode === 'navigate'");
  expect(sw).toContain('self.location.origin');
});
