#!/usr/bin/env zx

import jsLogger from '@map-colonies/js-logger';
import crypto from 'crypto';

const DATA_DIR = '/io/data';
const CURRENT_STATE_FILE = path.join(DATA_DIR, 'state.json');

const pollingInterval = +(process.env.POLLING_INTERVAL ?? 1000); // in milliseconds
// const waitOnStartup = (process.env.INITIAL_DELAY_SECONDS ?? 0) * 1000;
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

const generateChecksum = (str, algorithm, encoding) => {
  return crypto
    .createHash(algorithm || 'md5')
    .update(str, 'utf8')
    .digest(encoding || 'hex');
};

const getRemoteState = async () => {
  const args = [
    `list-objects`,
    `--endpoint-url`,
    `${process.env.AWS_ENDPOINT_URL}`,
    `--bucket`,
    `${process.env.AWS_BUCKET_NAME}`,
    `--query`,
    `Contents[?contains(@.Key, \`qgs\`) == \`true\`].{key: Key, size: Size, lastModified: LastModified}`
  ];
  return $`aws s3api ${args}`;
}

const syncProject = async (projectPath) => {
  const projectDir = path.join(projectPath, '..');
  const args = [
    `cp`,
    `--endpoint-url`,
    process.env.AWS_ENDPOINT_URL,
    `s3://${process.env.AWS_BUCKET_NAME}/${projectDir}`,
    `${DATA_DIR}/${projectDir}`,
    `--recursive`
  ]
  return $`aws s3 ${args}`;
}

const syncDataDir = async () => {

  try {
    logger.debug({ msg: 'Getting state from storage', bucket: process.env.AWS_BUCKET_NAME });
    const remoteState = (await getRemoteState()).stdout.trim();
    logger.debug({ remoteState });
    const parsedRemoteState = parse(remoteState);
    logger.debug({ parsedRemoteState });

    let currentState = '{}';
    if (fs.existsSync(CURRENT_STATE_FILE)) {
      currentState = (await $`cat ${CURRENT_STATE_FILE}`).stdout.trim();
      logger.debug({ currentState });
    }
    const parsedCurrentState = JSON.parse(currentState);
    logger.debug({ parsedCurrentState });

    if (generateChecksum(JSON.stringify(parsedRemoteState)) === generateChecksum(JSON.stringify(parsedCurrentState))) {
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
      await Promise.all(toDelete.map(projectToDelete => $`rm -rf ${path.join(DATA_DIR, projectToDelete, '../../')}`));
      toDelete.forEach(projectToDelete => logger.info({ msg: 'Deleted', project: projectToDelete }));
    }

    if (toSync.length) {
      await Promise.all(toSync.map(projectToSync => {
        return Promise.all([
          new Promise(async (resolve) => {
            const output = (await syncProject(projectToSync)).stdout.trim();
            if (output.includes('download:')) {
              await $`sed -i 's,{RAW_DATA_PROXY_URL},${process.env.RAW_DATA_PROXY_URL},g' ${DATA_DIR}/${projectToSync}`;
              logger.info({ msg: 'Synced', project: projectToSync });
              resolve(true);
            }
          })
        ]);
      }));
    }
    
    await fs.writeFile(CURRENT_STATE_FILE, JSON.stringify(parsedRemoteState, null, 2), { flag: 'w+' });
    logger.info({ msg: 'State was updated' });
    logger.debug({ newState: JSON.stringify(parsedRemoteState) });
  } catch (error) {
    logger.error({ msg: 'Failed', error });
  }

};

// await $`mkdir -p ${DATA_DIR}`; // Important: root directory '/io' has to be exist before execution of this script!!!
// const user = await $`whoami`;
// await $`chown ${user} ${DATA_DIR}`;
// await $`touch ${CURRENT_STATE_FILE}`;
// await sleep(waitOnStartup); // wait for QGIS Server to be ready
while (true) {
  await syncDataDir();
  logger.debug({ msg: 'Sleeping for polling interval', interval: pollingInterval });
  await sleep(pollingInterval);
}
