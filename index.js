require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const {
  joinVoiceChannel,
  entersState,
  VoiceConnectionStatus,
  getVoiceConnection
} = require('@discordjs/voice');

// ================= CONFIG =================
const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = "1221550661263429787";

console.log('🔍 جاري التحقق من التوكن...');
console.log('📌 DISCORD_TOKEN:', TOKEN ? '✅ موجود' : '❌ غير موجود');

// ================= رومات =================
const LOG_CHANNEL_ID = "1520181215859183888";
const MOD_CHANNEL_ID = "1502361550676168704";
const TICKET_CATEGORY_ID = "1502293033226604725";
const TICKET_CHANNEL_ID = "1502364295319785652"; // روم التذاكر الرئيسي
const ADMIN_ROLE_ID = "1502292895049449502";
const STATS_CHANNEL_ID = "1520181215859183888";
const VOICE_CHANNEL_ID = "1502293174218002575";

// ================= الإعدادات =================
const MAX_MESSAGES = 5;
const TIME_WINDOW = 5000;
const MAX_MENTIONS = 3;
const MAX_EMOJIS = 10;
const TIMEOUT_DURATION = 3600000;
const TICKET_COOLDOWN = 3600000; // ساعة كاملة

// ================= الكلمات المحظورة =================
const BAD_WORDS = [
  'كلمة_محظورة1',
  'كلمة_محظورة2',
  'كلمة_محظورة3'
];

// ================= الروابط الممنوعة =================
const FORBIDDEN_LINKS = [
  'discord.gg',
  'discord.com/invite',
  'tenor.com',
  'giphy.com'
];

// ================= CLIENT =================
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

// ================= المتغيرات =================
const spamMap = new Collection();
const tickets = new Collection();
const backups = new Collection();
const mentionMap = new Collection();
const ticketCooldown = new Collection();
let isInVoice = false;
let ticketMessage = null;

// ================= عندما يكون البوت جاهز =================
client.once('ready', async () => {
  console.log(`🟢 ${client.user.tag} Online - Security Bot`);
  client.user.setActivity('🛡️ حماية السيرفر', { type: 'WATCHING' });
  
  setInterval(updateStats, 3600000);
  setInterval(createBackup, 21600000);
  
  console.log('🎙️ البوت جاهز، استخدم !دخول 🎙️ للدخول إلى الروم الصوتي');

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
        .setLabel('⚙️ مشاكل برمجية')
        .setStyle(ButtonStyle.Success)
        .setEmoji('⚙️'),
      new ButtonBuilder()
        .setCustomId('ticket_question')
        .setLabel('❓ استفسار')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('❓')
    );

    ticketMessage = await channel.send({ embeds: [embed], components: [row] });
  }, 5000);
});

// ================= دالة دخول الروم الصوتي =================
async function joinVoiceChannelBot() {
  try {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    const voiceChannel = guild.channels.cache.get(VOICE_CHANNEL_ID);
    if (!voiceChannel) {
      console.log('❌ الروم الصوتي غير موجود!');
      return;
    }

    if (isInVoice) return;

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log(`🎙️ البوت دخل الروم الصوتي: ${voiceChannel.name}`);
      isInVoice = true;
      
      const channel = client.channels.cache.get(LOG_CHANNEL_ID);
      if (channel) {
        channel.send(`🎙️ **البوت دخل الروم الصوتي:** ${voiceChannel.name}`);
      }
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.log('🔌 البوت خرج من الروم الصوتي، يحاول إعادة الدخول خلال 10 ثواني...');
      isInVoice = false;
      
      setTimeout(async () => {
        console.log('🔄 محاولة إعادة الدخول إلى الروم الصوتي...');
        await joinVoiceChannelBot();
      }, 10000);
    });

    connection.on(VoiceConnectionStatus.Signalling, () => {
      console.log('🔄 جاري الاتصال بالروم الصوتي...');
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 30000);

  } catch (error) {
    console.log('❌ خطأ في دخول الروم الصوتي:', error.message);
    
    if (error.message.includes('aborted')) {
      console.log('🔄 محاولة إعادة الاتصال خلال 5 ثواني...');
      setTimeout(async () => {
        await joinVoiceChannelBot();
      }, 5000);
    } else {
      setTimeout(async () => {
        console.log('🔄 محاولة إعادة الدخول إلى الروم الصوتي...');
        await joinVoiceChannelBot();
      }, 15000);
    }
  }
}

