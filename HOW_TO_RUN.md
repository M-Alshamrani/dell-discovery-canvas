# How to run the Dell Discovery Canvas on your laptop

About 2 minutes end-to-end. Runs entirely on your own machine — your review data stays in your browser.

---

## Prerequisites (one-time, ~3 min)

- **Python 3.10 or later** — free from https://www.python.org/downloads/
  - During install on Windows, **tick the checkbox "Add python.exe to PATH"**. It's easy to miss.
  - Most Dell dev laptops already have Python; check by opening Command Prompt or Terminal and running `python --version`. If you see a version number, you're good.
- A web browser (you have one).

---

## Step-by-step

### Option A — Download the ZIP (easiest, no extra tools)

1. Open the repository page in your browser: https://github.com/M-Alshamrani/dell-discovery-canvas
   - You'll need to be signed in to GitHub and have accepted the collaboration invitation Mahmoud sent.
2. Click the green **`Code`** button near the top right → **`Download ZIP`**.
3. Extract the ZIP anywhere convenient (your Desktop is fine).
4. Open the extracted folder.
5. **Windows**: double-click **`start.bat`**.
   **macOS / Linux**: open Terminal in the folder, then run `./start.sh` (you may need to run `chmod +x start.sh` once on the first time).
6. A small command window opens, the local server starts, and your default browser opens to http://localhost:8000 automatically.

### Option B — Clone with git (for future quick updates)

```bash
git clone https://github.com/M-Alshamrani/dell-discovery-canvas.git
cd dell-discovery-canvas
```

Then run `start.bat` (Windows) or `./start.sh` (macOS / Linux).

To pull the latest changes later: `git pull`, then restart.

### Option C — Docker (Linux hosts, including ARM64 appliances)

For shared internal deployments. Requires Docker + Docker Compose installed.

```bash
git clone https://github.com/M-Alshamrani/dell-discovery-canvas.git
cd dell-discovery-canvas
docker compose up -d --build
```

Open **http://localhost:8080**.

By default the container binds to `127.0.0.1` (localhost only — safe even on a shared host).

To stop: `docker compose down`. To follow logs: `docker compose logs -f`.

> **Note**: Port 8080 was chosen to avoid clashing with typical self-hosted
> vLLM containers (Code LLM on :8000, VLM on :8001). If you need a different
> host port: `HOST_PORT=8888 docker compose up -d`.

#### Exposing to the LAN with Basic auth (v2.2.1+)

Don't open the container to the LAN without a credential gate — the LLM
endpoints on the same host are unauth'd, and any reviewer who can reach
the app could also reach inference if both are LAN-visible. Set both
`AUTH_USERNAME` and `AUTH_PASSWORD` to enable HTTP Basic auth, **and**
flip `BIND_ADDR=0.0.0.0`:

```bash
AUTH_USERNAME=<your-username> \
AUTH_PASSWORD=<strong-password> \
BIND_ADDR=0.0.0.0 \
  docker compose up -d --build
```

> **Naming convention**: when standing up a versioned deployment for shared
> testing (e.g., a clone alongside `main` for parallel review), use the form
> `dell-discovery-canvas-vX.Y.Z[-purpose]` for the directory and any
> identifying labels. Keep the container name as `dell-discovery-canvas`.

Authorised users reach `http://<host-IP>:8080`, get a browser login prompt,
and need the chosen username/password to access the app. The `/health`
endpoint stays open for monitoring.

To rotate credentials: `docker compose down`, change the env vars, `docker compose up -d`.

To turn auth back off (localhost-only): unset the two env vars and recreate the container with the default `BIND_ADDR=127.0.0.1`.

---

## What to expect

- The app runs in your browser at **http://localhost:8000**.
- Test banner at the top: **green** = all good. If red, hard-refresh (**Ctrl+F5** or **Cmd+Shift+R**); if still red, message Mahmoud.
- **All data you enter stays in your browser** (`localStorage`). Nothing leaves your machine.
- To stop the server: close the command window (Windows) or press **Ctrl+C** (macOS / Linux).

---

## How to use it

- Defaults to the **Context** tab. Either start fresh or keep the **demo customer** (Acme Financial Services) that loads by default.
- Use the 5 step-tabs at the top: Context → Current State → Desired State → Gaps → Reporting.
- The Reporting tab has 5 sub-tabs (Overview, Heatmap, Gaps Board, Vendor Mix, Roadmap).
- Click the `?` icon in the top-right of each tab for page-specific help.
- Press **"Load demo"** in the footer to reset to the demo customer any time.
- Press **"Export JSON"** in the footer to save a session file.

---

## Updating to a newer version

**If you downloaded the ZIP**: re-download the ZIP, extract, replace the old folder.

**If you cloned with git**:
```bash
cd dell-discovery-canvas
git pull
```
Then restart `start.bat` / `start.sh`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Python is not installed" | Install from https://python.org/downloads — on Windows, tick "Add to PATH". Restart the runner script. |
| "Port 8000 is already in use" | Close whatever else is using port 8000, or edit the last line of `start.bat` / `start.sh` to use a different port (e.g. `python -m http.server 8081` and open http://localhost:8081). |
| Docker: "port is already allocated" on 8080 | Another container or service is using 8080. Either stop it, or run with `HOST_PORT=8888 docker compose up -d` and open http://localhost:8888. |
| Docker: app loads but logo missing / fonts wrong | The browser may have cached an older build. Hard-refresh (Ctrl+F5 / Cmd+Shift+R) once after `docker compose up --build`. |
| Docker auth: every request gets 500 instead of 200 with correct creds | Old `.htpasswd` from a previous build is cached. Run `docker compose down && docker compose up -d --build`. |
| Docker auth: enabled both env vars but no prompt appears | Verify: `docker logs dell-discovery-canvas \| grep entrypoint` should say *"Enabling Basic auth"*. If it says *"not set"*, the shell didn't propagate the vars — try the explicit `VAR=val docker compose up` form (single line, no newlines). |
| Browser didn't open automatically | Open it yourself and go to http://localhost:8000. |
| Test banner is red | Hard-refresh with Ctrl+F5 (Windows) or Cmd+Shift+R (macOS). If still red, send Mahmoud the failing assertion from the browser console (F12). |
| Need to clear demo and start fresh | Click "New session" in the footer (bottom right). |

---

*Questions? Ping Mahmoud Alshamrani. Full project documentation lives in `README.md` and `SPEC.md` in the repo.*
