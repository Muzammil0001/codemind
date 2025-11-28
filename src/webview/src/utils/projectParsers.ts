/**
 * Project Configuration Parsers
 * Utilities to parse various project configuration files and extract scripts/tasks
 */

import type { ProjectScripts } from './commandDetection';

/**
 * Parse package.json (Node.js/JavaScript)
 * Already exists in commandDetection.ts, but re-exported here for consistency
 */
export function parsePackageJson(content: string): ProjectScripts {
    try {
        const pkg = JSON.parse(content);
        return pkg.scripts || {};
    } catch (error) {
        console.error('Failed to parse package.json:', error);
        return {};
    }
}

/**
 * Parse composer.json (PHP/Laravel)
 */
export function parseComposerJson(content: string): ProjectScripts {
    try {
        const composer = JSON.parse(content);
        const scripts: ProjectScripts = {};

        // Composer scripts section
        if (composer.scripts && typeof composer.scripts === 'object') {
            Object.keys(composer.scripts).forEach(key => {
                scripts[key] = composer.scripts[key];
            });
        }

        // Add common Laravel Artisan commands if Laravel is detected
        if (composer.require && composer.require['laravel/framework']) {
            scripts['serve'] = 'php artisan serve';
            scripts['migrate'] = 'php artisan migrate';
            scripts['test'] = 'php artisan test';
        }

        return scripts;
    } catch (error) {
        console.error('Failed to parse composer.json:', error);
        return {};
    }
}

/**
 * Parse pyproject.toml (Python - Poetry/Modern Python)
 */
