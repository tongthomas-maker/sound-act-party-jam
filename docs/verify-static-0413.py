"""Mac-only candidate verifier; no SSR/dev server and no external requests allowed."""

import asyncio
import json
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright, expect


ROOT = Path("dist/client").resolve()
EVIDENCE = Path("static-evidence").resolve()
ORIGIN = "http://localhost:8765"


async def verify():
    if not (ROOT / "index.html").is_file():
        raise RuntimeError("Missing dist/client/index.html; stop, do not serve development HTML")
    EVIDENCE.mkdir(exist_ok=True)
    (EVIDENCE / "files.txt").write_text(
        "\n".join(str(p.relative_to(ROOT)) for p in sorted(ROOT.rglob("*")) if p.is_file())
    )
    blocked, local_failures, errors, served = [], [], [], []
    server = ThreadingHTTPServer(
        ("localhost", 8765), partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    )
    threading.Thread(target=server.serve_forever, daemon=True).start()
    report = {"status": "FAIL", "scope": "Static Chromium only; not iOS/native/audibility"}
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 1280, "height": 1800}, service_workers="block"
            )

            async def allow_local_only(route):
                url = route.request.url
                if urlparse(url).scheme in ("data", "blob") or urlparse(url).netloc == "localhost:8765":
                    await route.continue_()
                else:
                    blocked.append(url)
                    await route.abort()

            await context.route("**/*", allow_local_only)
            page = await context.new_page()
            def watch(p, tag):
                # Shared by both contexts so a fresh launch also reports missing assets.
                p.on("pageerror", lambda error: errors.append(f"[{tag}] {error}"))
                p.on("response", lambda response: (
                    local_failures.append(f"[{tag}] {response.status} {response.url}")
                    if response.url.startswith(ORIGIN) and response.status >= 400
                    else served.append(response.url) if response.url.startswith(ORIGIN) else None
                ))
                p.on("requestfailed", lambda request: (
                    local_failures.append(f"[{tag}] {request.url}: {request.failure}")
                    if request.url.startswith(ORIGIN) else None
                ))

            watch(page, "first")
            response = await page.goto(ORIGIN, wait_until="domcontentloaded")
            assert response and response.status == 200, "Static root HTTP failure"
            await expect(page.get_by_role("button", name="START GAME", exact=True)).to_be_visible()
            await page.screenshot(path=str(EVIDENCE / "1-cold-start.png"))

            # Installed after navigation, before the app's first audio-unlocking tap.
            # Wrap real Web Audio, do not mock sound or replace playback behavior.
            await page.evaluate("""() => {
                window.__staticAudio = { contexts: [], starts: 0 };
                const Original = window.AudioContext || window.webkitAudioContext;
                if (!Original) throw new Error('Web Audio unavailable');
                class ObservedAudio extends Original {
                    constructor(...args) {
                        super(...args);
                        window.__staticAudio.contexts.push(this);
                    }
                    createOscillator(...args) {
                        const osc = super.createOscillator(...args);
                        const start = osc.start.bind(osc);
                        osc.start = (...values) => {
                            window.__staticAudio.starts++;
                            return start(...values);
                        };
                        return osc;
                    }
                }
                window.AudioContext = ObservedAudio;
                if (window.webkitAudioContext) window.webkitAudioContext = ObservedAudio;
            }""")
            for name in ("QA One", "QA Two"):
                await page.get_by_role("button", name="+ ADD PLAYER", exact=True).click()
                await page.get_by_role("textbox", name="New player name", exact=True).fill(name)
                await page.get_by_role("button", name="SAVE", exact=True).click()
            await page.get_by_role("button", name="30s", exact=True).click()
            await page.get_by_role("button", name="START GAME", exact=True).click()
            await page.get_by_role("button", name="READY!", exact=True).click()
            got = page.get_by_role("button", name="Got it, plus one point", exact=True)
            passed = page.get_by_role("button", name="Pass, no point", exact=True)
            await expect(got).to_be_visible(timeout=15000)
            # Deterministic readiness: feedback label proves acceptance; its reset
            # (after the next card is shown and input unlocked) proves readiness.
            await got.click()
            await expect(got).to_have_text("✓ +1")
            await expect(got).to_have_text("GOT IT!")
            await passed.click()
            await expect(passed).to_have_text("PASSED")
            await expect(passed).to_have_text("PASS")
            audio_before = await page.evaluate("""() => ({
                states: window.__staticAudio.contexts.map(c => c.state),
                times: window.__staticAudio.contexts.map(c => c.currentTime),
                starts: window.__staticAudio.starts
            })""")
            await page.wait_for_function(
                "t => window.__staticAudio.contexts.every((c, i) => c.currentTime > t[i])",
                arg=audio_before["times"],
            )
            audio_after = await page.evaluate("() => window.__staticAudio.contexts.map(c => c.currentTime)")
            assert audio_before["states"] and all(s == "running" for s in audio_before["states"])
            assert audio_before["starts"] > 0, "No real oscillator playback scheduled"
            assert all(b > a for a, b in zip(audio_before["times"], audio_after)), "Audio clock stalled"
            await page.screenshot(path=str(EVIDENCE / "2-scoring.png"))
            await expect(page.get_by_role("alert")).to_have_text("TIME!", timeout=40000)
            for label, expected in (("Points", "1"), ("Passed", "1"), ("Best 🔥", "1")):
                card = page.get_by_text(label, exact=True).locator("..")
                assert (await card.inner_text()).splitlines()[0] == expected, f"Incorrect {label}"
            await page.screenshot(path=str(EVIDENCE / "3-summary.png"))
            # No prior HTTP cache or local storage in this second context.
            cold = await browser.new_context(
                viewport={"width": 1280, "height": 1800}, service_workers="block"
            )
            await cold.route("**/*", allow_local_only)
            cold_page = await cold.new_page()
            watch(cold_page, "cold")
            served_before_cold = len(served)
            await cold_page.goto(ORIGIN, wait_until="domcontentloaded")
            await expect(cold_page.get_by_role("button", name="START GAME", exact=True)).to_be_visible()
            await cold_page.screenshot(path=str(EVIDENCE / "4-second-cold-start.png"))
            await cold_page.wait_for_load_state("load")
            cold_served = served[served_before_cold:]
            assert any(".js" in u for u in cold_served), "Fresh launch served no local JavaScript"
            assert any(".css" in u for u in cold_served), "Fresh launch served no local stylesheet"
            assert not blocked, f"External requests were blocked (not self-contained): {blocked}"
            assert not errors, f"Page errors: {errors}"
            assert not local_failures, f"Missing/broken local assets: {local_failures}"
            assert any(".js" in url for url in served), "No local JavaScript served"
            assert any(".css" in url for url in served), "No local stylesheet served"
            report.update(status="PASS", audio=audio_before, summary={"points": 1, "passed": 1, "best_streak": 1})
            await browser.close()
    finally:
        report.update(blocked_external=blocked, local_failures=local_failures, page_errors=errors, served_local=served)
        (EVIDENCE / "result.json").write_text(json.dumps(report, indent=2))
        server.shutdown()
        server.server_close()
        print(json.dumps(report, indent=2))


asyncio.run(verify())