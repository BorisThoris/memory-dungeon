/**
 * Vite dev-only: serve project import graph, blueprint codegen, and allowlisted ts-morph POC.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Project, SyntaxKind } from 'ts-morph';
import { buildProjectGraphData } from './graph-project.mjs';
import { runBlueprintCodegen } from './blueprint-codegen.mjs';
import { buildSystemDiagramData } from './system-diagrams.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const allowlist = () => {
    const p = path.join(__dirname, 'ast-allowlist.json');
    if (!fs.existsSync(p)) {
        return { files: [] };
    }
    return JSON.parse(fs.readFileSync(p, 'utf8'));
};

const toPosix = (f) => f.split(path.sep).join('/');

function sendJson(res, status, body) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
}

const pocConstName = 'BLUEPRINT_AST_POC';

/**
 * @returns {import('vite').Plugin}
 */
export function viteDevBlueprintApi() {
    return {
        name: 'vite-dev-blueprint-api',
        apply: 'serve',
        /** Run before the default / React stack so SPA `index.html` fallback never swallows `GET /__api/*`. */
        enforce: 'pre',
        configureServer(server) {
            const pathname = (u) => (u || '').split('?')[0];
            server.middlewares.use((req, res, next) => {
                if (!req.url) {
                    return next();
                }
                if (req.method === 'GET' && pathname(req.url) === '/__api/project-graph') {
                    try {
                        const data = buildProjectGraphData(repoRoot);
                        sendJson(res, 200, data);
                    } catch (e) {
                        sendJson(res, 500, { error: String((e).message || e) });
                    }
                    return;
                }
                if (req.method === 'GET' && pathname(req.url) === '/__api/system-diagrams') {
                    try {
                        const data = buildSystemDiagramData(repoRoot);
                        sendJson(res, 200, data);
                    } catch (e) {
                        sendJson(res, 500, { error: String((e).message || e) });
                    }
                    return;
                }
                if (req.method === 'GET' && pathname(req.url) === '/__api/ast-allowlist') {
                    sendJson(res, 200, allowlist());
                    return;
                }
                if (req.method === 'GET' && pathname(req.url) === '/__api/ast-poc') {
                    const qs = (req.url || '').includes('?') ? (req.url || '').split('?')[1] : '';
                    const u = new URLSearchParams(qs);
                    const rel = (u.get('path') || '').replaceAll('\\', '/');
                    const abs = path.join(repoRoot, rel);
                    const norm = toPosix(path.relative(repoRoot, path.normalize(abs)));
                    if (norm !== rel) {
                        sendJson(res, 400, { error: 'path escape' });
                        return;
                    }
                    const allowed = new Set(allowlist().files.map((f) => f.replaceAll('\\', '/')));
                    if (!rel || !allowed.has(rel) || !fs.existsSync(abs)) {
                        sendJson(res, 403, { error: 'not in allowlist or missing' });
                        return;
                    }
                    const content = fs.readFileSync(abs, 'utf8');
                    sendJson(res, 200, { path: rel, content });
                    return;
                }
                if (req.method === 'POST' && pathname(req.url) === '/__api/ast-poc-mutate') {
                    const chunks = [];
                    req.on('data', (c) => chunks.push(c));
                    req.on('end', () => {
                        const raw = Buffer.concat(chunks).toString('utf8');
                        let body;
                        try {
                            body = JSON.parse(raw || '{}');
                        } catch {
                            sendJson(res, 400, { error: 'invalid JSON' });
                            return;
                        }
                        const rel = String(body.path || body.file || '').replaceAll('\\', '/');
                        if (!rel || !allowlist().files.map((f) => f.replaceAll('\\', '/')).includes(rel)) {
                            sendJson(res, 403, { error: 'not allowlisted' });
                            return;
                        }
                        const abs = path.join(repoRoot, rel);
                        try {
                            const out = buildAstPocPreview(abs);
                            if (body.apply === true) {
                                fs.writeFileSync(abs, out.newContent, 'utf8');
                                sendJson(res, 200, { ok: true, path: rel, diff: out.diff, previousValue: out.previousValue, nextValue: out.nextValue });
                            } else {
                                sendJson(res, 200, { preview: out.newContent, diff: out.diff, previousValue: out.previousValue, nextValue: out.nextValue });
                            }
                        } catch (e) {
                            sendJson(res, 500, { error: String(e.message || e) });
                        }
                    });
                    return;
                }
                if (req.method === 'POST' && pathname(req.url) === '/__api/blueprint-codegen') {
                    try {
                        const r = runBlueprintCodegen({ repoRoot, definitionsDir: 'src/blueprint/definitions' });
                        sendJson(res, 200, r);
                    } catch (e) {
                        sendJson(res, 500, { error: String((e).message || e) });
                    }
                    return;
                }
                return next();
            });
        }
    };
}

/**
 * @param {string} absPath
 * @returns {{ newContent: string, diff: string, previousValue: number, nextValue: number }}
 */
function buildAstPocPreview(absPath) {
    const project = new Project();
    const sf = project.addSourceFileAtPath(absPath);
    const decl = sf.getVariableDeclaration(pocConstName);
    if (!decl) {
        throw new Error(`missing ${pocConstName}`);
    }
    const init = decl.getInitializer();
    if (!init) {
        throw new Error('missing initializer');
    }
    const n = init.getFirstChildByKind(SyntaxKind.NumericLiteral);
    if (!n) {
        throw new Error('POC value must be a numeric literal');
    }
    const previousValue = parseInt(n.getText(), 10);
    if (Number.isNaN(previousValue)) {
        throw new Error('not a number');
    }
    const nextValue = previousValue + 1;
    n.replaceWithText(String(nextValue));
    const newContent = sf.getFullText();
    const diff = `--- before\n+++ after\n@@\n- ${pocConstName} = ${previousValue}\n+ ${pocConstName} = ${nextValue}\n`;
    return { newContent, diff, previousValue, nextValue };
}
