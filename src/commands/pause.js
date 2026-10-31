// /pause — tạm dừng bài đang phát
import { SlashCommandBuilder } from 'discord.js'
import { ensureVoice, reply } from './_shared.js'

const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Tạm dừng bài hát đang phát')

async function execute(interaction, ctx) {
  const player = await ensureVoice(interaction, ctx)
  if (!player) return
  if (!player.current) return reply(interaction, '💤 Không có bài nào đang phát cả.')
  if (player.paused) return reply(interaction, '⏸️ Nhạc đang dừng sẵn rồi mà!')

  await player.setPaused(true)
  await reply(interaction, '⏸️ Đã tạm dừng. Gõ `/resume` hoặc bấm ▶️ để phát tiếp!')
}

export default { data: data.toJSON(), execute }
