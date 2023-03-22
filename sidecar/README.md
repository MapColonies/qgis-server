# sidecar

This is a sidecar container to reload QGIS Server data from S3.

## Run
```
docker image build -t sidecar:v1.0.0 .
```
```
docker container run --rm --name sidecar \
      --network host \
      -e POLLING_INTERVAL=120000 \
      -e INITIAL_DELAY_SECONDS=60 \
      -e LOG_LEVEL=info \
      -e AWS_ACCESS_KEY_ID=raster \
      -e AWS_SECRET_ACCESS_KEY=rasterPassword \
      -e AWS_ENDPOINT_URL=http://10.8.0.9:9000 \
      -e AWS_BUCKET_NAME=dem-int \
      -e RAW_DATA_PROXY_URL=https://client-int-qgis-integration-nginx-s3-gateway-route-integration.apps.j1lk3njp.eastus.aroapp.io \
      -v /docker/qgis/data:/io/data \
      sidecar:v1.0.0 -d
```
```
AWS_ENDPOINT_URL=http://10.8.0.9:9000 AWS_BUCKET_NAME=dem-int RAW_DATA_PROXY_URL=https://client-int-qgis-integration-nginx-s3-gateway-route-integration.apps.j1lk3njp.eastus.aroapp.io npx zx script.mjs
```