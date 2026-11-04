'use strict';

const { app, BrowserWindow, Menu, protocol, shell, session } = require('electron');
const path = require('node:path');
const fsp = require('node:fs/promises');

const APP_SCHEME = 'app';
const APP_HOST = 'drawnix';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const WEB_ROOT = path.join(__dirname, 'dist');

// A real origin (not file://) so IndexedDB / localforage autosave persists
// between launches, and so the app counts as a secure context for clipboard
// and File System Access APIs.
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function safeResolve(urlPath) {
  const rel = decodeURIComponent(urlPath).replace(/^\/+/, '') || 'index.html';
  const resolved = path.resolve(WEB_ROOT, rel);
  if (resolved !== WEB_ROOT && !resolved.startsWith(WEB_ROOT + path.sep)) {
    return null;
  }
  return resolved;
}

async function serveFromWebRoot(request) {
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  if (url.host !== APP_HOST) {
    return new Response('Not found', { status: 404 });
  }

  let filePath = safeResolve(url.pathname);
  if (!filePath) {
    return new Response('Forbidden', { status: 403 });
  }

  let stat = null;
  try {
    stat = await fsp.stat(filePath);
  } catch {
    stat = null;
  }

  // Single page app: unknown extension-less paths fall back to index.html.
  if (!stat || stat.isDirectory()) {
    if (!path.extname(url.pathname)) {
      filePath = path.join(WEB_ROOT, 'index.html');
      try {
        stat = await fsp.stat(filePath);
      } catch {
        stat = null;
      }
    }
    if (!stat || stat.isDirectory()) {
      return new Response('Not found', { status: 404 });
    }
  }

  const body = await fsp.readFile(filePath);
  const type =
    MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      'content-type': type,
      // Staged assets are hashed by the bundler; index.html must stay fresh.
      'cache-control': path.basename(filePath) === 'index.html'
        ? 'no-store'
        : 'public, max-age=31536000, immutable',
    },
  });
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Drawnix',
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Keep the app inside its own window; anything external belongs to the
  // user's real browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${APP_ORIGIN}/`)) {
      event.preventDefault();
      if (/^https?:/i.test(url)) {
        shell.openExternal(url);
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(`${APP_ORIGIN}/index.html`);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    protocol.handle(APP_SCHEME, serveFromWebRoot);

    // The upstream page ships a web analytics snippet. This build is a local
    // desktop app: drop it and any other telemetry beacon instead of calling out.
    const defaultSession = session.defaultSession;
    defaultSession.webRequest.onBeforeRequest(
      { urls: ['*://cloud.umami.is/*', '*://*.umami.is/*'] },
      (details, callback) => callback({ cancel: true })
    );

    // Needed for "copy as image" (SVG/PNG) which writes to the system clipboard.
    defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      const allowed = [
        'clipboard-read',
        'clipboard-sanitized-write',
        'fullscreen',
      ];
      callback(allowed.includes(permission));
    });

    Menu.setApplicationMenu(null);
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
