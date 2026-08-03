import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });
import { BoxWrapperService } from '../../box-wrapper-service/dist/index.js';
const svc = new BoxWrapperService({ configPath: resolve(__dirname, '../', process.env.BOX_CONFIG_PATH || './box_config.json'), rootFolderId: '0' });
const client = svc.getBoxClient();
const users = await client.users.getUsers({ userType: 'all', fields: ['id','name','login','external_app_user_id'] });
const matches = (users.entries||[]).filter(u => {
  const n = (u.name||'').toLowerCase();
  const ext = (u.externalAppUserId||u.external_app_user_id||'').toLowerCase();
  return n.includes('astral') || ext.includes('sageastral');
});
console.log(`Found ${matches.length} Box user(s) matching "astral":`);
matches.forEach(u => console.log(`  ${u.name} (${u.id}) — ${u.externalAppUserId||u.external_app_user_id||'no ext id'}`));
if (matches.length === 0) console.log('  (none)');
