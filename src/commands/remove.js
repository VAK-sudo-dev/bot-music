// /remove — xoá 1 bài khỏi hàng đợi (có autocomplete chọn bài)
import { SlashCommandBuilder } from 'discord.js'
import { ensureVoice, reply } from './_shared.js'
import { clamp } from '../utils/format.js'

const data = new SlashCommandBuilder()
  .setName('remove')
  .setDescription('Xoá một bài hát khỏi hàng đợi')
  .addIntegerOption((opt) =>
    opt
      .setName('so_thu_tu')
      .setDescription('Số thứ tự của bài trong /queue')
      .setRequired(true)
      .setMinValue(1)
      .setAutocomplete(true)
  )

async function autocomplete(interaction, ctx) {
  const focused = interaction.options.getFocused(true).find((o) => o.name === 'so_thu_tu')
  const value = Number(focused?.value ?? 0)
  if (!value || Number.isNaN(value)) return interaction.respond([]).catch(() => {})

  const player = ctx.manager.players.get(interaction.guild.id)
  if (!player) return interaction.respond([]).catch(() => {})

  // Gợi ý 25 bài bắt đầu từ vị trí người dùng đang gõ
  const start = Math.max(0, value - 1)
  const slice = player.queue.slice(start, start + 25)
  const options = slice.map((entry, i) => ({
    name: clamp(`${start + i + 1}. ${entry.track.info?.title ?? 'Không rõ'}`, 95),
    value: start + i + 1
  }))
  await interaction.respond(options).catch(() => {})
}

async function execute(interaction, ctx) {
  const player = await ensureVoice(interaction, ctx)
  if (!player) return

  const index = interaction.options.getInteger('so_thu_tu', true)
  const entry = player.queue[index - 1]
  if (!entry) {
    return reply(interaction, `❌ Không có bài ở vị trí **#${index}**. Xem lại bằng \`/queue\` nhé!`)
  }

  player.queue.splice(index - 1, 1)
  await reply(interaction, `🗑️ Đã xoá **${clamp(entry.track.info?.title ?? 'Không rõ', 80)}** khỏi hàng đợi.`)
}

export default { data: data.toJSON(), execute, autocomplete }
