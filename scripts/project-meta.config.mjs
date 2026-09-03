// Metadata inputs for this repository - unique to memory-dungeon.
//
// Everything here is curated by hand. Derived facts (stack, metrics, git,
// screenshots) are computed by scripts/generate-project-meta.mjs, which writes
// project.meta.json. Run it with:
//   npm run meta          regenerate project.meta.json
//   npm run meta:check    fail if project.meta.json is stale

import path from 'node:path';

// Screenshots are captured by the portfolio (npm run capture there). Point
// PORTFOLIO_ROOT elsewhere, or drop images in ./project-media, to override.
const portfolioRoot = process.env.PORTFOLIO_ROOT ?? String.raw`C:\Users\Gaming PC\Desktop\Repos\portfolio`;

export default {
  slug: "memory-dungeon",
  classification: "web-app",

  curated: {
    "title": "Memory Dungeon",
    "subtitle": "Steam-focused memory roguelite",
    "description": "A Windows-first arcade rebuild with run modes, relics, procedural boards, local saves, Electron shell, and polished long-run gameplay feedback.",
    "tags": [
      "React",
      "Three.js",
      "Electron",
      "TypeScript"
    ],
    "accent": "#f59e0b",
    "deploymentUrl": "https://memory-dungeon-git.pages.dev/",
    "localUrl": "http://127.0.0.1:4102/",
    "buildCommand": "yarn build:cloudflare",
    "buildOutput": "dist",
    "runCommand": "yarn dev:renderer --host 127.0.0.1 --port 4102",
    "devPort": 4102,
    "showcaseTier": "showcase",
    "showcaseOrder": 2
  },

  // How the portfolio screenshot pipeline photographs this project.
  capture: {
    "route": "/",
    "waitAfterReadyMs": 2200
  },

  scores: {
    "priorityScore": 94,
    "demoabilityScore": 94,
    "depthScore": 97,
    "polishScore": 92,
    "uniquenessScore": 95,
    "maintenanceScore": 90
  },

  analysisNotes:
    "Deep game project with renderer build, Electron path, visual/gameplay gates, assets, and stable local/deployed demo flow.",

  // Where the link-preview card lives: the page head that carries the Open
  // Graph tags, and the static directory the image is published from.
  social: {
    "htmlFile": "index.html",
    "staticDir": "public",
    "imageName": "og-image.jpg",
    "imageUrlPath": "/og-image.jpg"
  },

  media: {
    sourceDir: path.join(portfolioRoot, "public", "project-shots", "memory-dungeon", "latest"),
    publicPathPrefix: "/project-shots/memory-dungeon/latest",
    primaryProfile: "card"
  }
};
