// /nowplaying — bài đang phát + tiến trình
import { SlashCommandBuilder } from 'discord.js'
import { nowPlayingEmbed } from '../ui/embeds.js'
import { ensureVoice, reply } from './_shared.js'

const data = new SlashCommandBuilder()
  .setName('nowplaying')
  .setDescription('Xem bài hát đang phát và thanh tiến trình')

async function execute(interaction, ctx) {
  const player = await ensureVoice(interaction, ctx)
  if (!player) return
  const embed = nowPlayingEmbed(player)
  if (!embed) return reply(interaction, '💤 Không có bài nào đang phát cả.')

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp({ embeds: [embed] }).catch(() => {})
  } else {
    await interaction.reply({ embeds: [embed] }).catch(() => {})
  }
}

export default { data: data.toJSON(), execute }
