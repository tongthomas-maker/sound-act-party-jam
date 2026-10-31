"""Isolated Mac handoff. Never builds in Lovable; no signing, deployment or upload."""

import argparse
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import platform
import plistlib
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import unquote, urlparse


EXCLUDED = {".git", "node_modules", "dist", ".output", ".tanstack", ".nitro",
            ".wrangler", ".workspace", ".lovable", "__pycache__", "static-evidence"}
FONT_IMPORTS = ['@import "@fontsource/anton/400.css";',
                '@import "@fontsource/archivo/500.css";',
                '@import "@fontsource/archivo/700.css";',
                '@import "@fontsource/archivo/900.css";']
STATIC_CONFIG = '''import { defineConfig } from "@lovable.dev/vite-tanstack-config";
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    pages: [{ path: "/" }],
    prerender: { enabled: true, autoStaticPathsDiscovery: false,
      crawlLinks: false, failOnError: true },
  },
});
'''


def ignored(directory, names):
    return [n for n in names if n in EXCLUDED or n.startswith((".env", ".dev.vars"))
            or n.endswith((".local", ".pyc")) or Path(directory, n).is_symlink()]


def source_hashes(source):
    result = {}
    for directory, dirs, files in os.walk(source, followlinks=False):
        skip = set(ignored(directory, dirs + files))
        dirs[:] = sorted(d for d in dirs if d not in skip)
        for name in sorted(files):
            if name not in skip:
                path = Path(directory, name)
                result[str(path.relative_to(source))] = hashlib.sha256(path.read_bytes()).hexdigest()
    return result


def localize_fonts(candidate):
    root = candidate / "src/routes/__root.tsx"
    text = root.read_text()
    replacements = [
        '      { rel: "preconnect", href: "https://fonts.googleapis.com" },\n',
        '      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },\n',
        '      {\n        rel: "stylesheet",\n        href: "https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@500;700;900&display=swap",\n      },\n',
    ]
    for old in replacements:
        if text.count(old) != 1:
            raise RuntimeError("Font-link source changed; review handoff instead of guessing")
        text = text.replace(old, "", 1)
    css = candidate / "src/styles.css"
    original_css = css.read_text()
    if "@fontsource/" in original_css:
        raise RuntimeError("Unexpected existing local font imports; review candidate")
    root.write_text(text)
    css.write_text("\n".join(FONT_IMPORTS) + "\n" + original_css)
    licenses = candidate / "public/licenses"
    licenses.mkdir(parents=True, exist_ok=True)
    for family in ("anton", "archivo"):
        package = candidate / "node_modules/@fontsource" / family
        metadata = json.loads((package / "package.json").read_text())
        notice = (package / "LICENSE").read_bytes()
        if metadata["version"] != "5.3.0" or metadata["license"] != "OFL-1.1" or b"SIL OPEN FONT LICENSE" not in notice.upper():
            raise RuntimeError(f"Unexpected font package/license: {family}")
        (licenses / f"{family}-OFL.txt").write_bytes(notice)
    (candidate / "vite.static-handoff.ts").write_text(STATIC_CONFIG)


class AssetParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        key = "src" if tag in ("script", "img", "source", "audio", "video") else "href" if tag == "link" else None
        if key and attrs.get(key):
            self.refs.append(attrs[key])


def validate_bundle(root, candidate):
    html = (root / "index.html").read_text()
    if "/@vite/client" in html or "/src/" in html or "START GAME" not in html:
        raise RuntimeError("Missing prerendered setup or development HTML emitted")
    parser = AssetParser()
    parser.feed(html)
    refs = [(root / "index.html", ref) for ref in parser.refs]
    for css in root.rglob("*.css"):
        refs.extend((css, m.group(1).strip("\"' "))
                    for m in re.finditer(r"url\(([^)]+)\)", css.read_text()))
    for owner, ref in refs:
        url = urlparse(ref)
        if url.scheme in ("data", "blob"):
            continue
        if url.scheme or url.netloc:
            raise RuntimeError(f"External asset reference: {ref}")
        target = (root / unquote(url.path).lstrip("/")) if url.path.startswith("/") else owner.parent / unquote(url.path)
        target = target.resolve()
        if not target.is_relative_to(root.resolve()) or not target.is_file():
            raise RuntimeError(f"Missing or escaped asset: {ref}")
    for suffix in (".js", ".css", ".woff2"):
        if not any(root.rglob(f"*{suffix}")):
            raise RuntimeError(f"No local {suffix} assets")
    for family in ("anton", "archivo"):
        if (root / f"licenses/{family}-OFL.txt").read_bytes() != (candidate / f"node_modules/@fontsource/{family}/LICENSE").read_bytes():
            raise RuntimeError(f"Distributed notice differs: {family}")
    return source_hashes(root)


