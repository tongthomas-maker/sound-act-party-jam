"""Isolated font-only proof. Downloads to a disposable directory, never the app.

Usage: python3 docs/prove-local-fonts.py --work /tmp/sound-it-font-proof
Requires Python 3, internet for npm package download, and installed Playwright Chromium.
Not a Vite build, static app test, native test, or typography parity claim.
"""

import argparse
import asyncio
import base64
import hashlib
import json
import shutil
import tarfile
import threading
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright


VERSION = "5.3.0"
FONTS = {"anton": [400], "archivo": [500, 700, 900]}


def prepare(work):
    if work.exists():
        raise RuntimeError("Use a new empty work directory; existing work is not overwritten")
    work.mkdir(parents=True)
    site = work / "site"
    site.mkdir()
    inventory, css, samples = [], [], []
    for family, weights in FONTS.items():
        package = f"@fontsource/{family}"
        metadata_url = f"https://registry.npmjs.org/@fontsource%2f{family}/{VERSION}"
        with urllib.request.urlopen(metadata_url, timeout=30) as response:
            metadata = json.load(response)
        assert metadata["version"] == VERSION
        assert metadata["license"] == "OFL-1.1", "Unexpected package license"
        tarball_url = metadata["dist"]["tarball"]
        assert urlparse(tarball_url).hostname == "registry.npmjs.org"
        with urllib.request.urlopen(tarball_url, timeout=30) as response:
            archive = response.read()
        integrity = "sha512-" + base64.b64encode(hashlib.sha512(archive).digest()).decode()
        assert integrity == metadata["dist"]["integrity"], "Package integrity mismatch"
        archive_path = work / f"{family}-{VERSION}.tgz"
        archive_path.write_bytes(archive)
        with tarfile.open(archive_path) as bundle:
            def read_member(name):
                member = bundle.getmember(f"package/{name}")
                assert member.isfile(), "Expected ordinary package file"
                stream = bundle.extractfile(member)
                if stream is None:
                    raise RuntimeError(f"Missing package member {name}")
                return stream.read()

            license_text = read_member("LICENSE").decode()
            assert "SIL OPEN FONT LICENSE" in license_text.upper()
            assert "Version 1.1" in license_text
            (site / f"{family}-LICENSE.txt").write_text(license_text)
            (work / f"{family}-metadata.json").write_text(json.dumps(metadata, indent=2))
            for weight in weights:
                filename = f"{family}-latin-{weight}-normal.woff2"
                font = read_member(f"files/{filename}")
                assert font[:4] == b"wOF2", "Not a WOFF2 font"
                (site / filename).write_bytes(font)
                inventory.append({"package": package, "version": VERSION,
                                  "license": "OFL-1.1", "weight": weight,
                                  "file": filename, "bytes": len(font),
                                  "sha256": hashlib.sha256(font).hexdigest(),
                                  "package_integrity": integrity})
                css.append(f'@font-face {{font-family: "{family}"; font-style: normal; '
                           f'font-weight: {weight}; font-display: swap; '
                           f'src: url("./{filename}") format("woff2");}}\n'
                           f'.{family}-{weight} {{font-family: "{family}"; font-weight: {weight};}}')
                samples.append(f'<p class="{family}-{weight}">{family.title()} {weight}: '
                               'SOUND IT! ACT IT! MIX IT! GOT IT! PASS 0123456789</p>')
    (site / "fonts.css").write_text("\n".join(css) + "\nbody {font-size: 28px;}\n")
    (site / "index.html").write_text('<!doctype html><html lang="en"><head>'
                                   '<meta charset="utf-8"><title>Sound It! isolated font proof</title>'
                                   '<link rel="stylesheet" href="./fonts.css"></head><body>'
                                   + "".join(samples) + '</body></html>')
    (work / "inventory.json").write_text(json.dumps(inventory, indent=2))
    return site, inventory


async def verify(work, site, inventory):
    server = ThreadingHTTPServer(("localhost", 0),
                                 partial(SimpleHTTPRequestHandler, directory=str(site)))
    origin = f"http://localhost:{server.server_port}"
    threading.Thread(target=server.serve_forever, daemon=True).start()
    report = {"status": "FAIL", "scope": "Font-only Chromium; Latin subset; not static app/iOS",
              "blocked_external": [], "failures": [], "launches": []}
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            for launch in (1, 2):
                context = await browser.new_context(viewport={"width": 1280, "height": 1800},
                                                    service_workers="block")
                served = []

                async def local_only(route):
                    if urlparse(route.request.url).netloc == urlparse(origin).netloc:
                        await route.continue_()
                    else:
                        report["blocked_external"].append(route.request.url)
                        await route.abort()

                await context.route("**/*", local_only)
                page = await context.new_page()
                page.on("pageerror", lambda error: report["failures"].append(str(error)))
                page.on("requestfailed", lambda request: report["failures"].append(request.url))
                page.on("response", lambda response: served.append({"url": response.url,
                                                                     "status": response.status}))
                response = await page.goto(origin, wait_until="load")
                assert response and response.status == 200
                loaded = await page.evaluate("""async () => {
                    await document.fonts.ready;
                    const result = [];
                    for (const [family, weights] of Object.entries({anton:[400], archivo:[500,700,900]})) {
                        for (const weight of weights) {
                            const faces = await document.fonts.load(`${weight} 28px "${family}"`, 'SOUND IT!');
                            result.push({family, weight, count: faces.length,
                                         loaded: faces.length === 1 && faces[0].status === 'loaded',
                                         check: document.fonts.check(`${weight} 28px "${family}"`, 'SOUND IT!')});
                        }
                    }
                    return result;
                }""")
                assert len(loaded) == 4 and all(f["loaded"] and f["check"] for f in loaded)
                for font in inventory:
                    assert any(r["url"].endswith('/' + font["file"]) and r["status"] == 200
                               for r in served), f"Font not served: {font['file']}"
                assert all(r["status"] < 400 for r in served), "Missing local asset"
                await page.screenshot(path=str(work / f"cold-fonts-{launch}.png"))
                report["launches"].append({"launch": launch, "fonts": loaded, "served": served})
                await context.close()
            assert not report["blocked_external"], "Outside requests attempted"
            assert not report["failures"], "Browser errors or failed requests"
            report["status"] = "PASS"
            await browser.close()
    except Exception as error:
        report["error"] = str(error)
        raise
    finally:
        server.shutdown()
        server.server_close()
        (work / "result.json").write_text(json.dumps(report, indent=2))
        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--work", type=Path, required=True)
    args = parser.parse_args()
    site, inventory = prepare(args.work.resolve())
    asyncio.run(verify(args.work.resolve(), site, inventory))