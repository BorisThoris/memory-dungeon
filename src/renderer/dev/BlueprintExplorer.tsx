import {
    Background,
    BackgroundVariant,
    Controls,
    type Edge,
    type Node,
    MiniMap,
    ReactFlow,
    ReactFlowProvider,
    useEdgesState,
    useNodes,
    useNodesState,
    useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import styles from './BlueprintExplorer.module.css';

const POC_CONST = 'BLUEPRINT_AST_POC';

type Layer = 'all' | 'main' | 'shared' | 'renderer' | 'other';

type ProjectGraphPayload = {
    nodes: { id: string; label: string; path: string; layer: string }[];
    edges: { id: string; source: string; target: string }[];
    stats: { fileCount: number; edgeCount: number };
};

type ExplorerMode = 'project' | 'systems';

type SystemDiagramPayload = {
    rulesVersion: number | null;
    actions: {
        id: string;
        priority: string;
        status: 'open' | 'done' | string;
        command: string | null;
        system: string;
        title: string;
        detail: string;
        verifies: string;
        evidence: string[];
    }[];
    diagrams: {
        id: string;
        title: string;
        summary: string;
        nodes: { id: string; label: string; kind: string; layer: string; detail: string; evidence: string[] }[];
        edges: { id: string; source: string; target: string; label: string; kind: string }[];
        findings: { id: string; severity: 'info' | 'warning' | 'risk'; title: string; detail: string; evidence: string[] }[];
        stats: { nodeCount: number; edgeCount: number; findingCount: number };
    }[];
    stats: {
        diagramCount: number;
        nodeCount: number;
        edgeCount: number;
        findingCount: number;
        actionCount: number;
        importGraph: { fileCount: number; edgeCount: number; layers: Record<string, number> };
    };
};

const GRID_X = 200;
const GRID_Y = 80;
const COLS = 14;

const layout = (i: number) => ({
    x: (i % COLS) * GRID_X,
    y: Math.floor(i / COLS) * GRID_Y
});

function GraphAutoFit(): null {
    const { fitView } = useReactFlow();
    const nodes = useNodes();
    useEffect(() => {
        if (nodes.length === 0) {
            return;
        }
        const t = requestAnimationFrame(() => {
            fitView({ padding: 0.15, duration: 200 });
        });
        return () => cancelAnimationFrame(t);
    }, [nodes.length, fitView]);
    return null;
}

function BlueprintGraphInner(): ReactElement {
    const [raw, setRaw] = useState<ProjectGraphPayload | null>(null);
    const [systemRaw, setSystemRaw] = useState<SystemDiagramPayload | null>(null);
    const [loadErr, setLoadErr] = useState<string | null>(null);
    const [mode, setMode] = useState<ExplorerMode>('systems');
    const [selectedDiagramId, setSelectedDiagramId] = useState('navigation-flow');
    const [actionPriorityFilter, setActionPriorityFilter] = useState('all');
    const [showOnlyOpenActions, setShowOnlyOpenActions] = useState(true);
    const [filterLayer, setFilterLayer] = useState<Layer>('all');
    const [search, setSearch] = useState('');
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [astAllow, setAstAllow] = useState<string[]>([]);
    const [astPath, setAstPath] = useState('src/shared/blueprintAstPoc.ts');
    const [astDiff, setAstDiff] = useState<string | null>(null);
    const [astMsg, setAstMsg] = useState<string | null>(null);
    const [codegenOut, setCodegenOut] = useState<string | null>(null);

    const applyFilter = useCallback(
        (data: ProjectGraphPayload, layer: Layer, q: string) => {
            const ql = q.trim().toLowerCase();
            const byLayer =
                layer === 'all'
                    ? () => true
                    : (n: (typeof data.nodes)[0]) => n.layer === layer;
            const bySearch = (n: (typeof data.nodes)[0]) => {
                if (!ql) {
                    return true;
                }
                return n.id.toLowerCase().includes(ql) || n.path.toLowerCase().includes(ql) || n.label.toLowerCase().includes(ql);
            };
            const vis = new Set(
                data.nodes
                    .filter((n) => byLayer(n) && bySearch(n))
                    .map((n) => n.id)
            );
            if (vis.size === 0) {
                return { nOut: [] as Node[], eOut: [] as Edge[] };
            }
            const nOut: Node[] = data.nodes
                .filter((n) => vis.has(n.id))
                .map((n, i) => ({
                    id: n.id,
                    position: layout(i),
                    data: { label: n.label, path: n.path, layer: n.layer },
                    type: 'default'
                }));
            const eOut: Edge[] = data.edges
                .filter((e) => vis.has(e.source) && vis.has(e.target))
                .map((e) => ({ id: e.id, source: e.source, target: e.target, animated: false }));
            return { nOut, eOut };
        },
        []
    );

    const applySystemDiagram = useCallback(
        (data: SystemDiagramPayload, diagramId: string, q: string) => {
            const diagram = data.diagrams.find((candidate) => candidate.id === diagramId) ?? data.diagrams[0];
            if (!diagram) {
                return { nOut: [] as Node[], eOut: [] as Edge[] };
            }
            const ql = q.trim().toLowerCase();
            const bySearch = (n: (typeof diagram.nodes)[0]) => {
                if (!ql) {
                    return true;
                }
                return (
                    n.id.toLowerCase().includes(ql) ||
                    n.label.toLowerCase().includes(ql) ||
                    n.kind.toLowerCase().includes(ql) ||
                    n.detail.toLowerCase().includes(ql) ||
                    n.evidence.some((p) => p.toLowerCase().includes(ql))
                );
            };
            const vis = new Set(diagram.nodes.filter(bySearch).map((n) => n.id));
            const nOut: Node[] = diagram.nodes
                .filter((n) => vis.has(n.id))
                .map((n, i) => ({
                    id: n.id,
                    position: layout(i),
                    data: { label: `${n.label}\n${n.kind}`, path: n.evidence[0] ?? n.id, layer: n.layer, detail: n.detail },
                    type: 'default'
                }));
            const eOut: Edge[] = diagram.edges
                .filter((e) => vis.has(e.source) && vis.has(e.target))
                .map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label, animated: e.kind !== 'flow' }));
            return { nOut, eOut };
        },
        []
    );

    useEffect(() => {
        if (!import.meta.env.DEV) {
            return;
        }
        void (async () => {
            try {
                const r = await fetch('/__api/project-graph');
                if (!r.ok) {
                    throw new Error(`HTTP ${r.status}`);
                }
                const ct = (r.headers.get('content-type') || '').toLowerCase();
                if (!ct.includes('application/json')) {
                    const snippet = (await r.text()).slice(0, 120).replace(/\s+/g, ' ');
                    throw new Error(
                        `Expected JSON from /__api/project-graph, got content-type “${ct || 'unknown'}” (${snippet}…). Restart the Vite dev server if you changed vite.config.`
                    );
                }
                const j = (await r.json()) as ProjectGraphPayload;
                if (!j || !Array.isArray(j.nodes) || !Array.isArray(j.edges) || j.stats == null) {
                    throw new Error('Invalid /__api/project-graph payload (missing nodes, edges, or stats).');
                }
                setRaw(j);
            } catch (e) {
                setLoadErr((e as Error).message);
            }
        })();
    }, []);

    useEffect(() => {
        if (!import.meta.env.DEV) {
            return;
        }
        void (async () => {
            try {
                const r = await fetch('/__api/system-diagrams');
                if (!r.ok) {
                    throw new Error(`HTTP ${r.status}`);
                }
                const j = (await r.json()) as SystemDiagramPayload;
                if (!j || !Array.isArray(j.diagrams) || j.stats == null) {
                    throw new Error('Invalid /__api/system-diagrams payload (missing diagrams or stats).');
                }
                setSystemRaw(j);
                if (j.diagrams[0]) {
                    setSelectedDiagramId((current) => j.diagrams.some((diagram) => diagram.id === current) ? current : j.diagrams[0].id);
                }
            } catch (e) {
                setLoadErr((e as Error).message);
            }
        })();
    }, []);

    useEffect(() => {
        if (!import.meta.env.DEV) {
            return;
        }
        void (async () => {
            try {
                const r = await fetch('/__api/ast-allowlist');
                if (r.ok) {
                    const j = (await r.json()) as { files: string[] };
                    setAstAllow(j.files);
                    if (j.files[0]) {
                        setAstPath(j.files[0]);
                    }
                }
            } catch {
                /* ignore in non-vite */
            }
        })();
    }, []);

    useEffect(() => {
        if (mode === 'systems') {
            if (!systemRaw) {
                return;
            }
            const { nOut, eOut } = applySystemDiagram(systemRaw, selectedDiagramId, search);
            setNodes(nOut);
            setEdges(eOut);
            return;
        }
        if (!raw) {
            return;
        }
        const { nOut, eOut } = applyFilter(raw, filterLayer, search);
        setNodes(nOut);
        setEdges(eOut);
    }, [raw, systemRaw, mode, selectedDiagramId, filterLayer, search, applyFilter, applySystemDiagram, setNodes, setEdges]);

    const selectedDiagram = useMemo(() => {
        if (!systemRaw) {
            return null;
        }
        return systemRaw.diagrams.find((diagram) => diagram.id === selectedDiagramId) ?? systemRaw.diagrams[0] ?? null;
    }, [systemRaw, selectedDiagramId]);

    const selectedActions = useMemo(() => {
        if (!systemRaw || !selectedDiagram) {
            return [];
        }
        return systemRaw.actions.filter(
            (item) =>
                item.system === selectedDiagram.title &&
                (actionPriorityFilter === 'all' || item.priority === actionPriorityFilter) &&
                (!showOnlyOpenActions || item.status === 'open')
        );
    }, [systemRaw, selectedDiagram, actionPriorityFilter, showOnlyOpenActions]);

    const actionPriorities = useMemo(() => {
        if (!systemRaw) {
            return [];
        }
        return [...new Set(systemRaw.actions.map((item) => item.priority))].sort();
    }, [systemRaw]);

    const stats = useMemo(() => {
        if (mode === 'systems') {
            if (!systemRaw || !selectedDiagram) {
                return null;
            }
            return `Diagrams: ${systemRaw.stats.diagramCount} | Selected: ${selectedDiagram.stats.nodeCount} nodes, ${selectedDiagram.stats.edgeCount} edges | Findings: ${selectedDiagram.stats.findingCount} | Actions: ${selectedActions.length} | Visible: ${nodes.length} | ${edges.length}`;
        }
        if (!raw) {
            return null;
        }
        return `Files: ${raw.stats.fileCount} | Edges: ${raw.stats.edgeCount} | Visible: ${nodes.length} | ${edges.length}`;
    }, [mode, raw, systemRaw, selectedDiagram, selectedActions.length, nodes.length, edges.length]);

    const runAstPreview = useCallback(() => {
        setAstMsg(null);
        setAstDiff(null);
        void (async () => {
            try {
                const r = await fetch('/__api/ast-poc-mutate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: astPath })
                });
                const j = (await r.json()) as { diff?: string; error?: string; preview?: string };
                if (!r.ok) {
                    setAstMsg(j.error || 'error');
                } else {
                    setAstDiff((j as { diff: string }).diff);
                }
            } catch (e) {
                setAstMsg((e as Error).message);
            }
        })();
    }, [astPath]);

    const runAstApply = useCallback(() => {
        setAstMsg(null);
        void (async () => {
            try {
                const r = await fetch('/__api/ast-poc-mutate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: astPath, apply: true })
                });
                const j = (await r.json()) as { ok?: boolean; error?: string; diff?: string; nextValue?: number };
                if (!r.ok) {
                    setAstMsg(j.error || 'error');
                } else {
                    setAstDiff(j.diff || 'applied');
                    setAstMsg(`OK — ${POC_CONST} = ${(j as { nextValue: number }).nextValue}. Reload to see in editor.`);
                }
            } catch (e) {
                setAstMsg((e as Error).message);
            }
        })();
    }, [astPath]);

    const runCodegen = useCallback(() => {
        setCodegenOut(null);
        void (async () => {
            try {
                const r = await fetch('/__api/blueprint-codegen', { method: 'POST' });
                const j = (await r.json()) as { outFile?: string; count?: number; error?: string };
                if (!r.ok) {
                    setCodegenOut(j.error || 'error');
                } else {
                    setCodegenOut(`Wrote ${j.outFile} — ${(j as { count: number }).count} keys`);
                }
            } catch (e) {
                setCodegenOut((e as Error).message);
            }
        })();
    }, []);

    if (!import.meta.env.DEV) {
        return <p>Blueprint Explorer is only available in development.</p>;
    }

    if (loadErr) {
        return (
            <div className={styles.root} data-e2e-blueprint-dev="1">
                <p className={styles.error}>Could not load project graph: {loadErr}</p>
            </div>
        );
    }

    return (
        <div className={styles.root} data-e2e-blueprint-dev="1">
            <header className={styles.header}>
                <h1 className={styles.label}>{mode === 'systems' ? 'System diagrams' : 'Project graph (import edges in src/)'}</h1>
                {raw == null ? <p className={styles.stats}>Loading project graph from /__api/project-graph…</p> : null}
                {stats ? <p className={styles.stats}>{stats}</p> : null}
                <span className={styles.label}>(Vite dev APIs: /__api/project-graph, /__api/system-diagrams)</span>
                <label className={styles.label} htmlFor="bp-mode">
                    View
                </label>
                <select className={styles.filter} id="bp-mode" value={mode} onChange={(e) => setMode(e.target.value as ExplorerMode)}>
                    <option value="systems">system diagrams</option>
                    <option value="project">import graph</option>
                </select>
                {mode === 'systems' ? (
                    <>
                        <label className={styles.label} htmlFor="bp-system-diagram">
                            Diagram
                        </label>
                        <select
                            className={styles.filter}
                            id="bp-system-diagram"
                            value={selectedDiagramId}
                            onChange={(e) => setSelectedDiagramId(e.target.value)}
                        >
                            {(systemRaw?.diagrams ?? []).map((diagram) => (
                                <option key={diagram.id} value={diagram.id}>
                                    {diagram.title}
                                </option>
                            ))}
                        </select>
                        <label className={styles.label} htmlFor="bp-action-priority">
                            Priority
                        </label>
                        <select
                            className={styles.filter}
                            id="bp-action-priority"
                            value={actionPriorityFilter}
                            onChange={(e) => setActionPriorityFilter(e.target.value)}
                        >
                            <option value="all">all</option>
                            {actionPriorities.map((priority) => (
                                <option key={priority} value={priority}>
                                    {priority}
                                </option>
                            ))}
                        </select>
                        <label className={styles.checkboxLabel}>
                            <input
                                type="checkbox"
                                checked={showOnlyOpenActions}
                                onChange={(e) => setShowOnlyOpenActions(e.target.checked)}
                            />
                            open actions
                        </label>
                    </>
                ) : (
                    <>
                <label className={styles.label} htmlFor="bp-layer">
                    Layer
                </label>
                <select
                    className={styles.filter}
                    id="bp-layer"
                    value={filterLayer}
                    onChange={(e) => setFilterLayer(e.target.value as Layer)}
                >
                    <option value="all">all</option>
                    <option value="main">main</option>
                    <option value="shared">shared</option>
                    <option value="renderer">renderer</option>
                    <option value="other">other</option>
                </select>
                    </>
                )}
                <input
                    className={styles.search}
                    type="search"
                    placeholder="Filter path or filename…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </header>
            <div className={styles.flow}>
                <ReactFlow
                    colorMode="dark"
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodesConnectable={false}
                    minZoom={0.05}
                    maxZoom={1.5}
                    proOptions={{ hideAttribution: true }}
                >
                    <GraphAutoFit />
                    <MiniMap zoomable pannable />
                    <Controls />
                    <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                </ReactFlow>
            </div>
            <div className={styles.panels}>
                {mode === 'systems' && selectedDiagram ? (
                    <div className={styles.subPanel}>
                        <h3>{selectedDiagram.title}</h3>
                        <p className={styles.label}>{selectedDiagram.summary}</p>
                        <div className={styles.findings}>
                            {selectedDiagram.findings.map((item) => (
                                <div key={item.id} className={`${styles.finding} ${styles[`finding_${item.severity}`]}`}>
                                    <strong>{item.title}</strong>
                                    <p>{item.detail}</p>
                                    {item.evidence.length > 0 ? (
                                        <p className={styles.evidence}>Evidence: {item.evidence.join(', ')}</p>
                                    ) : null}
                                </div>
                            ))}
                            {selectedActions.map((item) => (
                                <div key={item.id} className={`${styles.finding} ${styles.finding_action}`}>
                                    <strong>
                                        {item.priority} {item.title}
                                    </strong>
                                    <p className={styles.evidence}>Status: {item.status}</p>
                                    {item.command ? <p className={styles.evidence}>Command: {item.command}</p> : null}
                                    <p>{item.detail}</p>
                                    <p className={styles.evidence}>Verifies: {item.verifies}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
                <div className={styles.subPanel}>
                    <h3>Codegen (glossary → TS)</h3>
                    <p className={styles.label}>
                        Merges <code>src/blueprint/definitions/*.blueprint.json</code> into{' '}
                        <code>src/shared/generated/blueprintGlossaryGen.ts</code>
                    </p>
                    <button type="button" className={styles.btn} onClick={runCodegen}>
                        Run blueprint:codegen (API)
                    </button>
                    {codegenOut ? <pre>{codegenOut}</pre> : null}
                </div>
                <div className={styles.subPanel}>
                    <h3>AST round-trip (allowlist)</h3>
                    {astAllow.length > 0 ? (
                        <select
                            className={styles.filter}
                            value={astPath}
                            onChange={(e) => setAstPath(e.target.value)}
                        >
                            {astAllow.map((f) => (
                                <option key={f} value={f}>
                                    {f}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <p className={styles.error}>No allowlist (start Vite dev — ast-allowlist.json)</p>
                    )}
                    <p className={styles.label}>Increments {POC_CONST} via ts-morph; preview is diff, apply writes disk.</p>
                    <div>
                        <button type="button" className={styles.btn} onClick={runAstPreview}>
                            Preview
                        </button>
                        <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={runAstApply}>
                            Apply
                        </button>
                    </div>
                    {astMsg ? <p className={styles.label}>{astMsg}</p> : null}
                    {astDiff ? <pre>{astDiff}</pre> : null}
                </div>
            </div>
        </div>
    );
}

const BlueprintExplorer = (): ReactElement => {
    if (!import.meta.env.DEV) {
        return <p>Blueprint Explorer is only available in development.</p>;
    }
    return (
        <ReactFlowProvider>
            <BlueprintGraphInner />
        </ReactFlowProvider>
    );
};

export default BlueprintExplorer;
