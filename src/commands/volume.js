// /volume — chỉnh âm lượng (0-1000)
import { SlashCommandBuilder } from 'discord.js'
import { ensureVoice, reply } from './_shared.js'

const data = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('Chỉnh âm lượng phát nhạc (0 - 1000, mặc định 100)')
  .addIntegerOption((opt) =>
    opt
      .setName('muc')
      .setDescription('Mức âm lượng (0-1000). Không nhập = xem mức hiện tại')
      .setMinValue(0)
      .setMaxValue(1000)
  )

async function execute(interaction, ctx) {
  const player = await ensureVoice(interaction, ctx)
  if (!player) return

  const level = interaction.options.getInteger('muc')
  if (level === null) {
    return reply(interaction, `🔊 Âm lượng hiện tại: **${player.volume}%**`)
  }

  await player.setVolume(level)
  const emoji = level === 0 ? '🔇' : level <= 50 ? '🔉' : level <= 150 ? '🔊' : '📢'
  const warn = level > 300 ? '\n⚠️ Âm lượng cao có thể gây rè và méo tiếng — cẩn thận tai nhé!' : ''
  await reply(interaction, `${emoji} Đã đặt âm lượng: **${level}%**${warn}`)
}

export default { data: data.toJSON(), execute }
