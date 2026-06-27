const mineflayer = require('mineflayer');
const fs = require('fs');
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionsBitField,
  Collection
} = require('discord.js');

// ================= OWNER =================
const OWNER_ID = "1221550661263429787";

// ================= CONFIG =================
const ADMIN_CHANNEL_ID = "1519954672994226196";
const PUBLIC_CHANNEL_ID = "1519685707709550622";
const REQUEST_CHANNEL_ID = "1520173000312488146";
const TICKET_CHANNEL_ID = "ايدي_روم_التذاكر_هنا"1502364295319785652ا
const TICKET_CATEGORY_ID = "1502293033226604725";
const LOG_CHANNEL_ID = "1520181215859183888";
const ADMIN_ROLE_ID = "ايدي_رتبة_الادمن_هنا"1519690375273386024ا

// ================= DATA =================
const FILE = "./allowed.json";

let allowedPlayers = new Set();

if (fs.existsSync(FILE)) {
  try {
    allowedPlayers = new Set(JSON.parse(fs.readFileSync(FILE)));
  } catch {
    allowedPlayers = new Set();
  }
}

function saveAllowed() {
  fs.writeFileSync(FILE, JSON.stringify([...allowedPlayers]));
}

function isOwner(msg) {
  return msg.author.id === OWNER_ID;
}

// ================= BOT =================
let bot;
let statusMessage = null;
let statusInterval = null;
let ticketMessage = null;
const tickets = new Collection();
const mentionMap = new Collection();
const bans = new Collection();

function humanMovement() {
  if (!bot || !bot.entity) return;

  const actions = ["forward", "back", "left", "right"];
  const action = actions[Math.floor(Math.random() * actions.length)];

  bot.clearControlStates();
  bot.setControlState(action, true);

  setTimeout(() => {
    bot.clearControlStates();
  }, 1500 + Math.random() * 2500);

  setTimeout(() => {
    bot.look(
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.5
    );
  }, 1000);

  if (Math.random() > 0.92) {
    bot.setControlState('jump', true);
    setTimeout(() => bot.setControlState('jump', false), 300);
  }
}

