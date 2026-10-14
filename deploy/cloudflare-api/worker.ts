/**
 * Cloudflare entry for the LinkUP API.
 *
 * The NestJS API runs unchanged inside a Cloudflare Container (see apps/api/Dockerfile).
 * This Worker only forwards requests to it. It has no public URL
 * (workers_dev: false); the web Worker reaches it through a service binding.
 */
import { Container, getContainer } from '@cloudflare/containers';

interface Env {
  API_CONTAINER: DurableObjectNamespace<ApiContainer>;
  /** Neon (or any Postgres with pgvector) connection string — `wrangler secret put DATABASE_URL` */
  DATABASE_URL: string;
}

export class ApiContainer extends Container<Env> {
  defaultPort = 4100;
  // Demo traffic is bursty; stay warm for 30 minutes after the last request.
  sleepAfter = '30m';
  pingEndpoint = 'container/health';

  constructor(ctx: DurableObjectState<{}>, env: Env) {
    super(ctx, env);
    this.envVars = {
      DATABASE_URL: env.DATABASE_URL,
      API_HOST: '0.0.0.0',
      API_PORT: '4100',
      EMBEDDINGS_PROVIDER: 'local',
      // Migrate + seed the demo data automatically when the database is empty.
      DB_AUTO_SETUP: '1',
    };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // One instance is plenty for a demo; the API itself is stateless.
    return getContainer(env.API_CONTAINER, 'linkup-api').fetch(request);
  },
} satisfies ExportedHandler<Env>;
