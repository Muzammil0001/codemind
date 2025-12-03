export type StackType =
  | 'node' | 'python' | 'java' | 'maven' | 'php' | 'laravel' | 'go' | 'rust'
  | 'next' | 'react' | 'vue' | 'nuxt' | 'angular' | 'svelte'
  | 'django' | 'flask' | 'fastapi' | 'spring' | 'nestjs'
  | 'prisma' | 'typeorm' | 'express' | 'unknown';

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun' | 'pip' | 'composer' | 'maven';

export interface StackDefinition {
  name: string;
  type: StackType;
  description: string;
  configFiles: string[];
  packageManager?: PackageManager;
  entryPoints: string[];
  conventions?: {
    description: string;
    patterns: Record<string, string[]>;
    specialRules?: string[];
  };
}

export interface FrameworkDefinition {
  name: string;
  description: string;
  configFiles: string[];
  dependencies: string[];
  entryPoints: string[];
  conventions?: {
    description: string;
    patterns: Record<string, string[]>;
    specialRules?: string[];
  };
}

export interface PackageManagerConfig {
  lockFiles: string[];
  commands: {
    install: string;
    run: string;
  };
}
