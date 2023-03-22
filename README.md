# qgis-server-helm
This repo contains a helm chart to deploy QGIS Server with reloading data directory from S3 to openshift.

## Why
QGIS Server by nature is a monolithic project that is built to run on VM or a physical machine.
Because we want it to run on k8s, we added a sidecar that enables QGIS Server to be deployed to k8s without a persistent volume.

## How does it work
When a new QGIS Server pod is starting, an init-container that runs the image will download the QGIS projects (*.qgs) from S3 for the first time, so QGIS Server has data.
After the init container has finished its job, the QGIS Server image will start and a sidecar that will check periodically for changes in S3. If changes are detected it will download the new/updated projects into QGIS Server data directory.

## Installation
```
helm install qgis-server helm
```