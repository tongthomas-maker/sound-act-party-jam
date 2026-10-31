"""Font-gate regression only; requires --font-site from the licensed isolated proof.

python3 docs/test-static-fonts.py --font-site /tmp/sound-it-font-proof/site
No app build, gameplay, production files or external browser requests are used.
"""

import argparse
import asyncio
import importlib.util
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright


async def run(site):
    spec = importlib.util.spec_from_file_location(
        "static_verifier", Path(__file__).with_name("verify-static-0413.py")
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("Cannot load verifier")
    verifier = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(verifier)
    server = ThreadingHTTPServer(
        ("localhost", 0), partial(SimpleHTTPRequestHandler, directory=str(site))
    )
    origin = f"http://localhost:{server.server_port}"
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            for launch in (1, 2):
                context = await browser.new_context(
                    viewport={"width": 1280, "height": 1800}, service_workers="block"
                )
                blocked, failures = [], []

                async def local_only(route):
                    if urlparse(route.request.url).netloc == urlparse(origin).netloc:
                        await route.continue_()
                    else:
                        blocked.append(route.request.url)
                        await route.abort()

                await context.route("**/*", local_only)
                page = await context.new_page()
                page.on("pageerror", lambda error: failures.append(str(error)))
                page.on("requestfailed", lambda request: failures.append(request.url))
                await page.goto(origin, wait_until="load")
                fonts = await verifier.verify_fonts(page)
                assert {(f["family"], f["weight"]) for f in fonts} == {
                    ("Anton", 400), ("Archivo", 500), ("Archivo", 700), ("Archivo", 900)
                }
                assert not blocked and not failures
                print(f"PASS: licensed local fonts, fresh launch {launch}")
                if launch == 2:
                    # CSS matching must not substitute Archivo 700 for absent 900.
                    await page.evaluate("""() => {
                        for (const sheet of document.styleSheets) {
                            for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
                                const rule = sheet.cssRules[i];
                                if (rule.type === CSSRule.FONT_FACE_RULE &&
                                    rule.style.fontFamily.replaceAll('"', '').toLowerCase() === 'archivo' &&
                                    rule.style.fontWeight === '900') sheet.deleteRule(i);
                            }
                        }
                    }""")
                    try:
                        await verifier.verify_fonts(page)
                    except AssertionError as error:
                        assert "Missing/unloaded bundled fonts" in str(error)
                        print("PASS: missing Archivo 900 rejected despite available 500/700")
                    else:
                        raise AssertionError("Substitute font weight incorrectly passed")
                    # Simulate omitted declarations; fallback alone must not pass.
                    await page.evaluate("""() => {
                        for (const sheet of document.querySelectorAll('link[rel="stylesheet"], style')) {
                            sheet.remove();
                        }
                    }""")
                    try:
                        await verifier.verify_fonts(page)
                    except AssertionError as error:
                        assert "Missing/unloaded bundled fonts" in str(error)
                        print("PASS: missing font declarations rejected")
                    else:
                        raise AssertionError("Fallback-only page incorrectly passed")
                await context.close()
            await browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--font-site", type=Path, required=True)
    args = parser.parse_args()
    site = args.font_site.resolve()
    if not (site / "fonts.css").is_file() or not (site / "index.html").is_file():
        parser.error("Use the site directory produced by docs/prove-local-fonts.py")
    asyncio.run(run(site))