// ============================================================
//  config.js — đọc file .env và kiểm tra cấu hình
//
//  Bot đọc các biến từ file ".env" nằm ở thư mục gốc của project.
//  Nếu thiếu biến bắt buộc, bot sẽ dừng ngay và in ra hướng dẫn cụ thể.
// ============================================================
import 'dotenv/config'

// --- Helper: đọc biến môi trường ---
const env = (key, fallback = '') => (process.env[key] ?? fallback).trim()

const token = env('DISCORD_TOKEN')
const clientId = env('CLIENT_ID')
const guildId = env('GUILD_ID') // tuỳ chọn — để trống = đăng ký lệnh global

const host = env('NODELINK_HOST', '127.0.0.1')
const port = Number(env('NODELINK_PORT', '3000'))
const secure = ['true', '1', 'yes'].includes(env('NODELINK_SECURE', 'false').toLowerCase())
const password = env('NODELINK_PASSWORD')
const userId = env('NODELINK_USER_ID') || clientId // mặc định = CLIENT_ID

const defaultVolume = Number(env('DEFAULT_VOLUME', '100'))
const maxQueueSize = Number(env('MAX_QUEUE_SIZE', '500'))
const name = env('NODE_NAME', 'NodeLinkMusicBot')

// --- Kiểm tra cấu hình trước khi khởi động ---
const errors = []

if (!token || token.includes('dán_token')) {
  errors.push('• DISCORD_TOKEN chưa điền — lấy token tại Developer Portal > Bot > Reset Token.')
}
if (!clientId || !/^\d{17,20}$/.test(clientId)) {
  errors.push('• CLIENT_ID chưa điền hoặc sai — đó là "Application ID" trong Developer Portal > General Information.')
}
if (guildId && !/^\d{17,20}$/.test(guildId)) {
  errors.push('• GUILD_ID sai định dạng — phải là ID server (chuỗi số 17-20 chữ số). Bỏ trống nếu muốn đăng ký lệnh global.')
}
if (!password || password === 'youshallnotpass') {
  errors.push('• NODELINK_PASSWORD chưa điền — lấy mật khẩu trong file config của server NodeLink của bạn (trường server.password).')
}
if (!host) {
  errors.push('• NODELINK_HOST chưa điền — ví dụ: 127.0.0.1 hoặc IP của server NodeLink.')
}
if (!Number.isFinite(port) || port < 1 || port > 65535) {
  errors.push('• NODELINK_PORT không hợp lệ — phải là số 1-65535 (mặc định NodeLink là 3000).')
}

if (errors.length > 0) {
  console.error('════════════════════════════════════════════')
  console.error('❌ Cấu hình chưa đúng — bot không thể khởi động:')
  console.error(errors.join('\n'))
  console.error('   👉 Mở file ".env" ở thư mục gốc project và sửa lại.')
  console.error('   📄 Chưa có ".env"? Copy file ".env.example" rồi đổi tên thành ".env".')
  console.error('════════════════════════════════════════════')
  process.exit(1)
}

export const config = {
  discord: { token, clientId, guildId: guildId || null },
  nodelink: { host, port, secure, password, userId, name },
  music: {
    defaultVolume: Number.isFinite(defaultVolume) ? Math.min(Math.max(defaultVolume, 1), 1000) : 100,
    maxQueueSize: Number.isFinite(maxQueueSize) ? Math.max(maxQueueSize, 1) : 500
  }
}

export default config
