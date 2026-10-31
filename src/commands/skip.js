// /skip — bỏ qua 1 hoặc nhiều bài
import { SlashCommandBuilder } from 'discord.js'
import { ensureVoice, reply } from './_shared.js'

const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Bỏ qua bài hát đang phát')
  .addIntegerOption((opt) =>
    opt
      .setName('so_bai')
      .setDescription('Số bài muốn bỏ qua (mặc định: 1)')
      .setMinValue(1)
      .setMaxValue(100)
  )

async function execute(interaction, ctx) {
  const player = await ensureVoice(interaction, ctx)
  if (!player) return
  if (!player.current && player.queue.length === 0) {
    return reply(interaction, '💤 Không có gì để bỏ qua — hàng đợi đang trống!')
  }

  const amount = interaction.options.getInteger('so_bai') ?? 1

  if (amount > 1) {
    // Bỏ qua N-1 bài đầu trong hàng đợi, rồi skip bài đang phát
    const removed = player.queue.splice(0, Math.min(amount - 1, player.queue.length))
    await reply(interaction, `⏭️ Đã bỏ qua ${removed.length + 1} bài!`)
  }

  const ok = await player.skip()
  if (ok && amount === 1) await reply(interaction, '⏭️ Đã bỏ qua bài hiện tại!')
}

export default { data: data.toJSON(), execute }
