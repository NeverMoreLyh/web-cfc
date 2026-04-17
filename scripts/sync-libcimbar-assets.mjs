import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, 'public', 'vendor', 'libcimbar');
const candidates = [
  path.resolve(projectRoot, '../libcimbar/web'),
  path.resolve(projectRoot, '../ios-cfc/Vendor/libcimbar/web'),
  path.resolve(projectRoot, '../../libcimbar/web'),
];

const requiredFiles = ['cimbar_js.js', 'cimbar_js.wasm'];

function exists(filePath) {
  return fs.existsSync(filePath);
}

function findSourceDirectory() {
  for (const candidate of candidates) {
    const matches = requiredFiles.every((file) => exists(path.join(candidate, file)));
    if (matches) {
      return candidate;
    }
  }
  return null;
}

const sourceDir = findSourceDirectory();
if (!sourceDir) {
  console.error('Could not find built libcimbar WASM assets.');
  console.error('Expected files:');
  for (const file of requiredFiles) {
    console.error(`- ${file}`);
  }
  console.error('Checked these directories:');
  for (const candidate of candidates) {
    console.error(`- ${candidate}`);
  }
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });
for (const file of requiredFiles) {
  fs.copyFileSync(path.join(sourceDir, file), path.join(outputDir, file));
  console.log(`Copied ${file} from ${sourceDir}`);
}
