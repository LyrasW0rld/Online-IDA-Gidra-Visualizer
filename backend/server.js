/**
 * Lyras Pseudocode Reader - Local Offline Server
 * 100% Local & Offline - No Google Cloud API or credentials required.
 */
import express from 'express';

const app = express();
const PORT = process?.env?.PORT || process?.env?.API_BACKEND_PORT || 5000;
const HOST = process?.env?.HOST || '127.0.0.1';

app.use(express.json());

// Offline local status endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    mode: 'local-offline',
    googleCloud: 'none-needed',
    message: 'Lyras Pseudocode Reader is running 100% locally in browser.',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, HOST, () => {
  console.log(`[Lyras Reader Backend] Local offline server listening at http://${HOST}:${PORT}`);
  console.log('[Lyras Reader Backend] 100% Local - No Google Cloud or external API needed.');
});
