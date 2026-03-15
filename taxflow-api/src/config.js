import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const boxConfigPath = process.env.BOX_CONFIG_PATH || './box_config.json';

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  boxConfigPath: resolve(__dirname, '../', boxConfigPath),
  boxRootFolderId: process.env.BOX_ROOT_FOLDER_ID || '0',
  boxAdminEmail: process.env.BOX_ADMIN_EMAIL || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};