export function parsePyprojectToml(content: string): ProjectScripts {
    try {
        const scripts: ProjectScripts = {};

        // Parse [tool.poetry.scripts] section for custom scripts
        const poetryScriptsMatch = content.match(/\[tool\.poetry\.scripts\]([\s\S]*?)(?=\n\[|$)/);
        if (poetryScriptsMatch) {
            const scriptsSection = poetryScriptsMatch[1];
            const lines = scriptsSection.split('\n');
            lines.forEach(line => {
                const match = line.match(/^(\w+)\s*=\s*"(.+)"$/);
                if (match) {
                    scripts[match[1]] = match[2];
                }
            });
        }

        // Parse [tool.poe.tasks] section for custom tasks (poethepoet)
        const poeTasksMatch = content.match(/\[tool\.poe\.tasks\]([\s\S]*?)(?=\n\[|$)/);
        if (poeTasksMatch) {
            const tasksSection = poeTasksMatch[1];
            const lines = tasksSection.split('\n');
            lines.forEach(line => {
                const match = line.match(/^(\w+)\s*=\s*"(.+)"$/);
                if (match) {
                    scripts[match[1]] = match[2];
                }
            });
        }

        // Only add defaults if no custom scripts were found
        if (Object.keys(scripts).length === 0) {
            scripts['install'] = 'pip install -r requirements.txt';
            scripts['test'] = 'pytest';
            scripts['lint'] = 'pylint .';
            scripts['format'] = 'black .';
        }

        return scripts;
    } catch (error) {
        console.error('Failed to parse pyproject.toml:', error);
        return {};
    }
}

/**
 * Parse requirements.txt (Python)
 */
export function parseRequirementsTxt(_content: string): ProjectScripts {
    // requirements.txt doesn't have scripts, but we can suggest common commands
    return {
        'install': 'pip install -r requirements.txt',
        'freeze': 'pip freeze > requirements.txt',
        'test': 'pytest',
        'run': 'python main.py'
    };
}

/**
 * Parse pom.xml (Maven/Java)
 */
export function parsePomXml(content: string): ProjectScripts {
    try {
        const scripts: ProjectScripts = {};

        // Extract common Maven goals
        scripts['clean'] = 'mvn clean';
        scripts['compile'] = 'mvn compile';
        scripts['test'] = 'mvn test';
        scripts['package'] = 'mvn package';
        scripts['install'] = 'mvn install';

        // Detect project type and adjust commands
        if (content.includes('spring-boot-maven-plugin') || content.includes('spring-boot-starter')) {
            scripts['run'] = 'mvn spring-boot:run';
            scripts['build'] = 'mvn clean package';
        } else if (content.includes('quarkus')) {
            scripts['dev'] = 'mvn quarkus:dev';
            scripts['run'] = 'mvn quarkus:dev';
            scripts['build'] = 'mvn clean package -Pnative';
        } else if (content.includes('maven-exec-plugin')) {
            // Extract exec plugin configuration
            const execMatch = content.match(/<mainClass>(.*?)<\/mainClass>/);
            if (execMatch) {
                scripts['run'] = `mvn exec:java -Dexec.mainClass="${execMatch[1]}"`;
            } else {
                scripts['run'] = 'mvn exec:java';
            }
        } else {
            scripts['run'] = 'mvn exec:java';
        }

        // Check for additional plugins
        if (content.includes('maven-war-plugin')) {
            scripts['war'] = 'mvn war:war';
        }
        if (content.includes('maven-jar-plugin')) {
            scripts['jar'] = 'mvn jar:jar';
        }

        return scripts;
    } catch (error) {
        console.error('Failed to parse pom.xml:', error);
        return {};
    }
}

/**
 * Parse Cargo.toml (Rust)
 */
export function parseCargoToml(content: string): ProjectScripts {
    try {
        const scripts: ProjectScripts = {};

        // Standard Cargo commands
        scripts['build'] = 'cargo build';
        scripts['run'] = 'cargo run';
        scripts['test'] = 'cargo test';
        scripts['check'] = 'cargo check';
        scripts['release'] = 'cargo build --release';
        scripts['clean'] = 'cargo clean';
        scripts['fmt'] = 'cargo fmt';
        scripts['clippy'] = 'cargo clippy';

        // Parse [[bin]] sections for binary targets
        const binMatches = content.matchAll(/\[\[bin\]\]\s*name\s*=\s*"([^"]+)"/g);
        const binaries = Array.from(binMatches).map(match => match[1]);

        if (binaries.length > 0) {
            // Add run commands for specific binaries
            binaries.forEach(bin => {
                scripts[`run-${bin}`] = `cargo run --bin ${bin}`;
            });
        }

        // Parse [features] section for feature flags
        const featuresMatch = content.match(/\[features\]([\s\S]*?)(?=\n\[|$)/);
        if (featuresMatch) {
            const featuresSection = featuresMatch[1];
            const featureLines = featuresSection.split('\n');
            const features = featureLines
                .map(line => line.match(/^(\w+)\s*=/))
                .filter(match => match !== null)
                .map(match => match![1]);

            if (features.length > 0) {
                scripts['features'] = `cargo build --features ${features.join(',')}`;
            }
        }

        // Check for workspace
        if (content.includes('[workspace]')) {
            scripts['build-all'] = 'cargo build --workspace';
            scripts['test-all'] = 'cargo test --workspace';
        }

        return scripts;
    } catch (error) {
        console.error('Failed to parse Cargo.toml:', error);
        return {};
    }
}

/**
 * Parse Gemfile (Ruby/Rails)
 */
export function parseGemfile(content: string): ProjectScripts {
    const scripts: ProjectScripts = {};

    // Common Ruby/Rails commands
    scripts['install'] = 'bundle install';
    scripts['update'] = 'bundle update';

    // Detect Rails
    const hasRails = content.includes('rails') || content.includes("gem 'rails'") || content.includes('gem "rails"');

    if (hasRails) {
        scripts['server'] = 'rails server';
        scripts['console'] = 'rails console';
        scripts['migrate'] = 'rails db:migrate';
        scripts['seed'] = 'rails db:seed';
        scripts['test'] = 'rails test';
        scripts['routes'] = 'rails routes';
    }

    // Detect RSpec
    if (content.includes('rspec') || content.includes("gem 'rspec'") || content.includes('gem "rspec"')) {
        scripts['test'] = 'bundle exec rspec';
        scripts['spec'] = 'bundle exec rspec';
    }

    // Detect Rake
    if (content.includes('rake') || hasRails) {
        scripts['tasks'] = 'bundle exec rake -T';
    }

    // Detect Sinatra
    if (content.includes('sinatra') || content.includes("gem 'sinatra'") || content.includes('gem "sinatra"')) {
        scripts['server'] = 'ruby app.rb';
    }

    return scripts;
}

/**
 * Parse go.mod (Go)
 */
export function parseGoMod(content: string): ProjectScripts {
    const scripts: ProjectScripts = {};

    // Common Go commands
    scripts['build'] = 'go build';
    scripts['run'] = 'go run .';
    scripts['test'] = 'go test ./...';
    scripts['fmt'] = 'go fmt ./...';
    scripts['vet'] = 'go vet ./...';
    scripts['mod-tidy'] = 'go mod tidy';
    scripts['mod-download'] = 'go mod download';
    scripts['mod-verify'] = 'go mod verify';

    // Extract module name for documentation
    const moduleMatch = content.match(/^module\s+(.+)$/m);
    if (moduleMatch) {
        const moduleName = moduleMatch[1];
        scripts['doc'] = `go doc ${moduleName}`;
    }

    // Check for build tags/constraints
    if (content.includes('// +build') || content.includes('//go:build')) {
        scripts['build-all-tags'] = 'go build -tags "integration,e2e"';
    }

    return scripts;
}

/**
 * Merge multiple ProjectScripts objects
 */
export function mergeProjectScripts(...scriptObjects: ProjectScripts[]): ProjectScripts {
    return scriptObjects.reduce((merged, scripts) => {
        return { ...merged, ...scripts };
    }, {});
}
