// ============================================================
//  /play — tìm kiếm & phát nhạc (YouTube, SoundCloud, Spotify, Deezer...)
//  Hỗ trợ autocomplete gợi ý kết quả khi gõ.
// ============================================================
import { SlashCommandBuilder } from 'discord.js'
import { addedEmbed, announce } from '../ui/embeds.js'
import { ensureVoice, reply } from './_shared.js'
import { clamp } from '../utils/format.js'

const SEARCH_PREFIX = {
  auto: '',
  youtube: 'ytsearch:',
  soundcloud: 'scsearch:',
  spotify: 'spsearch:',
  deezer: 'dzsearch:'
}

const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Phát nhạc theo tên bài hát hoặc link (YouTube, SoundCloud, Spotify, Deezer...)')
  .addStringOption((opt) =>
    opt
      .setName('query')
      .setDescription('Tên bài hát hoặc link trực tiếp')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption((opt) =>
    opt
      .setName('nguon')
      .setDescription('Chọn nguồn tìm kiếm (mặc định: tự động)')
      .addChoices(
        { name: 'Tự động', value: 'auto' },
        { name: 'YouTube', value: 'youtube' },
        { name: 'SoundCloud', value: 'soundcloud' },
        { name: 'Spotify', value: 'spotify' },
        { name: 'Deezer', value: 'deezer' }
      )
  )

/** Autocomplete: gợi ý kết quả tìm kiếm từ node */
async function autocomplete(interaction, ctx) {
  const focused = interaction.options.getFocused(true).find((o) => o.name === 'query')
  const value = (focused?.value ?? '').trim()
  if (value.length < 3) return interaction.respond([]).catch(() => {})

  try {
    const res = await ctx.nodelink.loadTracks(`ytsearch:${value}`)
    if (res.loadType !== 'search' || !Array.isArray(res.data)) {
      return interaction.respond([]).catch(() => {})
    }
    const options = res.data.slice(0, 5).map((track) => {
      const info = track.info ?? {}
      const uri = info.uri ?? ''
      return {
        name: clamp(`${info.title ?? 'Không rõ'} — ${info.author ?? ''}`, 95),
        value: uri.length > 0 && uri.length <= 100 ? uri : clamp(info.title ?? 'Không rõ', 95)
      }
    })
    await interaction.respond(options).catch(() => {})
  } catch {
    await interaction.respond([]).catch(() => {})
  }
}

/** Xây identifier cho loadtracks: URL thì giữ nguyên, text thì thêm prefix nguồn */
function buildIdentifier(query, source) {
  if (/^https?:\/\//i.test(query)) return query
  return `${SEARCH_PREFIX[source] || ''}${query}`
}

/** Xử lý kết quả loadtracks và thêm vào hàng đợi */
async function handleResult(interaction, ctx, player, res) {
  if (res.loadType === 'error') {
    return reply(interaction, `❌ Node báo lỗi khi tải nhạc: \`${res.data?.message ?? res.data?.cause ?? 'không rõ'}\``)
  }
  if (res.loadType === 'empty' || !res.data) {
    return reply(interaction, '🔍 Không tìm thấy kết quả nào. Thử đổi tên bài hoặc kiểm tra lại link nhé!')
  }

  if (res.loadType === 'search') {
    const track = res.data[0]
    if (!track) return reply(interaction, '🔍 Không tìm thấy kết quả nào.')
    return enqueueAndReply(interaction, ctx, player, [{ track }], null)
  }

  if (res.loadType === 'track') {
    return enqueueAndReply(interaction, ctx, player, [{ track: res.data }], null)
  }

  if (res.loadType === 'playlist') {
    const tracks = Array.isArray(res.data.tracks) ? res.data.tracks : []
    if (tracks.length === 0) return reply(interaction, '📂 Playlist này trống hoặc không tải được bài nào.')
    const info = res.data.info ?? {}
    // Nếu playlist có bài được chọn (bấm vào 1 bài trong playlist) -> phát bài đó trước
    const selected = info.selectedTrack ?? -1
    if (selected > 0) {
      const [chosen] = tracks.splice(selected, 1)
      if (chosen) tracks.unshift(chosen)
    }
    return enqueueAndReply(interaction, ctx, player, tracks.map((track) => ({ track })), info)
  }

  return reply(interaction, '🤔 Node trả về kiểu dữ liệu lạ, thử lại nhé!')
}

async function enqueueAndReply(interaction, ctx, player, entries, playlistInfo) {
  const requester = interaction.user
  const max = ctx.config.music.maxQueueSize
  const rejected = Math.max(0, player.queue.length + entries.length - max)
  const usable = entries.slice(0, Math.max(0, entries.length - rejected))
  if (usable.length === 0) {
    return reply(interaction, `📦 Hàng đợi đã đầy (tối đa ${max} bài).`)
  }

  for (const entry of usable) {
    player.addTrack(entry.track, requester)
  }
  if (player.shuffle) player.queue.sort(() => Math.random() - 0.5)

  const wasIdle = !player.current && !player.pendingTrack
  if (wasIdle) await player.startNext().catch(() => {})

  const embed = addedEmbed(player, usable, playlistInfo)
  await interaction.editReply({ embeds: [embed] })
  if (rejected > 0) {
    await announce(interaction.channel, `⚠️ Đã bỏ qua ${rejected} bài vì hàng đợi đạt giới hạn ${max} bài.`)
  }
}

async function execute(interaction, ctx) {
  const player = await ensureVoice(interaction, ctx)
  if (!player) return

  await interaction.deferReply()

  const query = interaction.options.getString('query', true).trim()
  const source = interaction.options.getString('nguon') ?? 'auto'
  const identifier = buildIdentifier(query, source)

  let res
  try {
    res = await ctx.nodelink.loadTracks(identifier)
  } catch (err) {
    return reply(interaction, `🛰️ Không gọi được NodeLink: \`${err.message}\``)
  }
  await handleResult(interaction, ctx, player, res)
}

export default { data: data.toJSON(), execute, autocomplete }
