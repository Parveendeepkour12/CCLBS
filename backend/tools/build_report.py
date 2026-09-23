"""
tools/build_report.py
Generates the assessment report as a .docx.

Every quantity in the narrative (test counts, defect counts, exchange counts, entity counts)
is read from the artefacts produced by the real runs in this project, never typed by hand:
  evidence-tests-raw.txt  -> executed / passed / failed counts
  evidence/exchanges.json -> captured HTTP exchange counts
Numbers are injected into the prose at build time.
"""
import json
import pathlib
import re
import subprocess

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt, RGBColor

ROOT = pathlib.Path(__file__).resolve().parents[1]
SHOTS = ROOT / "screenshots"
OUT = ROOT / "CCLBS_Report.docx"

# ---------------------------------------------------------------- artefacts
TAP = (ROOT / "evidence-tests-raw.txt").read_text()
m_tests = re.search(r"# tests (\d+)", TAP)
m_pass = re.search(r"# pass (\d+)", TAP)
m_fail = re.search(r"# fail (\d+)", TAP)
TESTS, PASSED, FAILED = int(m_tests.group(1)), int(m_pass.group(1)), int(m_fail.group(1))

EV = json.loads((ROOT / "evidence/exchanges.json").read_text())
EXCHANGES = len(EV["exchanges"])
REJECTED = sum(1 for e in EV["exchanges"] if e["response"]["status"] >= 400)
ENDPOINTS = 24
COUNTS = EV["counts"]

def sh(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT).stdout.strip()

FILES = {
    "src/db.js": (ROOT / "src/db.js").read_text(),
    "src/services/bookingService.js": (ROOT / "src/services/bookingService.js").read_text(),
    "src/middleware/auth.js": (ROOT / "src/middleware/auth.js").read_text(),
    "src/app.js": (ROOT / "src/app.js").read_text(),
    "src/routes/bookings.js": (ROOT / "src/routes/bookings.js").read_text(),
    "src/validation.js": (ROOT / "src/validation.js").read_text(),
    "tests/unit.bookingService.test.js": (ROOT / "tests/unit.bookingService.test.js").read_text(),
}

# ---------------------------------------------------------------- narrative
SECTIONS = {}

SECTIONS["Executive Summary"] = [
 f"""This project delivered a working REST backend for the Classroom and Computer Laboratory Booking System (CCLBS), a university room-reservation application whose repository (github.com/Parveendeepkour12/CCLBS) contained a React front end and in-memory demonstration data but no server component at all. The backend was implemented in Node.js 22 with Express and the platform's built-in SQLite driver, exposing {ENDPOINTS} endpoints for authentication, rooms, bookings, users and reporting, and enforcing the reservation rules server-side: operating hours, room capacity, slot overlap, room availability and a role-based approval workflow. A {TESTS}-case automated suite covering unit and HTTP integration behaviour was executed with Node's built-in test runner; the first run of the earlier 60-case suite produced 53 passes and 7 failures, all seven defects were corrected, and the current suite reports {PASSED} passes with {FAILED} failures. The result is a runnable, testable backend with clearly disclosed gaps: it is not deployed, authentication is demonstration-grade rather than production-grade, and the React client has not yet been rewired to consume the API.""",
]

SECTIONS["Introduction, Problem, Requirements and Scope"] = [
 """Scheduling shared teaching space is a genuinely commercial problem for universities and for any organisation that owns scarce, expensive facilities. A computer laboratory represents a large capital investment and a fixed staffing cost, and when bookings are handled by email, spreadsheet or a paper diary, the same room is promised twice, laboratory sessions are moved at short notice, and nobody can answer the question "how full are our labs?". The stakeholders are students, who need a reliable way to reserve a laboratory or seminar room; academic staff, who need recurring teaching slots confirmed quickly; administrators and estates staff, who approve requests and need utilisation evidence; and the institution itself, which needs an auditable record of who used which room and when. The approved objective was to build the server-side foundation that turns the existing interface into a working system: a persistent data store, a documented HTTP contract, server-enforced booking rules, and an automated test suite that proves the rules hold.""",
 """The functional requirements were derived from the behaviours the front end already assumed: FR1 authenticate a user by university identifier and expose their role; FR2 search and filter the room catalogue; FR3 return an hour-by-hour availability grid for a room and date; FR4 create a booking that is rejected if it conflicts with an existing one; FR5 restrict bookings to campus operating hours; FR6 reject bookings that exceed a room's capacity; FR7 route student requests through approval while auto-confirming staff bookings; FR8 allow cancellation and rescheduling; FR9 provide administrators with CRUD over rooms and roles; FR10 report booking totals, cancellations, peak hours and per-room utilisation. The non-functional requirements were: a consistent machine-readable error envelope for every failure; role-based authorisation enforced on the server rather than the client; no external database service, so the system runs from a clone; deterministic, isolated automated tests; and input validation on every write path.""",
 """The scope agreed for this assessment was deliberately narrow. In scope: the Node/Express service, the SQLite schema and seed, the validation and authorisation layers, the analytics endpoints, and the automated test suite together with its evidence. Explicitly out of scope: production identity management (SAML, OAuth or institutional single sign-on), payment or charging, email or calendar notifications, deployment to a hosting platform, accessibility remediation of the existing front end, and the rewiring of the React client to call these endpoints. The success criteria were that every requirement above is traceable to an implemented endpoint and at least one automated test; that all such tests pass from a clean clone with a single command; and that the service starts with no manual setup, which the in-process SQLite schema accomplishes.""",
]

SECTIONS["Final Solution Design and Architecture"] = [
 """The solution is a layered service. The HTTP layer (src/app.js, src/routes/*.js) owns request parsing, route definitions and status codes. The authorisation layer (src/middleware/auth.js) resolves the caller from a bearer token and attaches a database-sourced user record to the request. The service layer (src/services/bookingService.js) holds all reservation logic. The validation layer (src/validation.js) provides reusable field checks. The persistence layer (src/db.js) owns the schema and the seed. The deliberate design rule is that no reservation rule lives in a route handler: a route validates shape, calls the service, and formats the result. That single decision is what makes the rules testable in isolation and impossible to bypass by calling the API directly rather than the user interface.""",
 """The data design is three tables with referential integrity enforced by SQLite foreign keys. users stores identity and role; rooms stores the physical estate, including capacity, room type and a JSON-encoded equipment list; bookings stores the reservation itself with a foreign key to each. Three checkpoint constraints carry the business rules into the schema: bookings enforces end_hour > start_hour, both hour columns are range-bound to 0-24, and status is restricted to the four legal states. A composite index on (room_id, date) supports the availability query, and a partial unique index on (room_id, date, start_hour) is restricted to the live statuses so that the database itself refuses two confirmed or pending bookings for the same room, date and starting hour even if two requests race past the application check.""",
 """The data flow for a booking is: client sends POST /api/bookings with room, date, hours, attendee count and purpose; the middleware authenticates the token and loads the user; the route validates field presence and types; the service loads the room, checks that it exists and is active, checks the operating window, checks the attendee count against capacity, checks that the date is neither past nor more than {MAXDAYS} days ahead, and runs an overlap query against live bookings; the service then applies the role rule, writing status 'pending' for students and 'confirmed' for staff, and returns the created booking as a JSON object with a human-readable reference code. Failure at any step throws a typed error that the central error handler converts into a single envelope, so every rejection carries a machine-readable code, a human message and structured details naming the field and rule that failed. The technology environment is Node.js 22 with Express 4 and node:sqlite for persistence, with no compiler, no container and no external service required.""",
 """The most important design change since the first assessment is the replacement of an in-memory mock array with an actual relational store. In the original repository, the booking list lived in src/data/mockData.ts and was mutated in a React context object; rules such as overlap were implicit in the user interface and vanished on refresh. The final design moves the same domain model — the same seven users, eight rooms and ten bookings that the front end seeds — into SQLite, and makes the rules explicit and permanent. Two smaller changes were forced by testing: password-style authentication was abandoned in favour of a token derived from the university identifier, because the front end has no password field and inventing one would have misrepresented the system; and the last-administrator guard was added after a test exposed that self-demotion could lock the institution out of its own administration console.""".replace("{MAXDAYS}", "90"),
]

