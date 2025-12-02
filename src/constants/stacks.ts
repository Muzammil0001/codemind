

import { StackType, StackDefinition, FrameworkDefinition } from '../types/stackTypes';

export const STACKS: Record<StackType, StackDefinition> = {
  node: {
    name: 'Node.js',
    type: 'node',
    description: 'JavaScript runtime built on Chrome\'s V8 JavaScript engine',
    configFiles: ['package.json'],
    packageManager: 'npm',
    entryPoints: ['src', 'lib', 'index.js', 'main.js']
  },
  python: {
    name: 'Python',
    type: 'python',
    description: 'High-level programming language',
    configFiles: ['requirements.txt', 'pyproject.toml', 'setup.py'],
    packageManager: 'pip',
    entryPoints: ['main.py', 'app.py', '__main__.py']
  },
  java: {
    name: 'Java',
    type: 'java',
    description: 'Object-oriented programming language',
    configFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    packageManager: 'maven',
    entryPoints: ['src/main/java']
  },
  maven: {
    name: 'Maven',
    type: 'maven',
    description: 'Build automation tool for Java',
    configFiles: ['pom.xml'],
    packageManager: 'maven',
    entryPoints: ['src/main/java']
  },
  php: {
    name: 'PHP',
    type: 'php',
    description: 'Server-side scripting language',
    configFiles: ['composer.json', 'artisan'],
    packageManager: 'composer',
    entryPoints: ['src', 'app']
  },
  laravel: {
    name: 'Laravel',
    type: 'laravel',
    description: 'PHP web framework',
    configFiles: ['composer.json', 'artisan'],
    packageManager: 'composer',
    entryPoints: ['app', 'routes']
  },
  go: {
    name: 'Go',
    type: 'go',
    description: 'Compiled programming language',
    configFiles: ['go.mod', 'go.sum'],
    entryPoints: ['main.go', 'cmd']
  },
  rust: {
    name: 'Rust',
    type: 'rust',
    description: 'Systems programming language',
    configFiles: ['Cargo.toml', 'Cargo.lock'],
    entryPoints: ['src/main.rs', 'src/lib.rs']
  },
  next: {
    name: 'Next.js',
    type: 'next',
    description: 'Full-stack React framework with App Router or Pages Router',
    configFiles: ['package.json', 'next.config.js', 'next.config.ts'],
    packageManager: 'npm',
    entryPoints: ['pages', 'app', 'src'],
    conventions: {
      description: 'Next.js full-stack React framework',
      patterns: {
        pages: ['pages', 'app'],
        components: ['components', 'ui', 'src/components'],
        api: ['pages/api', 'app/api'],
        config: ['next.config.js', 'next.config.ts'],
        styles: ['styles', 'src/styles'],
        utils: ['lib', 'utils', 'src/lib'],
        tests: ['__tests__', 'src/__tests__']
      },
      specialRules: [
        'App Router uses /app directory, Pages Router uses /pages',
        'API routes in /pages/api (Pages) or /app/api (App Router)',
        'Components in /components or /src/components',
        'Server components in /app, client components with "use client"'
      ]
    }
  },
  react: {
    name: 'React',
    type: 'react',
    description: 'Component-based UI library',
    configFiles: ['package.json'],
    packageManager: 'npm',
    entryPoints: ['src', 'public'],
    conventions: {
      description: 'React component-based UI library',
      patterns: {
        components: ['components', 'src/components', 'ui'],
        pages: ['pages', 'src/pages', 'views'],
        config: ['vite.config.js', 'webpack.config.js'],
        styles: ['styles', 'src/styles', 'assets'],
        utils: ['utils', 'src/utils', 'lib', 'src/lib'],
        tests: ['__tests__', 'src/__tests__', 'tests']
      },
      specialRules: [
        'Components in /components or /src/components',
        'Use .tsx for TypeScript, .jsx for JavaScript',
        'Styles in /styles or collocated with components'
      ]
    }
  },
  vue: {
    name: 'Vue.js',
    type: 'vue',
    description: 'Progressive JavaScript framework',
    configFiles: ['package.json', 'vue.config.js'],
    packageManager: 'npm',
    entryPoints: ['src'],
    conventions: {
      description: 'Vue.js progressive framework',
      patterns: {
        pages: ['pages', 'src/pages', 'views'],
        components: ['components', 'src/components'],
        config: ['vue.config.js', 'vite.config.js'],
        styles: ['styles', 'src/styles', 'assets'],
        utils: ['utils', 'src/utils', 'lib'],
        tests: ['tests', '__tests__']
      },
      specialRules: [
        'Single File Components (.vue) in /components',
        'Pages in /pages (with Nuxt) or /src/pages',
        'Composition API with <script setup> preferred'
      ]
    }
  },
  nuxt: {
    name: 'Nuxt.js',
    type: 'nuxt',
    description: 'Vue.js framework with SSR and SSG',
    configFiles: ['nuxt.config.js', 'nuxt.config.ts'],
    packageManager: 'npm',
    entryPoints: ['pages', 'components'],
    conventions: {
      description: 'Nuxt.js Vue.js framework with SSR',
      patterns: {
        pages: ['pages'],
        components: ['components'],
        api: ['server/api'],
        config: ['nuxt.config.js', 'nuxt.config.ts'],
        styles: ['assets', 'assets/css'],
        utils: ['utils', 'lib'],
        tests: ['test']
      },
      specialRules: [
        'Pages auto-generate routes from /pages directory',
        'Components auto-imported from /components',
        'Server API routes in /server/api',
        'Auto-imports enabled by default'
      ]
    }
  },
  angular: {
    name: 'Angular',
    type: 'angular',
    description: 'Platform for building mobile and desktop web applications',
    configFiles: ['angular.json', 'package.json'],
    packageManager: 'npm',
    entryPoints: ['src'],
    conventions: {
      description: 'Angular platform framework',
      patterns: {
        components: ['src/app'],
        config: ['angular.json'],
        styles: ['src/styles'],
        utils: ['src/app/shared', 'src/app/core'],
        tests: ['src/app/**/*.spec.ts']
      },
      specialRules: [
        'Modules organize related components and services',
        'Components use @Component decorator',
        'Services use @Injectable decorator',
        'Routing configured in app-routing.module.ts'
      ]
    }
  },
  svelte: {
    name: 'Svelte',
    type: 'svelte',
    description: 'Component framework that compiles to vanilla JavaScript',
    configFiles: ['package.json', 'svelte.config.js'],
    packageManager: 'npm',
    entryPoints: ['src'],
    conventions: {
      description: 'Svelte component framework',
      patterns: {
        components: ['src/components', 'src/lib'],
        pages: ['src/routes'],
        config: ['svelte.config.js'],
        styles: ['src/app.css'],
        utils: ['src/lib', 'src/stores'],
        tests: ['tests', '__tests__']
      },
      specialRules: [
        'Components are .svelte files with no virtual DOM',
        'Routes in /src/routes for SvelteKit',
        'Stores for reactive state management',
        'No build step in browser - compiles at build time'
      ]
    }
  },
  django: {
    name: 'Django',
    type: 'django',
    description: 'High-level Python web framework',
    configFiles: ['manage.py', 'requirements.txt'],
    packageManager: 'pip',
    entryPoints: ['manage.py'],
    conventions: {
      description: 'Django Python web framework',
      patterns: {
        api: ['urls.py', 'views.py'],
        models: ['models.py'],
        config: ['settings.py', 'urls.py'],
        utils: ['utils', 'helpers'],
        tests: ['tests', 'test*.py']
      },
      specialRules: [
        'Apps organize related functionality',
        'Models in models.py define database schema',
        'Views in views.py handle HTTP requests',
        'URLs in urls.py map routes to views'
      ]
    }
  },
  flask: {
    name: 'Flask',
    type: 'flask',
    description: 'Lightweight WSGI web application framework',
    configFiles: ['requirements.txt'],
    packageManager: 'pip',
    entryPoints: ['app.py', 'main.py'],
    conventions: {
      description: 'Flask lightweight web framework',
      patterns: {
        api: ['routes', 'views'],
        models: ['models.py'],
        config: ['config.py'],
        utils: ['utils', 'helpers'],
        tests: ['tests', 'test_*.py']
      },
      specialRules: [
        'Routes defined with @app.route decorators',
        'Blueprints for modular applications',
        'Jinja2 templates in /templates',
        'Static files in /static'
      ]
    }
  },
  fastapi: {
    name: 'FastAPI',
    type: 'fastapi',
    description: 'Modern, fast web framework for Python',
    configFiles: ['requirements.txt', 'pyproject.toml'],
    packageManager: 'pip',
    entryPoints: ['main.py', 'app.py'],
    conventions: {
      description: 'FastAPI modern Python web framework',
      patterns: {
        api: ['main.py', 'routes', 'routers'],
        models: ['models.py', 'schemas.py'],
        config: ['config.py', 'settings.py'],
        utils: ['utils', 'helpers'],
        tests: ['test_*.py', 'tests']
      },
      specialRules: [
        'Routes defined with decorators (@app.get, @app.post)',
        'Pydantic models for request/response validation',
        'Dependency injection with Depends()',
        'Async support for high performance'
      ]
    }
  },
  spring: {
    name: 'Spring',
    type: 'spring',
    description: 'Java framework for enterprise applications',
    configFiles: ['pom.xml', 'build.gradle'],
    packageManager: 'maven',
    entryPoints: ['src/main/java'],
    conventions: {
      description: 'Spring enterprise Java framework',
      patterns: {
        api: ['src/main/java/com/example/controller'],
        models: ['src/main/java/com/example/model', 'src/main/java/com/example/entity'],
        config: ['src/main/resources/application.properties'],
        utils: ['src/main/java/com/example/util'],
        tests: ['src/test/java']
      },
      specialRules: [
        'Controllers use @RestController or @Controller',
        'Services use @Service annotation',
        'Repositories use @Repository for data access',
        'Configuration with @Configuration and @Bean'
      ]
    }
  },
  nestjs: {
    name: 'NestJS',
    type: 'nestjs',
    description: 'Node.js framework for scalable server-side applications',
    configFiles: ['package.json', 'nest-cli.json'],
    packageManager: 'npm',
    entryPoints: ['src'],
    conventions: {
      description: 'NestJS Node.js framework',
      patterns: {
        api: ['src/modules', 'src/controllers'],
        models: ['src/entities', 'src/schemas'],
        config: ['src/config'],
        utils: ['src/common', 'src/shared'],
        tests: ['test', 'src/**/*.spec.ts']
      },
      specialRules: [
        'Modules organize related controllers, services, entities',
        'Controllers define API endpoints with decorators',
        'Services contain business logic',
        'Dependency injection with constructor parameters'
      ]
    }
  },
  express: {
    name: 'Express',
    type: 'express',
    description: 'Minimalist web framework for Node.js',
    configFiles: ['package.json'],
    packageManager: 'npm',
    entryPoints: ['src', 'server'],
    conventions: {
      description: 'Express minimalist Node.js framework',
      patterns: {
        api: ['routes', 'src/routes', 'api'],
        models: ['models', 'src/models'],
        config: ['config', 'src/config'],
        utils: ['utils', 'src/utils', 'lib'],
        tests: ['test', '__tests__']
      },
      specialRules: [
        'Routes in /routes or /src/routes',
        'Middleware in separate files or inline',
        'Models/schemas for data validation',
        'Config for environment-specific settings'
      ]
    }
  },
  prisma: {
    name: 'Prisma',
    type: 'prisma',
    description: 'Next-generation ORM for TypeScript & Node.js',
    configFiles: ['prisma/schema.prisma'],
    entryPoints: []
  },
  typeorm: {
    name: 'TypeORM',
    type: 'typeorm',
    description: 'ORM for TypeScript and JavaScript',
    configFiles: ['ormconfig.json', 'ormconfig.js'],
    entryPoints: []
  },
  unknown: {
    name: 'Unknown',
    type: 'unknown',
    description: 'Unrecognized technology stack',
    configFiles: [],
    entryPoints: []
  }
};


