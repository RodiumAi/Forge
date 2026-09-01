#!/bin/sh
set -e

echo "Waiting for MinIO..."
i=0
until mc alias set local http://minio:9000 "${MINIO_ROOT_USER:-rodiumdev}" "${MINIO_ROOT_PASSWORD:-rodiumdev123}"; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    echo "MinIO did not become ready in time."
    exit 1
  fi
  sleep 2
done

mc mb -p local/forge-assets || true
mc mb -p local/forge-uploads || true
mc mb -p local/forge-runtime || true

mc anonymous set download local/forge-assets || true
mc anonymous set download local/forge-runtime || true
mc anonymous set none local/forge-uploads || true

mc admin config set local api \
  cors_allow_origin="http://localhost:5173,http://localhost:3000,http://localhost:3100,http://localhost:8080" \
  || true

cat > /tmp/ilm.json <<'JSON'
{
  "Rules": [
    {
      "ID": "expire-pending-uploads",
      "Status": "Enabled",
      "Filter": { "Prefix": "pending/" },
      "Expiration": { "Days": 1 }
    }
  ]
}
JSON
mc ilm import local/forge-uploads < /tmp/ilm.json || true

echo "MinIO initialized."