def require_offline_pass(evidence):
    result = json.loads((evidence / "result.json").read_text())
    if result.get("status") != "PASS" or any(result.get(k, ["missing"]) for k in ("blocked_external", "local_failures", "page_errors")):
        raise RuntimeError("Strict static verifier did not PASS cleanly")
    if result.get("summary") != {"points": 1, "passed": 1, "best_streak": 1}:
        raise RuntimeError("Manual scoring evidence missing")
    for key in ("first_launch_fonts", "cold_launch_fonts"):
        fonts = result.get(key, [])
        expected = {("Anton", 400), ("Archivo", 500), ("Archivo", 700), ("Archivo", 900)}
        if {(f.get("family"), f.get("weight")) for f in fonts} != expected or not all(f.get("loaded") and f.get("check") and f.get("exactWeight") for f in fonts):
            raise RuntimeError(f"Incomplete real font evidence: {key}")
    return result


def prepare_native(native, bundle, app_id):
    native.mkdir()
    shutil.copytree(bundle, native / "www")
    (native / "package.json").write_text(json.dumps({
        "name": "sound-it-ios-candidate", "private": True, "version": "0.0.0",
        "dependencies": {"@capacitor/core": "7.4.3", "@capacitor/ios": "7.4.3"},
        "devDependencies": {"@capacitor/cli": "7.4.3"},
    }, indent=2) + "\n")
    (native / "capacitor.config.json").write_text(json.dumps({
        "appId": app_id, "appName": "Sound It!", "webDir": "www",
    }, indent=2) + "\n")


