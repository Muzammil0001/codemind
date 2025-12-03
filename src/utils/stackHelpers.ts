import { StackType, StackDefinition, FrameworkDefinition, PackageManager } from '../types/stackTypes';
import { STACKS, FRAMEWORKS } from '../constants/stacks';
import { PACKAGE_MANAGERS } from '../constants/packageManagers';

export class StackUtils {

  static getStack(type: StackType): StackDefinition {
    return STACKS[type];
  }

  
  static getAllStackTypes(): StackType[] {
    return Object.keys(STACKS) as StackType[];
  }

  static getFramework(name: string): FrameworkDefinition | undefined {
    return FRAMEWORKS[name];
  }

  static detectPackageManager(lockFiles: string[]): PackageManager | undefined {
    for (const [manager, config] of Object.entries(PACKAGE_MANAGERS)) {
      if (config.lockFiles.some(lockFile => lockFiles.includes(lockFile))) {
        return manager as PackageManager;
      }
    }
    return undefined;
  }

  static stackSupports(stack: StackType, feature: 'frontend' | 'backend' | 'fullstack'): boolean {
    const frontendStacks: StackType[] = ['next', 'react', 'vue', 'nuxt', 'angular', 'svelte'];
    const backendStacks: StackType[] = ['express', 'nestjs', 'django', 'flask', 'fastapi', 'spring', 'laravel'];
    const fullstackStacks: StackType[] = ['next', 'nuxt'];

    switch (feature) {
      case 'frontend':
        return frontendStacks.includes(stack);
      case 'backend':
        return backendStacks.includes(stack);
      case 'fullstack':
        return fullstackStacks.includes(stack);
      default:
        return false;
    }
  }

  static getRecommendedExtensions(stack: StackType): string[] {
    const extensions: Record<StackType, string[]> = {
      node: ['.js', '.ts', '.mjs', '.cjs'],
      python: ['.py'],
      java: ['.java'],
      maven: ['.java'],
      php: ['.php'],
      laravel: ['.php'],
      go: ['.go'],
      rust: ['.rs'],
      next: ['.tsx', '.ts', '.jsx', '.js'],
      react: ['.tsx', '.ts', '.jsx', '.js'],
      vue: ['.vue', '.ts', '.js'],
      nuxt: ['.vue', '.ts', '.js'],
      angular: ['.ts', '.js'],
      svelte: ['.svelte', '.ts', '.js'],
      django: ['.py'],
      flask: ['.py'],
      fastapi: ['.py'],
      spring: ['.java'],
      nestjs: ['.ts', '.js'],
      prisma: ['.prisma'],
      typeorm: ['.ts', '.js'],
      express: ['.ts', '.js'],
      unknown: ['.txt']
    };

    return extensions[stack] || ['.txt'];
  }

  static getCommonPatterns(stack: StackType): Record<string, string[]> {
    const stackDef = STACKS[stack];
    return stackDef?.conventions?.patterns || {};
  }

  static matchesPattern(stack: StackType, filePath: string, patternType: string): boolean {
    const patterns = this.getCommonPatterns(stack)[patternType];
    if (!patterns) return false;

    const relativePath = filePath.toLowerCase();
    return patterns.some(pattern =>
      relativePath.includes(pattern.toLowerCase())
    );
  }

  static suggestLocation(stack: StackType, fileType: 'component' | 'api' | 'model' | 'config' | 'util' | 'test'): string[] {
    const patterns = this.getCommonPatterns(stack);

    switch (fileType) {
      case 'component':
        return patterns.components || ['src/components'];
      case 'api':
        return patterns.api || ['src/routes', 'src/controllers'];
      case 'model':
        return patterns.models || ['src/models', 'src/entities'];
      case 'config':
        return patterns.config || ['src/config', 'config'];
      case 'util':
        return patterns.utils || ['src/utils', 'src/lib'];
      case 'test':
        return patterns.tests || ['tests', '__tests__'];
      default:
        return ['src'];
    }
  }

  static getNamingConvention(stack: StackType): {
    fileName: 'camelCase' | 'PascalCase' | 'snake_case' | 'kebab-case';
    className: 'PascalCase' | 'camelCase';
    functionName: 'camelCase' | 'snake_case';
  } {
    const conventions: Partial<Record<StackType, any>> = {
      python: {
        fileName: 'snake_case',
        className: 'PascalCase',
        functionName: 'snake_case'
      },
      java: {
        fileName: 'PascalCase',
        className: 'PascalCase',
        functionName: 'camelCase'
      },
      maven: {
        fileName: 'PascalCase',
        className: 'PascalCase',
        functionName: 'camelCase'
      },
      go: {
        fileName: 'snake_case',
        className: 'PascalCase',
        functionName: 'camelCase'
      },
      rust: {
        fileName: 'snake_case',
        className: 'PascalCase',
        functionName: 'snake_case'
      },
      php: {
        fileName: 'snake_case',
        className: 'PascalCase',
        functionName: 'camelCase'
      },
      laravel: {
        fileName: 'snake_case',
        className: 'PascalCase',
        functionName: 'camelCase'
      }
    };

    return conventions[stack] || {
      fileName: 'camelCase',
      className: 'PascalCase',
      functionName: 'camelCase'
    };
  }

  static validateFilePath(stack: StackType, filePath: string): {
    valid: boolean;
    suggestions?: string[];
  } {
    const stackDef = STACKS[stack];
    if (!stackDef) {
      return { valid: false, suggestions: ['Unknown stack'] };
    }

    const ext = filePath.substring(filePath.lastIndexOf('.'));
    const recommendedExts = this.getRecommendedExtensions(stack);

    if (!recommendedExts.includes(ext)) {
      return {
        valid: false,
        suggestions: [`Consider using: ${recommendedExts.join(', ')}`]
      };
    }

    return { valid: true };
  }
}
