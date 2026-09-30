// Deploy the built renderer straight to the production Pages project from this machine.
//
// `yarn deploy:pages` builds `dist` and publishes it to `memory-dungeon-git` (the alias the game
// is served from), so a release does not wait on Cloudflare's git build. Wrangler reads the
// checkout's git metadata and would file the upload as a Preview of whatever branch is checked
// out; passing the production branch AND the commit hash explicitly is what makes it take
// production (measured 2026-09-29: `--branch main` alone still landed as a Preview).
import { execSync } from 'node:child_process';

// `--project=<name>` deploys somewhere other than production: `yarn deploy:pages:test` sends a build to
// the test realm (`memory-dungeon-test`, created 2026-09-30) so unreleased rules can be played
// without touching the live game.
const projectArg = process.argv.find((arg) => arg.startsWith('--project='));
const project = projectArg ? projectArg.slice('--project='.length) : 'memory-dungeon-git';

const run = (command) => execSync(command, { stdio: 'inherit' });
const head = execSync('git rev-parse --short HEAD').toString().trim();
run('yarn -s build:renderer');
// The test realm is a Workers static site (`wrangler.toml` already describes one: `./dist`, SPA
// fallback), so it deploys by name with `wrangler deploy`; production stays a Pages project.
if (project === 'memory-dungeon-test') {
    run(`npx wrangler deploy --name ${project}`);
} else {
    run(`npx wrangler pages deploy dist --project-name=${project} --branch main --commit-hash=${head} --commit-dirty=true`);
}