def run_handoff(source, work, app_id, run):
    """Injectable command runner allows fail-closed fixture tests without any build."""
    before = source_hashes(source)
    candidate = work / "candidate"
    shutil.copytree(source, candidate, ignore=ignored)
    try:
        run("install-locked", ["bun", "install", "--frozen-lockfile"], candidate)
        run("install-fonts", ["bun", "add", "--exact", "@fontsource/anton@5.3.0", "@fontsource/archivo@5.3.0"], candidate)
        localize_fonts(candidate)
        run("static-build", ["bun", "x", "--no-install", "vite", "build", "--config", "vite.static-handoff.ts"], candidate)
        inventory = validate_bundle(candidate / "dist/client", candidate)
        (work / "static-inventory.json").write_text(json.dumps(inventory, indent=2))
        venv = work / "qa-venv"
        run("qa-venv", [sys.executable, "-m", "venv", str(venv)], work)
        python = str(venv / "bin/python")
        run("qa-install", [python, "-m", "pip", "install", "playwright==1.56.0"], work)
        run("qa-chromium", [python, "-m", "playwright", "install", "chromium"], work)
        run("strict-offline", [python, "docs/verify-static-0413.py"], candidate)
        require_offline_pass(candidate / "static-evidence")
        native = work / "native"
        prepare_native(native, candidate / "dist/client", app_id)
        run("native-install", ["npm", "install", "--no-audit", "--no-fund"], native)
        run("native-add", [str(native / "node_modules/.bin/cap"), "add", "ios"], native)
        plist = native / "ios/App/App/Info.plist"
        info = plistlib.loads(plist.read_bytes())
        info["NSMotionUsageDescription"] = "Tilt the phone to mark guesses as GOT IT! or PASS."
        orientations = ["UIInterfaceOrientationPortrait", "UIInterfaceOrientationPortraitUpsideDown",
                        "UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight"]
        info["UISupportedInterfaceOrientations"] = orientations
        info["UISupportedInterfaceOrientations~ipad"] = orientations
        plist.write_bytes(plistlib.dumps(info))
        run("native-sync", [str(native / "node_modules/.bin/cap"), "sync", "ios"], native)
        if source_hashes(native / "www") != inventory:
            raise RuntimeError("Native web assets differ from verified static bundle")
        synced = source_hashes(native / "ios/App/App/public")
        if any(synced.get(name) != digest for name, digest in inventory.items()):
            raise RuntimeError("Synced iOS assets differ from verified static bundle")
        if set(synced) - set(inventory) - {"capacitor.js", "capacitor_plugins.js", "cordova.js", "cordova_plugins.js"}:
            raise RuntimeError("Unexpected added native web assets; review inventory")
        (work / "native-inventory.json").write_text(json.dumps(synced, indent=2))
        if not (native / "ios/App/App.xcworkspace").is_dir():
            raise RuntimeError("CocoaPods Xcode workspace missing")
        return {"status": "STATIC_PASS_NATIVE_WORKSPACE_PREPARED", "native_build": "NOT_RUN",
                "device_checks": "NOT_RUN", "workspace": str(native / "ios/App/App.xcworkspace")}
    finally:
        if source_hashes(source) != before:
            raise RuntimeError("Source changed during handoff; inspect before continuing")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--app-id", required=True, help="Owner-chosen Apple bundle identifier; no registration performed")
    args = parser.parse_args()
    if platform.system() != "Darwin" or any(os.environ.get(k) for k in ("LOVABLE_SANDBOX", "SANDBOX", "DEV_SERVER__PROJECT_PATH")):
        parser.error("Run only in an unrestricted Mac Terminal, never in the managed Lovable environment")
    if sys.version_info < (3, 10):
        parser.error("Python 3.10+ required")
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z][A-Za-z0-9-]*){2,}", args.app_id):
        parser.error("Use a real reverse-domain bundle identifier, e.g. com.yourcompany.soundit")
    source = args.source.resolve()
    for required in ("bun.lock", "package.json", "src/routes/__root.tsx", "src/styles.css", "docs/verify-static-0413.py"):
        if not (source / required).is_file():
            parser.error(f"Incomplete exported source: missing {required}")
    for tool in ("bun", "node", "npm", "xcodebuild", "pod"):
        if not shutil.which(tool):
            parser.error(f"Install prerequisite: {tool}")
    version = subprocess.check_output(["node", "--version"], text=True).strip()
    match = re.fullmatch(r"v(\d+)\.(\d+)\.(\d+)", version)
    if not match or int(match[1]) != 22 or int(match[2]) < 12:
        parser.error("Use Node 22 LTS, version 22.12.0 or newer within 22.x")
    subprocess.run(["xcodebuild", "-version"], check=True)
    work = Path(tempfile.mkdtemp(prefix="sound-it-ios-" )).resolve()
    print(f"Preserved workspace: {work}", flush=True)
    env = dict(os.environ)
    for key in list(env):
        if key in ("LOVABLE_SANDBOX", "SANDBOX", "DEV_SERVER__PROJECT_PATH", "TSS_PRERENDERING", "NODE_ENV") or key.startswith(("VITE_", "CLOUDFLARE_")):
            env.pop(key)
    stages = []
    def run(stage, command, cwd):
        print(f"Running {stage}; log: {work / (stage + '.log')}", flush=True)
        entry = {"stage": stage, "command": command, "status": "RUNNING"}
        stages.append(entry)
        with (work / f"{stage}.log").open("w") as log:
            try:
                completed = subprocess.run(command, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT, timeout=1200)
                entry.update(exit_code=completed.returncode, status="PASS" if completed.returncode == 0 else "FAIL")
                if completed.returncode:
                    raise RuntimeError(f"{stage} exited {completed.returncode}; inspect its log")
            except subprocess.TimeoutExpired:
                entry["status"] = "TIMEOUT"
                raise RuntimeError(f"{stage} exceeded 20 minutes; no success inferred") from None
    result = {"status": "FAIL", "native_build": "NOT_RUN", "device_checks": "NOT_RUN"}
    try:
        versions = {"node": version, "python": platform.python_version()}
        for tool in ("bun", "npm", "pod"):
            versions[tool] = subprocess.check_output([tool, "--version"], text=True).strip()
        (work / "versions.json").write_text(json.dumps(versions, indent=2))
        result = run_handoff(source, work, args.app_id, run)
    except Exception as error:
        result["error"] = str(error)
    finally:
        result["stages"] = stages
        (work / "handoff-result.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))
    return 0 if result["status"] == "STATIC_PASS_NATIVE_WORKSPACE_PREPARED" else 1


if __name__ == "__main__":
    sys.exit(main())