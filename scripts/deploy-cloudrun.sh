#!/usr/bin/env bash
# One-command Cloud Run deployment (run this in Google Cloud Shell or anywhere
# with gcloud authenticated).
#
#   bash scripts/deploy-cloudrun.sh
#
# It enables the required APIs, stores the Gemini key in Secret Manager, and
# deploys the service. Prints the public URL at the end.
set -euo pipefail

SERVICE="${SERVICE:-veritas}"
REGION="${REGION:-asia-south1}"

command -v gcloud >/dev/null 2>&1 || {
  echo "gcloud is not installed. Open https://shell.cloud.google.com and run this script there." >&2
  exit 1
}

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "No active project. Run: gcloud config set project YOUR_PROJECT_ID" >&2
  exit 1
fi

echo "Project: ${PROJECT_ID}  Region: ${REGION}  Service: ${SERVICE}"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  generativelanguage.googleapis.com

if ! gcloud secrets describe gemini-api-key >/dev/null 2>&1; then
  echo
  read -r -s -p "Paste your Gemini API key (https://aistudio.google.com/apikey): " GEMINI_KEY
  echo
  printf '%s' "${GEMINI_KEY}" | gcloud secrets create gemini-api-key --data-file=-
else
  echo "Secret gemini-api-key already exists; reusing it."
fi

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" >/dev/null

gcloud run deploy "${SERVICE}" \
  --source . \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 120 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "AI_PROVIDER=gemini,GEMINI_MODEL=gemini-3.8-flash,RETRIEVAL_ALLOWED_HOSTS=en.wikipedia.org,NODE_ENV=production" \
  --set-secrets "GEMINI_API_KEY=gemini-api-key:latest"

URL="$(gcloud run services describe "${SERVICE}" --region "${REGION}" --format='value(status.url)')"
echo
echo "Deployed: ${URL}"
echo "Health:   ${URL}/api/health"
echo
echo "Optional: paste this line into README.md so the repo links to the live app."
echo "- **Live app:** ${URL}"
