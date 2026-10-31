// /shuffle — bật/tắt xáo trộn hàng đợi
import { SlashCommandBuilder } from 'discord.js'
import { ensureVoice, reply } from './_shared.js'

const data = new SlashCommandBuilder()
  .setName('shuffle')
  .setDescription('Bật/tắt xáo trộn hàng đợi')

async function execute(interaction, ctx) {
  const player = await ensureVoice(interaction, ctx)
  if (!player) return

  player.shuffle = !player.shuffle
  if (player.shuffle) {
    player.queue.sort(() => Math.random() - 0.5)
    await reply(interaction, `🔀 Đã **bật** xáo trộn! ${player.queue.length} bài trong hàng đợi đã được trộn lại.`)
  } else {
    await reply(interaction, '➡️ Đã **tắt** xáo trộn. Các bài mới sẽ được thêm theo thứ tự.')
  }
}

export default { data: data.toJSON(), execute }
