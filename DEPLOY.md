# Deployment

Target: **Cloud Run**, because it is the host named in the submission form and it gives the
project a real Google Cloud footprint (Cloud Build, Artifact Registry, Secret Manager, Cloud
Logging).

Two paths. Path A needs nothing installed on your laptop.

---

## Path A — Google Cloud Shell (recommended, ~6 minutes)

1. Open <https://shell.cloud.google.com> and sign in with the Google account that has (or can
   create) a Cloud project.
2. Create/select a project and note its id:

   ```bash
   gcloud projects list
   gcloud config set project YOUR_PROJECT_ID
   ```

   If you have no project: <https://console.cloud.google.com/projectcreate>. A billing account is
   required by Cloud Run, but the free tier covers a demo like this.

3. Get a free Gemini API key: <https://aistudio.google.com/apikey> → **Create API key**.

4. Upload the project. In Cloud Shell: **⋮ → Upload** and choose the zip, then:

   ```bash
   unzip veritas.zip -d veritas
   cd veritas
   bash scripts/deploy-cloudrun.sh
   ```

   The script enables the APIs, stores the key in Secret Manager, grants the runtime service
   account access, builds the image and deploys. First run takes 3–5 minutes.

5. Copy the printed URL, open it, and run one claim end-to-end. Then check:

   ```bash
   curl -s "$(gcloud run services describe veritas --region asia-south1 --format='value(status.url)')/api/health"
   ```

Expected: `{"status":"ok","provider":"gemini",...}`.

---

## Path B — local machine with gcloud

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
bash scripts/deploy-cloudrun.sh
```

Requires `gcloud` and Docker only if you build locally; `--source .` uses Cloud Build, so Docker
is not needed.

---

## Path C — Render (backup host, no Google account)

1. Push the repository to GitHub.
2. <https://render.com> → **New → Blueprint** → pick the repo. `render.yaml` is detected.
3. Paste `GEMINI_API_KEY` when prompted. Free tier cold-starts in ~30 s.

The submission form asks for a "Cloud run URL"; Path A is the literal match. Use Path C only if
Cloud Run is blocked.

---

## Verify the deployment

```bash
curl -sS -X POST "$URL/api/research" \
  -H 'content-type: application/json' \
  -d '{"claim":"Octopuses have three hearts.","depth":"quick"}' | head -n 3
```

You should see a `status` line, then `source` events, then a `report`.

## Operations notes

- **Scaling:** `min-instances=0`, `max-instances=3`, concurrency 20. The in-memory cache and rate
  limiter are per instance; swap for Memorystore if you need global limits.
- **Secrets:** `GEMINI_API_KEY` is mounted from Secret Manager. It is never in the image, the
  repo, or the client bundle.
- **Logs:** structured JSON on stdout; Cloud Logging reads `severity` directly.
- **Rollback:** `gcloud run services update-traffic veritas --to-revisions REVISION=100`.
- **Cost:** a demo run is well inside the free tier; set a budget alert if you leave it public.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `PERMISSION_DENIED: Secret ...` | Re-run the IAM binding in `scripts/deploy-cloudrun.sh` |
| Health shows `"provider":"mock"` | `AI_PROVIDER` env var missing — set it to `gemini` |
| Every run returns `PROVIDER_ERROR` | Key invalid/expired, or the Generative Language API is disabled |
| `429` in the UI | Per-IP limit hit (8/min); wait for `Retry-After` |
| Build fails on `npm ci` | `package-lock.json` missing — commit it |
