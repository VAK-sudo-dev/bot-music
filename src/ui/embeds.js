// ============================================================
//  embeds.js — Các embed hiển thị (Now Playing, Queue, Thêm bài, Help)
// ============================================================
import { EmbedBuilder } from 'discord.js'
import { fmtTime, fmtBar, sourceEmoji, sourceLabel, clamp } from '../utils/format.js'
import { buildControlRow, attachControls } from './controls.js'

const MAIN_COLOR = 0x5865f2 // Blurple
const DIM_COLOR = 0x2b2d31

/* ---------------------- Now Playing ---------------------- */

export function nowPlayingEmbed(player) {
  const entry = player.current
  const info = entry?.track?.info
  if (!info) return null

  const position = player.getPosition()
  const length = info.isStream ? 0 : info.length ?? 0
  const bar = info.isStream ? '🔴 LIVE' : `${fmtTime(position)} ${fmtBar(position, length)} ${fmtTime(length)}`

  const filtersOn = Object.keys(player.filters ?? {})
  const embed = new EmbedBuilder()
    .setColor(MAIN_COLOR)
    .setAuthor({ name: '🎵 Đang phát' })
    .setTitle(clamp(info.title ?? 'Không rõ', 250))
    .setFields(
      { name: 'Tác giả', value: clamp(info.author ?? 'Không rõ', 100), inline: true },
      { name: 'Nguồn', value: `${sourceEmoji(info.sourceName)} ${sourceLabel(info.sourceName)}`, inline: true },
      { name: 'Yêu cầu bởi', value: entry.requester ? `<@${entry.requester.id}>` : 'Không rõ', inline: true },
      { name: 'Tiến trình', value: bar }
    )
    .setFooter({
      text: [
        `Âm lượng ${player.volume}%`,
        player.loopMode !== 'off' ? `Lặp: ${player.loopMode === 'track' ? '1 bài' : 'hàng đợi'}` : null,
        player.shuffle ? 'Xáo trộn bật' : null,
        filtersOn.length > 0 ? `Filters: ${filtersOn.join(', ')}` : null,
        `Hàng đợi: ${player.queue.length} bài`
      ]
        .filter(Boolean)
        .join(' • ')
    })

  if (info.uri) embed.setURL(info.uri)
  if (info.artworkUrl) embed.setThumbnail(info.artworkUrl)
  return embed
}

async function updateNowPlaying(player) {
  const message = player._npMessage
  if (!message) return
  const embed = nowPlayingEmbed(player)
  if (!embed) return
  try {
    await message.edit({ embeds: [embed] })
  } catch {
    clearInterval(player._npUpdater)
    player._npUpdater = null
  }
}

/** Gửi tin nhắn Now Playing kèm nút điều khiển (gọi mỗi khi track bắt đầu) */
export async function sendNowPlaying(player) {
  stopNowPlaying(player)
  const channel = await player._textChannel()
  const embed = nowPlayingEmbed(player)
  if (!channel || !embed) return

  const message = await channel
    .send({ embeds: [embed], components: [buildControlRow(player)] })
    .catch(() => null)
  if (!message) return

  player._npMessage = message
  attachControls(player, message)
  // Cập nhật thanh tiến trình mỗi 15 giây
  player._npUpdater = setInterval(() => updateNowPlaying(player), 15_000)
  if (player._npUpdater.unref) player._npUpdater.unref()
}

/** Gỡ tin nhắn Now Playing + dừng updater/collector */
export function stopNowPlaying(player) {
  if (player._npUpdater) {
    clearInterval(player._npUpdater)
    player._npUpdater = null
  }
  try {
    player._npCollector?.stop()
  } catch {
    /* bỏ qua */
  }
  player._npCollector = null
  if (player._npMessage) {
    const msg = player._npMessage
    player._npMessage = null
    msg.delete().catch(() => {})
  }
}

/** Thông báo nhanh dạng embed nhỏ */
export async function announce(channel, content) {
  if (!channel) return
  await channel
    .send({
      embeds: [new EmbedBuilder().setColor(DIM_COLOR).setDescription(content)]
    })
    .catch(() => {})
}

/* ---------------------- Đã thêm vào hàng đợi ---------------------- */

export function addedEmbed(player, entries, playlistInfo = null) {
  const first = entries[0].track.info
  const start = player.queue.length - entries.length + 1
  const embed = new EmbedBuilder().setColor(MAIN_COLOR)

  if (playlistInfo) {
    embed
      .setAuthor({ name: '📂 Đã thêm playlist' })
      .setTitle(clamp(playlistInfo.name ?? 'Playlist', 250))
      .addFields(
        { name: 'Số bài', value: `${entries.length} bài`, inline: true },
        { name: 'Vị trí trong hàng đợi', value: `#${start} → #${player.queue.length}`, inline: true },
        { name: 'Yêu cầu bởi', value: entries[0].requester ? `<@${entries[0].requester.id}>` : 'Không rõ', inline: true }
      )
    if (playlistInfo.duration) {
      embed.addFields({ name: 'Tổng thời lượng', value: fmtTime(playlistInfo.duration), inline: true })
    }
  } else {
    embed
      .setAuthor({ name: '➕ Đã thêm vào hàng đợi' })
      .setTitle(clamp(first.title ?? 'Không rõ', 250))
      .addFields(
        { name: 'Tác giả', value: clamp(first.author ?? 'Không rõ', 100), inline: true },
        { name: 'Thời lượng', value: first.isStream ? '🔴 LIVE' : fmtTime(first.length ?? 0), inline: true },
        { name: 'Vị trí', value: `#${player.queue.length}`, inline: true }
      )
    if (first.uri) embed.setURL(first.uri)
    if (first.artworkUrl) embed.setThumbnail(first.artworkUrl)
  }
  return embed
}

