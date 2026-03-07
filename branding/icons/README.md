# Icon Assets

This directory is generated from `public/ai-sticky-notes-logo.svg`.

## Generate

```bash
npm run icons:generate
```

## Outputs

- `app.ico`: Windows desktop and installer icon
- `icon-*.png`: shared PNG sizes
- `mac.iconset/`: source set for macOS `iconutil`

## Build `app.icns` on macOS

Run this on a Mac:

```bash
iconutil -c icns branding/icons/mac.iconset -o branding/icons/app.icns
```
