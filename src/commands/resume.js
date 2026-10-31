// /resume — phát tiếp bài đang dừng
import { SlashCommandBuilder } from 'discord.js'
import { ensureVoice, reply } from './_shared.js'

const data = new SlashCommandBuilder()
  .setName('resume')
  .setDescription('Phát tiếp bài hát đang bị tạm dừng')

async function execute(interaction, ctx) {
  const player = await ensureVoice(interaction, ctx)
  if (!player) return
  if (!player.current) return reply(interaction, '💤 Không có bài nào để phát tiếp. Dùng `/play` thêm nhạc nhé!')
  if (!player.paused) return reply(interaction, '▶️ Nhạc đang phát bình thường mà!')

  await player.setPaused(false)
  await reply(interaction, '▶️ Phát tiếp thôi!')
}

export default { data: data.toJSON(), execute }
