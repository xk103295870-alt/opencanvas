import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const svgPath = path.join(projectRoot, 'public', 'ai-sticky-notes-logo.svg');
const brandingDir = path.join(projectRoot, 'branding', 'icons');
const iconsetDir = path.join(brandingDir, 'mac.iconset');
const publicDir = path.join(projectRoot, 'public');
const renderHtmlPath = path.join(os.tmpdir(), 'ai-sticky-notes-render-logo.html');

const pngSizes = [16, 32, 48, 64, 128, 180, 192, 256, 512, 1024];
const masterPngSize = 1024;
const icoSizes = [16, 32, 48, 64, 128, 256];
const iconsetMap = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removeGeneratedFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      continue;
    }

    if (entry.name === 'README.md') {
      continue;
    }

    fs.rmSync(fullPath, { force: true });
  }
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error('Chrome or Edge executable was not found. Set CHROME_PATH to continue.');
}

function findFfmpeg() {
  const candidates = [
    process.env.FFMPEG_PATH,
    'ffmpeg',
    'C:\\Users\\xk\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.0.1-full_build\\bin\\ffmpeg.exe',
    '/usr/bin/ffmpeg',
    '/opt/homebrew/bin/ffmpeg',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['-version'], { stdio: 'ignore' });
      return candidate;
    } catch {
      // Try next candidate.
    }
  }

  throw new Error('ffmpeg executable was not found. Set FFMPEG_PATH to continue.');
}

function writeRenderHtml() {
  const svgMarkup = fs.readFileSync(svgPath, 'utf8');
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        overflow: hidden;
      }

      body {
        display: grid;
        place-items: center;
      }

      svg {
        width: 100vw;
        height: 100vh;
        display: block;
      }
    </style>
  </head>
  <body>
    ${svgMarkup}
  </body>
</html>
`;

  fs.writeFileSync(renderHtmlPath, html, 'utf8');
}

function generatePng(chromePath, size) {
  const outputPath = path.join(brandingDir, `icon-${size}.png`);
  const renderUrl = pathToFileURL(renderHtmlPath).href;

  execFileSync(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-color-profile=srgb',
      '--default-background-color=00000000',
      '--force-device-scale-factor=1',
      `--window-size=${size},${size}`,
      `--screenshot=${outputPath}`,
      renderUrl,
    ],
    { stdio: 'ignore' },
  );

  return outputPath;
}

function scalePng(ffmpegPath, sourcePath, size) {
  const outputPath = path.join(brandingDir, `icon-${size}.png`);
  execFileSync(
    ffmpegPath,
    [
      '-y',
      '-i',
      sourcePath,
      '-vf',
      `scale=${size}:${size}:flags=lanczos`,
      '-frames:v',
      '1',
      outputPath,
    ],
    { stdio: 'ignore' },
  );

  return outputPath;
}

function buildIco(entries) {
  const header = Buffer.alloc(6 + entries.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  let offset = header.length;
  entries.forEach((entry, index) => {
    const baseOffset = 6 + index * 16;
    const dimension = entry.size >= 256 ? 0 : entry.size;

    header.writeUInt8(dimension, baseOffset);
    header.writeUInt8(dimension, baseOffset + 1);
    header.writeUInt8(0, baseOffset + 2);
    header.writeUInt8(0, baseOffset + 3);
    header.writeUInt16LE(1, baseOffset + 4);
    header.writeUInt16LE(32, baseOffset + 6);
    header.writeUInt32LE(entry.buffer.length, baseOffset + 8);
    header.writeUInt32LE(offset, baseOffset + 12);

    offset += entry.buffer.length;
  });

  return Buffer.concat([header, ...entries.map((entry) => entry.buffer)]);
}

function copyFile(sourcePath, targetPath) {
  fs.copyFileSync(sourcePath, targetPath);
}

function main() {
  ensureDir(brandingDir);
  ensureDir(iconsetDir);
  removeGeneratedFiles(brandingDir);
  ensureDir(iconsetDir);

  const chromePath = findChrome();
  const ffmpegPath = findFfmpeg();
  writeRenderHtml();

  const pngFiles = new Map();
  const masterPngPath = generatePng(chromePath, masterPngSize);
  pngFiles.set(masterPngSize, masterPngPath);

  for (const size of pngSizes) {
    if (size === masterPngSize) {
      continue;
    }

    pngFiles.set(size, scalePng(ffmpegPath, masterPngPath, size));
  }

  const icoBuffer = buildIco(
    icoSizes.map((size) => ({
      size,
      buffer: fs.readFileSync(pngFiles.get(size)),
    })),
  );
  fs.writeFileSync(path.join(brandingDir, 'app.ico'), icoBuffer);

  for (const [fileName, size] of iconsetMap) {
    copyFile(pngFiles.get(size), path.join(iconsetDir, fileName));
  }

  copyFile(path.join(brandingDir, 'app.ico'), path.join(publicDir, 'favicon.ico'));
  copyFile(pngFiles.get(180), path.join(publicDir, 'apple-touch-icon.png'));
  copyFile(pngFiles.get(192), path.join(publicDir, 'icon-192.png'));
  copyFile(pngFiles.get(512), path.join(publicDir, 'icon-512.png'));
  copyFile(pngFiles.get(256), path.join(publicDir, 'icon-256.png'));
  fs.rmSync(renderHtmlPath, { force: true });

  console.log(`Icons generated in ${brandingDir}`);
  console.log('Windows: branding/icons/app.ico');
  console.log('macOS iconset: branding/icons/mac.iconset');
  console.log('Web assets updated: public/favicon.ico, public/apple-touch-icon.png, public/icon-192.png, public/icon-256.png, public/icon-512.png');
}

main();
