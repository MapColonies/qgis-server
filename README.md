# qgis-server Openshift Compatible Image

Configuring `openquake/qgis-server` image which exposes a QGIS Server on Ubuntu.
  
## Why?

QGIS Server is an open source web mapping software that allows you to publish QGIS projects as OGC-compliant map services (Open Geospatial Consortium standards).  
It supports open standards such as OGC WMS, WMTS, WFS, WCS and CSW.  
QGIS Server allows you to customize your map services to suit your specific needs. You can choose which layers to include, set layer styles and labels, and control how the map is displayed.
QGIS Server by nature is a monolithic project that is built to run on VM or a physical machine.
Because we want it to run on k8s, we added a sidecar that enables QGIS Server to be deployed to k8s without a persistent volume.
  
## How does it work?
When a new QGIS Server pod is starting, an init-container that runs the image will download the QGIS projects (*.qgs) from S3 for the first time, so QGIS Server has data.
After the init container has finished its job, the QGIS Server image will start and a sidecar that will check periodically for changes in S3. If changes are detected it will download the new/updated projects into QGIS Server data directory.
  
## Run

```sh
docker image build -t qgis-server:v1.0.0 .
```

```sh
docker container run --rm --name qgis-server \
      --network host \
      -e QGIS_SERVER_LOG_FILE=/var/tmp/qgisserver.log \
      -e QGIS_SERVER_LOG_LEVEL=0 \
      -e AWS_ACCESS_KEY_ID=avi \
      -e AWS_SECRET_ACCESS_KEY=aviPassword \
      -e AWS_ENDPOINT_URL=http://localhost:9000 \
      -e AWS_BUCKET_NAME=dem \
      -e RAW_DATA_PROXY_URL=https://proxy-route \
      -v /docker/qgis/data:/io/data \
      -v /docker/qgis/fonts:/usr/share/fonts \
      -v /docker/qgis/plugins:/io/plugins \
      qgis-server:v1.0.0 -d
```
  
The following variables can be customized during container deployment:

- `QGIS_SERVER_LOG_FILE`: default is `/var/tmp/qgisserver.log`
- `QGIS_SERVER_LOG_LEVEL`: default is `0`
- `RAW_DATA_PROXY_URL`: default is http://proxy-service
  
## Installation

```sh
helm install qgis-server helm
```