// ================= مراقبة دخول الأعضاء إلى الروم الصوتي =================
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (newState.member.user.bot) return;

  if (newState.channelId === VOICE_CHANNEL_ID && oldState.channelId !== VOICE_CHANNEL_ID) {
    const member = newState.member;
    
    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      logChannel.send(`👋 **${member.user.username}** دخل إلى الروم الصوتي!`);
    }

    try {
      const connection = getVoiceConnection(newState.guild.id);
      if (connection) {
        console.log(`🎙️ ${member.user.username} دخل الروم الصوتي`);
      }
    } catch (e) {
      console.log('خطأ في الترحيب:', e.message);
    }
  }

  if (oldState.channelId === VOICE_CHANNEL_ID && newState.channelId !== VOICE_CHANNEL_ID) {
    const member = oldState.member;
    
    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      logChannel.send(`👋 **${member.user.username}** غادر الروم الصوتي.`);
    }
  }
});

// =====================================================
// ================= نظام الحماية =================
// =====================================================

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

  const userId = message.author.id;
  const now = Date.now();

  if (!spamMap.has(userId)) {
    spamMap.set(userId, { messages: [], mentions: 0, emojis: 0, files: 0 });
  }

  const userData = spamMap.get(userId);
  userData.messages.push(now);

  while (userData.messages.length > 0 && userData.messages[0] < now - TIME_WINDOW) {
    userData.messages.shift();
  }

  if (userData.messages.length > MAX_MESSAGES) {
    await message.delete();
    
    try {
      await message.member.timeout(TIMEOUT_DURATION, 'سبام - كثرة الرسائل');
      
      const embed = new EmbedBuilder()
        .setTitle('⏰ تايم أوت')
        .setDescription(`**المستخدم:** ${message.author}\n**السبب:** سبام - كثرة الرسائل\n**المدة:** ساعة واحدة`)
        .setColor(0xFF0000)
        .setTimestamp();
      
      await message.channel.send({ embeds: [embed] });
      
      const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('⏰ تايم أوت تلقائي')
          .setDescription(`**المستخدم:** ${message.author.tag}\n**السبب:** سبام - كثرة الرسائل\n**المدة:** ساعة واحدة`)
          .setColor(0xFF0000)
          .setTimestamp();
        await logChannel.send({ embeds: [logEmbed] });
      }
    } catch (error) {
      console.log('❌ خطأ في تايم أوت:', error.message);
    }
  }

  const mentions = message.mentions.users.size;
  if (mentions > MAX_MENTIONS) {
    await message.delete();
    
    try {
      await message.member.timeout(TIMEOUT_DURATION, 'منشن جماعي');
      
      const embed = new EmbedBuilder()
        .setTitle('⏰ تايم أوت')
        .setDescription(`**المستخدم:** ${message.author}\n**السبب:** منشن جماعي (${mentions} منشن)\n**المدة:** ساعة واحدة`)
        .setColor(0xFF0000)
        .setTimestamp();
      
      await message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.log('❌ خطأ في تايم أوت:', error.message);
    }
  }

  const emojiCount = (message.content.match(/<a?:.+?:\d+>/g) || []).length;
  if (emojiCount > MAX_EMOJIS) {
    await message.delete();
    
    try {
      await message.member.timeout(TIMEOUT_DURATION, 'إيموجي مفرط');
      
      const embed = new EmbedBuilder()
        .setTitle('⏰ تايم أوت')
        .setDescription(`**المستخدم:** ${message.author}\n**السبب:** إيموجي مفرط (${emojiCount} إيموجي)\n**المدة:** ساعة واحدة`)
        .setColor(0xFF0000)
        .setTimestamp();
      
      await message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.log('❌ خطأ في تايم أوت:', error.message);
    }
  }

  if (message.attachments.size > 5) {
    await message.delete();
    
    try {
      await message.member.timeout(TIMEOUT_DURATION, 'ملفات مفرطة');
      
      const embed = new EmbedBuilder()
        .setTitle('⏰ تايم أوت')
        .setDescription(`**المستخدم:** ${message.author}\n**السبب:** ملفات مفرطة (${message.attachments.size} ملف)\n**المدة:** ساعة واحدة`)
        .setColor(0xFF0000)
        .setTimestamp();
      
      await message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.log('❌ خطأ في تايم أوت:', error.message);
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

  const content = message.content.toLowerCase();

  for (const link of FORBIDDEN_LINKS) {
    if (content.includes(link)) {
      await message.delete();
      
      try {
        await message.member.timeout(TIMEOUT_DURATION, `رابط ممنوع: ${link}`);
        
        const embed = new EmbedBuilder()
          .setTitle('⏰ تايم أوت')
          .setDescription(`**المستخدم:** ${message.author}\n**السبب:** رابط ممنوع: ${link}\n**المدة:** ساعة واحدة`)
          .setColor(0xFF0000)
          .setTimestamp();
        
        await message.channel.send({ embeds: [embed] });
      } catch (error) {
        console.log('❌ خطأ في تايم أوت:', error.message);
      }
      break;
    }
  }

  if (content.match(/https?:\/\/[^\s]+/g)) {
    const links = content.match(/https?:\/\/[^\s]+/g);
    for (const link of links) {
      if (link.includes('discord') || link.includes('nitro') || link.includes('steal')) {
        await message.delete();
        
        try {
          await message.member.timeout(TIMEOUT_DURATION, 'رابط مشبوه');
          
          const embed = new EmbedBuilder()
            .setTitle('⏰ تايم أوت')
            .setDescription(`**المستخدم:** ${message.author}\n**السبب:** رابط مشبوه: ${link}\n**المدة:** ساعة واحدة`)
            .setColor(0xFF0000)
            .setTimestamp();
          
          await message.channel.send({ embeds: [embed] });
        } catch (error) {
          console.log('❌ خطأ في تايم أوت:', error.message);
        }
        break;
      }
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

  const content = message.content.toLowerCase();

  for (const word of BAD_WORDS) {
    if (content.includes(word)) {
      await message.delete();
      
      try {
        await message.member.timeout(TIMEOUT_DURATION, `كلمة محظورة: ${word}`);
        
        const embed = new EmbedBuilder()
          .setTitle('⏰ تايم أوت')
          .setDescription(`**المستخدم:** ${message.author}\n**السبب:** كلمة محظورة: ${word}\n**المدة:** ساعة واحدة`)
          .setColor(0xFF0000)
          .setTimestamp();
        
        await message.channel.send({ embeds: [embed] });
      } catch (error) {
        console.log('❌ خطأ في تايم أوت:', error.message);
      }
      break;
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

// =====================================================
// ================= نظام التذاكر المطور =================
// =====================================================

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'ticket_bans' || interaction.customId === 'ticket_issues' || interaction.customId === 'ticket_question') {
    
    // ================= التحقق من الكول داون (تذكرة واحدة كل ساعة) =================
    const lastTicket = ticketCooldown.get(interaction.user.id);
    if (lastTicket) {
      const timeLeft = TICKET_COOLDOWN - (Date.now() - lastTicket);
      if (timeLeft > 0) {
        const hours = Math.floor(timeLeft / 3600000);
        const minutes = Math.floor((timeLeft % 3600000) / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        
        let timeString = '';
        if (hours > 0) timeString += `${hours} ساعة `;
        if (minutes > 0) timeString += `${minutes} دقيقة `;
        if (seconds > 0) timeString += `${seconds} ثانية`;
        
        return interaction.reply({
          content: `⏰ يجب الانتظار ${timeString} قبل فتح تذكرة جديدة!`,
          ephemeral: true
        });
      }
    }

    // ================= أنواع التذاكر =================
    const ticketTypes = {
      'ticket_bans': { title: '🔨 الباندات', color: 0xFF0000, emoji: '🔨' },
      'ticket_issues': { title: '⚙️ مشاكل برمجية', color: 0xFFA500, emoji: '⚙️' },
      'ticket_question': { title: '❓ استفسار', color: 0x00FF00, emoji: '❓' }
    };

    const type = ticketTypes[interaction.customId];
    if (!type) return;

    // ================= إنشاء روم التذكرة =================
    const channel = await interaction.guild.channels.create({
      name: `${type.emoji}-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        },
        {
          id: interaction.client.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
        }
      ]
    });

    // ================= حفظ التذكرة =================
    tickets.set(channel.id, { 
      userId: interaction.user.id, 
      channelId: channel.id, 
      type: interaction.customId,
      createdAt: Date.now()
    });

    // ================= حفظ وقت التذكرة للكول داون =================
    ticketCooldown.set(interaction.user.id, Date.now());

    // ================= رسالة التذكرة =================
    const embed = new EmbedBuilder()
      .setTitle(`${type.emoji} ${type.title}`)
      .setDescription(`**المستخدم:** ${interaction.user}\n**نوع التذكرة:** ${type.title}`)
      .setColor(type.color)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('close_ticket')
        .setLabel('🔒 إغلاق التذكرة')
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ تم فتح التذكرة: ${channel}`, ephemeral: true });
  }

  // ================= إغلاق التذكرة =================
  if (interaction.customId === 'close_ticket') {

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({
        content: '❌ فقط الأدمن يقدر يغلق التذكرة!',
        ephemeral: true
      });
    }

    const channel = interaction.channel;
    
    const embed = new EmbedBuilder()
      .setTitle('🔒 إغلاق التذكرة')
      .setDescription('سيتم حذف هذه التذكرة خلال 5 ثواني...')
      .setColor(0xFF0000)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    tickets.delete(channel.id);

    setTimeout(() => {
      channel.delete();
    }, 5000);
  }
});

// =====================================================
// ================= الردود التلقائية =================
// =====================================================

const autoReplies = new Map([
  ['سلام', 'وعليكم السلام 👋'],
  ['شلونك', 'تمام وانت؟ 😊'],
  ['شخبارك', 'الحمدلله بخير، شخبارك؟ 😄'],
  ['هلو', 'هلا والله 🌹'],
  ['هاي', 'هاي 🌸'],
  ['صباح الخير', 'صباح النور 🌅'],
  ['مساء الخير', 'مساء النور 🌙'],
  ['شباب', 'نعم 🌹'],
  ['باي', 'باي 👋'],
  ['تصبح على خير', 'تصبح على خير 🌙'],
  ['Good morning', 'Good morning ☀️'],
  ['Good night', 'Good night 🌙'],
  ['Hello', 'Hello 👋'],
  ['Hi', 'Hi 😊']
]);

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

  const content = message.content.toLowerCase().trim();
  
  for (const [key, reply] of autoReplies) {
    if (content === key) {
      await message.channel.send(reply);
      break;
    }
  }
});

// =====================================================
// ================= الأوامر =================
// =====================================================

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (!message.content.startsWith('!')) return;

  const args = message.content.slice(1).split(' ');
  const command = args[0].toLowerCase();

  // ================= أمر دخول الروم الصوتي =================
  if (command === 'دخول' || command === '🎙️') {
    if (message.author.id !== OWNER_ID) {
      return message.channel.send('❌ هذا الأمر للمالك فقط!');
    }

    await joinVoiceChannelBot();
    message.channel.send('🎙️ جاري الدخول إلى الروم الصوتي...');
  }

  // ================= أمر الخروج من الروم الصوتي =================
  if (command === 'خروج' || command === '🔌') {
    if (message.author.id !== OWNER_ID) {
      return message.channel.send('❌ هذا الأمر للمالك فقط!');
    }

    const connection = getVoiceConnection(message.guild.id);
    if (connection) {
      connection.destroy();
      isInVoice = false;
      message.channel.send('🔌 تم الخروج من الروم الصوتي');
    } else {
      message.channel.send('❌ البوت ليس في روم صوتي');
    }
  }

  // ================= أمر الطوارئ =================
  if (command === 'طوارئ' || command === '🚨') {
    if (message.author.id !== OWNER_ID) {
      return message.channel.send('❌ هذا الأمر للمالك فقط!');
    }

    const embed = new EmbedBuilder()
      .setTitle('🚨 تفعيل حالة الطوارئ')
      .setDescription('تم تفعيل حالة الطوارئ!')
      .setColor(0xFF0000)
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });

    message.guild.channels.cache.forEach(async channel => {
      await channel.permissionOverwrites.edit(message.guild.id, {
        SendMessages: false
      });
    });

    const everyone = message.guild.roles.everyone;
    await message.channel.send(`${everyone} 🚨 **حالة طوارئ! تم قفل جميع الرومات!**`);
  }

  // ================= أمر إلغاء الطوارئ =================
  if (command === 'الغاء_طوارئ') {
    if (message.author.id !== OWNER_ID) {
      return message.channel.send('❌ هذا الأمر للمالك فقط!');
    }

    message.guild.channels.cache.forEach(async channel => {
      await channel.permissionOverwrites.edit(message.guild.id, {
        SendMessages: null
      });
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ إلغاء حالة الطوارئ')
      .setDescription('تم إلغاء حالة الطوارئ!')
      .setColor(0x00FF00)
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });
  }

  // ================= أمر التطهير =================
  if (command === 'مسح' || command === '✈️') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== OWNER_ID) {
      return message.channel.send('❌ ما عندك صلاحية!');
    }

    const amount = parseInt(args[1]);
    if (!amount || amount < 1 || amount > 100) {
      return message.channel.send('📝 استخدم: `!مسح ✈️ 10`');
    }

    await message.channel.bulkDelete(amount, true);
    const reply = await message.channel.send(`✅ تم مسح ${amount} رسالة ✈️`);
    setTimeout(() => reply.delete(), 3000);
  }

  // ================= أمر الطرد =================
  if (command === 'طرد' || command === '👢') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== OWNER_ID) {
      return message.channel.send('❌ ما عندك صلاحية!');
    }

    const user = message.mentions.users.first();
    if (!user) {
      return message.channel.send('📝 استخدم: `!طرد 👢 @شخص`');
    }

    const member = message.guild.members.cache.get(user.id);
    if (!member) {
      return message.channel.send('❌ العضو غير موجود');
    }

    const reason = args.slice(2).join(' ') || 'بدون سبب';

    try {
      await member.kick(reason);
      message.channel.send(`✅ تم طرد ${user.tag} 👢 (السبب: ${reason})`);
      
      const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('👢 طرد')
          .setDescription(`**المستخدم:** ${user.tag}\n**بواسطة:** ${message.author.tag}\n**السبب:** ${reason}`)
          .setColor(0xFFA500)
          .setTimestamp();
        await logChannel.send({ embeds: [embed] });
      }
    } catch (e) {
      message.channel.send(`❌ خطأ: ${e.message}`);
    }
  }

  // ================= أمر الحظر =================
  if (command === 'حظر' || command === '🔨') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== OWNER_ID) {
      return message.channel.send('❌ ما عندك صلاحية!');
    }

    const user = message.mentions.users.first();
    if (!user) {
      return message.channel.send('📝 استخدم: `!حظر 🔨 @شخص`');
    }

    const reason = args.slice(2).join(' ') || 'بدون سبب';

    try {
      await message.guild.bans.create(user, { reason });
      message.channel.send(`✅ تم حظر ${user.tag} 🔨 (السبب: ${reason})`);
      
      const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle('🔨 حظر')
          .setDescription(`**المستخدم:** ${user.tag}\n**بواسطة:** ${message.author.tag}\n**السبب:** ${reason}`)
          .setColor(0xFF0000)
          .setTimestamp();
        await logChannel.send({ embeds: [embed] });
      }
    } catch (e) {
      message.channel.send(`❌ خطأ: ${e.message}`);
    }
  }

  // ================= أمر الإحصائيات =================
  if (command === 'احصائيات' || command === '📊') {
    const embed = new EmbedBuilder()
      .setTitle('📊 إحصائيات السيرفر')
      .addFields(
        { name: '👥 الأعضاء', value: `${message.guild.memberCount}`, inline: true },
        { name: '🟢 الأونلاين', value: `${message.guild.members.cache.filter(m => m.presence?.status === 'online').size}`, inline: true },
        { name: '📝 الرومات', value: `${message.guild.channels.cache.size}`, inline: true },
        { name: '🎫 التذاكر', value: `${tickets.size}`, inline: true }
      )
      .setColor(0x00FF00)
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  }

  // ================= أمر قفل الروم =================
  if (command === 'قفل' || command === '🔒') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== OWNER_ID) {
      return message.channel.send('❌ ما عندك صلاحية!');
    }

    await message.channel.permissionOverwrites.edit(message.guild.id, {
      SendMessages: false
    });

    message.channel.send('🔒 تم قفل الروم');
  }

  // ================= أمر فتح الروم =================
  if (command === 'فتح' || command === '🔓') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator) && message.author.id !== OWNER_ID) {
      return message.channel.send('❌ ما عندك صلاحية!');
    }

    await message.channel.permissionOverwrites.edit(message.guild.id, {
      SendMessages: null
    });

    message.channel.send('🔓 تم فتح الروم');
  }

  // ================= أمر النسخ الاحتياطي =================
  if (command === 'نسخ' || command === '💾') {
    if (message.author.id !== OWNER_ID) {
      return message.channel.send('❌ هذا الأمر للمالك فقط!');
    }

    await createBackup();
    message.channel.send('✅ تم إنشاء نسخة احتياطية 💾');
  }

  // ================= أمر إعادة تعيين المنشنات =================
  if (command === 'اعادة_تعيين_منشن' || command === 'reset_mention') {
    if (message.author.id !== OWNER_ID) {
      return message.channel.send('❌ هذا الأمر للمالك فقط!');
    }

    mentionMap.clear();
    message.channel.send('✅ تم إعادة تعيين منشنات الإدارة للجميع!');
  }

  // ================= أمر المساعدة =================
  if (command === 'مساعدة' || command === '❓') {
    const embed = new EmbedBuilder()
      .setTitle('🛡️ أوامر بوت الحماية')
      .setDescription(`
**🎙️ أوامر الصوتيات:**
\`!دخول 🎙️\` - دخول الروم الصوتي (للمالك)
\`!خروج 🔌\` - الخروج من الروم الصوتي (للمالك)

**🛠️ أوامر الإدارة:**
\`!مسح ✈️ 10\` - مسح الرسائل
\`!طرد 👢 @شخص\` - طرد عضو
\`!حظر 🔨 @شخص\` - حظر عضو
\`!قفل 🔒\` - قفل الروم
\`!فتح 🔓\` - فتح الروم

**🎫 نظام التذاكر:**
اضغط على الأزرار في روم التذاكر (تذكرة واحدة كل ساعة)

**📊 أوامر عامة:**
\`!احصائيات 📊\` - عرض الإحصائيات
\`!مساعدة ❓\` - عرض هذه الرسالة

**🚨 أوامر الطوارئ:**
\`!طوارئ 🚨\` - تفعيل حالة الطوارئ (المالك فقط)
\`!الغاء_طوارئ\` - إلغاء حالة الطوارئ (المالك فقط)
\`!نسخ 💾\` - إنشاء نسخة احتياطية (المالك فقط)
\`!اعادة_تعيين_منشن\` - إعادة تعيين منشنات الإدارة (المالك فقط)

**🛡️ نظام الحماية التلقائي:**
- سبام (تايم أوت ساعة)
- منشنات جماعية (تايم أوت ساعة)
- إيموجي مفرط (تايم أوت ساعة)
- روابط ممنوعة (تايم أوت ساعة)
- كلمات محظورة (تايم أوت ساعة)
- منشن الإدارة (5 مرات = تايم أوت دقيقة)
- حماية ضد الهجوم (Anti-Raid)
- حماية ضد البوتات
- تسجيل الأحداث
      `)
      .setColor(0x00FF00)
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  }
});

