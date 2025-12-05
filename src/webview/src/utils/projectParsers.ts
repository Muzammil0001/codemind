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

        if (composer.scripts && typeof composer.scripts === 'object') {
            Object.keys(composer.scripts).forEach(key => {
                scripts[key] = composer.scripts[key];
            });
        }

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

        scripts['clean'] = 'mvn clean';
        scripts['compile'] = 'mvn compile';
        scripts['test'] = 'mvn test';
        scripts['package'] = 'mvn package';
        scripts['install'] = 'mvn install';

        if (content.includes('spring-boot-maven-plugin') || content.includes('spring-boot-starter')) {
            scripts['run'] = 'mvn spring-boot:run';
            scripts['build'] = 'mvn clean package';
        } else if (content.includes('quarkus')) {
            scripts['dev'] = 'mvn quarkus:dev';
            scripts['run'] = 'mvn quarkus:dev';
            scripts['build'] = 'mvn clean package -Pnative';
        } else if (content.includes('maven-exec-plugin')) {
            const execMatch = content.match(/<mainClass>(.*?)<\/mainClass>/);
            if (execMatch) {
                scripts['run'] = `mvn exec:java -Dexec.mainClass="${execMatch[1]}"`;
            } else {
                scripts['run'] = 'mvn exec:java';
            }
        } else {
            scripts['run'] = 'mvn exec:java';
        }

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

        scripts['build'] = 'cargo build';
        scripts['run'] = 'cargo run';
        scripts['test'] = 'cargo test';
        scripts['check'] = 'cargo check';
        scripts['release'] = 'cargo build --release';
        scripts['clean'] = 'cargo clean';
        scripts['fmt'] = 'cargo fmt';
        scripts['clippy'] = 'cargo clippy';

        const binMatches = content.matchAll(/\[\[bin\]\]\s*name\s*=\s*"([^"]+)"/g);
        const binaries = Array.from(binMatches).map(match => match[1]);

        if (binaries.length > 0) {
            binaries.forEach(bin => {
                scripts[`run-${bin}`] = `cargo run --bin ${bin}`;
            });
        }
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

    scripts['install'] = 'bundle install';
    scripts['update'] = 'bundle update';

    const hasRails = content.includes('rails') || content.includes("gem 'rails'") || content.includes('gem "rails"');

    if (hasRails) {
        scripts['server'] = 'rails server';
        scripts['console'] = 'rails console';
        scripts['migrate'] = 'rails db:migrate';
        scripts['seed'] = 'rails db:seed';
        scripts['test'] = 'rails test';
        scripts['routes'] = 'rails routes';
    }

    if (content.includes('rspec') || content.includes("gem 'rspec'") || content.includes('gem "rspec"')) {
        scripts['test'] = 'bundle exec rspec';
        scripts['spec'] = 'bundle exec rspec';
    }

    if (content.includes('rake') || hasRails) {
        scripts['tasks'] = 'bundle exec rake -T';
    }
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

    scripts['build'] = 'go build';
    scripts['run'] = 'go run .';
    scripts['test'] = 'go test ./...';
    scripts['fmt'] = 'go fmt ./...';
    scripts['vet'] = 'go vet ./...';
    scripts['mod-tidy'] = 'go mod tidy';
    scripts['mod-download'] = 'go mod download';
    scripts['mod-verify'] = 'go mod verify';

    const moduleMatch = content.match(/^module\s+(.+)$/m);
    if (moduleMatch) {
        const moduleName = moduleMatch[1];
        scripts['doc'] = `go doc ${moduleName}`;
    }

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
