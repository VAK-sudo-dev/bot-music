// /queue — xem hàng đợi có phân trang bằng nút bấm
import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js'
import { queueEmbed } from '../ui/embeds.js'
import { ensureVoice, reply } from './_shared.js'

const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Xem hàng đợi nhạc của server')
  .addIntegerOption((opt) =>
    opt.setName('trang').setDescription('Số trang muốn xem').setMinValue(1).setMaxValue(100)
  )

async function execute(interaction, ctx) {
  const player = await ensureVoice(interaction, ctx)
  if (!player) return
  if (!player.current && player.queue.length === 0) {
    return reply(interaction, '💤 Hàng đợi trống. Thêm nhạc bằng `/play` nhé!')
  }

  await interaction.deferReply()
  let page = interaction.options.getInteger('trang') ?? 1

  const row = () => {
    const embed = queueEmbed(player, page)
    const pages = Number(embed.data.footer?.text?.match(/Trang (\d+)\/(\d+)/)?.[2] ?? 1)
    return {
      embed,
      row: new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('q:prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
        new ButtonBuilder().setCustomId('q:next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= pages)
      )
    }
  }

  const first = row()
  const message = await interaction.editReply({ embeds: [first.embed], components: [first.row] })

  const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, idle: 120_000 })
  collector.on('collect', async (i) => {
    if (i.customId === 'q:prev') page -= 1
    if (i.customId === 'q:next') page += 1
    const next = row()
    await i.update({ embeds: [next.embed], components: [next.row] }).catch(() => {})
  })
  collector.on('end', async () => {
    try {
      const last = row()
      last.row.components.forEach((b) => b.setDisabled(true))
      await message.edit({ components: [last.row] })
    } catch {
      /* bỏ qua */
    }
  })
}

export default { data: data.toJSON(), execute }
