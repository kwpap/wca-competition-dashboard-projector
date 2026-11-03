import type { IncomingMessage, ServerResponse } from 'node:http';

export function createApi(options: {
  dataDir: string;
  reportsDir: string;
}): (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
