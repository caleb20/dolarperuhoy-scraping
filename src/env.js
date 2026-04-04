import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, '..');
const envFiles = ['.env.local', '.env', '.env.local.example'];

let fallbackFileLoaded = null;

for (const fileName of envFiles) {
  const filePath = path.join(projectRoot, fileName);

  if (!fs.existsSync(filePath)) {
    continue;
  }

  dotenv.config({ path: filePath, override: false });

  if (fileName === '.env.local.example') {
    fallbackFileLoaded = fileName;
  }
}

if (fallbackFileLoaded) {
  console.warn(
    `[env] Usando ${fallbackFileLoaded} como fallback. Crea .env.local para configuración local.`
  );
}

export function requireEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `[env] Falta la variable ${name}. Crea .env.local basado en .env.local.example o expórtala en el entorno.`
    );
  }

  return value;
}