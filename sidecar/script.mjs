#!/usr/bin/env zx

import jsLogger from '@map-colonies/js-logger';

const isInitMode = true;
const dirList = [ 'dtm', 'dsm' ];
const updateInterval = 120000;
const waitOnStartup = 30000;
const logger = jsLogger.default({ level: 'info' }); // ['debug', 'info', 'warn', 'error', 'fatal']

$.shell = '/bin/bash';
$.verbose = false;

const isDataChanged = async (dir) => {
  logger.debug({ msg: 'Getting state from storage', bucket: process.env.AWS_BUCKET_NAME, key: dir });
  const metadata = (await $`aws s3api list-objects --endpoint-url ${process.env.AWS_ENDPOINT_URL} --bucket ${process.env.AWS_BUCKET_NAME} --prefix ${dir} --query 'Contents[?contains(@.Key, "qgs") == "true"].{Key: Key, Size: Size, LastModified: LastModified}'`).stdout.trim();
  logger.info({ msg: 'Metadata', metadata });
  return false;
};

const syncDataDir = async () => {
  dirList.forEach(async (dir) => {
    if (!isInitMode && !isDataChanged(dir)) {
      logger.info({ msg: 'Data unchanged' });
      return;
    }

    ($`aws s3 ls --endpoint-url ${process.env.AWS_ENDPOINT_URL} s3://${process.env.AWS_BUCKET_NAME}/${dir}/ --human-readable --summarize`)
    .then(async (data) => {
      const projectList = data.stdout.trim();
      logger.debug({ msg: 'Getting data from storage', bucket: process.env.AWS_BUCKET_NAME, directory: dir, projectList: projectList });
  
      const regexp = /\w*\//g;
      let project;
      while (project = regexp.exec(projectList)) {
        const projectName = project[0].replace('/','');
        logger.debug({ msg: 'Copying project', bucket: process.env.AWS_BUCKET_NAME, directory: dir, project: projectName });
        try {
          const output = (await $`aws s3 cp --endpoint-url ${process.env.AWS_ENDPOINT_URL} s3://${process.env.AWS_BUCKET_NAME}/${dir}/${projectName}/project /io/data/${projectName} --recursive`).stdout.trim();
        } catch (err) {
          logger.error({ msg: 'Failed during aws s3 cp', directory: dir, error: err.msg });
        }
        await $`sed -i 's,{RAW_DATA_PROXY_URL},${process.env.RAW_DATA_PROXY_URL},g' /io/data/${projectName}/${projectName}.qgs`;
        logger.info({ msg: 'Project updated', updatedProject: projectName });
      }
    })
    .catch((error) => {
      if (error._stderr) {
        logger.error({ msg: 'Failed during aws s3 ls', directory: dir, error: error._stderr });
      }
      return;
    });
  });
};

if (isInitMode) {

  await syncDataDir();
  logger.info({ msg: 'Finished updating, exiting gracefully' });

} else {
  // wait for QGIS Server to be ready
  await sleep(waitOnStartup);

  while (true) {

    await syncDataDir();

    logger.debug({ msg: 'sleeping for update interval', interval: updateInterval });

    await sleep(updateInterval);

  }
}
