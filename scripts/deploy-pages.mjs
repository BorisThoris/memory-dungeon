// Deploy the built renderer straight to the production Pages project from this machine.
//
// `yarn deploy:pages` builds `dist` and publishes it to `memory-dungeon-git` (the alias the game
// is served from), so a release does not wait on Cloudflare's git build. Wrangler reads the
// checkout's git metadata and would file the upload as a Preview of whatever branch is checked
// out; passing the production branch AND the commit hash explicitly is what makes it take
// production (measured 2026-09-29: `--branch main` alone still landed as a Preview).
import { execSync } from 'node:child_process';

const run = (command) => execSync(command, { stdio: 'inherit' });
const head = execSync('git rev-parse --short HEAD').toString().trim();
run('yarn -s build:renderer');
run(`npx wrangler pages deploy dist --project-name=memory-dungeon-git --branch main --commit-hash=${head} --commit-dirty=true`);
