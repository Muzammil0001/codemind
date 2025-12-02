
import { PackageManagerConfig } from '../types/stackTypes';

export const PACKAGE_MANAGERS: Record<string, PackageManagerConfig> = {
  npm: {
    lockFiles: ['package-lock.json'],
    commands: { install: 'npm install', run: 'npm run' }
  },
  yarn: {
    lockFiles: ['yarn.lock'],
    commands: { install: 'yarn install', run: 'yarn' }
  },
  pnpm: {
    lockFiles: ['pnpm-lock.yaml'],
    commands: { install: 'pnpm install', run: 'pnpm' }
  },
  bun: {
    lockFiles: ['bun.lockb'],
    commands: { install: 'bun install', run: 'bun run' }
  },
  pip: {
    lockFiles: ['requirements.txt', 'Pipfile.lock'],
    commands: { install: 'pip install', run: 'python' }
  },
  composer: {
    lockFiles: ['composer.lock'],
    commands: { install: 'composer install', run: 'php' }
  },
  maven: {
    lockFiles: ['pom.xml'],
    commands: { install: 'mvn install', run: 'mvn' }
  }
};









