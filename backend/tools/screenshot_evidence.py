"""
tools/screenshot_evidence.py
Renders the captured evidence pages to PNG screenshots using headless Chromium.
Figures produced:
  fig-api-console.png, fig-negative-paths.png, fig-database-schema.png, fig-analytics.png,
  fig-test-console.png (rendered from the real TAP output), and, if the frontend builds,
  fig-frontend-*.png captures of the existing React prototype.
No image is generated or re-drawn: every figure is a screenshot of real output.
"""
import html
import re
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "evidence"
SHOTS = ROOT / "screenshots"
SHOTS.mkdir(exist_ok=True)
EVIDENCE.mkdir(exist_ok=True)


def render_test_log_page():
    """Wrap the raw TAP output in a readable shell so it can be screenshotted as-is."""
    raw = (ROOT / "evidence-tests-raw.txt").read_text()
    lines = []
    for line in raw.splitlines():
        cls = ""
        if line.strip().startswith("not ok"):
            cls = "fail"
        elif line.strip().startswith("ok "):
            cls = "pass"
        elif line.startswith("# tests") or line.startswith("# pass") or line.startswith("# fail"):
            cls = "summary"
        elif line.strip().startswith("# Subtest"):
            cls = "suite"
        lines.append(f'<div class="{cls}">{html.escape(line) or "&nbsp;"}</div>')
    head = re.search(r"# tests (\d+).*?# pass (\d+).*?# fail (\d+)", raw, re.S)
    summary = ""
    if head:
        summary = (
            '<div class="kpi">'
            f'<div><b>{head.group(1)}</b><span>tests executed</span></div>'
            f'<div><b>{head.group(2)}</b><span>passed</span></div>'
            f'<div><b>{head.group(3)}</b><span>failed</span></div>'
            "</div>"
        )
    doc = f"""<!doctype html><html><head><meta charset="utf-8"><style>
    body{{margin:0;background:#f6f7fb;font:13px/1.45 ui-monospace,Consolas,monospace;color:#0f172a}}
    header{{background:#0f766e;color:#fff;padding:20px 28px;font-family:"Segoe UI",sans-serif}}
    header h1{{margin:0;font-size:19px}} header p{{margin:6px 0 0;font-size:13px;opacity:.9}}
    main{{padding:20px 28px 40px;max-width:1120px}}
    .kpi{{display:flex;gap:12px;margin-bottom:16px;font-family:"Segoe UI",sans-serif}}
    .kpi div{{flex:1;background:#fff;border:1px solid #e3e6ee;border-radius:10px;padding:12px 14px}}
    .kpi b{{display:block;font-size:26px;color:#0f766e}} .kpi span{{font-size:12px;color:#6b7280}}
    .shell{{background:#fff;border:1px solid #e3e6ee;border-radius:10px;padding:14px 16px}}
    .pass{{color:#0f766e}} .fail{{color:#b91c1c;font-weight:700;background:#fee2e2}}
    .suite{{color:#3730a3;font-weight:700;margin-top:6px}} .summary{{color:#0f172a;font-weight:700;background:#eef0f8}}
    </style></head><body><header><h1>CCLBS backend — automated test run (Node test runner, TAP output)</h1>
    <p>Command: npm test &nbsp;→&nbsp; node --experimental-sqlite --test tests/*.test.js &nbsp;·&nbsp; raw console output, unedited</p></header>
    <main>{summary}<div class="shell">{"".join(lines)}</div></main></body></html>"""
    out = EVIDENCE / "page-test-log.html"
    out.write_text(doc)
    return out


def shoot(page, path, out_name):
    page.goto(pathlib.Path(path).as_uri(), wait_until="load")
    page.screenshot(path=str(SHOTS / out_name), full_page=True)
    print(f"  captured {out_name}")


def capture_frontend():
    """Screenshot the existing React prototype if its production build is servable."""
    dist = pathlib.Path("/home/user/CCLBS/dist")
    if not dist.exists():
        print("  frontend build not present — skipped")
        return []
    import functools, http.server, socketserver, threading

    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(dist))
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    port = httpd.server_address[1]
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    made = []
    base = f"http://127.0.0.1:{port}/"
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page(viewport={"width": 1440, "height": 900})
        try:
            page.goto(base, wait_until="networkidle", timeout=20000)
            page.wait_for_timeout(800)
            page.screenshot(path=str(SHOTS / "fig-frontend-login.png"), full_page=True)
            made.append("fig-frontend-login.png")
            print("  captured fig-frontend-login.png")
            # Sign in with a seeded administrator ID so deeper screens can be captured.
            try:
                page.fill("input", "20210001", timeout=4000)
            except Exception:
                try:
                    page.locator("input").first.fill("20210001", timeout=4000)
                except Exception as exc:
                    print(f"  could not fill the sign-in field: {exc}")
            try:
                for sel in ["button:has-text('Sign in')", "button:has-text('Login')", "button[type=submit]", "button"]:
                    if page.locator(sel).count():
                        page.locator(sel).first.click(timeout=4000)
                        break
                page.wait_for_timeout(1200)
                page.screenshot(path=str(SHOTS / "fig-frontend-dashboard.png"), full_page=True)
                made.append("fig-frontend-dashboard.png")
                print("  captured fig-frontend-dashboard.png")
                # Walk the sidebar by visible label; unknown labels are skipped quietly.
                for label, slug in [("Rooms", "rooms"), ("Calendar", "calendar"), ("Reports", "admin-reports")]:
                    try:
                        link = page.get_by_text(label, exact=True).first
                        if link.count():
                            link.click(timeout=3000)
                            page.wait_for_timeout(1000)
                            page.screenshot(path=str(SHOTS / f"fig-frontend-{slug}.png"), full_page=True)
                            made.append(f"fig-frontend-{slug}.png")
                            print(f"  captured fig-frontend-{slug}.png")
                    except Exception as exc:
                        print(f"  skipped frontend screen '{label}': {exc}")
            except Exception as exc:
                print(f"  sign-in step failed: {exc}")
        except Exception as exc:
            print(f"  frontend capture failed entirely: {exc}")
        b.close()
    httpd.shutdown()
    return made


def main():
    render_test_log_page()
    pages = [
        ("page-api-console.html", "fig-api-console.png"),
        ("page-negative-paths.html", "fig-negative-paths.png"),
        ("page-database-schema.html", "fig-database-schema.png"),
        ("page-analytics.html", "fig-analytics.png"),
        ("page-test-log.html", "fig-test-console.png"),
    ]
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900}, device_scale_factor=1)
        for src, out in pages:
            shoot(page, EVIDENCE / src, out)
        page.close()
        browser.close()
    made = capture_frontend()
    print(f"Total screenshots: {len(pages) + len(made)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