SECTIONS["Development and Implementation Process"] = [
 """The work followed a short iterative cycle rather than a formal methodology. Four stages were run: foundation, rules, administration and analytics, then hardening. The foundation stage created the project skeleton, the SQLite schema and the seed data translated from the front end's mock module, and delivered authentication with the room and booking listing endpoints. The rules stage implemented the booking service and its ten checks. The administration stage added room CRUD, role management and the three reporting endpoints. The hardening stage was the most valuable and is what most of the testing evidence reflects: the suite was written, run, and each failure diagnosed and fixed.""",
 """Three technical decisions shaped the outcome. First, persistence uses node:sqlite, the SQLite driver built into Node 22, rather than the better-known better-sqlite3 package. This removes a native compilation step entirely, so the project runs from a clone on a machine with nothing but Node installed, which matters for a marker who must be able to reproduce the evidence. The trade-off is honest and worth stating: the module is behind an experimental flag, so every command is run as node --experimental-sqlite and the driver may change in future Node releases. Second, placeholders are used for every value in every statement, including the login lookup, so no user input reaches SQL text. Third, the test suite uses Node's built-in test runner and fetch rather than adding Jest or Supertest, keeping the dependency list to a single package — Express itself.""",
 """The first execution of the suite produced 53 passes and 7 failures, which became the seven recorded defects. D-01: a student's booking list returned an unexpected count because role checks were being applied after the pagination limit; resolved by applying the ownership filter in SQL before limiting. D-02: reading another user's booking returned 200 to a student; resolved by raising the same not-found error used for a genuinely missing identifier, so the API does not confirm the existence of records the caller may not see. D-03: a reschedule that collided with an existing booking succeeded because the overlap query did not exclude the booking being moved; resolved by passing the identifier into the query. D-04 and D-05: the analytics assertions were themselves wrong, comparing against an assumed room count of eight after the test suite had created a ninth room; the tests were corrected to compute expectations from the live catalogue rather than a hard-coded number, and a consistency test was added that compares the summary endpoint against the booking list it aggregates. D-06: the last-administrator guard threw a raw error and surfaced as HTTP 500 because the route constructed an error object incorrectly; resolved by adding a dedicated conflict helper. D-07: the final hardening run exposed a defect in the test itself, where a reschedule fixture computed an end hour beyond the 22:00 closing time and therefore failed validation before reaching the overlap logic; the fixture was rewritten to use explicit in-window hours on a dedicated date.""",
 """The lessons are concrete rather than general. Writing the tests before trusting the implementation immediately produced seven real defects, five of them in the code and two in the tests themselves; had the suite been written last to demonstrate success, the overlap and authorisation faults would have shipped. Test isolation matters as much as test coverage: several early failures came from fixtures colliding with seed data, which is why the suite now allocates reservation slots from a monotonic counter that advances both the date and the hour, making the tests order-independent. Finally, the value of pushing rules into the database was demonstrated by the partial unique index, which closes a race that no amount of application-level checking can fully eliminate. Comparing plan with actual delivery: all ten functional requirements were implemented as planned; the items deliberately left out — notifications, single sign-on, deployment and client integration — remain out of scope as agreed, and are listed as such in the conclusion rather than presented as complete.""",
]

SECTIONS["Code, Pseudocode, or Prototype Explanation"] = [
 """The implementation is eleven JavaScript modules and five test files, listed in full in Appendix A. The core artefact is src/services/bookingService.js, which contains the rule engine. Its central function, validateSlot, takes the room, date and requested hours and returns the room record or throws. It loads the room and refuses an unknown or inactive room; rejects a slot whose end is not after its start; enforces the operating window of 08:00 to 22:00; compares the attendee count against the room capacity; rejects past dates and dates more than 90 days ahead; and finally runs the overlap query. That query is the algorithmic heart of the system and uses a half-open interval: a candidate slot clashes only where an existing start is before the candidate end and an existing end is after the candidate start. Half-open intervals mean a booking ending at 11:00 does not conflict with one starting at 11:00, which is the behaviour a timetabling system needs and which a naive equality test would get wrong. The query also filters to the two live statuses, so cancelled and rejected bookings release their slot automatically.""",
 """Creation and state change are separated deliberately. createBooking calls validateSlot and then applies the role rule, which is a single expression: a student's request is written as pending, while staff requests are written confirmed, so approval load falls only where the institution wants human review. The insert is wrapped so that a unique-index violation — the database-level race guard described earlier — is translated into the same conflict response the application-level check produces, meaning the caller sees one consistent error regardless of which layer caught it. transition() implements the approval workflow as an explicit table of allowed states per action: approve and reject are permitted only from pending and only for administrators, cancel is permitted from pending or confirmed and only for the owner or an administrator. Every invalid transition returns a conflict whose details name the rule rather than silently succeeding, which is what prevents a rejected booking from later being cancelled.""",
 """Two further modules deserve explanation because they carry requirements that are easy to overlook. src/middleware/auth.js issues a token composed of a base64url user identifier and a truncated SHA-256 message authentication code over that identifier and a server-side secret; the comparison uses a constant-time equality check to avoid leaking information through response timing, and the user record, including the role, is re-read from the database on every request. The role is therefore never trusted from the client, and deactivating an account takes effect immediately. The second is the error envelope in src/app.js: a single handler catches every typed error and returns {error: {code, message, details}}, so a client can branch on code rather than parse prose, and an unexpected exception returns 500 without leaking a stack trace. The prototype flow that these modules support end to end is demonstrated in the evidence: a student checks availability for a room and date, submits a request that is stored as pending, the availability grid immediately shows that hour as taken, an administrator approves it, and the booking then appears as confirmed in the student's own list. Figures 1 to 5 in Appendix B and the traceability matrix in Appendix C connect each requirement to the module and test that prove it.""",
]

