// /help — danh sách lệnh + thông tin node
import { SlashCommandBuilder } from 'discord.js'
import { helpEmbed } from '../ui/embeds.js'

const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Xem danh sách lệnh và hướng dẫn sử dụng bot nhạc')

async function execute(interaction, ctx) {
  if (!interaction.guild) {
    return interaction.reply({ content: '🤖 Lệnh này chỉ dùng trong server nhé!', ephemeral: true })
  }
  // Ghi nhớ kênh thông báo nếu đã có player cho guild này
  const player = ctx.manager.players.get(interaction.guild.id)
  if (player) player.textChannelId = interaction.channelId

  const embed = helpEmbed(ctx.nodeInfo)
  await interaction.reply({ embeds: [embed] })
}

export default { data: data.toJSON(), execute }
