// envファイルが本当に読み込まれているかを確認するためのスクリプト
import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

const envPath = resolve(__dirname, '../.env.local');
config({ path: envPath });

console.log('✔ .env.local パス:', envPath);
console.log('MONGODB_URI:', process.env.MONGODB_URI || '❌ 未設定');
console.log('MONGODB_DB:', process.env.MONGODB_DB || '❌ 未設定');