export const FRAMEWORKS: Record<string, FrameworkDefinition> = {
  'Next.js': {
    name: 'Next.js',
    description: 'Full-stack React framework with App Router or Pages Router',
    configFiles: ['next.config.js', 'next.config.ts', 'next.config.mjs'],
    dependencies: ['next'],
    entryPoints: ['pages', 'app', 'src'],
    conventions: STACKS.next.conventions
  },
  'React': {
    name: 'React',
    description: 'Component-based UI library',
    configFiles: ['package.json'],
    dependencies: ['react'],
    entryPoints: ['src', 'public'],
    conventions: STACKS.react.conventions
  },
  'Vue.js': {
    name: 'Vue.js',
    description: 'Progressive JavaScript framework',
    configFiles: ['vue.config.js', 'vite.config.ts', 'vite.config.js'],
    dependencies: ['vue'],
    entryPoints: ['src'],
    conventions: STACKS.vue.conventions
  },
  'Nuxt.js': {
    name: 'Nuxt.js',
    description: 'Vue.js framework with SSR and SSG',
    configFiles: ['nuxt.config.js', 'nuxt.config.ts'],
    dependencies: ['nuxt'],
    entryPoints: ['pages', 'components'],
    conventions: STACKS.nuxt.conventions
  },
  'Express': {
    name: 'Express',
    description: 'Minimalist web framework for Node.js',
    configFiles: ['package.json'],
    dependencies: ['express'],
    entryPoints: ['src', 'server'],
    conventions: STACKS.express.conventions
  },
  'NestJS': {
    name: 'NestJS',
    description: 'Node.js framework for scalable server-side applications',
    configFiles: ['nest-cli.json'],
    dependencies: ['@nestjs/core'],
    entryPoints: ['src'],
    conventions: STACKS.nestjs.conventions
  },
  'Django': {
    name: 'Django',
    description: 'High-level Python web framework',
    configFiles: ['manage.py', 'requirements.txt', 'pyproject.toml'],
    dependencies: ['django'],
    entryPoints: ['manage.py'],
    conventions: STACKS.django.conventions
  },
  'FastAPI': {
    name: 'FastAPI',
    description: 'Modern, fast web framework for Python',
    configFiles: ['requirements.txt', 'pyproject.toml'],
    dependencies: ['fastapi'],
    entryPoints: ['main.py', 'app.py'],
    conventions: STACKS.fastapi.conventions
  },
  'Flask': {
    name: 'Flask',
    description: 'Lightweight WSGI web application framework',
    configFiles: ['requirements.txt', 'pyproject.toml'],
    dependencies: ['flask'],
    entryPoints: ['app.py', 'main.py'],
    conventions: STACKS.flask.conventions
  },
  'Spring': {
    name: 'Spring',
    description: 'Java framework for enterprise applications',
    configFiles: ['pom.xml', 'build.gradle'],
    dependencies: ['spring-boot', 'spring-framework'],
    entryPoints: ['src/main/java'],
    conventions: STACKS.spring.conventions
  },
  'Laravel': {
    name: 'Laravel',
    description: 'PHP web framework',
    configFiles: ['composer.json', 'artisan'],
    dependencies: ['laravel/framework'],
    entryPoints: ['app', 'routes'],
    conventions: STACKS.laravel.conventions
  },
  'Prisma': {
    name: 'Prisma',
    description: 'Next-generation ORM for TypeScript & Node.js',
    configFiles: ['prisma/schema.prisma'],
    dependencies: ['prisma'],
    entryPoints: [],
  },
  'TypeORM': {
    name: 'TypeORM',
    description: 'ORM for TypeScript and JavaScript',
    configFiles: ['ormconfig.json', 'ormconfig.js'],
    dependencies: ['typeorm'],
    entryPoints: [],
  }
};

// Stack constants are defined above
