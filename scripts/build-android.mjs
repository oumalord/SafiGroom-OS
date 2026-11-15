import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'vite';

const root = process.cwd();
const capCommand = resolve(root, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor');
const appConfig = JSON.parse(readFileSync(resolve(root, 'app-config.json'), 'utf8'));
const hostedUrl = new URL(appConfig.hostedUrl);
if (hostedUrl.protocol !== 'https:') throw new Error('The hosted SafiGroom app URL must use HTTPS.');

function runCapacitor(args) {
  const result = spawnSync(process.execPath, [capCommand, ...args], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Capacitor command failed: cap ${args.join(' ')}`);
}

process.env.VITE_API_BASE_URL = hostedUrl.origin;
await build();

if (!existsSync(resolve(root, 'android'))) runCapacitor(['add', 'android']);
runCapacitor(['sync', 'android']);

const icon = resolve(root, 'public', 'favicon.png');
const adaptiveIcon = resolve(root, 'public', 'app-adaptive-foreground.png');
for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  const resources = resolve(root, 'android', 'app', 'src', 'main', 'res', `mipmap-${density}`);
  mkdirSync(resources, { recursive: true });
  copyFileSync(icon, join(resources, 'ic_launcher.png'));
  copyFileSync(icon, join(resources, 'ic_launcher_round.png'));
  copyFileSync(adaptiveIcon, join(resources, 'ic_launcher_foreground.png'));
}
