# studious-winner
HIRING HELPER
# Optimum PM Hiring Hub — Resume Proxy Server

This server holds your Anthropic API key securely. Your peers upload resumes
through the hub HTML → this server → Claude API → back to the browser.

No npm packages required. Runs on Node.js 18+.

---

## Deploy in 5 minutes — choose one platform

---

### Option A: Railway (recommended — easiest)

1. Go to https://railway.app and sign up (free tier available)

2. Click **New Project → Deploy from GitHub repo**
   - Push these two files (`server.js`, `package.json`) to a new GitHub repo first
   - Or use **New Project → Empty Project → Add a Service → GitHub Repo**

3. In your Railway project, click your service → **Variables** tab → **Add Variable**:
   ```
   ANTHROPIC_API_KEY = sk-ant-your-key-here
   ```
   Optionally add:
   ```
   ALLOWED_ORIGIN = https://claude.ai
   ```

4. Railway auto-detects Node.js and runs `npm start`. Your server URL will be
   something like: `https://optimum-resume-proxy.up.railway.app`

5. Test it:
   ```
   curl https://your-server.up.railway.app/health
   ```
   You should see: `{"ok":true,"message":"Optimum Resume Proxy is running"}`

---

### Option B: Render (also free tier)

1. Go to https://render.com and sign up

2. Click **New → Web Service → Connect a GitHub repo**
   (push `server.js` + `package.json` to GitHub first)

3. Settings:
   - **Build Command**: (leave blank — no build needed)
   - **Start Command**: `node server.js`
   - **Instance type**: Free

4. Under **Environment**, add:
   ```
   ANTHROPIC_API_KEY = sk-ant-your-key-here
   ```

5. Click **Create Web Service**. Your URL will be:
   `https://optimum-resume-proxy.onrender.com`

   ⚠️ Free Render instances spin down after 15 minutes of inactivity.
   The first upload after idle will take ~30 seconds to warm up.

---

### Option C: Fly.io (more control, still free for small servers)

1. Install Fly CLI: https://fly.io/docs/hands-on/install-flyctl/

2. In this folder, run:
   ```bash
   fly launch --name optimum-resume-proxy --region ewr --no-deploy
   fly secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
   fly deploy
   ```

3. Your URL: `https://optimum-resume-proxy.fly.dev`

---

## Update the hub HTML

Once your server is deployed, open `optimum_hiring_hub.html` and find this line
near the bottom of the `<script>` section:

```js
const PROXY_URL = "YOUR_SERVER_URL_HERE";
```

Replace with your actual server URL:

```js
const PROXY_URL = "https://optimum-resume-proxy.up.railway.app";
```

Save and redistribute the HTML file to your team. That's it.

---

## Security notes

- Your API key never touches the browser — it lives only in the server's
  environment variables
- The server only accepts POST requests to `/parse-resume`
- Set `ALLOWED_ORIGIN` to your team's domain for extra protection
- File size is capped at 20MB per upload
- The server forces `claude-sonnet-4-20250514` and caps `max_tokens` at 1000,
  so peers can't abuse the key for other purposes

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ Yes | — | Your Anthropic API key |
| `PORT` | No | `3000` | Port to listen on |
| `ALLOWED_ORIGIN` | No | `*` | CORS origin (e.g. `https://claude.ai`) |

---

## Local testing

```bash
ANTHROPIC_API_KEY=sk-ant-your-key node server.js
# Server running on http://localhost:3000

curl http://localhost:3000/health
# {"ok":true,"message":"Optimum Resume Proxy is running"}
```
