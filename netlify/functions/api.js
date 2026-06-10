import serverless from 'serverless-http';
import { createApp } from '../../server/app.js';

// netlify.toml redirects /api/* here; basePath strips the function prefix so
// the Express routes (/api/...) match unchanged.
export const handler = serverless(createApp({ serveStatic: false }), {
  basePath: '/.netlify/functions/api',
});
