import path from 'node:path';
import { WebRService } from '@/runtime/webr-service';

/** Start a real WebR session in Node using the pinned distribution from node_modules. */
export async function startR(): Promise<WebRService> {
  const baseUrl = path.resolve(process.cwd(), 'node_modules/webr/dist') + '/';
  const r = new WebRService(baseUrl);
  await r.init();
  return r;
}

export function text(chunks: { kind: string; text: string }[]): string {
  return chunks.map((c) => c.text).join('\n');
}
