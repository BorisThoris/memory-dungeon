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
    "deploymentUrl": "https://memory-dungeon-git.pages.dev/",
    "title": "Memory Dungeon",
    "subtitle": "Seeker of Shards: a memory roguelite",
    "description": "A memory roguelite: read the board, match the pairs and protect the streak while relics bend the rules and every run deals deeper, harder boards. Run modes, a collection to unlock, local saves and an Electron build aimed at Steam.",
    "tags": [
      "Roguelite",
      "Memory Game",
      "React",
      "Electron",
      "Steam"
    ],
    "accent": "#f59e0b",
    "localUrl": "http://127.0.0.1:4102/",
    "buildCommand": "yarn build:cloudflare",
    "buildOutput": "dist",
    "runCommand": "yarn dev:renderer --host 127.0.0.1 --port 4102",
    "devPort": 4102,
    "showcaseTier": "showcase",
    "showcaseOrder": 2
  },

  // How the portfolio screenshot pipeline photographs this project.
  // The deployment opens on the studio splash; the card should show the game
  // behind it, so the recipe clicks through before it photographs.
  capture: {
    "route": "/",
    "actions": [
      {
        "type": "click",
        "target": { "text": "Continue to game" },
        "label": "leave the studio splash"
      },
      { "type": "wait", "ms": 1500, "label": "let the title screen settle" }
    ],
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
    "pageTitle": "Memory Dungeon",
    "staticDir": "public",
    "imageName": "og-image.jpg",
    "imageUrlPath": "/og-image.jpg"
  },

  // The icon set is rendered from favicon.svg by scripts/generate-app-icons.mjs.
  icons: {
    "background": "#11131a",
    "themeColor": "#11131a",
    "shortName": "Memory Dungeon"
  },

  media: {
    sourceDir: path.join(portfolioRoot, "public", "project-shots", "memory-dungeon", "latest"),
    publicPathPrefix: "/project-shots/memory-dungeon/latest",
    primaryProfile: "card"
  }
};
