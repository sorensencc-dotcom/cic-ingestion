#!/usr/bin/env node

/**
 * Documentation Generator Agent
 * Generates API docs (TypeDoc) and README files
 * No API calls - all local generation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getStagedFiles, findServiceRoot } = require('./shared-utils');

const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

class DocsGeneratorAgent {
  constructor() {
    this.stagedFiles = getStagedFiles(['.ts']);
    this.generatedDocs = [];
  }

  /**
   * Generate TypeDoc documentation for a service
   */
  generateTypeDoc(serviceRoot) {
    const packageJsonPath = path.join(serviceRoot, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      return;
    }

    try {
      const serviceName = path.basename(serviceRoot);
      const docsDir = path.join(serviceRoot, 'docs/api');

      // Create docs directory if it doesn't exist
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
      }

      // Generate TypeDoc if tsconfig exists
      const tsconfigPath = path.join(serviceRoot, 'tsconfig.json');
      if (fs.existsSync(tsconfigPath)) {
        try {
          execSync(
            `npx typedoc --out ${docsDir} --readme none src 2>/dev/null`,
            { cwd: serviceRoot, stdio: 'ignore' }
          );
          this.generatedDocs.push(`${serviceName} API documentation`);
        } catch (e) {
          // TypeDoc not available, continue
        }
      }
    } catch (e) {
      // Silently skip if generation fails
    }
  }

  /**
   * Generate README for a service
   */
  generateReadme(serviceRoot) {
    const serviceName = path.basename(serviceRoot);
    const packageJsonPath = path.join(serviceRoot, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      return;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const srcDir = path.join(serviceRoot, 'src');
      const readmePath = path.join(serviceRoot, 'README.md');

      // Get main source files
      let mainFiles = [];
      if (fs.existsSync(srcDir)) {
        mainFiles = fs.readdirSync(srcDir)
          .filter(f => f.endsWith('.ts'))
          .slice(0, 5);
      }

      // Generate README
      const readme = `# ${packageJson.name}

${packageJson.description || ''}

## Quick Start

\`\`\`bash
cd ${serviceName}
npm install
npm run dev
\`\`\`

## Scripts

${Object.entries(packageJson.scripts || {})
  .map(([name, cmd]) => `- \`npm run ${name}\` - ${cmd}`)
  .join('\n')}

## Main Exports

${mainFiles.length > 0 ? mainFiles.map(f => `- \`src/${f}\``).join('\n') : '*(See src/ directory)*'}

## Dependencies

- ${Object.keys(packageJson.dependencies || {}).join('\n- ')}

## Dev Dependencies

- ${Object.keys(packageJson.devDependencies || {}).slice(0, 5).join('\n- ')}${Object.keys(packageJson.devDependencies || {}).length > 5 ? '\n- ... and more' : ''}

---

Generated automatically. Last updated: ${new Date().toISOString()}
`;

      fs.writeFileSync(readmePath, readme);
      this.generatedDocs.push(`${serviceName} README`);
    } catch (e) {
      // Silently skip if generation fails
    }
  }

  /**
   * Generate a service index if multiple services changed
   */
  generateServiceIndex() {
    const servicesDir = path.join(__dirname, '..', 'services');

    if (!fs.existsSync(servicesDir)) {
      return;
    }

    try {
      const services = fs.readdirSync(servicesDir)
        .filter(f => fs.statSync(path.join(servicesDir, f)).isDirectory())
        .filter(f => fs.existsSync(path.join(servicesDir, f, 'package.json')));

      const servicesList = services
        .map(service => {
          const pkgPath = path.join(servicesDir, service, 'package.json');
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          return `- **${pkg.name}** - ${pkg.description || ''}`;
        })
        .join('\n');

      const indexContent = `# Cast Iron Forge Services

## Available Services

${servicesList}

---

Generated automatically. Last updated: ${new Date().toISOString()}
`;

      const indexPath = path.join(servicesDir, 'INDEX.md');
      fs.writeFileSync(indexPath, indexContent);
      this.generatedDocs.push('Services INDEX');
    } catch (e) {
      // Silently skip if generation fails
    }
  }

  run() {
    console.log(`\n${BLUE}📚 Documentation Generator Agent${RESET}\n`);

    if (this.stagedFiles.length === 0) {
      console.log('✅ No TypeScript files staged\n');
      return;
    }

    console.log(`Generating docs for ${this.stagedFiles.length} file(s)...\n`);

    // Find unique services
    const services = new Set();
    this.stagedFiles.forEach(file => {
      const service = findServiceRoot(file);
      if (service) {
        services.add(service);
      }
    });

    // Generate docs for each service
    services.forEach(serviceRoot => {
      this.generateTypeDoc(serviceRoot);
      this.generateReadme(serviceRoot);
    });

    // Generate service index
    this.generateServiceIndex();

    // Report results
    if (this.generatedDocs.length > 0) {
      console.log(`${GREEN}✅ Generated documentation:${RESET}`);
      this.generatedDocs.forEach(doc => console.log(`   ${GREEN}✓${RESET} ${doc}`));

      // Stage the generated docs
      try {
        execSync('git add "**/*.md" "docs/" 2>/dev/null', { stdio: 'ignore' });
        console.log(`\n${GREEN}✓ Docs auto-staged${RESET}\n`);
      } catch (e) {
        // Docs already staged or git error, continue
        console.log('\n');
      }
    } else {
      console.log('ℹ️  No documentation generated\n');
    }
  }
}

// Run the agent
const agent = new DocsGeneratorAgent();
agent.run();