// =====================================================
// ================= تحديث الإحصائيات =================
// =====================================================

async function updateStats() {
  try {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    const statsChannel = client.channels.cache.get(STATS_CHANNEL_ID);
    if (!statsChannel) return;

    const totalMembers = guild.memberCount;
    const onlineMembers = guild.members.cache.filter(m => m.presence?.status === 'online').size;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = totalMembers - bots;

    const embed = new EmbedBuilder()
      .setTitle('📊 إحصائيات السيرفر')
      .setColor(0x00FF00)
      .addFields(
        { name: '👥 إجمالي الأعضاء', value: `${totalMembers}`, inline: true },
        { name: '🟢 الأونلاين', value: `${onlineMembers}`, inline: true },
        { name: '🤖 البوتات', value: `${bots}`, inline: true },
        { name: '👤 البشر', value: `${humans}`, inline: true },
        { name: '📝 الرومات', value: `${guild.channels.cache.size}`, inline: true },
        { name: '🎫 التذاكر', value: `${tickets.size}`, inline: true }
      )
      .setTimestamp();

    const messages = await statsChannel.messages.fetch({ limit: 10 });
    const oldMessage = messages.find(m => m.author.id === client.user.id);
    
    if (oldMessage) {
      await oldMessage.edit({ embeds: [embed] });
    } else {
      await statsChannel.send({ embeds: [embed] });
    }
  } catch (e) {
    console.log('خطأ في تحديث الإحصائيات:', e.message);
  }
}

