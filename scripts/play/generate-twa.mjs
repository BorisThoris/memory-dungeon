// Generates the Trusted Web Activity project for Memory Dungeon with @bubblewrap/core 1.27.0.
// The CLI's `init` is interactive and reads the live manifest, so the TWA manifest is
// written here instead. Run it from a work folder outside the repository that has
// `npm install @bubblewrap/core@1.27.0` (see docs/GOOGLE_PLAY.md):
//   node <repo>/scripts/play/generate-twa.mjs [outDir]       (default ./android)
// appVersionCode must rise with every upload to Play.
import fs from 'node:fs';
import path from 'node:path';
import { TwaManifest, TwaGenerator, ConsoleLog } from '@bubblewrap/core';

const host = 'memory-dungeon-git.pages.dev';
const json = {
  packageId: 'com.boristhoris.memorydungeon',
  host,
  name: 'Memory Dungeon',
  launcherName: 'Memory Dungeon',
  display: 'standalone',
  orientation: 'any',
  themeColor: '#11131a',
  themeColorDark: '#11131a',
  navigationColor: '#11131a',
  navigationColorDark: '#11131a',
  navigationDividerColor: '#11131a',
  navigationDividerColorDark: '#11131a',
  backgroundColor: '#11131a',
  enableNotifications: false,
  startUrl: '/',
  iconUrl: `https://${host}/icon-512.png`,
  maskableIconUrl: `https://${host}/icon-maskable-512.png`,
  splashScreenFadeOutDuration: 300,
  signingKey: {
    path: 'D:/agent-work/memory-dungeon/play-secrets/upload.jks',
    alias: 'upload',
  },
  appVersionName: '1.0.0',
  appVersionCode: 1,
  shortcuts: [],
  generatorApp: 'bubblewrap-core-1.27.0',
  webManifestUrl: `https://${host}/site.webmanifest`,
  fallbackType: 'customtabs',
  features: {},
  alphaDependencies: { enabled: false },
  enableSiteSettingsShortcut: true,
  isChromeOSOnly: false,
  isMetaQuest: false,
  fullScopeUrl: `https://${host}/`,
  minSdkVersion: 24,
  fingerprints: [],
  additionalTrustedOrigins: [],
  retainedBundles: [],
  protocolHandlers: [],
  fileHandlers: [],
  launchHandlerClientMode: '',
  displayOverride: [],
  appVersion: '1.0.0',
};

const out = path.resolve(process.argv[2] ?? 'android');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const manifest = new TwaManifest(json);
const error = manifest.validate();
if (error) throw new Error(error);
await manifest.saveToFile(path.join(out, 'twa-manifest.json'));
await new TwaGenerator().createTwaProject(out, manifest, new ConsoleLog('gen'));

// Bubblewrap signs after Gradle with its own prompts; sign in Gradle instead, with the
// upload key kept outside any repository.
const gradleFile = path.join(out, 'app', 'build.gradle');
const releaseBlock = `    buildTypes {
        release {
            minifyEnabled true
        }
    }`;
const gradle = fs.readFileSync(gradleFile, 'utf8');
if (!gradle.includes(releaseBlock))
  throw new Error('generated build.gradle has no plain release block');
fs.writeFileSync(
  gradleFile,
  gradle.replace(
    releaseBlock,
    `    def keystoreProps = new Properties()
    file(System.getenv('MEMORY_DUNGEON_KEYSTORE_PROPS') ?: 'D:/agent-work/memory-dungeon/play-secrets/keystore.properties').withInputStream { keystoreProps.load(it) }
    signingConfigs {
        upload {
            storeFile file(keystoreProps['storeFile'])
            storePassword keystoreProps['storePassword']
            keyAlias keystoreProps['keyAlias']
            keyPassword keystoreProps['keyPassword']
        }
    }
    buildTypes {
        release {
            minifyEnabled true
            signingConfig signingConfigs.upload
        }
    }`,
  ),
);
console.log('generated', out);
