import { createApp } from './app.js';
import config from './config.js';

createApp().listen(config.port, () => {
  console.log(`QueueSmart API listening on http://127.0.0.1:${config.port}/api`);
});