// =====================================================
// ================= نظام النسخ الاحتياطي =================
// =====================================================

async function createBackup() {
  try {
    const guild = client.guilds.cache.first();
    if (!guild) return;

    const backup = {
      name: guild.name,
      members: guild.memberCount,
      channels: guild.channels.cache.map(c => ({ name: c.name, type: c.type })),
      roles: guild.roles.cache.map(r => ({ name: r.name, color: r.color })),
      date: new Date()
    };

    backups.set(Date.now(), backup);

    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle('💾 نسخة احتياطية جديدة')
        .setDescription(`**تم إنشاء نسخة احتياطية للسيرفر**\n**الأعضاء:** ${backup.members}\n**الرومات:** ${backup.channels.length}\n**الأدوار:** ${backup.roles.length}`)
        .setColor(0x00FF00)
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }
  } catch (e) {
    console.log('خطأ في إنشاء النسخة الاحتياطية:', e.message);
  }
}

// =====================================================
// ================= تسجيل الأحداث =================
// =====================================================

client.on('guildMemberAdd', async (member) => {
  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('👤 عضو جديد')
    .setDescription(`**المستخدم:** ${member.user.tag}\n**الأيدي:** \`${member.id}\``)
    .setColor(0x00FF00)
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });

  const ticketChannel = client.channels.cache.get(TICKET_CHANNEL_ID);
  if (ticketChannel && ticketMessage) {
    await ticketChannel.send({ content: member.toString() });
  }
});

client.on('guildMemberRemove', async (member) => {
  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('👤 عضو غادر')
    .setDescription(`**المستخدم:** ${member.user.tag}\n**الأيدي:** \`${member.id}\``)
    .setColor(0xFF0000)
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (oldMessage.author?.bot) return;
  if (!oldMessage.guild) return;

  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('✏️ رسالة معدلة')
    .setDescription(`**المستخدم:** ${oldMessage.author?.tag}\n**الروم:** ${oldMessage.channel.name}`)
    .addFields(
      { name: '📝 قبل التعديل', value: oldMessage.content || 'فارغ' },
      { name: '📝 بعد التعديل', value: newMessage.content || 'فارغ' }
    )
    .setColor(0xFFFF00)
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});

client.on('messageDelete', async (message) => {
  if (message.author?.bot) return;
  if (!message.guild) return;

  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('🗑️ رسالة محذوفة')
    .setDescription(`**المستخدم:** ${message.author?.tag}\n**الروم:** ${message.channel.name}`)
    .addFields(
      { name: '📝 المحتوى', value: message.content || 'فارغ' }
    )
    .setColor(0xFF0000)
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
});

// =====================================================
// ================= تشغيل البوت =================
// =====================================================

client.login(TOKEN);