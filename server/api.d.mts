import type { IncomingMessage, ServerResponse } from 'node:http';

export function createApi(options: {
  dataDir: string;
  reportsDir: string;
  /** Whether the server listens on the network, so TVs can connect. */
  lan: () => boolean;
}): (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