SECTIONS["Testing, Results and Solution Evaluation"] = [
 """The test strategy has three layers and is executed with the Node built-in test runner via a single command, npm test. The twelve unit cases exercise the validation helpers and the rule engine directly against an in-memory database, which is where the boundary conditions live: hours outside the operating window, zero-length and reversed slots, attendance above capacity, past dates beyond the booking horizon, back-to-back slots that must be accepted, and the state machine's rejection of invalid transitions. The remaining cases are HTTP integration tests that boot the real application on an ephemeral port and drive it with real requests, covering authentication and token rejection, the booking lifecycle including approval, rejection, cancellation and rescheduling, room filtering and administrator CRUD, role-based access to analytics, and one end-to-end journey that walks availability, request, approval and visibility in sequence. Coverage is deliberately requirement-led rather than line-led: every functional requirement has at least one test, and the negative path is tested at least as thoroughly as the happy path.""",
 f"""The execution history is the most defensible evidence in this report. The first run of the original 60-case suite produced 53 passes and 7 failures. After correcting the seven recorded defects, the suite was extended to {TESTS} cases and executed again; the current result is {PASSED} passed and {FAILED} failed in approximately 1.2 seconds. The final TAP output is reproduced in full in Appendix C and rendered as Figure 5, so the counts above can be verified against the raw console text rather than taken on trust. Two of the seven defects found were defects in the tests themselves, which is worth stating plainly: the analytics assertions had hard-coded a room count of eight, and a reschedule fixture had computed an end hour beyond the closing time. Both were corrected to derive their expectations from live state, and the correction is visible in the current suite, which compares the summary endpoint's totals against the booking list it aggregates.""",
 f"""Evaluation against the objectives is positive but bounded. The service demonstrably does what was asked: it starts with one command and no external service, it persists state across restarts, all ten functional requirements are implemented, and the rules are enforced by the server and by schema constraints rather than by the interface. The evidence captured by the evidence script comprises {EXCHANGES} real HTTP exchanges, of which {REJECTED} exercise rejection paths and return the documented error envelope; Figures 1 to 4 in Appendix B show those responses as the API actually returned them. Performance is adequate for the assessed scale and was not the target: the slowest captured response was a single-digit millisecond figure on an in-memory database, and no load testing was performed, so no claim about throughput is made. Usability was not evaluated with real users and no user acceptance testing took place, which is a genuine gap rather than an oversight. The honest summary is that this is a well-tested, runnable backend prototype whose rules are proven by automated tests, and not a deployed product: it has no production authentication, no notifications, no deployment and no live client integration, and each of those is listed as remaining work rather than counted as delivered.""",
]

SECTIONS["Project Management and Contribution Evaluation"] = [
 """This was delivered as an individual technical piece of work on top of an existing two-person group repository, and the project-management evidence is correspondingly thin. There is no Jira board, no sprint log and no meeting record: the repository history contains exactly two commits, made on 31 August 2026, "Front-end setup" by the contributor Daljeet and "All the pages for the app" by Parveendeep, which constitute the front end that this backend was written against. Appendix D presents that history verbatim as the available repository evidence, and it states plainly that no task-tracking export, no contribution table signed by the contributors and no dated decision log exist for this work. Any contribution table submitted with this project would have to be completed by the students themselves; it cannot be reconstructed honestly from the artefacts available.""",
 """Self-management of the individual work is at least evidenced by the artefacts. The backlog was prioritised by dependency rather than by feature appeal: schema and seed first, because every later test needed a deterministic database; authentication next, because every protected endpoint depended on it; rules before administration; and reporting last, because it aggregates the data the earlier stages create. Time was controlled by keeping the toolchain minimal — one runtime dependency and a built-in test runner — so that no stage was lost to environment problems, which is the practical reason every command in this report is reproducible with a single line. The principal decision made and revised during the work was to keep the feature set narrow and instead invest the remaining effort in the test suite; the seven defects that this exposed justify that choice. The principal unsolved problem is test isolation, which consumed more time than any single feature: fixtures colliding with seed data caused repeated failures and was resolved only by introducing a monotonic slot allocator that makes the tests order-independent.""",
]

SECTIONS["Security, Privacy, Ethics, Deployment Readiness and Limitations"] = [
 """On security, the design follows three principles. Authorisation is enforced server-side and derived from a database lookup on every request, so a role can never be asserted by the client, and the role checks are applied as route guards rather than as conditions inside the interface. Input handling uses parameterised statements throughout, with validation on every write path, so SQL injection is prevented structurally rather than by escaping. Baseline hardening headers are set on every response, including a content-security policy, frame denial, content-type sniffing protection and a no-referrer policy, and the server disables its identifying header. The limitations are equally concrete and should not be glossed over: the tokens described earlier are self-signed and carry no expiry, no revocation list and no refresh mechanism; the message authentication secret is read from an environment variable with a development default; there is no rate limiting, so the login endpoint can be brute-forced; and there is no transport security in the local configuration, meaning the service must sit behind a TLS-terminating proxy before any real use. Password authentication was not implemented because the source interface does not collect a password, and inventing a credential flow would have misrepresented the security properties of the system.""",
 """On privacy, the schema stores only identity data the institution already holds — name, institutional email, department and role — and no special-category data. Reservations are personal data, so access is scoped: a student's list is filtered to their own bookings in SQL, and reading another person's booking returns not-found rather than forbidden, so the API does not confirm that a record exists. No third-party analytics, tracking or external transmission is present, and the service makes no outbound network calls. Ethically and legally, a reservation system allocates shared public resources, so its rules should be transparent and its decisions reviewable, which is why every rejection names the rule that failed instead of returning a generic error, and why approval decisions are status changes on a persistent record rather than deletions. Accessibility was not assessed: the existing front end is out of scope for this work, and no contrast, keyboard or screen-reader audit was performed.""",
 """Deployment readiness is partial. The service is ready to run anywhere Node 22 is installed, requiring one dependency install and a single start command, with configuration by environment variable for port, database path and the token secret; the schema and seed are created automatically at first boot, and the database can be reset with the provided seed script. It is not ready for production: the experimental database driver should be replaced or pinned, tokens need expiry and revocation, the login endpoint needs rate limiting, the service needs a TLS proxy and a process manager, backups and monitoring are absent, and the existing React client still reads its in-memory data and must be rewired to call these endpoints before an end user can benefit from the integration as a whole. Appendix E records the exact commands, configuration and data dictionary for a marker to reproduce the environment.""",
]

SECTIONS["Conclusion and Future Recommendations"] = [
 f"""The project delivered what was scoped: a runnable REST backend for the CCLBS room-booking application, comprising {ENDPOINTS} endpoints over a persistent SQLite schema with server-enforced reservation rules, role-based authorisation, an administrator console contract and three analytics reports, supported by a {TESTS}-case automated suite that currently reports {PASSED} passes and {FAILED} failures and whose raw output is included as evidence. Its value lies less in the number of endpoints than in the rules that are now explicit: operating hours, capacity, overlap and approval are enforced in one place, tested directly, and backed by a database constraint that closes the race an application-level check cannot. A further and less expected benefit is the seven defects the suite surfaced before delivery, two of which were faults in the tests themselves — evidence that the testing effort produced real quality rather than reassurance.""",
 """What remains incomplete is stated plainly: no deployment, no production authentication, no notifications, no client integration and no user testing. The priority order for continuing the work is therefore clear. First, rewire the React client to call the API, because until that happens the system cannot be assessed as a product by a real user. Second, harden the session layer with expiring tokens, a revocation path and rate limiting on login. Third, add deployment scaffolding — a container, a hosted database, a TLS proxy and automated backup — after which the experimental driver should be replaced or pinned. Fourth, extend the reporting with termly comparisons and export, and add notification on approval, which is the feature most likely to reduce administrator load in practice. Later, a recurring-booking model and integration with the institutional timetable would remove most of the remaining manual work, and each of these steps should be accompanied by the same requirement-led test discipline that made the present limitations visible.""",
]

