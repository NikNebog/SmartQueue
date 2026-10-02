import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export function getUploadsDir(): string {
  const rootBackendUploads = join(process.cwd(), 'backend', 'uploads');

  if (existsSync(rootBackendUploads)) {
    return rootBackendUploads;
  }

  return join(process.cwd(), 'uploads');
}

export function ensureUploadsDir(): string {
  const uploadsDir = getUploadsDir();

  mkdirSync(uploadsDir, { recursive: true });

  return uploadsDir;
}