async function updateServerStatus() {
  try {
    const channel = client.channels.cache.get(PUBLIC_CHANNEL_ID);
    if (!channel) return;

    const players = Object.keys(bot?.players || {});
    const count = players.length;
    const maxPlayers = 20;

    let statusText = "";
    let color = 0x00FF00;

    if (count === 0) {
      statusText = "🟢 السيرفر فاضي";
      color = 0x00FF00;
    } else if (count <= 5) {
      statusText = `🟢 اللاعبين ${count}`;
      color = 0x00FF00;
    } else if (count <= 10) {
      statusText = `🟡 عدد اللاعبين ${count}`;
      color = 0xFFFF00;
    } else if (count <= 15) {
      statusText = `🟠 عدد اللاعبين ${count}`;
      color = 0xFFA500;
    } else {
      statusText = `🔴 السيرفر مزدحم (${count})`;
      color = 0xFF0000;
    }

    const embed = new EmbedBuilder()
      .setTitle("🎮 𝗜𝗿𝗮𝗾 𝗕𝗮𝗯𝘆𝗹𝗼𝗻 𝗦𝗠𝗣")
      .setDescription(`**${statusText}**`)
      .setColor(color)
      .addFields(
        { name: "👥 عدد اللاعبين", value: `${count} / ${maxPlayers}`, inline: true },
        { name: "📊 الحالة", value: count >= maxPlayers ? "❌ ممتلئ" : "✅ متاح", inline: true },
        { name: "🕒 آخر تحديث", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: false }
      )
      .setFooter({ text: "𝗜𝗿𝗮𝗾 𝗕𝗮𝗯𝘆𝗹𝗼𝗻 𝗦𝗠𝗣" })
      .setTimestamp();

    if (count > 0 && count <= 10) {
      embed.addFields({ 
        name: "👥 اللاعبين المتصلين", 
        value: players.join("\n"), 
        inline: false 
      });
    } else if (count > 10) {
      embed.addFields({ 
        name: "👥 اللاعبين المتصلين", 
        value: players.slice(0, 10).join("\n") + `\nو ${count - 10} آخرين...`, 
        inline: false 
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("request_ip")
        .setLabel("🔐 طلب الآيبي")
        .setStyle(ButtonStyle.Primary)
    );

    if (statusMessage) {
      await statusMessage.edit({ embeds: [embed], components: [row] });
    } else {
      statusMessage = await channel.send({ embeds: [embed], components: [row] });
    }

  } catch (e) {
    console.log("⚠️ خطأ في تحديث الحالة:", e.message);
  }
}

function startBot() {

  console.log("⏳ محاولة الاتصال بالسيرفر...");

  try {

    bot = mineflayer.createBot({
      host: process.env.MC_HOST,
      port: parseInt(process.env.MC_PORT) || 25565,
      username: "IraqBabylonSMP",
      auth: 'offline',
      version: "1.20.4",
      hideErrors: true,
      logErrors: false,
      checkTimeoutInterval: 120000,
      keepAlive: true,
      keepAliveInterval: 20000
    });

    bot.on('spawn', () => {
      console.log("🟢 Bot Online - IraqBabylonSMP");
      setInterval(humanMovement, 4000 + Math.random() * 2000);
      
      setTimeout(() => updateServerStatus(), 5000);
      if (statusInterval) clearInterval(statusInterval);
      statusInterval = setInterval(updateServerStatus, 300000);
    });

    bot.on('playerJoined', (p) => {

      const name = p.username.toLowerCase();

      if (!allowedPlayers.has(name)) {
        setTimeout(() => {
          try {
            bot.chat(`/kick ${p.username} ❌ غير مفعل`);
          } catch (e) {
            console.log("❌ خطأ في الطرد:", e.message);
          }
        }, 2000);
      }
    });

    bot.on('chat', (user, msg) => {

      const text = msg.toLowerCase();

      const ai = {
        "hi": "هلا 👋",
        "hello": "أهلاً 😄",
        "gg": "GG 🔥",
        "bye": "باي 👋",
        "شلونك": "تمام وانت؟ 😄"
      };

      if (ai[text]) {
        setTimeout(() => {
          try {
            bot.chat(ai[text]);
          } catch (e) {
            console.log("❌ خطأ في الرد:", e.message);
          }
        }, 1200);
      }
    });

    bot.on('end', () => {
      console.log("🔄 Reconnecting in 10 seconds...");
      setTimeout(startBot, 10000);
    });

    bot.on('kicked', (r) => {
      console.log("❌ Kicked:", r);
      if (typeof r === 'string' && r.includes('Connection throttled')) {
        console.log("⏳ انتظر 3 دقائق...");
        setTimeout(startBot, 180000);
      } else {
        setTimeout(startBot, 10000);
      }
    });

    bot.on('error', (e) => {
      console.log("⚠️ Error:", e.message);
      if (e.message.includes('ECONNRESET')) {
        console.log("⏳ انتظر دقيقتين...");
        setTimeout(startBot, 120000);
      } else {
        setTimeout(startBot, 10000);
      }
    });

  } catch (e) {
    console.log("💥 Crash:", e.message);
    setTimeout(startBot, 10000);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences
  ]
});

client.once('ready', async () => {

  console.log("Discord Ready");

  // ================= إرسال رسالة التذكرة عند بدء البوت =================
  setTimeout(async () => {
    const channel = client.channels.cache.get(TICKET_CHANNEL_ID);
    if (!channel) return;

    const messages = await channel.messages.fetch({ limit: 10 });
    const oldMessage = messages.find(m => m.author.id === client.user.id && m.components.length > 0);

    if (oldMessage) {
      ticketMessage = oldMessage;
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎫 نظام التذاكر')
      .setDescription('اختر نوع طلبك من الأزرار بالأسفل')
      .setColor(0x00FF00)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_bans')
        .setLabel('🔨 الباندات')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔨'),
      new ButtonBuilder()
        .setCustomId('ticket_issues')
        .setLabel('🐛 مشاكل برمجية')
        .setStyle(ButtonStyle.Warning)
        .setEmoji('🐛'),
      new ButtonBuilder()
        .setCustomId('ticket_question')
        .setLabel('❓ استفسار')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('❓')
    );

    ticketMessage = await channel.send({ embeds: [embed], components: [row] });
  }, 5000);

  // ================= أوامر عامة (للكل) =================
  client.on('messageCreate', (msg) => {

    if (msg.author.bot) return;
    if (msg.channel.id !== PUBLIC_CHANNEL_ID) return;

    const content = msg.content.toLowerCase();

    if (content.includes("السيرفر شغال") || content.includes("سيرفر شغال") || content === "server") {

      const players = Object.keys(bot?.players || {});
      const count = players.length;
      const maxPlayers = 20;

      let statusText = "";
      let color = 0x00FF00;

      if (count === 0) {
        statusText = "🟢 السيرفر فاضي";
        color = 0x00FF00;
      } else if (count <= 5) {
        statusText = `🟢 اللاعبين ${count}`;
        color = 0x00FF00;
      } else if (count <= 10) {
        statusText = `🟡 عدد اللاعبين ${count}`;
        color = 0xFFFF00;
      } else if (count <= 15) {
        statusText = `🟠 عدد اللاعبين ${count}`;
        color = 0xFFA500;
      } else {
        statusText = `🔴 السيرفر مزدحم (${count})`;
        color = 0xFF0000;
      }

      const embed = new EmbedBuilder()
        .setTitle("🎮 𝗜𝗿𝗮𝗾 𝗕𝗮𝗯𝘆𝗹𝗼𝗻 𝗦𝗠𝗣")
        .setDescription(`**${statusText}**`)
        .setColor(color)
        .addFields(
          { name: "👥 عدد اللاعبين", value: `${count} / ${maxPlayers}`, inline: true },
          { name: "📊 الحالة", value: count >= maxPlayers ? "❌ ممتلئ" : "✅ متاح", inline: true },
          { name: "🕒 آخر تحديث", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: false }
        )
        .setFooter({ text: "𝗜𝗿𝗮𝗾 𝗕𝗮𝗯𝘆𝗹𝗼𝗻 𝗦𝗠𝗣" })
        .setTimestamp();

      if (count > 0 && count <= 10) {
        embed.addFields({ 
          name: "👥 اللاعبين المتصلين", 
          value: players.join("\n"), 
          inline: false 
        });
      } else if (count > 10) {
        embed.addFields({ 
          name: "👥 اللاعبين المتصلين", 
          value: players.slice(0, 10).join("\n") + `\nو ${count - 10} آخرين...`, 
          inline: false 
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("request_ip")
          .setLabel("🔐 طلب الآيبي")
          .setStyle(ButtonStyle.Primary)
      );

      return msg.reply({ embeds: [embed], components: [row] });
    }
  });

  // ================= أوامر المالك (في الروم المخفي) =================
  client.on('messageCreate', (msg) => {

    if (msg.channel.id !== ADMIN_CHANNEL_ID) return;
    if (!msg.content.startsWith("!")) return;
    if (!isOwner(msg)) return;

    const args = msg.content.split(" ");
    const cmd = args[0];

    if (cmd === "!لوحة") {

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("تشغيل")
          .setLabel("🟢 تشغيل")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("ايقاف")
          .setLabel("🔴 إيقاف")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId("حالة")
          .setLabel("📊 حالة")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("ادارة")
          .setLabel("🛡️ الإدارة")
          .setStyle(ButtonStyle.Secondary)
      );

      return msg.reply({ content: "🎛️ لوحة التحكم", components: [row] });
    }

    if (cmd === "!تفعيل") {
      const name = args[1]?.toLowerCase();
      if (!name) return;
      allowedPlayers.add(name);
      saveAllowed();
      return msg.reply(`✅ تم تفعيل: ${name}`);
    }

    if (cmd === "!الغاء") {
      const name = args[1]?.toLowerCase();
      if (!name) return;
      allowedPlayers.delete(name);
      saveAllowed();
      return msg.reply(`❌ تم إلغاء: ${name}`);
    }

    if (cmd === "!say") {
      const text = msg.content.slice(5);
      try {
        bot?.chat(text);
        return msg.reply("💬 تم الإرسال");
      } catch (e) {
        return msg.reply("❌ البوت غير متصل");
      }
    }

    if (cmd === "!restart") {
      bot?.end();
      return msg.reply("🔄 إعادة تشغيل...");
    }

    if (cmd === "!المفعلين") {
      return msg.reply([...allowedPlayers].join(", ") || "فارغ");
    }

    if (cmd === "!تحديث") {
      updateServerStatus();
      return msg.reply("✅ تم تحديث الحالة");
    }

    if (cmd === "!اعادة_تعيين_منشن" || cmd === "!reset_mention") {
      mentionMap.clear();
      return msg.reply("✅ تم إعادة تعيين منشنات الإدارة للجميع!");
    }
  });

  // ================= الأزرار =================
  client.on('interactionCreate', async (i) => {

    // ================= أزرار التذاكر =================
    if (i.customId === 'ticket_bans' || i.customId === 'ticket_issues' || i.customId === 'ticket_question') {
      
      const ticketTypes = {
        'ticket_bans': { title: '🔨 الباندات', color: 0xFF0000, emoji: '🔨' },
        'ticket_issues': { title: '🐛 مشاكل برمجية', color: 0xFFA500, emoji: '🐛' },
        'ticket_question': { title: '❓ استفسار', color: 0x00FF00, emoji: '❓' }
      };

      const type = ticketTypes[i.customId];
      if (!type) return;

      const userTickets = tickets.filter(t => t.userId === i.user.id);
      if (userTickets.size >= 3) {
        return i.reply({
          content: '❌ لديك 3 تذاكر مفتوحة، أغلقتها أولاً!',
          ephemeral: true
        });
      }

      const channel = await i.guild.channels.create({
        name: `${type.emoji}-${i.user.username}`,
        type: ChannelType.GuildText,
        parent: TICKET_CATEGORY_ID,
        permissionOverwrites: [
          {
            id: i.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: i.user.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
          },
          {
            id: i.client.user.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
          }
        ]
      });

      tickets.set(channel.id, { userId: i.user.id, channelId: channel.id, type: i.customId });

      const embed = new EmbedBuilder()
        .setTitle(`${type.emoji} ${type.title}`)
        .setDescription(`**المستخدم:** ${i.user}\n**نوع التذكرة:** ${type.title}`)
        .setColor(type.color)
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('🔒 إغلاق التذكرة')
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({ embeds: [embed], components: [row] });
      await i.reply({ content: `✅ تم فتح التذكرة: ${channel}`, ephemeral: true });
    }

    // ================= إغلاق التذكرة =================
    if (i.customId === "close_ticket") {

      if (!i.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return i.reply({
          content: '❌ فقط الأدمن يقدر يغلق التذكرة!',
          ephemeral: true
        });
      }

      const channel = i.channel;
      
      const embed = new EmbedBuilder()
        .setTitle('🔒 إغلاق التذكرة')
        .setDescription('سيتم حذف هذه التذكرة خلال 5 ثواني...')
        .setColor(0xFF0000)
        .setTimestamp();

      await i.reply({ embeds: [embed] });

      setTimeout(() => {
        channel.delete();
        tickets.delete(channel.id);
      }, 5000);
    }

    // ================= زر طلب الآيبي =================
    if (i.customId === "request_ip") {

      if (i.channelId !== PUBLIC_CHANNEL_ID) {
        return i.reply({
          content: "❌ هذا الروم غير مخصص للطلبات.",
          ephemeral: true
        });
      }

      const requestChannel = client.channels.cache.get(REQUEST_CHANNEL_ID);
      if (requestChannel) {

        const requestEmbed = new EmbedBuilder()
          .setTitle("🔐 طلب آيبي جديد")
          .setDescription(`**${i.user.username}** يطلب آيبي السيرفر!`)
          .setColor(0xFFA500)
          .addFields(
            { name: "👤 المستخدم", value: `${i.user}`, inline: true },
            { name: "🆔 الأيدي", value: `\`${i.user.id}\``, inline: true },
            { name: "📅 الوقت", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
          )
          .setFooter({ text: "اضغط على زر الرد لإرسال الآيبي" })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`reply_ip_${i.user.id}`)
            .setLabel("📩 رد على الطلب")
            .setStyle(ButtonStyle.Success)
        );

        await requestChannel.send({ embeds: [requestEmbed], components: [row] });
      }

      return i.reply({
        content: "✅ تم إرسال طلبك! سيتم التواصل معك قريباً.",
        ephemeral: true
      });
    }

    // ================= زر الرد على الطلب (للمالك فقط) =================
    if (i.customId.startsWith("reply_ip_")) {

      if (i.user.id !== OWNER_ID) {
        return i.reply({
          content: "❌ ممنوع، هذا الزر للمالك فقط.",
          ephemeral: true
        });
      }

      const userId = i.customId.replace("reply_ip_", "");
      const user = await client.users.fetch(userId).catch(() => null);

      if (!user) {
        return i.reply({
          content: "❌ المستخدم غير موجود.",
          ephemeral: true
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`send_ip_${userId}`)
        .setTitle("📩 إرسال الآيبي");

      const input = new TextInputBuilder()
        .setCustomId("ip_input")
        .setLabel("اكتب آيبي السيرفر هنا")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(`مثال: 194.45.197.219:30130`)
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      return i.showModal(modal);
    }

    // ================= معالجة إرسال الآيبي =================
    if (i.isModalSubmit() && i.customId.startsWith("send_ip_")) {

      if (i.user.id !== OWNER_ID) {
        return i.reply({
          content: "❌ ممنوع",
          ephemeral: true
        });
      }

      const userId = i.customId.replace("send_ip_", "");
      const user = await client.users.fetch(userId).catch(() => null);
      const ip = i.fields.getTextInputValue("ip_input");

      if (!user) {
        return i.reply({
          content: "❌ المستخدم غير موجود.",
          ephemeral: true
        });
      }

      try {
        await user.send({
          content: `🎮 **آيبي السيرفر:**\n\`${ip}\``
        });

        await i.reply({
          content: `✅ تم إرسال الآيبي إلى ${user.username}`,
          ephemeral: true
        });

        const requestChannel = client.channels.cache.get(REQUEST_CHANNEL_ID);
        if (requestChannel) {
          await requestChannel.send({
            content: `✅ **تم إرسال الآيبي** إلى ${user} بواسطة ${i.user}`
          });
        }

      } catch (e) {
        await i.reply({
          content: `❌ خطأ: المستخدم عنده الخاصية مقفلة.`,
          ephemeral: true
        });
      }
    }

    // ================= باقي الأزرار (للمالك فقط) =================
    if (i.channelId !== ADMIN_CHANNEL_ID) {
      if (i.customId !== "request_ip" && !i.customId.startsWith("ticket_") && i.customId !== "close_ticket") {
        return i.reply({
          content: "❌ هذا الروم غير مخصص للتحكم",
          ephemeral: true
        });
      }
      return;
    }

    if (i.user.id !== OWNER_ID) {
      return i.reply({
        content: "❌ ممنوع",
        ephemeral: true
      });
    }

    if (i.isButton()) {

      if (i.customId === "تشغيل") {
        bot?.setControlState("forward", true);
        return i.reply("🟢 البوت شغال");
      }

      if (i.customId === "ايقاف") {
        bot?.clearControlStates();
        return i.reply("🔴 البوت متوقف");
      }

      if (i.customId === "حالة") {
        const count = Object.keys(bot?.players || {}).length;
        return i.reply(`📊 اللاعبين: ${count}/20`);
      }

      if (i.customId === "ادارة") {

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("players")
            .setLabel("👥 اللاعبين")
            .setStyle(ButtonStyle.Primary),

          new ButtonBuilder()
            .setCustomId("tp")
            .setLabel("📥 سحب")
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId("goto")
            .setLabel("📍 انتقال")
            .setStyle(ButtonStyle.Success),

          new ButtonBuilder()
            .setCustomId("kick")
            .setLabel("👢 طرد")
            .setStyle(ButtonStyle.Danger),

          new ButtonBuilder()
            .setCustomId("ban")
            .setLabel("🔨 باند")
            .setStyle(ButtonStyle.Danger)
        );

        return i.reply({
          content: "🛡️ قائمة الإدارة",
          components: [row],
          ephemeral: true
        });
      }

      if (i.customId === "players") {
        if (!bot) {
          return i.reply({ content: "❌ بوت ماينكرافت غير شغال.", ephemeral: true });
        }
        const players = Object.keys(bot.players || {});
        return i.reply({
          content: players.length
            ? "👥 اللاعبين المتصلين:\n\n" + players.join("\n")
            : "❌ لا يوجد لاعبين متصلين.",
          ephemeral: true
        });
      }

      if (["tp", "goto", "kick", "ban"].includes(i.customId)) {
        if (!bot) {
          return i.reply({ content: "❌ بوت ماينكرافت غير شغال.", ephemeral: true });
        }
        const players = Object.keys(bot.players || {});
        if (players.length === 0) {
          return i.reply({ content: "❌ لا يوجد لاعبين متصلين.", ephemeral: true });
        }

        const select = new StringSelectMenuBuilder()
          .setCustomId(i.customId + "_select")
          .setPlaceholder({
            "tp": "📥 اختر لاعب للسحب",
            "goto": "📍 اختر لاعب للانتقال",
            "kick": "👢 اختر لاعب للطرد",
            "ban": "🔨 اختر لاعب للباند"
          }[i.customId])
          .addOptions(players.map(name => ({ label: name, value: name })));

        const row = new ActionRowBuilder().addComponents(select);

        return i.reply({
          content: `اختر اللاعب:`,
          components: [row],
          ephemeral: true
        });
      }
    }

    if (i.isStringSelectMenu()) {

      const selected = i.values[0];
      const action = {
        "tp_select": `/tp ${selected}`,
        "goto_select": `/tp ${process.env.MC_USERNAME} ${selected}`,
        "kick_select": `/kick ${selected}`,
        "ban_select": `/ban ${selected}`
      }[i.customId];

      const response = {
        "tp_select": `✅ تم سحب ${selected}`,
        "goto_select": `✅ تم الانتقال إلى ${selected}`,
        "kick_select": `✅ تم طرد ${selected}`,
        "ban_select": `✅ تم باند ${selected}`
      }[i.customId];

      if (!action || !response) {
        return i.reply({ content: "❌ أمر غير معروف", ephemeral: true });
      }

      try {
        bot.chat(action);
        return i.reply({ content: response, ephemeral: true });
      } catch (e) {
        return i.reply({ content: `❌ خطأ: ${e.message}`, ephemeral: true });
      }
    }
  });

  // =====================================================
  // ================= منشن الإدارة =================
  // =====================================================

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    const adminRole = message.guild.roles.cache.get(ADMIN_ROLE_ID);
    if (!adminRole) return;

    if (!message.mentions.roles.has(adminRole.id)) return;

    const userId = message.author.id;
    const member = message.member;

    const count = mentionMap.get(userId) || 0;
    const newCount = count + 1;
    mentionMap.set(userId, newCount);

    if (newCount === 1) {
      const embed = new EmbedBuilder()
        .setTitle('🔔 منشن الإدارة')
        .setDescription(`**المستخدم:** ${message.author}\n**الرسالة:** ${message.content}`)
        .setColor(0xFFFF00)
        .setTimestamp();
      
      await message.channel.send({ embeds: [embed] });
      
      const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('🔔 منشن الإدارة')
          .setDescription(`**المستخدم:** ${message.author.tag}`)
          .setColor(0xFFFF00)
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }
      return;
    }

    if (newCount === 2) {
      await message.delete();
      
      const embed = new EmbedBuilder()
        .setTitle('⚠️ تحذير')
        .setDescription(`**${message.author}**، هذا تحذيرك الأول! لا تكرر منشن الإدارة.`)
        .setColor(0xFFA500)
        .setTimestamp();
      
      await message.channel.send({ embeds: [embed] });
      
      const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('⚠️ تحذير')
          .setDescription(`**المستخدم:** ${message.author.tag}\n**السبب:** تكرار منشن الإدارة (المرة الثانية)`)
          .setColor(0xFFA500)
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }
      return;
    }

    if (newCount === 3) {
      await message.delete();
      
      const embed = new EmbedBuilder()
        .setTitle('⚠️ تحذير')
        .setDescription(`**${message.author}**، هذا تحذيرك الثاني! المرة القادمة راح تاخذ تايم أوت.`)
        .setColor(0xFF6600)
        .setTimestamp();
      
      await message.channel.send({ embeds: [embed] });
      
      const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('⚠️ تحذير')
          .setDescription(`**المستخدم:** ${message.author.tag}\n**السبب:** تكرار منشن الإدارة (المرة الثالثة)`)
          .setColor(0xFF6600)
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }
      return;
    }

    if (newCount === 4) {
      await message.delete();
      
      const embed = new EmbedBuilder()
        .setTitle('⚠️ تحذير أخير')
        .setDescription(`**${message.author}**، هذا تحذيرك الأخير! المرة القادمة راح تاخذ تايم أوت.`)
        .setColor(0xFF0000)
        .setTimestamp();
      
      await message.channel.send({ embeds: [embed] });
      
      const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('⚠️ تحذير أخير')
          .setDescription(`**المستخدم:** ${message.author.tag}\n**السبب:** تكرار منشن الإدارة (المرة الرابعة)`)
          .setColor(0xFF0000)
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }
      return;
    }

    if (newCount >= 5) {
      await message.delete();
      
      try {
        await member.timeout(60000, 'تكرار منشن الإدارة');
        
        const embed = new EmbedBuilder()
          .setTitle('⏰ تايم أوت')
          .setDescription(`**${message.author}** تم تايم أوت لمدة دقيقة بسبب تكرار منشن الإدارة.`)
          .setColor(0xFF0000)
          .setTimestamp();
        
        await message.channel.send({ embeds: [embed] });
        
        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setTitle('⏰ تايم أوت')
            .setDescription(`**المستخدم:** ${message.author.tag}\n**السبب:** تكرار منشن الإدارة (المرة الخامسة)\n**المدة:** دقيقة`)
            .setColor(0xFF0000)
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] });
        }
      } catch (e) {
        console.log('❌ خطأ في تايم أوت:', e.message);
      }
      return;
    }
  });

  // ================= عندما يدخل عضو جديد (منشن التذكرة) =================
  client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) return;

    const channel = member.guild.channels.cache.get(TICKET_CHANNEL_ID);
    if (!channel) return;

    if (ticketMessage) {
      await channel.send({ content: member.toString() });
    }
  });

});

client.login(process.env.DISCORD_TOKEN);
setTimeout(startBot, 10000);