/* ---------------------- Hàng đợi ---------------------- */

const PAGE_SIZE = 10

export function queueEmbed(player, page = 1) {
  const embed = new EmbedBuilder().setColor(MAIN_COLOR)
  const queue = player.queue

  if (!player.current && queue.length === 0) {
    return embed.setDescription('💤 Hàng đợi trống. Thêm nhạc bằng `/play` nhé!').setFooter({ text: 'Hàng đợi • 0 bài' })
  }

  const totalDuration = queueDurationText(player)
  const pages = Math.max(1, Math.ceil(queue.length / PAGE_SIZE))
  page = Math.min(Math.max(1, page), pages)
  const start = (page - 1) * PAGE_SIZE
  const slice = queue.slice(start, start + PAGE_SIZE)

  let desc = ''
  if (player.current && page === 1) {
    const info = player.current.track.info
    const pos = player.getPosition()
    const len = info.isStream ? 0 : info.length ?? 0
    desc += `**▶️ Đang phát:** [${clamp(info.title, 80)}](${info.uri ?? ''})\n${fmtTime(pos)} ${fmtBar(pos, len, 10)} ${info.isStream ? '🔴 LIVE' : fmtTime(len)} • <@${player.current.requester?.id ?? '?'}>\n\n`
  }

  if (slice.length === 0 && page === 1 && !player.current) desc += '(trống)'
  desc += slice
    .map(
      (entry, i) =>
        `\`${start + i + 1}.\` [${clamp(entry.track.info?.title ?? 'Không rõ', 70)}](${entry.track.info?.uri ?? ''}) — ${entry.track.info?.isStream ? '🔴 LIVE' : fmtTime(entry.track.info?.length ?? 0)} • <@${entry.requester?.id ?? '?'}>`
    )
    .join('\n')

  embed
    .setDescription(desc || '(trống)')
    .setFooter({ text: `Hàng đợi • Trang ${page}/${pages} • ${queue.length} bài • ${totalDuration}` })

  if (player.loopMode !== 'off') {
    embed.addFields({
      name: 'Chế độ',
      value: `${player.loopMode === 'track' ? '🔂 Lặp 1 bài' : '🔁 Lặp hàng đợi'}${player.shuffle ? ' • 🔀 Xáo trộn' : ''}`
    })
  } else if (player.shuffle) {
    embed.addFields({ name: 'Chế độ', value: '🔀 Xáo trộn bật' })
  }
  return embed
}

function queueDurationText(player) {
  const ms = player.queueDuration()
  if (ms <= 0) return '0:00'
  return fmtTime(ms)
}

/* ---------------------- Help ---------------------- */

export function helpEmbed(nodeInfo = null) {
  const embed = new EmbedBuilder()
    .setColor(MAIN_COLOR)
    .setTitle('🎵 NodeLink Music Bot — Danh sách lệnh')
    .setDescription('Bot phát nhạc kết nối **NodeLink** (Lavalink-compatible). Hỗ trợ YouTube, SoundCloud, Spotify, Deezer, Apple Music và nhiều nguồn khác.')
    .addFields(
      {
        name: '🎧 Phát nhạc',
        value:
          '`/play <tên bài hoặc link>` — tìm và phát nhạc\n' +
          '`/nowplaying` — bài đang phát + tiến trình\n' +
          '`/queue <trang>` — xem hàng đợi'
      },
      {
        name: '🎛️ Điều khiển',
        value:
          '`/pause` `/resume` — tạm dừng / tiếp tục\n' +
          '`/skip [số bài]` — bỏ qua\n' +
          '`/stop` — dừng + xoá hàng đợi\n' +
          '`/seek <mm:ss>` — tua tới thời điểm\n' +
          '`/volume <1-1000>` — chỉnh âm lượng'
      },
      {
        name: '🔀 Chế độ & hiệu ứng',
        value:
          '`/loop <off|track|queue>` — lặp lại\n' +
          '`/shuffle` — xáo trộn hàng đợi\n' +
          '`/remove <số thứ tự>` — xoá 1 bài khỏi hàng đợi\n' +
          '`/filter <preset>` — bassboost, nightcore, vaporwave, 8d, karaoke... (hoặc `off`)'
      },
      {
        name: '📃 Khác',
        value:
          '`/lyrics` — lời bài hát đang phát\n' +
          '`/help` — danh sách lệnh này'
      },
      {
        name: '🧩 Nút bấm trên tin nhắn nhạc',
        value: '⏸️ Tạm dừng/Tiếp tục • ⏭️ Bỏ qua • ⏹️ Dừng • 🔁 Lặp • 🔀 Xáo trộn'
      }
    )
    .setFooter({ text: 'Chỉ người đang ở trong kênh thoại với bot mới điều khiển được nhạc' })

  if (nodeInfo) {
    const version = nodeInfo.version?.semver ?? 'không rõ'
    const sources = (nodeInfo.sourceManagers ?? []).slice(0, 18).join(', ')
    embed.addFields({
      name: '🛰️ Node đang kết nối',
      value: `Phiên bản NodeLink: \`${version}\`\nNguồn hỗ trợ: ${sources}${(nodeInfo.sourceManagers ?? []).length > 18 ? '...' : ''}`
    })
  }
  return embed
}
