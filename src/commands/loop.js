// /loop — lặp lại: tắt / 1 bài / cả hàng đợi
import { SlashCommandBuilder } from 'discord.js'
import { ensureVoice, reply } from './_shared.js'

const data = new SlashCommandBuilder()
  .setName('loop')
  .setDescription('Bật chế độ lặp lại nhạc')
  .addStringOption((opt) =>
    opt
      .setName('che_do')
      .setDescription('Chế độ lặp')
      .setRequired(true)
      .addChoices(
        { name: 'Tắt lặp', value: 'off' },
        { name: 'Lặp 1 bài', value: 'track' },
        { name: 'Lặp cả hàng đợi', value: 'queue' }
      )
  )

const MESSAGES = {
  off: '🔁 Đã **tắt** chế độ lặp.',
  track: '🔂 Đã bật **lặp 1 bài** — bài này sẽ phát đi phát lại.',
  queue: '🔁 Đã bật **lặp hàng đợi** — phát xong sẽ quay lại từ đầu.'
}

async function execute(interaction, ctx) {
  const player = await ensureVoice(interaction, ctx)
  if (!player) return
  const mode = interaction.options.getString('che_do', true)
  player.loopMode = mode
  await reply(interaction, MESSAGES[mode])
}

export default { data: data.toJSON(), execute }
