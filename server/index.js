import 'dotenv/config';
import { createApp } from './app.js';
import { hasDataForSeoCredentials } from './dataforseo.js';
import { hasNotionCredentials } from './notion.js';

const app = createApp();
const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`Keyword Gap Analysis running on http://localhost:${port}`);
  console.log(
    `DataForSEO env keys: ${hasDataForSeoCredentials() ? 'yes' : 'no (visitors supply their own, or demo mode)'}`
  );
  console.log(`Notion env keys: ${hasNotionCredentials() ? 'yes' : 'no'}`);
});
