import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Every page is per-persona and dynamic, so no incremental (ISR) cache is configured.
export default defineCloudflareConfig({});
