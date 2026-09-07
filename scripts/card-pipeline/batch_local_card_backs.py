#!/usr/bin/env python3
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

repo_root = Path(__file__).resolve().parents[2]
# Sibling checkout by default; CROSS_REPO_LIBS_ROOT overrides it (git worktrees live under .claude/worktrees/).
cross_repo_libs = Path(os.environ.get("CROSS_REPO_LIBS_ROOT") or (repo_root.parent / "cross-repo-libs"))
script = cross_repo_libs / "packages" / "ai-image" / "scripts" / "batch_local_card_backs.py"

raise SystemExit(
    subprocess.run(
        [sys.executable, str(script), "--repo-root", str(repo_root), *sys.argv[1:]],
        cwd=repo_root,
        check=False,
    ).returncode
)
