import { Android, Job, Workflow, sanitizeJob } from '@expo/eas-build-job';
import { AndroidGenericBuildProfile, AndroidManagedBuildProfile } from '@expo/eas-json';
import path from 'path';

import { AndroidCredentials } from '../../credentials/android/AndroidCredentialsProvider';
import { readSecretEnvsAsync } from '../../credentials/credentialsJson/read';
import { gitRootDirectoryAsync } from '../../utils/git';
import { BuildContext } from '../context';
import { Platform } from '../types';

interface JobData {
  archiveUrl: string;
  credentials?: AndroidCredentials;
}

export async function prepareJobAsync(
  ctx: BuildContext<Platform.Android>,
  jobData: JobData
): Promise<Job> {
  if (ctx.buildProfile.workflow === Workflow.Generic) {
    const partialJob = await prepareGenericJobAsync(ctx, jobData, ctx.buildProfile);
    return sanitizeJob(partialJob);
  } else if (ctx.buildProfile.workflow === Workflow.Managed) {
    const partialJob = await prepareManagedJobAsync(ctx, jobData, ctx.buildProfile);
    return sanitizeJob(partialJob);
  } else {
    throw new Error("Unknown workflow. Shouldn't happen");
  }
}

interface CommonJobProperties {
  platform: Platform.Android;
  projectUrl: string;
  secrets: {
    buildCredentials?: {
      keystore: Android.Keystore;
    };
    secretEnvs?: Record<string, string>;
  };
}

async function prepareJobCommonAsync(
  ctx: BuildContext<Platform.Android>,
  jobData: JobData
): Promise<Partial<CommonJobProperties>> {
  const secretEnvs = await readSecretEnvsAsync(ctx.commandCtx.projectDir);
  const credentials = jobData.credentials;
  const buildCredentials = credentials
    ? {
        buildCredentials: {
          keystore: {
            dataBase64: credentials.keystore.keystore,
            keystorePassword: credentials.keystore.keystorePassword,
            keyAlias: credentials.keystore.keyAlias,
            keyPassword: credentials.keystore.keyPassword,
          },
        },
      }
    : {};

  return {
    platform: Platform.Android,
    projectUrl: jobData.archiveUrl,
    secrets: {
      ...(secretEnvs ? { secretEnvs } : {}),
      ...buildCredentials,
    },
  };
}

async function prepareGenericJobAsync(
  ctx: BuildContext<Platform.Android>,
  jobData: JobData,
  buildProfile: AndroidGenericBuildProfile
): Promise<Partial<Android.GenericJob>> {
  const projectRootDirectory = path.relative(await gitRootDirectoryAsync(), process.cwd()) || '.';
  return {
    ...(await prepareJobCommonAsync(ctx, jobData)),
    type: Workflow.Generic,
    gradleCommand: buildProfile.gradleCommand,
    artifactPath: buildProfile.artifactPath,
    projectRootDirectory,
  };
}

async function prepareManagedJobAsync(
  ctx: BuildContext<Platform.Android>,
  jobData: JobData,
  buildProfile: AndroidManagedBuildProfile
): Promise<Partial<Android.ManagedJob>> {
  const projectRootDirectory = path.relative(await gitRootDirectoryAsync(), process.cwd()) || '.';
  return {
    ...(await prepareJobCommonAsync(ctx, jobData)),
    type: Workflow.Managed,
    projectRootDirectory,
  };
}
