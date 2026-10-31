"""Synthetic orchestration fixtures only: no game/font audits, downloads or builds."""

import importlib.util
import json
from pathlib import Path
import plistlib
import shutil
import tempfile
import unittest


spec = importlib.util.spec_from_file_location("ios_handoff", Path(__file__).with_name("prepare-ios.py"))
handoff = importlib.util.module_from_spec(spec)
spec.loader.exec_module(handoff)


class HandoffTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.source = self.base / "source"
        (self.source / "src/routes").mkdir(parents=True)
        (self.source / "src/routes/__root.tsx").write_text('''links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@500;700;900&display=swap",
      },
]
''')
        (self.source / "src/styles.css").write_text('@import "tailwindcss";\n@source "../src";\n')
        (self.source / "bun.lock").write_text("fixture lock, not installable")
        for folder in (".git", "nested/.git", "node_modules", "dist"):
            path = self.source / folder
            path.mkdir(parents=True)
            (path / "excluded").write_text("fixture")
        (self.source / ".env").write_text("synthetic excluded content")
        self.work = self.base / "work"
        self.work.mkdir()
        self.stages = []
        self.fail_stage = None
        self.missing_asset = False
        self.external_asset = False
        self.offline_fail = False
        self.tamper_native = False

    def fake_run(self, stage, command, cwd):
        self.stages.append(stage)
        if stage == self.fail_stage:
            raise RuntimeError("fixture stage failed")
        if stage == "install-fonts":
            for family in ("anton", "archivo"):
                p = cwd / f"node_modules/@fontsource/{family}"
                p.mkdir(parents=True)
                (p / "package.json").write_text(json.dumps({"version": "5.3.0", "license": "OFL-1.1"}))
                # Clearly synthetic notice; never shipped or used as a font proof.
                (p / "LICENSE").write_text("SYNTHETIC FIXTURE: SIL OPEN FONT LICENSE")
        elif stage == "static-build":
            root = cwd / "dist/client"
            (root / "assets").mkdir(parents=True)
            (root / "index.html").write_text('<button>START GAME</button><script src="/assets/game.js"></script><link href="/assets/game.css" rel="stylesheet">')
            if not self.missing_asset:
                (root / "assets/game.js").write_text("// synthetic asset, not game output")
            url = "https://example.invalid/font.woff2" if self.external_asset else "font.woff2"
            (root / "assets/game.css").write_text(f"@font-face{{src:url({url})}}")
            (root / "assets/font.woff2").write_bytes(b"NOT A FONT: synthetic orchestration fixture")
            shutil.copytree(cwd / "public/licenses", root / "licenses")
        elif stage == "strict-offline":
            evidence = cwd / "static-evidence"
            evidence.mkdir()
            faces = [{"family": family, "weight": weight, "loaded": True, "check": True, "exactWeight": True}
                     for family, weight in (("Anton", 400), ("Archivo", 500), ("Archivo", 700), ("Archivo", 900))]
            (evidence / "result.json").write_text(json.dumps({
                "status": "FAIL" if self.offline_fail else "PASS", "blocked_external": [],
                "local_failures": [], "page_errors": [], "first_launch_fonts": faces,
                "cold_launch_fonts": faces, "summary": {"points": 1, "passed": 1, "best_streak": 1},
            }))
        elif stage == "native-add":
            app = cwd / "ios/App/App"
            app.mkdir(parents=True)
            (app / "Info.plist").write_bytes(plistlib.dumps({}))
            (cwd / "ios/App/App.xcworkspace").mkdir()
        elif stage == "native-sync":
            shutil.copytree(cwd / "www", cwd / "ios/App/App/public")
            (cwd / "ios/App/App/public/capacitor.js").write_text("// synthetic bridge")
            if self.tamper_native:
                (cwd / "ios/App/App/public/assets/game.js").write_text("changed")

    def execute(self):
        return handoff.run_handoff(self.source, self.work, "com.fixture.soundit", self.fake_run)

    def test_success_preserves_source_and_orders_native_after_offline(self):
        before = handoff.source_hashes(self.source)
        result = self.execute()
        self.assertEqual(result["native_build"], "NOT_RUN")
        self.assertEqual(result["status"], "STATIC_PASS_NATIVE_WORKSPACE_PREPARED")
        self.assertLess(self.stages.index("strict-offline"), self.stages.index("native-install"))
        self.assertEqual(before, handoff.source_hashes(self.source))
        config = json.loads((self.work / "native/capacitor.config.json").read_text())
        self.assertEqual(config["webDir"], "www")
        self.assertNotIn("server", config)
        info = plistlib.loads((self.work / "native/ios/App/App/Info.plist").read_bytes())
        self.assertIn("UIInterfaceOrientationLandscapeRight", info["UISupportedInterfaceOrientations~ipad"])
        for path in (".git", "nested/.git", ".env"):
            self.assertFalse((self.work / "candidate" / path).exists())

    def test_failed_build_never_verifies_or_creates_native(self):
        self.fail_stage = "static-build"
        with self.assertRaisesRegex(RuntimeError, "fixture stage failed"):
            self.execute()
        self.assertNotIn("strict-offline", self.stages)
        self.assertFalse((self.work / "native").exists())

    def test_missing_local_asset_stops_before_browser_and_native(self):
        self.missing_asset = True
        with self.assertRaisesRegex(RuntimeError, "Missing or escaped asset"):
            self.execute()
        self.assertNotIn("strict-offline", self.stages)

    def test_external_css_asset_rejected(self):
        self.external_asset = True
        with self.assertRaisesRegex(RuntimeError, "External asset"):
            self.execute()
        self.assertFalse((self.work / "native").exists())

    def test_verifier_nonzero_stops_native(self):
        self.fail_stage = "strict-offline"
        with self.assertRaises(RuntimeError):
            self.execute()
        self.assertNotIn("native-install", self.stages)

    def test_exit_zero_with_fail_json_stops_native(self):
        self.offline_fail = True
        with self.assertRaisesRegex(RuntimeError, "did not PASS"):
            self.execute()
        self.assertFalse((self.work / "native").exists())

    def test_synced_asset_tampering_rejected(self):
        self.tamper_native = True
        with self.assertRaisesRegex(RuntimeError, "Synced iOS assets differ"):
            self.execute()

    def test_changed_font_source_fails_closed(self):
        (self.source / "src/routes/__root.tsx").write_text("changed fixture")
        with self.assertRaisesRegex(RuntimeError, "Font-link source changed"):
            self.execute()
        self.assertNotIn("static-build", self.stages)


if __name__ == "__main__":
    unittest.main()