#!/usr/bin/env zx

import jsLogger from '@map-colonies/js-logger';

const DATA_DIR = '/io/data';
const CURRENT_STATE_FILE = path.join(DATA_DIR, 'state.json');

const isInitMode = /^true$/i.test(process.env.IS_INIT_MODE);
const pollingInterval = +(process.env.POLLING_INTERVAL ?? 1000); // in milliseconds
const waitOnStartup = (process.env.INITIAL_DELAY_SECONDS ?? 0) * 1000;
const logger = jsLogger.default({ level: process.env.LOG_LEVEL ?? 'info' }); // ['debug', 'info', 'warn', 'error', 'fatal']

$.shell = '/bin/bash';
$.verbose = false;

const parse = (state) => JSON.parse(state).reduce((parsedState, project) => {
  const { key, size, lastModified } = project;
  return ({
    ...parsedState,
    [key]: {
      size,
      lastModified
    }
  })
}, {});

const syncDataDir = async () => {

  try {
    logger.debug({ msg: 'Getting state from storage', bucket: process.env.AWS_BUCKET_NAME });
    const remoteState = (await $`aws s3api list-objects --endpoint-url ${process.env.AWS_ENDPOINT_URL} --bucket ${process.env.AWS_BUCKET_NAME} --query 'Contents[?contains(@.Key, \`qgs\`) == \`true\`].{key: Key, size: Size, lastModified: LastModified}'`).stdout.trim();
    logger.debug({ remoteState });
    const parsedRemoteState = parse(remoteState);
    logger.debug({ parsedRemoteState });

    const currentState = (await $`cat ${CURRENT_STATE_FILE}`).stdout.trim();
    logger.debug({ currentState });
    const parsedCurrentState = JSON.parse(currentState.length ? currentState : '{}');
    logger.debug({ parsedCurrentState });

    if (JSON.stringify(parsedRemoteState) === JSON.stringify(parsedCurrentState)) {
      logger.info({ msg: 'Data unchanged' });
      return;
    }

    const remoteStateKeys = Object.keys(parsedRemoteState);
    const currentStateKeys = Object.keys(parsedCurrentState);

    const toDelete = currentStateKeys.filter(proj => !remoteStateKeys.includes(proj));
    logger.debug({ toDelete });
    const toUpdate = remoteStateKeys.filter(proj => currentStateKeys.includes(proj) && parsedCurrentState[proj].lastModified !== parsedRemoteState[proj].lastModified);
    logger.debug({ toUpdate });
    const toAdd = remoteStateKeys.filter(proj => !currentStateKeys.includes(proj));
    logger.debug({ toAdd });
    const toSync = [ ...toUpdate, ...toAdd ];
    logger.debug({ toSync });

    if (toDelete.length) {
      await Promise.all(toDelete.map(projectToDelete => $`rm -rf ${DATA_DIR}/${projectToDelete}`));
      toDelete.forEach(projectToDelete => logger.info({ msg: 'Deleted', project: projectToDelete }));
    }

    if (toSync.length) {
      await Promise.all(toSync.map(projectToSync => {
        return Promise.all([
          new Promise(async (resolve) => {
            const output = (await $`aws s3 cp --endpoint-url ${process.env.AWS_ENDPOINT_URL} s3://${process.env.AWS_BUCKET_NAME}/${projectToSync.substring(0, projectToSync.lastIndexOf('/'))} ${DATA_DIR}/${projectToSync.substring(0, projectToSync.lastIndexOf('/'))} --recursive`).stdout.trim();
            if (output.includes('download:')){
              await $`sed -i 's,{RAW_DATA_PROXY_URL},${process.env.RAW_DATA_PROXY_URL},g' ${DATA_DIR}/${projectToSync}`;
              logger.info({ msg: 'Synced', project: projectToSync });
              resolve(true);
            }
          })
        ]);
      }));
    }
    
    await fs.writeFile(CURRENT_STATE_FILE, JSON.stringify(parsedRemoteState, null, 2));
    logger.info({ msg: 'State was updated' });
    logger.debug({ newState: JSON.stringify(parsedRemoteState) });
  } catch (error) {
    logger.error({ msg: 'Failed', error });
  }

};

if (isInitMode) {
  await $`mkdir -p ${DATA_DIR}`; // Important: root directory '/io' has to be exist before execution of this script!!!
  const user = await $`whoami`;
  await $`chown ${user} ${DATA_DIR}`;
  await $`touch ${CURRENT_STATE_FILE}`;
  process.exit(0);
} else {
  await sleep(waitOnStartup); // wait for QGIS Server to be ready
  while (true) {
    await syncDataDir();
    logger.debug({ msg: 'Sleeping for polling interval', interval: pollingInterval });
    await sleep(pollingInterval);
  }
}
