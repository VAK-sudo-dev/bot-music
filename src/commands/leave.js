// /leave — dừng nhạc, xoá player và rời kênh thoại
import { SlashCommandBuilder } from 'discord.js'
import { ensureVoice, reply } from './_shared.js'

const data = new SlashCommandBuilder()
  .setName('leave')
  .setDescription('Cho bot rời khỏi kênh thoại (dừng nhạc + xoá hàng đợi)')

async function execute(interaction, ctx) {
  const memberVoice = interaction.member?.voice?.channel
  if (!memberVoice) return reply(interaction, '🎙️ Bạn cần vào một **kênh thoại** trước đã!')

  const botVoice = interaction.guild.members.me?.voice?.channel
  if (!botVoice) return reply(interaction, '💤 Mình đang không ở trong kênh thoại nào cả.')

  if (botVoice.id !== memberVoice.id) {
    return reply(interaction, '🚫 Bạn phải ở cùng kênh thoại với bot mới được yêu cầu mình out!')
  }

  const player = ctx.manager.players.get(interaction.guild.id)
  const cleared = player ? player.queue.length : 0
  await player?.destroy(true)
  await reply(interaction, `👋 Đã dừng nhạc${cleared > 0 ? ` và xoá ${cleared} bài` : ''}, mình out đây. Bye bye!`)
}

export default { data: data.toJSON(), execute }
