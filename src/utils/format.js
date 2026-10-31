// ============================================================
//  Tiện ích định dạng (thời gian, thanh tiến trình, emoji nguồn)
// ============================================================

/** Đổi ms -> "3:25" hoặc "1:02:33" */
export function fmtTime(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '0:00'
  const total = Math.floor(ms / 1000)
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  const ss = String(s).padStart(2, '0')
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`
  return `${m}:${ss}`
}

/** Vẽ thanh tiến trình ▰▰▰▱▱▱ */
export function fmtBar(current, total, length = 14) {
  if (!total || total <= 0) return '▬'.repeat(length)
  const ratio = Math.min(1, Math.max(0, current / total))
  const filled = Math.round(ratio * length)
  return '▰'.repeat(filled) + '▱'.repeat(length - filled)
}

/** Emoji hiển thị theo nguồn nhạc */
export function sourceEmoji(sourceName) {
  const map = {
    youtube: '▶️',
    ytmusic: '🎵',
    soundcloud: '☁️',
    spotify: '🎧',
    deezer: '🔊',
    applemusic: '🍎',
    tidal: '🌊',
    bandcamp: '🏕️',
    vimeo: '🎬',
    twitch: '🟣',
    http: '🌐',
    local: '📁',
    flowery: '🗣️',
    nicovideo: '📺',
    bilibili: '📺'
  }
  return map[String(sourceName || '').toLowerCase()] || '🎵'
}

/** Tên nguồn tiếng Việt cho người dùng */
export function sourceLabel(sourceName) {
  const map = {
    youtube: 'YouTube',
    ytmusic: 'YouTube Music',
    soundcloud: 'SoundCloud',
    spotify: 'Spotify',
    deezer: 'Deezer',
    applemusic: 'Apple Music',
    tidal: 'TIDAL',
    bandcamp: 'Bandcamp',
    vimeo: 'Vimeo',
    twitch: 'Twitch',
    http: 'Liên kết trực tiếp',
    local: 'File local'
  }
  return map[String(sourceName || '').toLowerCase()] || String(sourceName || 'Không rõ')
}

/** Cắt an toàn theo giới hạn ký tự của Discord */
export function clamp(text, max = 100) {
  if (!text) return ''
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

/** "mm:ss" hoặc "ss" hoặc số (giây) -> ms */
export function parseSeek(input) {
  if (!input) return null
  const text = String(input).trim()
  if (/^\d+$/u.test(text)) return Number(text) * 1000
  const parts = text.split(':').map((p) => Number(p))
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000
  return null
}