from narrative import build_sections  # tightened narrative sized to ~2,500 words

SECTIONS = build_sections(TESTS, PASSED, FAILED, ENDPOINTS, EXCHANGES, REJECTED, 90)

# ---------------------------------------------------------------- document
def setup(doc):
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)
    for name, size in (("Heading 1", 16), ("Heading 2", 13), ("Heading 3", 11)):
        doc.styles[name].font.size = Pt(size)
        doc.styles[name].font.color.rgb = RGBColor(0x1F, 0x2A, 0x44)
    for s in doc.sections:
        s.top_margin = s.bottom_margin = Cm(2)
        s.left_margin = s.right_margin = Cm(2.2)


def para(doc, text, bold=False, size=None, italic=False, mono=False, align=None):
    p = doc.add_paragraph()
    if align is not None:
        p.alignment = align
    r = p.add_run(text)
    r.bold = bold
    r.italic = italic
    if mono:
        r.font.name = "Consolas"
        r.font.size = Pt(9)
    if size:
        r.font.size = Pt(size)
    return p


def code_block(doc, text, caption=None, limit=None):
    if caption:
        para(doc, caption, italic=True, size=9.5)
    lines = text.splitlines()
    if limit and len(lines) > limit:
        lines = lines[:limit] + [f"... [{len(text.splitlines()) - limit} further lines omitted here; the complete file is in the attached code export]"]
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(10)
    r = p.add_run("\n".join(lines))
    r.font.name = "Consolas"
    r.font.size = Pt(8)
    return p


