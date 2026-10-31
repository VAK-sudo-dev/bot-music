// /stop — dừng phát và xoá toàn bộ hàng đợi (bot ở lại kênh thoại)
import { SlashCommandBuilder } from 'discord.js'
import { ensureVoice, reply } from './_shared.js'

const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Dừng phát nhạc và xoá toàn bộ hàng đợi')

async function execute(interaction, ctx) {
  const player = await ensureVoice(interaction, ctx)
  if (!player) return
  if (!player.current && player.queue.length === 0) {
    return reply(interaction, '💤 Hàng đợi đang trống sẵn rồi!')
  }

  const count = player.queue.length
  await player.stop()
  await reply(interaction, `⏹️ Đã dừng phát và xoá **${count} bài** khỏi hàng đợi.\nMuốn mình out khỏi kênh thoại luôn? Dùng \`/leave\`!`)
}

export default { data: data.toJSON(), execute }
