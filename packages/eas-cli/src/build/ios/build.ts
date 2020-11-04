import { EasConfig, Workflow } from '@eas/config';
import { IOSConfig } from '@expo/config';
import chalk from 'chalk';
import sortBy from 'lodash/sortBy';

import log from '../../log';
import { promptAsync } from '../../prompts';
import { startBuildForPlatformAsync } from '../build';
import { BuildContext, CommandContext, createBuildContext } from '../context';
import { Platform } from '../types';
import { syncProjectConfigurationAsync } from './configure';
import { ensureIosCredentialsAsync } from './credentials';
import { prepareJobAsync } from './prepareJob';

export async function startIosBuildAsync(
  commandCtx: CommandContext,
  easConfig: EasConfig,
  projectId: string
): Promise<string> {
  const buildCtx = createBuildContext<Platform.iOS>({
    commandCtx,
    platform: Platform.iOS,
    easConfig,
    projectId,
  });

  let iosNativeProjectScheme: string | undefined;
  if (buildCtx.buildProfile.workflow === Workflow.Generic) {
    iosNativeProjectScheme = buildCtx.buildProfile.scheme ?? (await resolveSchemeAsync(buildCtx));
  }
  if (buildCtx.buildProfile.workflow === Workflow.Generic) {
    await syncProjectConfigurationAsync(commandCtx.projectDir, commandCtx.exp);
  }
  return await startBuildForPlatformAsync({
    ctx: buildCtx,
    projectConfiguration: {
      iosNativeProjectScheme,
    },
    ensureCredentialsAsync: ensureIosCredentialsAsync,
    ensureProjectConfiguredAsync: async () => {},
    prepareJobAsync,
  });
}

async function resolveSchemeAsync(ctx: BuildContext<Platform.iOS>): Promise<string> {
  const schemes = IOSConfig.Scheme.getSchemesFromXcodeproj(ctx.commandCtx.projectDir);
  if (schemes.length === 1) {
    return schemes[0];
  }

  const sortedSchemes = sortBy(schemes);
  log.newLine();
  log(
    `We've found multiple schemes in your Xcode project: ${chalk.bold(sortedSchemes.join(', '))}`
  );
  log(
    `You can specify the scheme you want to build at ${chalk.bold(
      'builds.ios.PROFILE_NAME.scheme'
    )} in eas.json.`
  );
  if (ctx.commandCtx.nonInteractive) {
    const withoutTvOS = sortedSchemes.filter(i => !i.includes('tvOS'));
    const scheme = withoutTvOS.length > 0 ? withoutTvOS[0] : sortedSchemes[0];
    log(`You've run Expo CLI in non-interactive mode, choosing the ${chalk.bold(scheme)} scheme.`);
    log.newLine();
    return scheme;
  } else {
    const { selectedScheme } = await promptAsync({
      type: 'select',
      name: 'selectedScheme',
      message: 'Which scheme would you like to build now?',
      choices: sortedSchemes.map(scheme => ({ title: scheme, value: scheme })),
    });
    log.newLine();
    return selectedScheme as string;
  }
}