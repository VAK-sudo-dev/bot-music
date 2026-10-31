// /lyrics — lời bài hát đang phát (qua /v4/loadlyrics của NodeLink)
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import { ensureVoice, reply } from './_shared.js'
import { clamp, sourceLabel } from '../utils/format.js'

const data = new SlashCommandBuilder()
  .setName('lyrics')
  .setDescription('Xem lời bài hát đang phát')

async function execute(interaction, ctx) {
  const player = await ensureVoice(interaction, ctx)
  if (!player) return
  if (!player.current) return reply(interaction, '💤 Không có bài nào đang phát cả.')

  await interaction.deferReply()
  const info = player.current.track.info

  try {
    const res = await ctx.nodelink.loadLyrics(player.current.track.encoded)
    if (!res || res.loadType !== 'lyrics' || !res.data) {
      return reply(interaction, '🔍 Không tìm thấy lời cho bài này (bài live/radio thường không có lyrics).')
    }

    const data = res.data
    let text = ''
    if (typeof data.text === 'string' && data.text.trim()) {
      text = data.text.trim()
    } else if (Array.isArray(data.lines)) {
      text = data.lines.map((line) => line.text ?? line.line ?? '').join('\n').trim()
    }
    if (!text) return reply(interaction, '🔍 Node tìm thấy bản ghi lyrics nhưng nội dung trống.')

    const truncated = text.length > 3900
    if (truncated) text = `${text.slice(0, 3900)}…`

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📃 Lời bài hát: ${clamp(info.title ?? 'Không rõ', 200)}`)
      .setDescription(text)
      .setFooter({ text: `Nguồn lời: ${data.provider ?? 'NodeLink'} • ${sourceLabel(info.sourceName)}${truncated ? ' • (đã rút gọn)' : ''}` })
    if (info.artworkUrl) embed.setThumbnail(info.artworkUrl)

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ embeds: [embed] }).catch(() => {})
    } else {
      await interaction.reply({ embeds: [embed] }).catch(() => {})
    }
  } catch (err) {
    await reply(interaction, `🛰️ Không tải được lyrics: \`${err.message}\``)
  }
}

export default { data: data.toJSON(), execute }
