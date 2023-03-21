#!/usr/bin/env zx

import { join } from 'path';
import jsLogger from '@map-colonies/js-logger';

const DATA_DIR = '/io/data';
const CURRENT_STATE_FILE = join(DATA_DIR, 'state.json');

const isInitMode = /^true$/i.test(process.env.IS_INIT_MODE);
const pollingInterval = +(process.env.POLLING_INTERVAL ?? 1000); // in milliseconds
const waitOnStartup = (process.env.INITIAL_DELAY_SECONDS ?? 0) * 1000;
const logger = jsLogger.default({ level: process.env.LOG_LEVEL ?? 'info' }); // ['debug', 'info', 'warn', 'error', 'fatal']

$.shell = '/bin/bash';
$.verbose = false;

const syncDataDir = async () => {
  try {
    logger.debug({ msg: 'Getting state from storage', bucket: process.env.AWS_BUCKET_NAME });
    const remoteState = (await $`aws s3api list-objects --endpoint-url ${process.env.AWS_ENDPOINT_URL} --bucket ${process.env.AWS_BUCKET_NAME} --query 'Contents[?contains(@.Key, \`qgs\`) == \`true\`].{Key: Key, Size: Size, LastModified: LastModified}'`).stdout.trim();
    logger.debug({ remoteState });

    const currentState = (await $`cat ${CURRENT_STATE_FILE}`).stdout.trim();
    logger.debug({ currentState });

    if (remoteState == currentState) {
      logger.info({ msg: 'Data unchanged' });
      return;
    }
    
    // dirList.forEach(async (dir) => {
    //   ($`aws s3 ls --endpoint-url ${process.env.AWS_ENDPOINT_URL} s3://${process.env.AWS_BUCKET_NAME}/${dir}/ --human-readable --summarize`)
    //   .then(async (data) => {
    //     const projectList = data.stdout.trim();
    //     logger.debug({ msg: 'Getting data from storage', bucket: process.env.AWS_BUCKET_NAME, directory: dir, projectList: projectList });
    
    //     const regexp = /\w*\//g;
    //     let project;
    //     while (project = regexp.exec(projectList)) {
    //       const projectName = project[0].replace('/','');
    //       logger.debug({ msg: 'Copying project', bucket: process.env.AWS_BUCKET_NAME, directory: dir, project: projectName });
    //       try {
    //         const output = (await $`aws s3 cp --endpoint-url ${process.env.AWS_ENDPOINT_URL} s3://${process.env.AWS_BUCKET_NAME}/${dir}/${projectName}/project ${DATA_DIR}/${projectName} --recursive`).stdout.trim();
    //       } catch (err) {
    //         logger.error({ msg: 'Failed during aws s3 cp', directory: dir, error: err.msg });
    //       }
    //       await $`sed -i 's,{RAW_DATA_PROXY_URL},${process.env.RAW_DATA_PROXY_URL},g' ${DATA_DIR}/${projectName}/${projectName}.qgs`;
    //       logger.info({ msg: 'Updated', project: projectName });
    //     }
    //   })
    //   .catch((error) => {
    //     if (error._stderr) {
    //       logger.error({ msg: 'Failed during sync', directory: dir, error: error._stderr });
    //     }
    //     return;
    //   });
    // });
    await fs.writeFile(CURRENT_STATE_FILE, remoteState);
    logger.info({ msg: 'State was updated', newState: remoteState });
  } catch (error) {
    logger.error({ msg: 'Failed', error });
  }
};

if (isInitMode) {
  process.exit(0);
} else {
  await sleep(waitOnStartup); // wait for QGIS Server to be ready
  while (true) {
    await syncDataDir();
    logger.debug({ msg: 'Sleeping for polling interval', interval: pollingInterval });
    await sleep(pollingInterval);
  }
}