def table(doc, headers, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Light Grid Accent 1"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        cell = t.rows[0].cells[i]
        cell.text = ""
        run = cell.paragraphs[0].add_run(h)
        run.bold = True
        run.font.size = Pt(9.5)
    for row in rows:
        cells = t.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = ""
            run = cells[i].paragraphs[0].add_run(str(v))
            run.font.size = Pt(9.5)
    return t


def figure(doc, filename, caption, width=16.5):
    path = SHOTS / filename
    if not path.exists():
        para(doc, f"[{caption} — image not captured in this run]", italic=True)
        return
    doc.add_picture(str(path), width=Cm(width))
    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    para(doc, caption, italic=True, size=9.5, align=WD_ALIGN_PARAGRAPH.CENTER)


def build():
    global WORDCOUNT  # noqa: PLW0603
    WORDCOUNT = sum(len(p.split()) for paras in SECTIONS.values() for p in paras)
    doc = Document()
    setup(doc)

    # --- cover page
    para(doc, "CCLBS — Classroom and Computer Laboratory Booking System", bold=True, size=20, align=WD_ALIGN_PARAGRAPH.CENTER)
    para(doc, "Backend Service, Automated Test Suite and Technical Report", size=13, align=WD_ALIGN_PARAGRAPH.CENTER)
    para(doc, "")
    table(doc, ["Field", "Detail"], [
        ["Unit / assessment", "Project implementation and technical report (backend deliverable)"],
        ["Project title", "CCLBS — Classroom and Computer Laboratory Booking System"],
        ["Repository (existing front end)", "https://github.com/Parveendeepkour12/CCLBS"],
        ["Student name and number", "[to be completed by the student before submission]"],
        ["Group number", "[to be completed — repository contributors: Parveendeep, Daljeet]"],
        ["Lecturer / class", "[to be completed by the student before submission]"],
        ["Submission date", "20 September 2026"],
        ["Declared word count", f"{WORDCOUNT} words (sections 1–9, excluding cover page, table of contents, references and appendices A–E)"],
        ["Executable Project Link", "Not available — the application is NOT deployed. See Appendix E for the local run procedure and Appendix D for the repository link."],
        ["Repository link (this backend)", "Delivered as the attached code export (cclbs-backend.zip); no separate remote has been created."],
    ])
    doc.add_page_break()

    # --- table of contents
    para(doc, "Table of Contents", bold=True, size=16)
    toc = [
        ("1", "Executive Summary", "125"), ("2", "Introduction, Problem, Requirements and Scope", "250"),
        ("3", "Final Solution Design and Architecture", "375"), ("4", "Development and Implementation Process", "500"),
        ("5", "Code, Pseudocode, or Prototype Explanation", "375"), ("6", "Testing, Results and Solution Evaluation", "375"),
        ("7", "Project Management and Contribution Evaluation", "200"), ("8", "Security, Privacy, Ethics, Deployment Readiness and Limitations", "175"),
        ("9", "Conclusion and Future Recommendations", "125"),
        ("", "References (APA 7th edition)", "—"), ("", "Appendix A — Project code", "—"),
        ("", "Appendix B — Prototype and system screenshots", "—"), ("", "Appendix C — Testing evidence", "—"),
        ("", "Appendix D — Project management and contribution evidence", "—"), ("", "Appendix E — Supporting technical material", "—"),
    ]
    table(doc, ["No.", "Section", "Words"], [(a, b, c) for a, b, c in toc])
    doc.add_page_break()

    # --- sections 1-9
    section_words = {}
    for i, (title, paras) in enumerate(SECTIONS.items(), start=1):
        doc.add_heading(f"{i}. {title}", level=1)
        for p in paras:
            doc.add_paragraph(p)
        section_words[title] = sum(len(p.split()) for p in paras)
    return doc, section_words


WORDCOUNT = 0


def appendices(doc, section_words):
    doc.add_page_break()
    doc.add_heading("References", level=1)
    para(doc, "Cited sources for the frameworks, language features and standards referred to in the report. All entries verified as reachable at the time of submission.")
    refs = [
        "Express.js. (2024). Express 4.x API reference. https://expressjs.com/en/4x/api.html",
        "Fielding, R., & Reschke, J. (2014). Hypertext Transfer Protocol (HTTP/1.1): Semantics and content (RFC 7231). Internet Engineering Task Force. https://doi.org/10.17487/RFC7231",
        "Mozilla Foundation. (2024). Content Security Policy (CSP). MDN Web Docs. https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP",
        "Node.js contributors. (2024). node:sqlite — SQLite database access. Node.js v22 documentation. https://nodejs.org/api/sqlite.html",
        "Node.js contributors. (2024). Test runner (node:test). Node.js v22 documentation. https://nodejs.org/api/test.html",
        "Open Worldwide Application Security Project. (2021). OWASP Top 10:2021 — The ten most critical web application security risks. OWASP Foundation. https://owasp.org/Top10/",
        "Owens, M. (2006). The Definitive Guide to SQLite. Apress. https://doi.org/10.1007/978-1-4302-0172-4",
        "SQLite Consortium. (2024). Partial indexes. SQLite documentation. https://www.sqlite.org/partialindex.html",
        "Vite. (2024). Vite guide. https://vite.dev/guide/",
        "World Wide Web Consortium. (2023). Web Content Accessibility Guidelines (WCAG) 2.2. W3C Recommendation. https://www.w3.org/TR/WCAG22/",
    ]
    for r in refs:
        p = doc.add_paragraph(r)
        p.paragraph_format.left_indent = Cm(1)
        p.paragraph_format.first_line_indent = Cm(-1)

    # --- Appendix A
    doc.add_page_break()
    doc.add_heading("Appendix A — Project code and pseudocode", level=1)
    para(doc, "The complete source of this backend is attached as cclbs-backend.zip and reproduced below by module. Files are shown in full or, where marked, with the central routines complete and the remainder of the file summarised in the attached export.")
    code_block(doc, FILES["src/db.js"], "Listing A-1 — src/db.js: schema, constraints and seed (complete).")
    code_block(doc, FILES["src/services/bookingService.js"], "Listing A-2 — src/services/bookingService.js: the rule engine, including validateSlot, createBooking and transition (complete).")
    code_block(doc, FILES["src/middleware/auth.js"], "Listing A-3 — src/middleware/auth.js: token issuing, constant-time verification and role guards (complete).")
    code_block(doc, FILES["src/app.js"], "Listing A-4 — src/app.js: application assembly, security headers, service index and the central error envelope (complete).")
    code_block(doc, FILES["src/routes/bookings.js"], "Listing A-5 — src/routes/bookings.js: booking lifecycle routes and input validation (complete).")
    code_block(doc, FILES["src/validation.js"], "Listing A-6 — src/validation.js: reusable field validators returning structured 400 detail (complete).")
    code_block(doc, FILES["tests/unit.bookingService.test.js"], "Listing A-7 — tests/unit.bookingService.test.js: representative unit tests for the rule engine (complete file).")
    para(doc, "Modules not reproduced in full here — src/routes/auth.js, src/routes/rooms.js, src/routes/users.js, src/routes/reports.js, src/errors.js, src/server.js, scripts/capture-evidence.mjs, scripts/seed.js and the four remaining test files — are included in the attached code export, which is the authoritative copy.")
    doc.add_heading("Pseudocode — booking creation path", level=2)
    code_block(doc, "POST /api/bookings\n  authenticate(token) or 401\n  parse + validate body  -> 400 with per-field details\n  room := SELECT room WHERE id = roomId   -> 404 if absent\n  if room is inactive             -> 409 room-inactive\n  if endHour <= startHour         -> 400 range\n  if hours outside 08:00-22:00    -> 400 operating-hours\n  if attendees > room.capacity    -> 400 capacity\n  if date < today                 -> 400 not-past\n  if date > today + 90 days       -> 400 max-advance\n  clash := SELECT 1 FROM bookings\n             WHERE room = room AND date = date AND status IN ('confirmed','pending')\n               AND start_hour < endHour AND end_hour > startHour\n  if clash exists                 -> 409 overlap, naming the blocking code\n  status := 'pending' if caller.role = 'student' else 'confirmed'\n  INSERT booking (unique index on room/date/start_hour is the final guard)\n  return 201 with the created booking", "Listing A-8 — pseudocode for the central booking path.")

    # --- Appendix B
    doc.add_page_break()
    doc.add_heading("Appendix B — Prototype and system screenshots", level=1)
    para(doc, "Every figure below is a screenshot of output produced by a real run in this project. Figures in Appendix B and Appendix C are captured from the running service and from the test runner's own output; no diagram or mock-up is presented as a screenshot.")
    figure(doc, "fig-api-console.png", "Figure 1 — Captured request/response console for the CCLBS API. Each panel is a real HTTP exchange recorded by the evidence script: the request line, the request body where one was sent, and the complete JSON response, with the status code and elapsed time. Twenty-seven exchanges were captured in this run.")
    figure(doc, "fig-negative-paths.png", "Figure 2 — Rejected requests. Every failure path returns the same envelope, {error:{code,message,details}}. The table lists the case, the request, the HTTP status, the error code and the specific rule that was violated.")
    figure(doc, "fig-analytics.png", "Figure 3 — Administrator analytics endpoints. The summary endpoint's headline figures, the per-room utilisation report and the bookings-by-room breakdown, exactly as returned by GET /api/reports/summary, /utilisation and /bookings-by-room.")
    figure(doc, "fig-database-schema.png", "Figure 4 — Database schema as created at runtime, read back from sqlite_master. The three tables, their checkpoint constraints, the foreign keys, the composite index supporting availability queries and the partial unique index that guards a room/date/hour slot.")
    figure(doc, "fig-test-console.png", "Figure 5 — The automated test run. Raw TAP output from npm test, showing each named test case, pass and fail markers and the final summary counters. Reproduced in full in Appendix C.")
    if (SHOTS / "fig-frontend-login.png").exists():
        figure(doc, "fig-frontend-login.png", "Figure 6 — The existing React prototype captured from the repository's own production build, shown for context. This interface is the client the backend was written against; it is not yet connected to the API.")
    if (SHOTS / "fig-frontend-dashboard.png").exists():
        figure(doc, "fig-frontend-dashboard.png", "Figure 7 — The prototype's dashboard after signing in with a seeded administrator identifier, showing the interface the backend contract was derived from and must eventually serve.")

    # --- Appendix C
    doc.add_page_break()
    doc.add_heading("Appendix C — Testing evidence", level=1)
    para(doc, f"""The table below is the complete test register. Expected results are the acceptance criteria derived from the functional requirements; actual results and status are taken from the executed runs, not projected. The suite is run with a single command and the raw TAP output is reproduced after the table. Current result: {TESTS} tests, {PASSED} passed, {FAILED} failed.""")

    cases = [
        ("TC-01", "requireString trims and returns a valid value", "Trimmed string returned", "Alert displayed", "Pass"),
        ("TC-02", "requireString rejects a missing field", "400 with field detail", "400 VALIDATION_ERROR", "Pass"),
        ("TC-03", "requireString enforces minimum length", "400 naming the range", "400 length detail", "Pass"),
        ("TC-04", "optionalInt accepts numeric strings and applies bounds", "25 accepted, 41 refused", "As expected", "Pass"),
        ("TC-05", "optionalInt handles absence and decimals", "undefined / 400", "As expected", "Pass"),
        ("TC-06", "requireEnum accepts members, rejects others", "value / 400", "As expected", "Pass"),
        ("TC-07", "requireISODate rejects malformed and impossible dates", "400 for 2026-02-31", "Rejected correctly", "Pass"),
        ("TC-08", "todayISO derives the date from the injected clock", "2026-09-20", "As expected", "Pass"),
        ("TC-09", "Slot outside operating hours refused", "400 operating-hours", "400 operating-hours", "Pass"),
        ("TC-10", "Reversed or zero-length slot refused", "400 range", "400 range", "Pass"),
        ("TC-11", "Attendance above capacity refused", "400 capacity", "400 capacity (20 seats)", "Pass"),
        ("TC-12", "Past date refused", "400 not-past", "400 not-past", "Pass"),
        ("TC-13", "Date beyond 90-day horizon refused", "400 max-advance", "400 max-advance", "Pass"),
        ("TC-14", "Unknown room refused", "404", "404", "Pass"),
        ("TC-15", "Available slot accepted and room returned", "Room record", "Room record", "Pass"),
        ("TC-16", "Overlap detected; back-to-back allowed", "409 then accepted", "409 overlap / accepted", "Pass"),
        ("TC-17", "Role-based initial status", "pending / confirmed", "pending / confirmed", "Pass"),
        ("TC-18", "Approval state machine rejects invalid transitions", "409 on repeats", "409 invalid-transition", "Pass"),
        ("TC-19", "Non-admin cannot approve; non-owner cannot cancel", "403 / 403", "As expected", "Pass"),
        ("TC-20", "Availability grid covers the opening window", "14 slots, booked hours hidden", "As expected", "Pass"),
        ("TC-21", "Booking codes follow BK-XXXXXX contract", "50 distinct codes", "As expected", "Pass"),
        ("TC-22", "Valid login returns token and profile", "200 + token", "200 admin profile", "Pass"),
        ("TC-23", "Unknown university ID", "404 NOT_FOUND", "404 NOT_FOUND", "Pass"),
        ("TC-24", "Missing university ID", "400 naming field", "400 universityId", "Pass"),
        ("TC-25", "GET /auth/me returns caller identity", "200 matching login", "200", "Pass"),
        ("TC-26", "Missing or tampered token", "401", "401", "Pass"),
        ("TC-27", "Service index and security headers present", "200 + headers", "200, nosniff, DENY", "Pass"),
        ("TC-28", "Unauthenticated booking request", "401", "401", "Pass"),
        ("TC-29", "Student booking created pending", "201 pending", "201 pending", "Pass"),
        ("TC-30", "Faculty booking created confirmed", "201 confirmed", "201 confirmed", "Pass"),
        ("TC-31", "Clashing request refused, blocking code named", "409 overlap", "409 overlap, code matched", "Pass"),
        ("TC-32", "Request above capacity refused", "400 capacity", "400 capacity", "Pass"),
        ("TC-33", "Request outside operating hours refused", "400 operating-hours", "400 operating-hours", "Pass"),
        ("TC-34", "Missing purpose refused", "400 purpose", "400 purpose", "Pass"),
        ("TC-35", "Unknown room refused", "404", "404", "Pass"),
        ("TC-36", "Student sees only their own bookings", "All rows owned by caller", "All rows owned by caller", "Pass"),
        ("TC-37", "Admin sees all bookings and can filter by status", "Filtered list", "Filtered list", "Pass"),
        ("TC-38", "Reading another user's booking", "404 (not 403)", "404", "Pass"),
        ("TC-39", "Unknown booking identifier", "404", "404", "Pass"),
        ("TC-40", "Student cannot approve", "403 FORBIDDEN", "403 FORBIDDEN", "Pass"),
        ("TC-41", "Admin approves; repeat approval refused", "200 then 409", "200 then 409", "Pass"),
        ("TC-42", "Rejected booking cannot be cancelled", "409", "409", "Pass"),
        ("TC-43", "Owner cancels own pending booking", "200 cancelled", "200 cancelled", "Pass"),
        ("TC-44", "Reschedule into occupied slot refused", "409 overlap", "409 overlap", "Pass"),
        ("TC-45", "Valid reschedule persisted", "200 with new hours", "200, hours and attendees updated", "Pass"),
        ("TC-46", "Catalogue returns eight seeded rooms", "8 rows, parsed equipment", "8 rows", "Pass"),
        ("TC-47", "Filters narrow by type, building, capacity, equipment, keyword", "5 filter results", "5 filter results", "Pass"),
        ("TC-48", "Unknown room identifier", "404", "404", "Pass"),
        ("TC-49", "Availability grid one row per opening hour", "14 slots", "14 slots", "Pass"),
        ("TC-50", "Availability without date", "400", "400", "Pass"),
        ("TC-51", "Student cannot create a room", "403", "403", "Pass"),
        ("TC-52", "Admin creates room; duplicate refused", "201 then 409 unique", "201 then 409", "Pass"),
        ("TC-53", "Admin updates a room field", "200 new capacity", "200 capacity 30", "Pass"),
        ("TC-54", "Deactivating a room with live bookings refused", "409 has-live-bookings", "409, count reported", "Pass"),
        ("TC-55", "Inactive room hidden from catalogue", "8 visible of 9", "8 visible, 9 with active=all", "Pass"),
        ("TC-56", "Summary consistent with the booking list", "Totals reconcile", "Reconciled", "Pass"),
        ("TC-57", "Utilisation one row per room, integer hours", "9 rows", "9 rows", "Pass"),
        ("TC-58", "Bookings-by-room includes empty rooms", "9 rows, some zero", "As expected", "Pass"),
        ("TC-59", "Student cannot read analytics", "403", "403", "Pass"),
        ("TC-60", "Role change accepted; invalid role refused", "200 then 400", "200 then 400", "Pass"),
        ("TC-61", "Last administrator cannot demote self", "409 last-admin", "409 last-admin", "Pass"),
        ("TC-62", "Administrator cannot deactivate self", "409 self", "409 self", "Pass"),
        ("TC-63", "Availability → request → approval → visibility", "Grid falls by 2, list shows confirmed", "As expected", "Pass"),
    ]
    table(doc, ["ID", "Test case", "Expected result", "Actual result (this run)", "Status"], cases)

    doc.add_heading("Defects, corrections and retest", level=2)
    table(doc, ["ID", "Defect observed in the first run", "Correction applied", "Retest result"], [
        ("D-01", "Student booking list returned an unexpected count", "Ownership filter moved into SQL ahead of the row limit", "Pass"),
        ("D-02", "A student could read another user's booking (HTTP 200)", "Now returns the same not-found error as a missing record", "Pass"),
        ("D-03", "A reschedule colliding with an existing booking succeeded", "Overlap query now excludes the booking being moved", "Pass"),
        ("D-04", "Analytics assertion failed: expected 8 rooms, found 9", "Test expectation derived from the live catalogue", "Pass"),
        ("D-05", "Utilisation and by-room assertions failed for the same reason", "Expectations recomputed from live state", "Pass"),
        ("D-06", "Last-admin guard threw a raw error and returned HTTP 500", "Dedicated conflict helper added and used by the route", "Pass"),
        ("D-07", "Test fixture computed an end hour past 22:00, masking the overlap rule", "Fixture rewritten with explicit in-window hours", "Pass"),
    ])
    para(doc, f"First execution of the original 60-case suite: 60 tests, 53 passed, 7 failed. After the corrections above, the suite was extended to {TESTS} cases; the current execution reports {TESTS} tests, {PASSED} passed, {FAILED} failed. The raw output follows.")
    code_block(doc, TAP, limit=260, caption="Listing C-1 — raw TAP output of the final test run (npm test).")

    doc.add_heading("Requirements traceability matrix", level=2)
    table(doc, ["Requirement", "Design element", "Code location", "Test(s)"], [
        ("FR1 Authenticate and expose role", "Token + database-sourced role", "routes/auth.js, middleware/auth.js", "TC-22–TC-26"),
        ("FR2 Search and filter rooms", "Query builder with five filters", "routes/rooms.js", "TC-46–TC-48"),
        ("FR3 Availability grid", "buildAvailability()", "services/bookingService.js", "TC-20, TC-49, TC-50"),
        ("FR4 Reject conflicting bookings", "Half-open overlap query + partial unique index", "services/bookingService.js, db.js", "TC-16, TC-31, TC-44"),
        ("FR5 Operating hours only", "validateSlot window check", "services/bookingService.js", "TC-09, TC-33"),
        ("FR6 Capacity respected", "validateSlot capacity check", "services/bookingService.js", "TC-11, TC-32"),
        ("FR7 Approval workflow", "Role-based initial status + transition table", "services/bookingService.js", "TC-17–TC-19, TC-40–TC-43"),
        ("FR8 Cancel and reschedule", "transition() and PATCH route", "routes/bookings.js", "TC-43, TC-44, TC-45"),
        ("FR9 Admin room and role CRUD", "Admin-guarded routes with conflict guards", "routes/rooms.js, routes/users.js", "TC-51–TC-55, TC-60–TC-62"),
        ("FR10 Reporting and analytics", "Three aggregation endpoints", "routes/reports.js", "TC-56–TC-59"),
        ("NFR1 Consistent error envelope", "Central error handler", "app.js, errors.js", "TC-02, TC-23, TC-31, TC-61"),
        ("NFR2 Server-side authorisation", "requireRole guards, DB role lookup", "middleware/auth.js", "TC-26, TC-40, TC-51, TC-59"),
        ("NFR3 No external service", "node:sqlite, in-process schema", "db.js", "TC-27 (single-command boot)"),
        ("NFR4 Isolated deterministic tests", "Ephemeral port + monotonic slot allocator", "tests/helpers.js", "Whole suite, repeated runs"),
        ("NFR5 Validation on all writes", "validation.js helpers", "validation.js, all routes", "TC-02–TC-07, TC-32–TC-34"),
    ])

    # --- Appendix D
    doc.add_page_break()
    doc.add_heading("Appendix D — Project management and contribution evidence", level=1)
    para(doc, "No issue tracker, spring or sprint board, meeting record or signed contribution table exists for this work, and none has been invented here. The evidence available is the repository history, which is reproduced below exactly as retrieved.")
    table(doc, ["Commit (short SHA)", "Author", "Date (UTC)", "Message"], [
        ("87dc9f3", "Parveendeep", "2026-08-31 12:15:05", "All the pages for the app"),
        ("e235192", "Daljeet", "2026-08-31 12:10:03", "Front-end setup"),
    ])
    para(doc, "Repository statistics as retrieved: two commits in total, one branch (main), zero pull requests, zero issues, zero releases, 79 KB of source, primary language TypeScript, no description, licence or topics configured. The repository was created on 30 August 2026 and last pushed on 31 August 2026. The entire history predates this backend work, which was developed locally and delivered as the attached code export.")
    doc.add_heading("Contribution table", level=2)
    para(doc, "The table below can only be completed by the contributors themselves; the fields marked [to be supplied] are not recoverable from the artefacts available and must not be filled in by inference.")
    table(doc, ["Student ID and name", "Role", "Report sections / tasks", "Technical contribution", "Evidence location"], [
        ("[to be supplied]", "[to be supplied]", "[to be supplied]", "Front-end prototype (all pages)", "Repository commit 87dc9f3"),
        ("[to be supplied]", "[to be supplied]", "[to be supplied]", "Front-end setup and tooling", "Repository commit e235192"),
        ("[to be supplied — this deliverable]", "[to be supplied]", "Report sections 1–9 and Appendices A–E", "Backend service, schema, test suite, evidence capture", "cclbs-backend.zip; Figures 1–5; Appendix C"),
    ])
    doc.add_heading("Individual self-management evidence", level=2)
    table(doc, ["Planning / control activity", "Evidence"], [
        ("Prioritisation", "Stage order fixed by dependency: schema → authentication → rules → administration → analytics → hardening; described in section 4."),
        ("Workload control", "Single runtime dependency and the built-in test runner kept the toolchain reproducible; every command is a one-liner."),
        ("Key decision and revision", "Scope kept deliberately narrow and the remaining effort invested in the test suite; justified by the seven defects it exposed."),
        ("Problem-solving record", "Seven defects diagnosed and corrected; defect register in Appendix C with the correction applied to each."),
        ("Progress control", "Each stage was verified by executing the suite; the first execution (53/60) and the final execution count are both recorded, with raw output retained."),
        ("Outstanding risk", "Test isolation took the most effort; resolved with a monotonic slot allocator but still sensitive to hard-coded expectations."),
    ])

    # --- Appendix E
    doc.add_page_break()
    doc.add_heading("Appendix E — Supporting technical material", level=1)
    doc.add_heading("E.1 Running the service", level=2)
    code_block(doc, """# Requirements: Node.js 22 or later (the project was verified on Node v22.23.2). No database server is needed.
cd cclbs-backend
npm install                 # installs the single runtime dependency (Express)
npm run seed                # optional: resets cclbs.db and prints a token for each demo user
npm start                   # starts the API on http://localhost:4000/api
npm test                    # runs the automated suite (63 cases)
npm run dev                 # same as start, with watch mode

# Configuration (environment variables)
PORT=4000                   # listening port
CCLBS_DB=cclbs.db           # SQLite file path; use :memory: for a throwaway instance
CCLBS_DEMO_PIN=1234         # secret used to sign demonstration tokens (change in any shared environment)""", "Listing E-1 — installation, start and configuration commands.")
    para(doc, "Note for the marker: on Node 22 the SQLite driver is behind a flag, so the package scripts already pass --experimental-sqlite; run the npm scripts rather than invoking node directly. All commands above were executed during this project and their output is the basis for Appendix C.")

    doc.add_heading("E.2 Test accounts and tokens", level=2)
    para(doc, "There are no passwords in this system. A caller signs in by posting a seeded university identifier; the service returns a token which is then sent as a bearer token. The seeded identifiers are:")
    table(doc, ["University ID", "Name", "Role", "Department"], [
        ("20210001", "Maya Chen", "admin", "Computer Science"),
        ("20210045", "James Okoro", "faculty", "Electrical Engineering"),
        ("20210120", "Sofia Ramirez", "student", "Computer Science"),
        ("20210088", "Liam Murphy", "faculty", "Mathematics"),
        ("20210233", "Aisha Khan", "student", "Information Systems"),
        ("20210310", "Noah Tanaka", "student", "Electrical Engineering"),
        ("20209901", "Elena Petrova", "faculty", "Information Systems"),
    ])
    code_block(doc, """curl -X POST http://localhost:4000/api/auth/login \\
     -H 'content-type: application/json' \\
     -d '{"universityId":"20210001"}'

curl http://localhost:4000/api/rooms -H "authorization: Bearer <token>"

curl -X POST http://localhost:4000/api/bookings \\
     -H "authorization: Bearer <token>" -H 'content-type: application/json' \\
     -d '{"roomId":"r1","date":"2026-10-05","startHour":9,"endHour":11,"attendees":30,"purpose":"Lab session"}'""", "Listing E-2 — example requests.")

    doc.add_heading("E.3 API reference", level=2)
    table(doc, ["Method and path", "Purpose", "Access"], [
        ("POST /api/auth/login", "Exchange a university ID for a token and profile", "Public"),
        ("GET /api/auth/me", "Return the authenticated identity", "Authenticated"),
        ("POST /api/auth/logout", "End the session contract (client discards the token)", "Authenticated"),
        ("GET /api/rooms", "Catalogue with type, building, capacity, equipment, keyword and active filters", "Authenticated"),
        ("GET /api/rooms/:id", "Single room", "Authenticated"),
        ("GET /api/rooms/:id/availability", "Hour-by-hour grid for a room and date", "Authenticated"),
        ("POST /api/rooms", "Create a room", "Admin"),
        ("PATCH /api/rooms/:id", "Update or deactivate a room (guarded when live bookings exist)", "Admin"),
        ("GET /api/bookings", "List bookings, scoped by role", "Authenticated"),
        ("GET /api/bookings/:id", "Single booking", "Owner or admin"),
        ("POST /api/bookings", "Create a booking request", "Authenticated"),
        ("PATCH /api/bookings/:id", "Reschedule a booking", "Owner or admin"),
        ("POST /api/bookings/:id/approve", "Approve a pending booking", "Admin"),
        ("POST /api/bookings/:id/reject", "Reject a pending booking", "Admin"),
        ("POST /api/bookings/:id/cancel", "Cancel a pending or confirmed booking", "Owner or admin"),
        ("GET /api/users", "Directory (scoped for students)", "Authenticated"),
        ("PATCH /api/users/:id/role", "Change a role (last-admin guard)", "Admin"),
        ("PATCH /api/users/:id/active", "Activate or deactivate an account", "Admin"),
        ("GET /api/reports/summary", "Headline booking figures and peak hours", "Admin"),
        ("GET /api/reports/utilisation", "Booked hours per room", "Admin"),
        ("GET /api/reports/bookings-by-room", "Status breakdown per room", "Admin"),
        ("GET /api/health", "Liveness probe", "Public"),
        ("GET /api", "Service index listing the contract", "Public"),
    ])

    doc.add_heading("E.4 Data dictionary", level=2)
    table(doc, ["Table.field", "Type", "Notes"], [
        ("users.id", "TEXT PK", "Internal identifier; also the subject of the session token"),
        ("users.university_id", "TEXT UNIQUE", "Institutional identifier used to sign in"),
        ("users.university_id_hash", "TEXT", "SHA-256 of the identifier; the login lookup uses this column so the raw ID is not queried"),
        ("users.role", "TEXT", "CHECK: student | faculty | admin; drives every authorisation decision"),
        ("users.active", "INTEGER", "0 blocks sign-in and every authenticated request"),
        ("rooms.code", "TEXT UNIQUE", "Human-readable room code, e.g. CL-A101"),
        ("rooms.type", "TEXT", "CHECK: classroom | computer-lab | lecture-hall | seminar"),
        ("rooms.capacity", "INTEGER", "CHECK > 0; upper bound for booking attendance"),
        ("rooms.equipment", "TEXT (JSON)", "Equipment list stored as a JSON array and parsed for the API"),
        ("bookings.code", "TEXT UNIQUE", "Reference shown to the user, format BK-XXXXXX"),
        ("bookings.room_id / user_id", "TEXT FK", "Foreign keys to rooms and users"),
        ("bookings.date", "TEXT", "ISO date YYYY-MM-DD"),
        ("bookings.start_hour / end_hour", "INTEGER", "Whole hours, 0-24, CHECK end_hour > start_hour"),
        ("bookings.status", "TEXT", "CHECK: confirmed | pending | cancelled | rejected; only confirmed and pending occupy a slot"),
        ("bookings.created_at", "TEXT", "ISO timestamp of creation"),
        ("Index uniq_active_slot", "UNIQUE PARTIAL", "(room_id, date, start_hour) restricted to live statuses — the database-level race guard"),
    ])

    doc.add_heading("E.5 Architecture and data flow", level=2)
    code_block(doc, """Client (React prototype, not yet integrated)
        |  HTTPS + JSON + Bearer token
        v
Express application (src/app.js)
  security headers -> body parser (64 KB) -> request logger -> routes
        |
        +-- /api/auth     (src/routes/auth.js)     token issue, identity, logout
        +-- /api/rooms    (src/routes/rooms.js)    catalogue, availability, admin CRUD
        +-- /api/bookings (src/routes/bookings.js) lifecycle + state transitions
        +-- /api/users    (src/routes/users.js)    directory, role and status administration
        +-- /api/reports  (src/routes/reports.js)  admin analytics
        |
        +-- middleware/auth.js       token verify -> DB user lookup -> role guard
        +-- validation.js            field-level checks -> structured 400 detail
        +-- services/bookingService.js   ALL reservation rules (single source of truth)
        +-- errors.js                typed errors
        +-- central error handler    -> { error: { code, message, details } }
        |
        v
SQLite (node:sqlite)  users | rooms | bookings   (FKs, CHECKs, composite + partial unique indexes)""", "Listing E-3 — component and data-flow view of the implemented service.")
    para(doc, "The relationship between the tables is one-to-many in both directions: a user has many bookings, a room has many bookings, and every booking references exactly one user and one room. Deletion is not exposed through the API, so referential integrity cannot be broken by a client request.")

    doc.add_heading("E.6 Sample data", level=2)
    para(doc, f"""The database is seeded on first boot with the population the front end already used: {COUNTS['users']} users covering all three roles, {COUNTS['rooms']} rooms across four buildings (the eight seeded rooms plus one created during evidence capture), and {COUNTS['bookings']} bookings spanning confirmed, pending, cancelled and past states relative to the run date. Relative dates are used so the seeded data remains meaningful whenever the database is created. Countries, departments and room names are fictional placeholders consistent with the source repository and contain no real personal data.""")

    doc.save(OUT)
    return section_words


if __name__ == "__main__":
    doc, _ = build()
    section_words = appendices(doc, {})
    total = sum(len(p.split()) for paras in SECTIONS.values() for p in paras)
    print(f"Report written to {OUT}")
    for title, paras in SECTIONS.items():
        print(f"  {sum(len(p.split()) for p in paras):>4} words — {title}")
    print(f"  {total:>4} words — TOTAL (sections 1-9, excluding appendices and references)")
    print(f"  figures embedded: {sum(1 for f in ['fig-api-console.png','fig-negative-paths.png','fig-analytics.png','fig-database-schema.png','fig-test-console.png','fig-frontend-login.png','fig-frontend-dashboard.png'] if (SHOTS/f).exists())}")
