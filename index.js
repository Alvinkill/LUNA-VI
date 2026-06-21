const {default: makeWASocket,useMultiFileAuthState,DisconnectReason,downloadMediaMessage} = require('@whiskeysockets/baileys')
const pino = require('pino')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const axios = require('axios')
const yts = require('yt-search')
// Load config.json
let config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'))
const configPath = path.join(__dirname, 'config.json')
const MAIN_OWNER = config.MAIN_OWNER
const BOT_NAME = "LUNA-V1"
const ACCOUNT_NUMBER = config.ACCOUNT_NUMBER
let PREFIX = config.PREFIX || '.'
const BANK_NAME = config.BANK_NAME
const ACCOUNT_NAME = config.ACCOUNT_NAME
const OWNER_NAME = config.OWNER_NAME
const OWNER_FILE = './owner.json'
let ownerConfig = { numbers: [MAIN_OWNER], lids: [] }

const saveConfig = () => {
    config.PREFIX = PREFIX
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

const BOT_CREATOR = {
    name: "Rosean-X",
    role: "Developer & Owner of LUNA-V1",
    bio: "Rosean-X is the creator of LUNA-V1 WhatsApp Bot. Passionate about coding, automation, and building tools that make life easier. Based in Benin City, Nigeria., click on my contact to see my portfolio and projects.",
    github: "https://github.com/alvinkill",
    contact: "https://alvinkill.github.io/portfolio/"
}
// ═══════════════════════════════════════════════════
// PLACE THIS AT THE TOP OF YOUR FILE (e.g., below BOT_CREATOR)
// ═══════════════════════════════════════════════════
const menuImagePath = path.join(__dirname, 'luna.jpeg')
const menuImage = fs.existsSync(menuImagePath) ? fs.readFileSync(menuImagePath) : null
global.menuImage = menuImage
const publicCmds = ['ping', 'alive', 'info', 'help', 'owner', 'getpp', 'say', 'creator', 'rules', 'time','couplepp']
const mediaCmds = ['sticker', 'toimg', 'vv', 'vv2', 'save', 'ttp', 'attp', 'tts', 'wallpaper']
const aiCmds = ['luna', 'chatgpt','imganime', 'gemini', 'imagine', 'aisong', 'google']
const utilityCmds = ['weather', 'calc', 'qr', 'ssweb', 'translate', 'dm', 'lyrics', 'motivations', 'encode', 'decode', 'binary', 'age', 'reverse', 'password']
const gameCmds = ['tictactoe', 'truth', 'dare', 'wyr', 'guess', 'roll', 'flip', '8ball', 'bet', 'roast', 'compliment']
const groupCmds = ['tagall', 'hidetag', 'setdesc', 'antilink', 'antidelete', 'kick', 'promote', 'demote', 'marry', 'divorce', 'add', 'setgcname', 'setgcpp']
const ytCmds = ['play', 'song', 'video', 'ytmp3', 'ytdlmp4', 'igdl', 'ttdl']
const awesomeCmds = ['facts', 'anime', 'manga', 'movie', 'define', 'github', 'crypto', 'country', 'ud', 'horoscope', 'quote', 'joke', 'meme', 'rizz', 'bible']
const ownerCmds = ['restart', 'studown', 'broadcast', 'addowner', 'removeowner', 'aza', 'prefix']
const sportsCmds = ['nba', 'soccer', 'football']
const nsfwCmds = ['waifu', 'ecchi', 'hentai', 'trap', 'blowjob', 'xxx', 'leak']

// Base total excluding owner commands (or update it dynamically inside the event loop)
const baseTotal = publicCmds.length + mediaCmds.length + aiCmds.length + utilityCmds.length + gameCmds.length + groupCmds.length + ytCmds.length + awesomeCmds.length + sportsCmds.length + nsfwCmds.length

const isYTUrl = (url) => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(url)

try {
    process.env.FFMPEG_PATH = require('ffmpeg-static')
} catch(e) {
    console.log('ffmpeg-static not found. Run: npm install ffmpeg-static')
}

const normalizeNumber = (value) => String(value || '').replace(/\D/g, '')
const getJidUser = (jid) => String(jid || '').split('@')[0].split(':')[0]
const normalizeJid = (jid) => {
    if (!jid) return ''
    const value = String(jid).trim()
    if (value.includes('@')) return value
    const num = normalizeNumber(value)
    return num ? `${num}@s.whatsapp.net` : ''
}
const isLikelyLid = (jid) => /@(?:lid|hosted\.lid)(?:\.whatsapp\.net)?$/i.test(String(jid || ''))
const resolveLidJid = async (sock, jid) => {
    const value = String(jid || '').trim()
    if (!value) return ''

    // If it's already a normal JID, keep it.
    if (value.includes('@') && !isLikelyLid(value)) return value

    try {
        if (typeof sock?.getJidFromLid === 'function' && isLikelyLid(value)) {
            const resolved = await sock.getJidFromLid(value)
            if (resolved) return resolved
        }
    } catch (e) {
        // ignore and continue
    }

    try {
        const lidMapping = sock?.signalRepository?.lidMapping
        if (isLikelyLid(value) && lidMapping && typeof lidMapping.getPNForLID === 'function') {
            const pnJid = await lidMapping.getPNForLID(value)
            if (pnJid) return pnJid
        }
    } catch (e) {
        // ignore and continue
    }

    return value
}
const resolveLidToPhone = async (sock, jid) => {
    const value = String(jid || '').trim()
    if (!value) return ''

    // If it is already a plain phone number, use that directly.
    const cleanNumber = normalizeNumber(value)
    if (cleanNumber && !value.includes('@')) return cleanNumber

    // If it is already a normal JID or phone JID, extract the number.
    if (value.includes('@')) {
        const extracted = getJidUser(value)
        if (!isLikelyLid(value) && extracted) return normalizeNumber(extracted)
    }

    // Try the real mapping API used by Baileys for LID <-> PN conversion.
    try {
        const lidMapping = sock?.signalRepository?.lidMapping
        if (isLikelyLid(value) && lidMapping && typeof lidMapping.getPNForLID === 'function') {
            const pnJid = await lidMapping.getPNForLID(value)
            if (pnJid) {
                const pnNumber = getJidUser(pnJid)
                if (pnNumber) return normalizeNumber(pnNumber)
            }
        }
    } catch (e) {
        // ignore and continue to fallback
    }

    // Fallback: if the socket has me.id and me.lid, use those when possible.
    try {
        const me = sock?.authState?.creds?.me
        if (me?.lid && value === me.lid && me?.id) return normalizeNumber(getJidUser(me.id))
        if (me?.id && value === me.id) return normalizeNumber(getJidUser(me.id))
    } catch (e) {
        // ignore
    }

    // Last fallback: return the extracted number if the value looks numeric-like.
    return cleanNumber || ''
}
const matchesOwner = (ownerList, ...values) => {
    const ownerSet = new Set(ownerList.map(normalizeNumber).filter(Boolean))
    return values.some(value => ownerSet.has(normalizeNumber(value)))
}

const loadOwnerConfig = () => {
    if (!fs.existsSync(OWNER_FILE)) return
    let data
    try { data = JSON.parse(fs.readFileSync(OWNER_FILE)) } catch { return }
    if (Array.isArray(data)) {
        ownerConfig.numbers = data.map(normalizeNumber).filter(Boolean)
        return
    }
    if (Array.isArray(data.numbers)) {
        ownerConfig.numbers = data.numbers.map(normalizeNumber).filter(Boolean)
    } else if (data.main) {
        ownerConfig.numbers = [normalizeNumber(data.main)]
    }
}

loadOwnerConfig()
ownerConfig.numbers = [...new Set(ownerConfig.numbers)]
const saveOwner = () => fs.writeFileSync(OWNER_FILE, JSON.stringify({ numbers: ownerConfig.numbers }, null, 2))

const gameSessions = new Map()
const groupSettings = new Map()
const lidCache = new Map() // put this near top with your other Maps
// marriages persistence: store pairings in a JSON file
const MARRIAGES_FILE = path.join(__dirname, 'marriages.json')
const marriages = new Map()
const loadMarriages = () => {
    try {
        if (fs.existsSync(MARRIAGES_FILE)) {
            const raw = JSON.parse(fs.readFileSync(MARRIAGES_FILE, 'utf8') || '{}')
            Object.entries(raw || {}).forEach(([k,v]) => marriages.set(k, v))
        }
    } catch (e) { console.log('Failed to load marriages:', e?.message || e) }
}
const saveMarriages = () => {
    try {
        const obj = {}
        for (const [k,v] of marriages.entries()) obj[k] = v
        fs.writeFileSync(MARRIAGES_FILE, JSON.stringify(obj, null, 2))
    } catch (e) { console.log('Failed to save marriages:', e?.message || e) }
}
loadMarriages()

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth')

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        getMessage: async (key) => {
            if (global.messageStore && global.messageStore[key.id]) return global.messageStore[key.id]
            return { conversation: '' }
        }
    })

    global.messageStore = {}
    const startTime = Date.now()

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode!== DisconnectReason.loggedOut
            console.log('❌ Disconnected. Reconnecting:', shouldReconnect)
            if (shouldReconnect) startBot()
        } else if (connection === 'open') {
    console.log('✅ LUNA-V1 Online!')
    const botJid = sock.user.id
    const botNum = getJidUser(botJid)
    if (!botJid.endsWith('@lid.whatsapp.net') && !ownerConfig.numbers.includes(botNum)) {
        ownerConfig.numbers.push(botNum)
        ownerConfig.numbers = [...new Set(ownerConfig.numbers)]
        saveOwner()
        console.log(`🔒 Locked owner to: ${botNum}`)
    }

    // ===== SEND CONNECTED MESSAGE WITH IMAGE TO MAIN_OWNER =====
    try {
        const fs = require('fs')
        const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'))
        
        const ownerNumber = config.MAIN_OWNER // 2347058642511 from your json
        const ownerJid = ownerNumber + '@s.whatsapp.net'
        const imagePath = './lunac.jpeg' // put the image you uploaded here, rename to luna.jpeg
        const botName = "LUNA-V1"
        const prefix = config.PREFIX
        
        const msg = `🌙 *LUNA V1 Connected Successfully* ✅\n\n` +
                    `> 🤖 *Bot*: LUNA-V1\n` +
                    `> 👑 *Owner*: ${config.OWNER_NAME}\n` +
                    `> 📱 *Number*: ${config.MAIN_OWNER}\n` +
                    `> ⏰ *Time*: ${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Lagos' })}\n\n` +
                    `> Bot is online and ready\n` +
                    `> Type ${config.PREFIX}menu to start`

        if (fs.existsSync(imagePath)) {
            await sock.sendMessage(ownerJid, {
                image: fs.readFileSync(imagePath),
                caption: msg
            })
            console.log(`📨 Connected message + image sent to ${ownerNumber}`)
        } else {
            await sock.sendMessage(ownerJid, { text: msg })
            console.log(`📨 Connected message sent to ${ownerNumber} - no image found`)
        }
    } catch (e) {
        console.log('❌ Failed to send connect message:', e.message)
    }
}
        if (!sock.authState.creds.registered) {
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(MAIN_OWNER)
                    console.log('\u001b[1;32m📱 Pairing Code: ' + code + '\u001b[0m')
                    console.log('Go to WhatsApp > Linked Devices > Link with phone number')
                } catch(e) { console.log('❌ Pairing code failed:', e.message) }
            }, 3000)
        }
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type!== 'notify') return
        const msg = messages[0]
        if (!msg?.message) return
        if (msg.key.id) global.messageStore[msg.key.id] = msg.message
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg?.message) return
    if (msg.key.remoteJid === 'status@broadcast') return

    // store message for getMessage
    if (msg.key.id) global.messageStore[msg.key.id] = msg.message

    const from = msg.key.remoteJid
    const isGroup = from.endsWith('@g.us')
    const botId = sock.user?.id || sock.authState?.creds?.me?.id || sock.authState?.creds?.me?.lid || ''
    const rawSenderJid = msg.key.fromMe
        ? (msg.key.participant || botId || from)
        : (msg.key.participant || from)

    // Convert any LID/hosted-LID values to a phone number before checking owner.json.
    const senderNumber = await resolveLidToPhone(sock, rawSenderJid)
    // Resolved sender JID and pushName for use in commands
    const sender = await resolveLidJid(sock, rawSenderJid)
    const pushName = msg.pushName || (await sock.getName?.(rawSenderJid)) || ''

    // isAdmin: whether the sender is an admin in the group (if applicable)
    let isAdmin = false
    if (isGroup) {
        try {
            const metaForAdmin = await sock.groupMetadata(from)
            const participantId = rawSenderJid
            isAdmin = !!metaForAdmin.participants.find(p => p.id === participantId && (p.admin || p.isAdmin || p.role === 'admin'))
        } catch (e) { console.log('isAdmin check failed:', e?.message || e) }
    }

    // Compare against owner.json using normalized values so both phone numbers and LID-based IDs work.
    const isOwner = matchesOwner(
        ownerConfig.numbers,
        senderNumber,
        rawSenderJid,
        getJidUser(rawSenderJid),
        from
    )

    console.log('Debug:', { chatJid: from, rawSenderJid, senderNumber, isOwner, fromMe: msg.key.fromMe })

    const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption

    if (!text) return
    console.log(`[${senderNumber}] ${text}`)
    if (!text.startsWith(PREFIX)) return


    const [rawCommand, ...rest] = text.trim().split(' ')
    const cmd = rawCommand.slice(PREFIX.length).toLowerCase() // strip whatever the *current* PREFIX is, not a hardcoded '.'
    const args = rest.join(' ').trim()
    const uptime = Math.floor((Date.now() - startTime) / 1000)
    const hrs = Math.floor(uptime / 3600)
    const mins = Math.floor((uptime % 3600) / 60)
    const secs = uptime % 60

    


        const convertToWebp = async (buffer, isVideo = false) => {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-sticker-'))
            const inputExt = isVideo? 'mp4' : 'jpg'
            const inputFile = path.join(tmpDir, `input.${inputExt}`)
            const outputFile = path.join(tmpDir, 'output.webp')
            fs.writeFileSync(inputFile, buffer)
            const ffmpegArgs = [
                '-y', '-i', inputFile,
                '-vcodec', 'libwebp',
                '-vf', isVideo
                   ? 'fps=15,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2,format=rgba'
                    : 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2',
                '-lossless', '1', '-preset', 'default', '-an', '-vsync', '0',
                outputFile
            ]
            await new Promise((resolve, reject) => {
                const ffmpeg = spawn(process.env.FFMPEG_PATH || 'ffmpeg', ffmpegArgs)
                ffmpeg.stderr.on('data', () => {})
                ffmpeg.on('error', reject)
                ffmpeg.on('close', (code) => code === 0? resolve() : reject(new Error(`ffmpeg exited ${code}`)))
            })
            const webp = fs.readFileSync(outputFile)
            fs.rmSync(tmpDir, { recursive: true, force: true })
            return webp
        }

        // OWNER COMMANDS
        if (cmd === 'addowner' && isOwner) {
            if (!args) return await sock.sendMessage(from, { text: 'Usage:.addowner 2347076114896' })
            const targetNumber = normalizeNumber(args)
            if (!targetNumber) return await sock.sendMessage(from, { text: '❌ Invalid number.' })
            if (ownerConfig.numbers.includes(targetNumber)) return await sock.sendMessage(from, { text: '❌ Already an owner.' })
            try {
                const [result] = await sock.onWhatsApp(targetNumber)
                if (!result?.exists) return await sock.sendMessage(from, { text: '❌ Number not on WhatsApp.' })
                ownerConfig.numbers.push(targetNumber)
                ownerConfig.numbers = [...new Set(ownerConfig.numbers)]
                saveOwner()
                await sock.sendMessage(from, { text: `✅ Added ${targetNumber} as owner.` })
            } catch {
                await sock.sendMessage(from, { text: '❌ Failed to check number.' })
            }
            return
        }

        if (cmd === 'removeowner' && isOwner) {
            if (!args) return await sock.sendMessage(from, { text: 'Usage:.removeowner 2347076114896' })
            const targetNumber = normalizeNumber(args)
            ownerConfig.numbers = ownerConfig.numbers.filter(n => n!== targetNumber)
            saveOwner()
            await sock.sendMessage(from, { text: `✅ Removed ${targetNumber} from owners.` })
            return
        }

    

        // ════════════════
        // PUBLIC COMMANDS
        // ════════════════

        if (cmd === 'ping') {
            const start = Date.now()
            await sock.sendMessage(from, { text: '🔍 Pinging...' })
            await sock.sendMessage(from, { text: `🔍 *Pong!*\nSpeed: ${Date.now() - start}ms\nUptime: ${hrs}h ${mins}m ${secs}s\n\n> © LUNA-V1` })
        }

        if (cmd === 'alive') {
            await sock.sendMessage(from, { text: `✅ *${BOT_NAME} is Online*\n\n🟢 Status: Active\n⏱️ Uptime: ${hrs}h ${mins}m ${secs}s\n\n> © LUNA-V1` })
        }

        if (cmd === 'info') {
            await sock.sendMessage(from, { text: `ℹ️ *${BOT_NAME} Bot Info*\n\nBuilt with Baileys MD\nNode: ${process.version}\nPlatform: ${process.platform}\nCreated by ROSEAN-X TEAM\n\n> © LUNA-V1` })
        }

        if (cmd === 'couplepp' || cmd === 'cpp') {
    try {
        await sock.sendMessage(from, { text: '👫 Looking for the best couplepp' })

        const res = await axios.get('https://apis.davidcyril.name.ng/couplepp', { timeout: 15000 })
        
        const maleUrl = res.data?.male
        const femaleUrl = res.data?.female

        if (!maleUrl || !femaleUrl) throw new Error('API returned no image URLs')

        // Send male DP
        await sock.sendMessage(from, {
            image: { url: maleUrl },
            caption: `👨 *Male Couple DP*\n\n> © LUNA-V1`
        })

        // Send female DP  
        await sock.sendMessage(from, {
            image: { url: femaleUrl },
            caption: `👩 *Female Couple DP*\n\n> © LUNA-V1`
        })

    } catch (err) {
        console.log('CouplePP error:', err.response?.data || err.message)
        await sock.sendMessage(from, { text: `❌ Failed to fetch couple DP. API down or no images.` })
    }
}

        if (cmd === 'help') {
           const ownerNumber = '2347058642511' // <- put your number here, no + 
        const ownerName = 'FELICE-HART' // <- your name here
    
    // 1. Send vCard contact like DAVID CYRIL screenshot
    await sock.sendMessage(from, {
        contacts: {
            displayName: ownerName,
            contacts: [{
                displayName: ownerName,
                vcard: `BEGIN:VCARD
VERSION:3.0
FN:${ownerName}
TEL;type=CELL;waid=${ownerNumber}:+${ownerNumber}
END:VCARD`
            }]
        }
    })
    
    
    await sock.sendMessage(from, {
        text: `*MESSAGE MY MASTER FOR HELP*\n\n use ${PREFIX}creator to know more about him\n\nif you want to know more about me use ${PREFIX}menu\n\n> © LUNA-V1`
    })
    return
}

         if (cmd === 'owner') {
    const ownerNumber = config.MAIN_OWNER + '@s.whatsapp.net'
    const ownerName = config.OWNER_NAME || 'Bot Owner'
    
    // Get owner's profile picture
    let ppUrl
    try {
        ppUrl = await sock.profilePictureUrl(ownerNumber, 'image')
    } catch {
        ppUrl = 'https://i.ibb.co/xyz/default.jpg' // fallback image if owner has no pp
    }
    
    // Send contact card like the DAVID CYRIL one
    await sock.sendMessage(from, {
        contacts: {
            displayName: ownerName,
            contacts: [{
                displayName: ownerName,
                vcard: `BEGIN:VCARD
VERSION:3.0
FN:${ownerName}
TEL;type=CELL;waid=${config.MAIN_OWNER}:+${config.MAIN_OWNER}
END:VCARD`
            }]
        }
    })
    return
   
}

        if (cmd === 'command' || cmd === 'commands') {
    // Dynamically calculate total including owner commands if the sender is an owner
    const totalCommandsCount = baseTotal + (isOwner ? ownerCmds.length : 0)

    await sock.sendMessage(from, {
        text: `📊 *Total Commands: ${totalCommandsCount}*\n> © LUNA-V1`
    })
    return
}
            
       if (cmd === 'creator') {
    const ownerNumber = '2347058642511' // <- put your number here, no + 
    const ownerName = 'FELICE-HART' // <- your name here
    
    // 1. Send vCard contact like DAVID CYRIL screenshot
    await sock.sendMessage(from, {
        contacts: {
            displayName: ownerName,
            contacts: [{
                displayName: ownerName,
                vcard: `BEGIN:VCARD
VERSION:3.0
FN:${ownerName}
TEL;type=CELL;waid=${ownerNumber}:+${ownerNumber}
END:VCARD`
            }]
        }
    })
    
    
    await sock.sendMessage(from, {
        text: `*${BOT_CREATOR.name}*\n\n${BOT_CREATOR.role}\n${BOT_CREATOR.bio}\n\nGITHUB: ${BOT_CREATOR.github}\n\nCONTACT: ${BOT_CREATOR.contact}\n\n> © LUNA-V1`
    })
    return
}

        if (cmd === 'rules') {
            await sock.sendMessage(from, { text: `> 📜 *LUNA-V1 RULES*\n\n1. Be respectful to everyone.\n2. No spamming or flooding.\n3. No illegal content.\n4. Use commands responsibly.\n5. No harassment or hate speech.\n6. Follow WhatsApp's terms of service.\n7. Have fun!\n8. Suggestions? Contact *ROSEAN-X TEAM*` })
        }

        if (cmd === `getpp`) {
            let target = senderJid
            const ctx = msg.message.extendedTextMessage?.contextInfo

            if (ctx?.quotedMessage) {
                target = ctx.participant || ctx.quotedMessage?.participant || senderJid
            } else if (ctx?.mentionedJid?.length) {
                target = ctx.mentionedJid[0]
            } else if (args) {
                target = normalizeJid(args)
            }

            const normalizedTarget = normalizeJid(target)
            if (!normalizedTarget) {
                return await sock.sendMessage(from, { text: `Usage: getpp <number or @mention or reply>` })
            }

            try {
                const ppUrl = await sock.profilePictureUrl(normalizedTarget, 'image')
                await sock.sendMessage(from, {
                    image: { url: ppUrl },
                    caption: `📸 Profile Picture of ${normalizedTarget}`
                })
            } catch (err) {
                console.log('getpp error:', err)
                await sock.sendMessage(from, {
                    text: '❌ User has no profile picture or privacy settings block access.'
                })
            }
            return
        }

        if (cmd === 'echo' || cmd === 'say') {
            if (!args) return await sock.sendMessage(from, { text: 'Usage: .echo hello' })
            await sock.sendMessage(from, { text: args })
        }

        if (cmd === 'time') {
            const now = new Date()
            await sock.sendMessage(from, { text: `🕒 *Current Time*\n${now.toLocaleTimeString('en-GB', { hour12: true })}` })
        }

        if (cmd === 'date') {
            const now = new Date()
            await sock.sendMessage(from, { text: `📅 *Current Date*\n ${now.toLocaleDateString('en-GB')}` })
        }

        if (cmd === 'quote') {
            const quotes = [
                "Code is poetry written in logic.",
                "Every bug is a lesson in disguise.",
                "Consistency beats intensity.",
                "Level 100 today, level 200 tomorrow.",
                "Debugging is like being a detective where you are also the culprit.",
                "The best error message is the one that never shows up.",
                "First, solve the problem. Then, write the code.",
                "Simplicity is the soul of efficiency.",
                "In programming, the hard part isn’t solving problems, but deciding what problems to solve.",
                "Programming is the art of telling another human what one wants the computer to do.",
            ]
            await sock.sendMessage(from, { text: `💬 *Quote of the Moment*\n\n"${quotes[Math.floor(Math.random() * quotes.length)]}"\n\n> © LUNA-V1` })
        }

        if (cmd === 'joke') {
            try {
                const res = await axios.get('https://official-joke-api.appspot.com/random_joke', { timeout: 10000 })
                await sock.sendMessage(from, { text: `😂 *${res.data.setup}*\n\n${res.data.punchline}\n\n> © ${BOT_NAME}` })
            } catch {
                const jokes = [
                    { s: "Why don't scientists trust atoms?", p: "Because they make up everything!" },
                    { s: "Why did the programmer quit his job?", p: "Because he didn't get arrays!" },
                    { s: "What do you call a fish without eyes?", p: "A fsh!" }
                ]
                const j = jokes[Math.floor(Math.random() * jokes.length)]
                await sock.sendMessage(from, { text: `😂 *${j.s}*\n\n${j.p}\n\n> © LUNA-V1` })
            }
        }

        if (cmd === 'meme') {
            try {
                const res = await axios.get('https://meme-api.com/gimme', { timeout: 10000 })
                await sock.sendMessage(from, { image: { url: res.data.url }, caption: `😆 ${res.data.title}\n\nr/${res.data.subreddit}\n\n> © LUNA-V1` })
            } catch { await sock.sendMessage(from, { text: '❌ Failed to get meme' }) }
        }
        if (cmd === 'rosean-x' || cmd === 'rosean') {
    await sock.sendMessage(from, {
        text: `*${BOT_CREATOR.name}*\n\n${BOT_CREATOR.role}\n${BOT_CREATOR.bio}\n\n${BOT_CREATOR.github}\n${BOT_CREATOR.contact}\n\n> © LUNA-V1`
    })
}
        if (cmd === 'rizz' || cmd === 'pickup') {
    const rizzImagePath = path.join(__dirname, 'rizz.jpeg')
    const rizzImage = fs.existsSync(rizzImagePath) ? fs.readFileSync(rizzImagePath) : null
    
    try {

        const res = await axios.get('https://apis.davidcyril.name.ng/pickupline', { timeout: 15000 })
        
        // From screenshot: response has "pickupline" key
        const rizzLine = res.data?.pickupline || 'Are you Wi-Fi? Cause I feel a connection 😏'
        const rizzText = `💘 *Rizz Line*\n\n${rizzLine}\n\n> © LUNA-V1`
        
        if (rizzImage) {
            await sock.sendMessage(from, { image: rizzImage, caption: rizzText })
        } else {
            await sock.sendMessage(from, { text: rizzText })
        }

    } catch (err) {
        console.log('Rizz API error:', err.response?.data || err.message)
        // Fallback if API down
        const fallback = "Do you have a map? I keep getting lost in your eyes."
        const rizzText = `💘 *Rizz Line*\n\n${fallback}\n\n> © LUNA-V1`
        if (rizzImage) await sock.sendMessage(from, { image: rizzImage, caption: rizzText })
        else await sock.sendMessage(from, { text: rizzText })
    }
}

        if (cmd === 'motivations' || cmd === 'motivation') {
            const motivations = [
                "Believe in yourself and all that you are.",
                "Small steps every day add up to big results.",
                "The only limit is the one you set for yourself.",
                "Keep going. Great things take time.",
                "Success is not final, failure is not fatal — it's the courage to continue that counts.",
                "The future belongs to those who believe in the beauty of their dreams.",
                "Don't watch the clock; do what it does. Keep going."
            ]
            await sock.sendMessage(from, { text: `💡 *Motivation*\n\n${motivations[Math.floor(Math.random() * motivations.length)]}\n\n> © LUNA-V1` })
        }

        if (cmd === '8ball') {
            if (!args) return await sock.sendMessage(from, { text: 'Usage: .8ball will I pass my exam?' })
            const responses = [
                "🔮 It is certain.", "🔮 Without a doubt.", "🔮 Yes, definitely!", "🔮 You may rely on it.",
                "🔮 Most likely.", "🔮 Outlook good.", "🔮 Signs point to yes.",
                "🤔 Reply hazy, try again.", "🤔 Ask again later.", "🤔 Cannot predict now.",
                "❌ Don't count on it.", "❌ My reply is no.", "❌ Very doubtful.", "❌ Outlook not so good."
            ]
            await sock.sendMessage(from, { text: `🎱 *Magic 8-Ball*\n\n❓ ${args}\n\n${responses[Math.floor(Math.random() * responses.length)]}\n\n> © LUNA-V1` })
        }

        if (cmd === 'roast') {
            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
            const target = mentioned ? `@${getJidUser(mentioned)}` : (args || 'yourself')
            const roasts = [
                `${target}, you're not stupid; you just have bad luck thinking.`,
                `${target} is proof that even evolution makes mistakes sometimes.`,
                `${target}, if brains were gasoline, you wouldn't have enough to power an ant's motorbike.`,
                `${target}, you're like a software update — whenever you show up, everyone thinks "not now."`,
                `${target}, I'd agree with you, but then we'd both be wrong.`,
                `${target} has the energy of a dying phone battery — barely 3%.`,
                `${target}, you're not the dumbest person alive, but you better hope they don't die.`,
                `${target}, if you were any slower, you'd be going backwards.`,
            ]
            await sock.sendMessage(from, {
                text: `🔥 *ROASTED!*\n\n${roasts[Math.floor(Math.random() * roasts.length)]}\n\n> © LUNA-V1`,
                mentions: mentioned ? [mentioned] : []
            })
        }

        if (cmd === 'compliment') {
            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
            const target = mentioned ? `@${getJidUser(mentioned)}` : (args || 'you')
            const compliments = [
                `${target}, your smile could light up an entire city! 😊`,
                `${target} is one of those rare people who make the world genuinely better. 🌟`,
                `${target}, you have an incredible mind — the way you think is truly impressive! 🧠`,
                `${target}, your kindness doesn't go unnoticed. Keep being amazing! 💫`,
                `${target} is stronger than they realize and more loved than they know. 💖`,
                `Everything ${target} touches turns to gold. Pure magic! ✨`
            ]
            await sock.sendMessage(from, {
                text: `👍 *Compliment*\n\n${compliments[Math.floor(Math.random() * compliments.length)]}\n\n> © LUNA-V1`,
                mentions: mentioned ? [mentioned] : []
            })
        }

        if (cmd === 'horoscope') {
            if (!args) return await sock.sendMessage(from, { text: 'Usage: .horoscope aries\n\nSigns: aries, taurus, gemini, cancer, leo, virgo, libra, scorpio, sagittarius, capricorn, aquarius, pisces' })
            try {
                const sign = args.toLowerCase().trim()
                const res = await axios.get(`https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${sign}&day=TODAY`, { timeout: 10000 })
                const data = res.data?.data
                if (data?.horoscope_data) {
                    await sock.sendMessage(from, { text: `⭐ *${sign.charAt(0).toUpperCase() + sign.slice(1)} Horoscope*\n\n${data.horoscope_data}\n\n📅 ${data.date || 'Today'}\n\n> © LUNA-V1` })
                } else { throw new Error('No data') }
            } catch {
                const generic = ["Today brings unexpected opportunities — stay open! 🌟", "Trust your instincts today, they won't lead you astray. ✨", "The stars align in your favor today. Act boldly! 💫", "A great day for reflection and planning ahead. 🌙", "Positive energy surrounds you — embrace it! ☀️"]
                await sock.sendMessage(from, { text: `⭐ *${args.charAt(0).toUpperCase() + args.slice(1)} Horoscope*\n\n${generic[Math.floor(Math.random() * generic.length)]}\n\n> © LUNA-V1` })
            }
        }

        if (cmd === 'password') {
            const length = parseInt(args) || 16
            if (length < 6 || length > 64) return await sock.sendMessage(from, { text: '❌ Length must be between 6 and 64.' })
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
            const password = Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
            await sock.sendMessage(from, { text: `🔑 *Generated Password (${length} chars)*\n\n\`${password}\`\n\n⚠️ Save it somewhere safe!\n\n> © LUNA-V1` })
        }

        if (cmd === 'encode') {
            if (!args) return await sock.sendMessage(from, { text: 'Usage: .encode hello world' })
            await sock.sendMessage(from, { text: `🔒 *Base64 Encoded*\n\n${Buffer.from(args).toString('base64')}\n\n> © LUNA-V1` })
        }

        if (cmd === 'decode') {
            if (!args) return await sock.sendMessage(from, { text: 'Usage: .decode aGVsbG8gd29ybGQ=' })
            try {
                const decoded = Buffer.from(args, 'base64').toString('utf8')
                await sock.sendMessage(from, { text: `🔓 *Base64 Decoded*\n\n${decoded}\n\n> © LUNA-V1` })
            } catch { await sock.sendMessage(from, { text: '❌ Invalid base64 string.' }) }
        }

        if (cmd === 'binary') {
            if (!args) return await sock.sendMessage(from, { text: 'Usage: .binary hello' })
            const binary = args.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ')
            await sock.sendMessage(from, { text: `💻 *Binary*\n\n${binary}\n\n> © LUNA-V1` })
        }

        if (cmd === 'age') {
            if (!args) return await sock.sendMessage(from, { text: 'Usage: .age 2000-05-15 (YYYY-MM-DD)' })
            try {
                const birth = new Date(args)
                if (isNaN(birth)) throw new Error()
                const now = new Date()
                let years = now.getFullYear() - birth.getFullYear()
                let months = now.getMonth() - birth.getMonth()
                let days = now.getDate() - birth.getDate()
                if (days < 0) { months--; days += 30 }
                if (months < 0) { years--; months += 12 }
                await sock.sendMessage(from, { text: `🎂 *Age Calculator*\n\n📅 Birthday: ${args}\n🎉 Age: ${years} years, ${months} months, ${days} days\n\n> © LUNA-V1` })
            } catch { await sock.sendMessage(from, { text: '❌ Invalid date. Use format: YYYY-MM-DD' }) }
        }

        if (cmd === 'reverse') {
            if (!args) return await sock.sendMessage(from, { text: 'Usage: .reverse hello world' })
            await sock.sendMessage(from, { text: `🔄 *Reversed*\n\n${args.split('').reverse().join('')}\n\n> © LUNA-V1` })
        }

        if (cmd === 'bet') {
            if (!args || !['heads', 'tails'].includes(args.toLowerCase())) return await sock.sendMessage(from, { text: 'Usage: .bet heads OR .bet tails' })
            const result = Math.random() < 0.5 ? 'heads' : 'tails'
            const won = args.toLowerCase() === result
            await sock.sendMessage(from, { text: `🪙 *Coin Flip Bet*\n\nYour choice: ${args}\nResult: ${result}\n\n${won ? '🎉 You WIN!' : '😢 You LOSE!'}\n\n> © LUNA-V1` })
        }

        if (cmd === 'fact' || cmd === 'facts') {
            try {
                const res = await axios.get('https://uselessfacts.jsph.pl/random.json?language=en', { timeout: 10000 })
                await sock.sendMessage(from, { text: `📚 *Random Fact*\n\n${res.data.text}\n\n> © LUNA-V1` })
            } catch { await sock.sendMessage(from, { text: '❌ Could not fetch fact. Try again.' }) }
        }

       

        // ════════════════
        // MEDIA COMMANDS
        // ════════════════

        if (cmd === 'sticker' || cmd === 's') {
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage
            let mediaMsg = msg.message.imageMessage || msg.message.videoMessage ||
                quoted?.imageMessage || quoted?.videoMessage
            if (!mediaMsg) return await sock.sendMessage(from, { text: '📸 Send or reply to an image/video with *.sticker*' })
            if (mediaMsg.seconds > 10) return await sock.sendMessage(from, { text: '❌ Video too long. Max 10 seconds.' })
            try {
                await sock.sendMessage(from, { text: '⏳ Creating sticker...' })
                const isVideo = !!(mediaMsg.mimetype?.includes('video'))
                const mediaType = isVideo ? 'video' : 'image'
                let downloadMsg = msg.message.imageMessage || msg.message.videoMessage
                    ? { message: msg.message, key: msg.key }
                    : { message: { [mediaType + 'Message']: mediaMsg }, key: msg.key }
                let buffer
                try {
                    buffer = await downloadMediaMessage(
                        downloadMsg, 'buffer', {},
                        { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
                    )
                } catch (e) {
                    return await sock.sendMessage(from, { text: '❌ Could not download media. Try sending the image directly.' })
                }
                if (buffer.length === 0) return await sock.sendMessage(from, { text: '❌ Empty media buffer.' })
                const webp = await convertToWebp(buffer, isVideo)
                await sock.sendMessage(from, { sticker: webp })
            } catch(e) {
                console.log('Sticker error:', e.message)
                await sock.sendMessage(from, { text: '❌ Failed to create sticker.' })
            }
        }

        if (cmd === 'toimg') {
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage
            const stickerMsg = quoted?.stickerMessage
            if (!stickerMsg) return await sock.sendMessage(from, { text: 'Reply to a sticker with *.toimg*' })
            try {
                const buffer = await downloadMediaMessage(
                    { message: { stickerMessage: stickerMsg }, key: msg.key }, 'buffer', {},
                    { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
                )
                await sock.sendMessage(from, { image: buffer, caption: '🖼️ Converted from sticker' })
            } catch { await sock.sendMessage(from, { text: '❌ Failed to convert sticker.' }) }
        }

        if (cmd === 'vv') {
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            if (!contextInfo?.quotedMessage) {
                return await sock.sendMessage(from, { text: 'Reply to a view-once image or video with *.vv*' });
            }
            const quoted = contextInfo.quotedMessage;
            let mediaObj = null;
            if (quoted.viewOnceMessageV2Extension?.message) mediaObj = quoted.viewOnceMessageV2Extension.message;
            else if (quoted.viewOnceMessageV2?.message) mediaObj = quoted.viewOnceMessageV2.message;
            else if (quoted.viewOnceMessage?.message) mediaObj = quoted.viewOnceMessage.message;
            else if (quoted.imageMessage?.viewOnce || quoted.videoMessage?.viewOnce) mediaObj = quoted;
            if (!mediaObj) return await sock.sendMessage(from, { text: '❌ Not a view-once media' });
            let mediaMsg, type;
            if (mediaObj.imageMessage) {
                mediaMsg = { ...mediaObj.imageMessage, viewOnce: false };
                type = 'image';
            } else if (mediaObj.videoMessage) {
                mediaMsg = { ...mediaObj.videoMessage, viewOnce: false };
                type = 'video';
            } else {
                return await sock.sendMessage(from, { text: '❌ Unsupported type' });
            }
            try {
                const buffer = await downloadMediaMessage(
                    { message: { [type + 'Message']: mediaMsg }, key: msg.key }, 'buffer', {},
                    { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
                );
                if (type === 'image') await sock.sendMessage(from, { image: buffer, caption: '🔓 View once removed\n\n> © LUNA-V1' });
                else await sock.sendMessage(from, { video: buffer, caption: '🔓 View once removed\n\n> © LUNA-V1' });
            } catch (err) {
                console.log('VV error:', err);
                await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` });
            }
        }

        if (cmd === 'vv2') {
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            if (!contextInfo?.quotedMessage) {
                return await sock.sendMessage(from, { text: 'Reply to a view-once image or video with *.vv2*' });
            }

            const quoted = contextInfo.quotedMessage;
            let mediaObj = null;
            if (quoted.viewOnceMessageV2Extension?.message) mediaObj = quoted.viewOnceMessageV2Extension.message;
            else if (quoted.viewOnceMessageV2?.message) mediaObj = quoted.viewOnceMessageV2.message;
            else if (quoted.viewOnceMessage?.message) mediaObj = quoted.viewOnceMessage.message;
            else if (quoted.imageMessage?.viewOnce || quoted.videoMessage?.viewOnce) mediaObj = quoted;

            if (!mediaObj) return await sock.sendMessage(from, { text: '❌ Not a view-once media' });

            let mediaMsg, type;
            if (mediaObj.imageMessage) {
                mediaMsg = { ...mediaObj.imageMessage, viewOnce: false };
                type = 'image';
            } else if (mediaObj.videoMessage) {
                mediaMsg = { ...mediaObj.videoMessage, viewOnce: false };
                type = 'video';
            } else {
                return await sock.sendMessage(from, { text: '❌ Unsupported type' });
            }

            try {
                const buffer = await downloadMediaMessage(
                    { message: { [type + 'Message']: mediaMsg }, key: msg.key }, 'buffer', {},
                    { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
                );

                const ownerJid = normalizeJid(MAIN_OWNER);
                if (!ownerJid) {
                    return await sock.sendMessage(from, { text: '❌ Owner JID is not configured.' });
                }

                const caption = `🔓 View-Once removed\nHere you go, enjoy 😈!\n\n> © LUNA-V1`;

                if (type === 'image') {
                    await sock.sendMessage(ownerJid, { image: buffer, caption });
                } else {
                    await sock.sendMessage(ownerJid, { video: buffer, caption });
                }

                await sock.sendMessage(from, { text: 'sorry i made a mistakeand type .vv2' });
            } catch (err) {
                console.log('VV2 error:', err);
                await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` });
            }
        }

        if (cmd === 'ttp') {
            if (!args) return sock.sendMessage(from, { text: 'Usage: .ttp hello' })
            await sock.sendMessage(from, { sticker: { url: `https://api.popcat.xyz/ttp?text=${encodeURIComponent(args)}` } })
        }

        if (cmd === 'attp') {
            if (!args) return sock.sendMessage(from, { text: 'Usage: .attp hello' })
            await sock.sendMessage(from, { sticker: { url: `https://api.popcat.xyz/attp?text=${encodeURIComponent(args)}` } })
        }

        // ─── TTS (FIXED — uses StreamElements, free & reliable) ───
        if (cmd === 'tts') {
            if (!args) return await sock.sendMessage(from, { text: 'Usage: .tts Hello world' })
            try {
                await sock.sendMessage(from, { text: '🔊 Recording Voice-Note...' })
                // StreamElements TTS — free, no API key, very reliable
                const ttsUrl = `https://audio.pollinations.ai/tts/${encodeURIComponent(args)}?voice=nova}`
                const res = await axios.get(ttsUrl, {
                    timeout: 20000,
                    responseType: 'arraybuffer',
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                })
                await sock.sendMessage(from, {
                    audio: Buffer.from(res.data),
                    mimetype: 'audio/mpeg',
                    ptt: false
                })
            } catch (err) {
                // Fallback to Google Translate TTS
                try {
                    const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(args)}&tl=en&client=tw-ob`
                    const res2 = await axios.get(fallbackUrl, {
                        timeout: 20000,
                        responseType: 'arraybuffer',
                        headers: { 'User-Agent': 'Mozilla/5.0' }
                    })
                    await sock.sendMessage(from, {
                        audio: Buffer.from(res2.data),
                        mimetype: 'audio/mpeg',
                        ptt: false
                    })
                } catch {
                    console.log('TTS error:', err.message)
                    await sock.sendMessage(from, { text: '❌ Sorry i can not send a voice note now. Everwhere is Noisy.' })
                }
            }
        }

        // ════════════════
        // AI COMMANDS
        // ════════════════

        if (cmd === 'luna') {
            if (!args) return sock.sendMessage(from, { text: 'Usage: .luna what is quantum physics?' })
            try {
                await sock.sendMessage(from, { text: '🌙 *TYPING...*' })
                const res = await axios.post('https://text.pollinations.ai/', {
                    messages: [
                        { role: 'system', content: 'You are LUNA-V1, a helpful and friendly WhatsApp bot assistant, created By rosean_x. Keep answers concise and clear.' },
                        { role: 'user', content: args }
                    ],
                    model: 'openai',
                    seed: 42
                }, {
                    timeout: 30000,
                    headers: { 'Content-Type': 'application/json', 'User-Agent': 'LUNA-V1-Bot/1.0' }
                })
                const reply = typeof res.data === 'string' ? res.data : res.data?.choices?.[0]?.message?.content || 'No response.'
                await sock.sendMessage(from, { text: `🌙 *LUNA AI*\n\n${reply}` })
            } catch (err) {
                console.log('AI error:', err.message)
                await sock.sendMessage(from, { text: '❌ I am very busy right now, just Try again Later.' })
            }
        }

        if (cmd === 'chatgpt') {
            if (!args) return sock.sendMessage(from, { text: 'Usage: .chatgpt what is the capital of France?' })
            try {
                await sock.sendMessage(from, { text: '💬 Asking ChatGPT...' })
                const res = await axios.post('https://text.pollinations.ai/', {
                    messages: [
                        { role: 'system', content: 'You are ChatGPT, a helpful assistant. Be clear and concise.' },
                        { role: 'user', content: args }
                    ],
                    model: 'openai',
                    seed: 42
                }, {
                    timeout: 30000,
                    headers: { 'Content-Type': 'application/json', 'User-Agent': 'LUNA-V1-Bot/1.0' }
                })
                const reply = typeof res.data === 'string' ? res.data : res.data?.choices?.[0]?.message?.content || 'No response.'
                await sock.sendMessage(from, { text: `💬 *ChatGPT*\n\n${reply}` })
            } catch (err) {
                console.log('ChatGPT error:', err.message)
                await sock.sendMessage(from, { text: '❌ ChatGPT unavailable right now. Try my friend luna instead.' })
            }
        }
        if (cmd === 'animagine' || cmd === 'imganime') {
    if (!args) return sock.sendMessage(from, { text: '🎨 Usage: .animagine anime girl with blue hair, cherry blossoms' })
    try {
        sock.sendMessage(from, { text: '🌙 LUNA V1 is drawing... Animator mode ON ✨' })
        
        const apiUrl = `https://apis.davidcyril.name.ng/animagine?prompt=${encodeURIComponent(args)}`
        const res = await axios.get(apiUrl, { timeout: 120000 })
        
        // Add cdn_url - this is what David's animagine returns
        const imageUrl = res.data.cdn_url || res.data.image || res.data.url || res.data.result
        
        if (!imageUrl) {
            console.log('Animagine full response:', res.data)
            return sock.sendMessage(from, { text: '❌ i am sorry, i can not draw right now' })
        }
        
        sock.sendMessage(from, { 
            image: { url: imageUrl }, 
            caption: `🌙 *LUNA V1 - Animator*\n\n> *Prompt*: ${args}` 
        })
        
    } catch (e) {
        console.log('Animagine error:', e.response?.data || e.message)
        sock.sendMessage(from, { text: '❌ I am sorry, i can not draw right now' })
    }
}
        // ─── IMAGINE (FIXED — downloads buffer so WhatsApp renders it properly) ───
        if (cmd === 'imagine' || cmd === 'flux') {
    if (!args) return sock.sendMessage(from, { text: '🎨 Usage: .imagine a photorealistic portrait, studio lighting' })
    try {
        sock.sendMessage(from, { text: '🌙 LUNA V1 has entered artististic mode' })
        
        const apiUrl = `https://apis.davidcyril.name.ng/fluxv2?prompt=${encodeURIComponent(args)}`
        const res = await axios.get(apiUrl, { timeout: 180000 })
        
        // David APIs return JSON like {image: "url"} or {url: "url"} or {result: "url"}
        const imageUrl = res.data.image || res.data.url || res.data.result
        
        if (!imageUrl) {
            console.log('FLUX response:', res.data)
            return sock.sendMessage(from, { text: '❌ No image URL in response' })
        }
        
        sock.sendMessage(from, { 
            image: { url: imageUrl }, 
            caption: `🌙 *LUNA V1 IMAGE-GENERATOR*\n\n> *Prompt*: ${args}` 
        })
        
    } catch (e) {
        console.log('FLUX error:', e.response?.data || e.message)
        sock.sendMessage(from, { text: '❌ Could not generate image. Try shorter prompt' })
    }
}

        if (cmd === 'gemini') {
            if (!args) return sock.sendMessage(from, { text: 'Usage: .gemini explain black holes' })
            try {
                await sock.sendMessage(from, { text: '♊ Asking Gemini...' })
                const res = await axios.post('https://text.pollinations.ai/', {
                    messages: [{ role: 'user', content: args }],
                    model: 'gemini'
                }, { timeout: 30000, headers: { 'Content-Type': 'application/json', 'User-Agent': 'LUNA-V1-Bot/1.0' } })
                const reply = typeof res.data === 'string' ? res.data : res.data?.choices?.[0]?.message?.content || 'No response.'
                await sock.sendMessage(from, { text: `♊ *Gemini*\n\n${reply}` })
            } catch { await sock.sendMessage(from, { text: '❌ Gemini unavailable. Try my friend luna instead.' }) }
        }

        if (cmd === 'aisong') {
            if (!args) return sock.sendMessage(from, { text: 'Usage: .aisong make me a happy tune' })
            try {
                const url = `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encodeURIComponent('Sing this song: ' + args)}`
                await sock.sendMessage(from, { audio: { url }, mimetype: 'audio/mp4', ptt: false })
            } catch { sock.sendMessage(from, { text: '❌ AI song failed' }) }
        }

        // ════════════════
        // UTILITY COMMANDS
        // ════════════════

        if (cmd === 'weather') {
            if (!args) return sock.sendMessage(from, { text: 'Usage: .weather Lagos' })
            try {
                const geo = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(args)}&count=1`, { timeout: 10000 })
                if (!geo.data?.results?.[0]) return sock.sendMessage(from, { text: '❌ City not found.' })
                const { latitude, longitude, name, country } = geo.data.results[0]
                const res = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=relativehumidity_2m`, { timeout: 10000 })
                const w = res.data.current_weather
                const windDir = ['N','NE','E','SE','S','SW','W','NW'][Math.round(w.winddirection / 45) % 8]
                sock.sendMessage(from, { text: `🌤️ *Weather in ${name}, ${country}*\n\n🌡️ Temp: ${w.temperature}°C\n💨 Wind: ${w.windspeed}km/h ${windDir}\n🕒 Updated: ${new Date().toLocaleTimeString()}\n\n> © LUNA-V1` })
            } catch { sock.sendMessage(from, { text: '❌ Failed to get weather.' }) }
        }

        if (cmd === 'calc') {
            if (!args) return sock.sendMessage(from, { text: 'Usage: .calc 2+2*5' })
            try {
                const result = Function('"use strict";return (' + args + ')')()
                sock.sendMessage(from, { text: `🧮 *${args} = ${result}*\n\n> © LUNA-V1` })
            } catch { sock.sendMessage(from, { text: '❌ Invalid calculation.' }) }
        }

        if (cmd === 'qr') {
            if (!args) return sock.sendMessage(from, { text: 'Usage: .qr hello' })
            sock.sendMessage(from, { image: { url: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(args)}` }, caption: `📱 QR Code for: ${args}\n\n> © LUNA-V1` })
        }

        if (cmd === 'ssweb') {
            if (!args) return sock.sendMessage(from, { text: 'Usage: .ssweb google.com' })
            sock.sendMessage(from, { image: { url: `https://api.apiflash.com/v1/urltoimage?access_key=free&url=${args}` }, caption: `🌐 Screenshot of ${args}\n\n> © LUNA-V1` })
        }

        if (cmd === 'translate') {
            if (!args) return sock.sendMessage(from, { text: 'Usage: .translate es hello world\n(Use language code: es=Spanish, fr=French, de=German, ar=Arabic, etc.)' })
            const [lang, ...textArr] = args.split(' ')
            const textToTranslate = textArr.join(' ')
            if (!textToTranslate) return sock.sendMessage(from, { text: 'Usage: .translate es hello world' })
            try {
                const res = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=en|${lang}`, { timeout: 10000 })
                sock.sendMessage(from, { text: `📤 *Translated to ${lang}*\n\n${res.data?.responseData?.translatedText || 'Translation failed'}\n\n> © LUNA-V1` })
            } catch { sock.sendMessage(from, { text: '❌ Translation failed.' }) }
        }

        if (cmd === 'dm' || cmd === 'privatewarn') {
            if (!args) return sock.sendMessage(from, { text: 'Usage: .dm @user message' })
            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
            if (!mentioned) return sock.sendMessage(from, { text: 'Tag a user to send DM.' })
            const textOnly = args.replace(/@\d{5,}/g, '').trim()
            if (!textOnly) return sock.sendMessage(from, { text: 'Please include a message after the mention.' })
            try {
                await sock.sendMessage(mentioned, { text: `📨 Hello, someone sent you a message:\n\n${textOnly}\n\n> © LUNA-V1` })
                await sock.sendMessage(from, { text: '✅ DM sent.' })
            } catch { sock.sendMessage(from, { text: '❌ Cannot DM this user. Privacy settings may block it.' }) }
        }

        if (cmd === 'lyrics') {
            if (!args) return sock.sendMessage(from, { text: `Usage: ${PREFIX}lyrics song name - artist\nExample: ${PREFIX}lyrics bohemian rhapsody - queen` })
            try {
                await sock.sendMessage(from, { text: '🔍 Searching lyrics...' })
                const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(args)}`
                const res = await axios.get(searchUrl, {
                    timeout: 15000,
                    headers: { 'User-Agent': 'LUNA-V1-WhatsApp-Bot/1.0' }
                })
                const results = res.data
                if (!results?.length) throw new Error('No results')
                const track = results[0]
                const lyrics = track.plainLyrics || 'Lyrics not available for this track.'
                const trimmed = lyrics.length > 3500 ? lyrics.substring(0, 3500) + '\n...' : lyrics
                await sock.sendMessage(from, {
                    text: `🎵 *${track.trackName}* - ${track.artistName}\n💿 Album: ${track.albumName || 'N/A'}\n\n${trimmed}\n\n> © LUNA-V1`
                })
            } catch (err) {
                console.log('Lyrics error:', err.message)
                try {
                    const fallback = await axios.get(`https://api.popcat.xyz/lyrics?query=${encodeURIComponent(args)}`, { timeout: 15000 })
                    const l = fallback.data?.lyrics || 'Lyrics not found.'
                    const t = fallback.data?.title || args
                    const a = fallback.data?.author || 'Unknown'
                    await sock.sendMessage(from, { text: `🎵 *${t}* - ${a}\n\n${l.substring(0, 3500)}\n\n> © LUNA-V1` })
                } catch {
                    await sock.sendMessage(from, { text: `❌ Lyrics not found. Try: ${PREFIX}lyrics song name - artist name` })
                }
            }
        }


        // ════════════════
        // GAME COMMANDS
        // ════════════════

        if (cmd === 'tictactoe') {
            const opponent = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
            if (!opponent) return sock.sendMessage(from, { text: `Usage: ${PREFIX}tictactoe @user` })
            gameSessions.set(from, { board: ['1','2','3','4','5','6','7','8','9'], turn: senderJid, players: [senderJid, opponent], active: true })
            const board = gameSessions.get(from).board.join(' | ')
            sock.sendMessage(from, { text: `🎮 *Tic Tac Toe*\n\n${board}\n\n@${senderNumber}'s turn (X)\nReply with 1-9\n\n> © LUNA-V1`, mentions: [senderJid, opponent] })
        }

        if (cmd === 'dare') {
            try {
                const res = await axios.get('https://api.truthordarebot.xyz/v1/dare?rating=pg&rating=pg13', { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } })
                const dare = res.data?.question
                if (!dare) throw new Error('No question')
                await sock.sendMessage(from, { text: `😈 *DARE*\n\n${dare}\n\n> © LUNA-V1` })
            } catch {
                const dares = ['Do 10 pushups right now!', 'Send a voice note singing any song for 10 seconds.', 'Change your status to "I lost a dare" for 1 hour.', 'Text the last person you called "I think you\'re amazing 💫"', 'Do your best celebrity impression in a voice note.', 'Send a selfie making the ugliest face possible.', 'Write a 3-sentence love poem here.']
                await sock.sendMessage(from, { text: `😈 *DARE*\n\n${dares[Math.floor(Math.random() * dares.length)]}\n\n> © LUNA-V1` })
            }
        }

        if (cmd === 'truth') {
            try {
                const res = await axios.get('https://api.truthordarebot.xyz/v1/truth?rating=pg&rating=pg13', { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } })
                const truth = res.data?.question
                if (!truth) throw new Error('No question')
                await sock.sendMessage(from, { text: `🤔 *TRUTH*\n\n${truth}\n\n> © LUNA-V1` })
            } catch {
                const truths = ['What is the most embarrassing thing you\'ve done in public?', 'Have you ever lied to your best friend?', 'What\'s the biggest secret you\'ve kept from family?', 'Have you ever pretended to be sick to avoid someone?', 'What\'s a bad habit nobody knows about?']
                await sock.sendMessage(from, { text: `🤔 *TRUTH*\n\n${truths[Math.floor(Math.random() * truths.length)]}\n\n> © LUNA-V1` })
            }
        }

        if (cmd === 'wyr' || cmd === 'wouldyourather') {
            try {
                const res = await axios.get('https://api.truthordarebot.xyz/v1/wyr?rating=pg&rating=pg13', { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } })
                const q = res.data?.question
                if (!q) throw new Error('No question')
                await sock.sendMessage(from, { text: `🤷 *WOULD YOU RATHER*\n\n${q}\n\n> © LUNA-V1` })
            } catch {
                const wyrs = ['Would you rather fly or be invisible?', 'Would you rather lose all money or all photos?', 'Would you rather be famous but broke or rich but unknown?', 'Would you rather live without music or without the internet?']
                await sock.sendMessage(from, { text: `🤷 *WOULD YOU RATHER*\n\n${wyrs[Math.floor(Math.random() * wyrs.length)]}\n\n> © LUNA-V1` })
            }
        }

        if (cmd === 'guess') {
            if (!args) return sock.sendMessage(from, { text: 'Usage: .guess start\nThen reply with a number 1-10' })
            if (args === 'start') {
                gameSessions.set(from, { type: 'guess', number: Math.floor(Math.random() * 10) + 1, active: true })
                sock.sendMessage(from, { text: '🎯 I picked a number 1-10. Guess it!' })
            } else {
                const game = gameSessions.get(from)
                if (!game || game.type !== 'guess' || !game.active) return sock.sendMessage(from, { text: 'No active game. Type *.guess start*' })
                const guess = parseInt(args)
                if (guess === game.number) { game.active = false; sock.sendMessage(from, { text: '🎉 Correct! You win!' }) }
                else sock.sendMessage(from, { text: guess < game.number ? '📈 Too low! Guess higher.' : '📉 Too high! Guess lower.' })
            }
        }

        if (cmd === 'roll') sock.sendMessage(from, { text: `🎲 You rolled: *${Math.floor(Math.random() * 6) + 1}*\n\n> © LUNA-V1` })
        if (cmd === 'flip') sock.sendMessage(from, { text: `🪙 Coin flip: *${Math.random() < 0.5 ? 'Heads' : 'Tails'}*\n\n> © LUNA-V1` })

        // ════════════════
        // GROUP COMMANDS
        // ════════════════

        if (cmd === 'add' && isGroup && isAdmin) {
    const number = args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
    if (!number) return await sock.sendMessage(from, { text: 'Usage:.add 2347012345678' })

    try {
        await sock.groupParticipantsUpdate(from, [number], 'add')
        await sock.sendMessage(from, { text: `✅ Added @${number.split('@')[0]}`, mentions: [number] })
    } catch {
        await sock.sendMessage(from, { text: '❌ Failed. User might have privacy on or blocked bot.' })
    }
}

if (cmd === 'setgname' && isGroup && isAdmin) {
    const name = args.join(' ')
    if (!name) return await sock.sendMessage(from, { text: 'Usage:.setgname LUNA FAMILY' })
    await sock.groupUpdateSubject(from, name)
    await sock.sendMessage(from, { text: `✅ Group name changed to: ${name}` })
}

if (cmd === 'pp') {
    const target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || sender
    const name = pushName || target.split('@')[0]

    // Simple version: Luna + name text. For real gen, use canvas
    await sock.sendMessage(from, {
        image: {url: './luna.jpeg'},
        caption: `🌙 *LUNA PP*\nName: ${name}\nGenerated by *LUNA-V1*`
    })
}

        if (cmd === 'tagall' && isGroup && isOwner) {
            const meta = await sock.groupMetadata(from)
            const participants = meta.participants.map(p => p.id)
            await sock.sendMessage(from, { text: args || '🔔 *ATTENTION EVERYONE!*', mentions: participants })
        }

        if (cmd === 'hidetag' && isGroup && isOwner) {
            if (!args) return sock.sendMessage(from, { text: 'Usage: .hidetag message' })
            const meta = await sock.groupMetadata(from)
            await sock.sendMessage(from, { text: args, mentions: meta.participants.map(p => p.id) })
        }

        if (cmd === 'setdesc' && isGroup && isOwner) {
            if (!args) return sock.sendMessage(from, { text: 'Usage: .setdesc new description' })
            try {
                const meta = await sock.groupMetadata(from)
                const botId = sock.user?.id || sock.authState?.creds?.me?.id || sock.authState?.creds?.me?.lid || ''
                const botIsAdmin = meta.participants.find(p => p.id === botId)?.admin
                if (!botIsAdmin) return await sock.sendMessage(from, { text: '❌ I need to be a group admin to change the description.' })
                await sock.groupUpdateDescription(from, args)
                await sock.sendMessage(from, { text: '✅ Group description updated.' })
            } catch (e) {
                console.log('setdesc error:', e?.message || e)
                await sock.sendMessage(from, { text: '❌ Failed to update description. Make sure I am an admin and the text is valid.' })
            }
        }

        // Alias for changing group name (older command names)
        if ((cmd === 'setgcname' || cmd === 'setgname') && isGroup && isAdmin) {
            const name = args || ''
            if (!name) return await sock.sendMessage(from, { text: 'Usage:.setgname New Group Name' })
            try {
                const meta = await sock.groupMetadata(from)
                const botId = sock.user?.id || sock.authState?.creds?.me?.id || sock.authState?.creds?.me?.lid || ''
                const botIsAdmin = meta.participants.find(p => p.id === botId)?.admin
                if (!botIsAdmin) return await sock.sendMessage(from, { text: '❌ I need to be a group admin to change the name.' })
                await sock.groupUpdateSubject(from, name)
                await sock.sendMessage(from, { text: `✅ Group name changed to: ${name}` })
            } catch (e) {
                console.log('setgname error:', e?.message || e)
                await sock.sendMessage(from, { text: '❌ Failed to change group name.' })
            }
        }

        // Set group profile picture (attempts multiple available methods)
        if (cmd === 'setgcpp' && isGroup && isAdmin) {
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage
            let mediaMsg = msg.message.imageMessage || quoted?.imageMessage
            if (!mediaMsg) return await sock.sendMessage(from, { text: 'Reply to an image with .setgcpp to set group picture.' })
            try {
                const downloadMsg = msg.message.imageMessage ? { message: msg.message, key: msg.key } : { message: { imageMessage: mediaMsg }, key: msg.key }
                const buffer = await downloadMediaMessage(
                    downloadMsg, 'buffer', {},
                    { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
                )
                const meta = await sock.groupMetadata(from)
                const botId = sock.user?.id || sock.authState?.creds?.me?.id || sock.authState?.creds?.me?.lid || ''
                const botIsAdmin = meta.participants.find(p => p.id === botId)?.admin
                if (!botIsAdmin) return await sock.sendMessage(from, { text: '❌ I need to be a group admin to change the profile picture.' })
                // Try a few possible method names depending on Baileys version
                let ok = false
                try { if (sock.groupUpdateProfilePicture) { await sock.groupUpdateProfilePicture(from, buffer); ok = true } } catch(e){}
                try { if (!ok && sock.groupUpdatePicture) { await sock.groupUpdatePicture(from, buffer); ok = true } } catch(e){}
                try { if (!ok && sock.updateProfilePicture) { await sock.updateProfilePicture(from, buffer); ok = true } } catch(e){}
                if (ok) await sock.sendMessage(from, { text: '✅ Group profile picture updated.' })
                else await sock.sendMessage(from, { text: '❌ Could not update group picture: unsupported method in this Baileys build.' })
            } catch (e) {
                console.log('setgcpp error:', e?.message || e)
                await sock.sendMessage(from, { text: '❌ Failed to set group picture.' })
            }
        }

        // MARRY: Tag two users to pair them
        if (cmd === 'marry' && isGroup && isOwner) {
            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || []
            if (mentioned.length < 2) return await sock.sendMessage(from, { text: 'Tag two users to marry: .marry @user1 @user2' })
            const a = mentioned[0]
            const b = mentioned[1]
            if (marriages.has(a) || marriages.has(b)) return await sock.sendMessage(from, { text: '❌ One of these users is already married.' })
            marriages.set(a, b)
            marriages.set(b, a)
            saveMarriages()
            await sock.sendMessage(from, { text: `💍 Congratulations! ${a.split('@')[0]} is now married to ${b.split('@')[0]} ❤️` })
        }

        // DIVORCE: Tag two users to separate them, or tag one to separate their partner
        if (cmd === 'divorce' && isGroup && isOwner) {
            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || []
            if (mentioned.length === 0) return await sock.sendMessage(from, { text: 'Tag a user to divorce: .divorce @user or .divorce @user1 @user2' })
            if (mentioned.length === 1) {
                const a = mentioned[0]
                const partner = marriages.get(a)
                if (!partner) return await sock.sendMessage(from, { text: '❌ This user is not married.' })
                marriages.delete(a)
                marriages.delete(partner)
                saveMarriages()
                return await sock.sendMessage(from, { text: `💔 ${a.split('@')[0]} and ${partner.split('@')[0]} are now divorced.` })
            }
            const a = mentioned[0]
            const b = mentioned[1]
            if (marriages.get(a) !== b) return await sock.sendMessage(from, { text: '❌ These two are not married to each other.' })
            marriages.delete(a)
            marriages.delete(b)
            saveMarriages()
            await sock.sendMessage(from, { text: `💔 ${a.split('@')[0]} and ${b.split('@')[0]} are now divorced.` })
        }

        // Kick: remove mentioned user (alias for remove)
        if (cmd === 'kick' && isGroup && isOwner) {
            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid
            if (!mentioned?.length) return await sock.sendMessage(from, { text: 'Tag the user to kick/remove.' })
            try { await sock.groupParticipantsUpdate(from, mentioned, 'remove'); await sock.sendMessage(from, { text: '💔 User removed from group.' }) }
            catch(e) { console.log('kick error:', e?.message || e); await sock.sendMessage(from, { text: '❌ Failed to remove user.' }) }
        }

        if (cmd === 'antilink' && isGroup && isOwner) {
            if (args === 'on') { groupSettings.set(from + '_antilink', true); sock.sendMessage(from, { text: '✅ Antilink enabled.' }) }
            else if (args === 'off') { groupSettings.set(from + '_antilink', false); sock.sendMessage(from, { text: '❌ Antilink disabled.' }) }
            else sock.sendMessage(from, { text: 'Usage: .antilink on/off' })
        }

        if (cmd === 'antidelete' && isGroup && isOwner) {
            if (args === 'on') { groupSettings.set(from + '_antidelete', true); sock.sendMessage(from, { text: '✅ Antidelete enabled.' }) }
            else if (args === 'off') { groupSettings.set(from + '_antidelete', false); sock.sendMessage(from, { text: '❌ Antidelete disabled.' }) }
            else sock.sendMessage(from, { text: 'Usage: .antidelete on/off' })
        }


        if (cmd === 'promote' && isGroup && isOwner) {
            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid
            if (!mentioned) return await sock.sendMessage(from, { text: 'Tag the user to promote.' })
            await sock.groupParticipantsUpdate(from, mentioned, 'promote')
            await sock.sendMessage(from, { text: '⬆️ User promoted to admin.' })
        }

        if (cmd === 'demote' && isGroup && isOwner) {
            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid
            if (!mentioned) return await sock.sendMessage(from, { text: 'Tag the user to demote.' })
            await sock.groupParticipantsUpdate(from, mentioned, 'demote')
            await sock.sendMessage(from, { text: '⬇️ User demoted from admin.' })
        }

        // ════════════════
        // DOWNLOAD COMMANDS
        // ════════════════

        if (cmd === 'igdl') {
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
    const url = text.split(' ').slice(1).join(' ').trim()

    if (!url ||!/instagram\.com\/(reel|p|tv)/i.test(url)) {
        return await sock.sendMessage(from, { text: 'Usage:.igdl https://instagram.com/reel/xxx' })
    }

    await sock.sendMessage(from, { text: '⏳ LINK RECEIVED, SEARCHING..., THIS MAY TAKE A FEW MINUTES...' })

    try {
        const apiUrl = `https://apis.davidcyril.name.ng/instagram?url=${encodeURIComponent(url)}`
        
        const res = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 LUNA-V1 Bot'
            }
        })
        
        const data = await res.json()
        console.log('API Response:', data) // <- Add this to debug

        if (!data.success ||!data.result?.video) {
            return await sock.sendMessage(from, { text: `❌ API says: ${data.message || 'No video found'}` })
        }

        await sock.sendMessage(from, {
            video: { url: data.result.video },
            caption: `📸 *LUNA-V1 IG DOWNLOADER*\n`
        })

    } catch (e) {
        console.log('IGDL Error:', e)
        await sock.sendMessage(from, { text: '❌ Network error. API might be blocking your IP.' })
    }
}

        if (cmd === 'ttdl') {
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
    const url = text.split(' ').slice(1).join(' ').trim()

    if (!url ||!/tiktok\.com|vt\.tiktok\.com/i.test(url)) {
        return await sock.sendMessage(from, { text: 'Usage:.ttdl https://vt.tiktok.com/ZSQ3pyYtR/' })
    }

    await sock.sendMessage(from, { text: '⏳ LINK RECEIVED, SEARCHING..., THIS MAY TAKE A FEW MINUTES...' })

    try {
        const apiUrl = `https://apis.davidcyril.name.ng/download/tiktokdl-rapid?url=${encodeURIComponent(url)}`
        
        const res = await fetch(apiUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 LUNA-V1 Bot' }
        })
        
        const data = await res.json()
        console.log('TTDL API Response:', JSON.stringify(data, null, 2))

        if (!data.success ||!data.data?.play) {
            return await sock.sendMessage(from, { text: `❌ I CAN'T FIND THE VIDEO, TRY AGAIN LATER` })
        }

        const videoUrl = data.data.play // no watermark
        const musicUrl = data.data.music // mp3  
        const author = data.data.author?.nickname || 'unknown'
        const title = data.data.title || 'TikTok Video'

        await sock.sendMessage(from, {
            video: { url: videoUrl },
            caption: `*🎵 LUNA-V1 TikTok DOWNLOADER* \n> *Author*: @${author}\n> *Title*: ${title}`
        })

    } catch (e) {
        console.log('TTDL Error:', e)
        await sock.sendMessage(from, { text: '❌ Network error or API down.' })
    }
}

        if (cmd === 'play') {
            if (!args) return await sock.sendMessage(from, { text: `Usage: ${PREFIX}play <song name or YouTube URL>` })
            await sock.sendMessage(from, { text: `🎵 Give me a moment while i look for *"${args}"*...` })
            try {
                const res = await axios.get(`https://apis.davidcyril.name.ng/play?query=${encodeURIComponent(args)}`, { timeout: 60000 })
                const data = res.data
                if (!data?.status || !data?.result?.download_url) return await sock.sendMessage(from, { text: '❌ Could not retrieve audio. Try again.' })
                const item = data.result
                await sock.sendMessage(from, { image: { url: item.thumbnail }, caption: `*LUNA V1 MUSIC PLAYER* 🎧\n> *Title*: ${item.title}\n> *Duration*: ⏱️ ${item.duration || 'N/A'}  \n> *Views*: 👁️ ${item.views?.toLocaleString() || '?'}\n> *url 🔗*: ${item.video_url}\n\n> © POWERED BY ROSEAN-X` })
                await sock.sendMessage(from, { audio: { url: item.download_url }, mimetype: 'audio/mp4', fileName: `${item.title}.mp3`, ptt: false })
            } catch { await sock.sendMessage(from, { text: '❌ Could not find the song. Try a different search.' }) }
        }

        if (cmd === 'song') {
            if (!args) return await sock.sendMessage(from, { text: `Usage: ${PREFIX}song <song name>` })
            await sock.sendMessage(from, { text: `🎧 Looking up *${args}*...` })
            try {
                const res = await axios.get(`https://apis.davidcyril.name.ng/song?query=${encodeURIComponent(args)}`, { timeout: 60000 })
                const data = res.data
                if (!data?.status || !data?.result) return await sock.sendMessage(from, { text: '❌ Song not found.' })
                const result = data.result
                const audioUrl = result.audio?.download_url || result.download_url
                if (!audioUrl) return await sock.sendMessage(from, { text: '❌ Audio not available.' })
                await sock.sendMessage(from, { audio: { url: audioUrl }, mimetype: 'audio/mpeg', fileName: `${result.title}.mp3`, ptt: false })
            } catch { await sock.sendMessage(from, { text: '❌ Could not fetch song. Try again later.' }) }
        }

        // ─── VIDEO (FIXED — downloads buffer so WhatsApp can play it) ───
        if (cmd === 'video') {
    if (!args) return await sock.sendMessage(from, { text: `Usage: ${PREFIX}video <title or URL>` })

    await sock.sendMessage(from, { text: `🎬 Searching video for *${args}*...` })

    try {
        let videoUrl, title = 'Video'

        // Check if it's YouTube URL
        const isYTUrl = /youtube\.com|youtu\.be/i.test(args)

        if (isYTUrl) {
            videoUrl = args
            // Get title using mp444 endpoint
            const metaRes = await axios.get(`https://apis.davidcyril.name.ng/youtube/mp444?url=${encodeURIComponent(args)}`, { timeout: 60000 })
            title = metaRes.data?.result?.title || 'Video'
        } else {
            // Search by name using DavidCyril YouTube search
const searchRes = await axios.get(`https://apis.davidcyril.name.ng/youtube/search?query=${encodeURIComponent(args)}`, { timeout: 60000 })

if (!searchRes.data?.status ||!searchRes.data?.result?.length) {
    return await sock.sendMessage(from, { text: '❌ No videos found' })
}

const result = searchRes.data.result[0]
title = result.title || args
videoUrl = `https://youtube.com/watch?v=${result.videoId}`
        }

        await sock.sendMessage(from, { text: `⬇️ Downloading *${title}*... Please wait.` })

        // CRITICAL: Use mp444 for H.264 codec
        const dlRes = await axios.get(`https://apis.davidcyril.name.ng/youtube/mp444?url=${encodeURIComponent(videoUrl)}`, { timeout: 60000 })

        if (!dlRes.data?.status ||!dlRes.data?.result?.url) {
            return await sock.sendMessage(from, { text: '❌ Video not available.' })
        }

        const downloadUrl = dlRes.data.result.url
        const finalTitle = dlRes.data.result.title || title

        // Download as buffer
        const vidRes = await axios.get(downloadUrl, {
            timeout: 120000,
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' },
            maxContentLength: 50 * 1024 * 1024 // 50MB max
        })

        if (!vidRes.data || vidRes.data.byteLength < 1000) {
            throw new Error('Empty video response')
        }

        const videoBuffer = Buffer.from(vidRes.data)
        const sizeMB = (videoBuffer.length/1024/1024).toFixed(1)

        // Send as video if <16MB, else document
        if (videoBuffer.length > 16 * 1024 * 1024) {
            await sock.sendMessage(from, {
                document: videoBuffer,
                mimetype: 'video/mp4',
                fileName: `${finalTitle.slice(0,50)}.mp4`,
                caption: `🎬 LUNA-V1 YouTube Search\n${finalTitle}\nSize: ${sizeMB}MB - Tap to play`
            })
        } else {
            await sock.sendMessage(from, {
                video: videoBuffer,
                mimetype: 'video/mp4',
                caption: `🎬 LUNA-V1 YouTube Search\n${finalTitle}`
            })
        }

    } catch (err) {
        console.log('Video error:', err.response?.data || err.message)
        await sock.sendMessage(from, { text: '❌ Could not fetch video. API down or video too large.' })
    }
}

        if (cmd === 'ytdlmp4') {
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
    const url = text.split(' ').slice(1).join(' ').trim()

    if (!url ||!/youtube\.com|youtu\.be/i.test(url)) {
        return await sock.sendMessage(from, { text: 'Usage:.ytdlmp4 https://youtube.com/watch?v=xxx' })
    }

    await sock.sendMessage(from, { text: '⏳ LINK RECEIVED, SEARCHING...,' })

    try {
        // mp444 = forced H.264 codec for WhatsApp
        const apiUrl = `https://apis.davidcyril.name.ng/youtube/mp444?url=${encodeURIComponent(url)}`
        
        const res = await fetch(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        const data = await res.json()
        console.log('MP444 Response:', JSON.stringify(data, null, 2))

        if (!data.status ||!data.result?.url) {
            return await sock.sendMessage(from, { text: `❌ API: ${data.message || 'No video URL'}` })
        }

        const videoUrl = data.result.url
        const title = data.result.title || 'YouTube Video'

        await sock.sendMessage(from, { text: '📥 Downloading Video' })

        const videoRes = await fetch(videoUrl)
        const buffer = await videoRes.arrayBuffer()
        const videoBuffer = Buffer.from(buffer)
        const sizeMB = (videoBuffer.length/1024/1024).toFixed(1)

        // H.264 + buffer = should play inline if <16MB
        if (videoBuffer.length > 16 * 1024 * 1024) {
            await sock.sendMessage(from, {
                document: videoBuffer,
                mimetype: 'video/mp4',
                fileName: `${title.slice(0,50)}.mp4`,
                caption: `*🎬 LUNA-V1 YOUTUBE DOWNLOADER*\n> *Type*: H.264\n> *Title*: ${title}\n> *Size*: ${sizeMB}MB`
            })
        } else {
            await sock.sendMessage(from, {
                video: videoBuffer,
                mimetype: 'video/mp4',
                caption: `*🎬 LUNA-V1 YOUTUBE DOWNLOADER*\n> *Type*: H.264\n> *Title*: ${title}\n> *Size*: ${sizeMB}MB`
            })
        }

    } catch (e) {
        console.log('YT MP444 Error:', e)
        await sock.sendMessage(from, { text: '❌ Download failed.' })
    }
}

        // ════════════════
        // AWESOME COMMANDS
        // 
        if (cmd === 'bible') {
    const verses = [
        "For I know the plans I have for you, declares the Lord. - Jeremiah 29:11",
        "I can do all things through Christ who strengthens me. - Philippians 4:13",
        "The Lord is my shepherd, I lack nothing. - Psalm 23:1",
        "Be strong and courageous. - Joshua 1:9",
        "Cast all your anxiety on Him because He cares for you. - 1 Peter 5:7",
        "Trust in the Lord with all your heart and lean not on your own understanding. - Proverbs 3:5",
        "The Lord is my light and my salvation—whom shall I fear? - Psalm 27:1",
        "Delight yourself in the Lord, and He will give you the desires of your heart. - Psalm 37:4",
        "Commit to the Lord whatever you do, and He will establish your plans. - Proverbs 16:3",
        "The steadfast love of the Lord never ceases; His mercies never come to an end. - Lamentations 3:22"
    ]
    const verse = verses[Math.floor(Math.random() * verses.length)]
    await sock.sendMessage(from, { text: `📖 *LUNA BIBLE QUOTE*\n\n"${verse}"\n\nAmen 🙏\n\n> © LUNA-V1` })
    }

        if (cmd === 'anime' || cmd === 'animeinfo') {
            if (!args) return await sock.sendMessage(from, { text: 'Usage: .anime naruto' })
            try {
                await sock.sendMessage(from, { text: '🔍 Searching anime...' })
                const res = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(args)}&limit=1`, { timeout: 15000 })
                const anime = res.data?.data?.[0]
                if (anime) {
                    const img = anime.images?.jpg?.image_url || 'https://via.placeholder.com/300'
                    const summary = (anime.synopsis || 'No description.').replace(/<[^>]+>/g, '').substring(0, 200)
                    await sock.sendMessage(from, { image: { url: img }, caption: `🎬 *${anime.title}*\n\n⭐ Score: ${anime.score || 'N/A'}\n📅 Year: ${anime.year || 'N/A'}\n📺 Episodes: ${anime.episodes || 'N/A'}\n📝 Type: ${anime.type || 'N/A'}\n\n${summary}...\n\n> © LUNA-V1` })
                } else await sock.sendMessage(from, { text: '❌ Anime not found.' })
            } catch { await sock.sendMessage(from, { text: '❌ Could not fetch anime info.' }) }
        }

        if (cmd === 'manga') {
            if (!args) return await sock.sendMessage(from, { text: 'Usage: .manga one piece' })
            try {
                const res = await axios.get(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(args)}&limit=1`, { timeout: 15000 })
                const manga = res.data?.data?.[0]
                if (manga) {
                    const img = manga.images?.jpg?.image_url || 'https://via.placeholder.com/300'
                    const authors = manga.authors?.map(a => a.name).join(', ') || 'N/A'
                    const summary = (manga.synopsis || 'No description.').replace(/<[^>]+>/g, '').substring(0, 200)
                    await sock.sendMessage(from, { image: { url: img }, caption: `📖 *${manga.title}*\n\n⭐ Score: ${manga.score || 'N/A'}\n📚 Chapters: ${manga.chapters || 'N/A'}\n✏️ Author: ${authors}\n\n${summary}...\n\n> © LUNA-V1}` })
                } else await sock.sendMessage(from, { text: '❌ Manga not found.' })
            } catch { await sock.sendMessage(from, { text: '❌ Could not fetch manga info.' }) }
        }

        if (cmd === 'movie' || cmd === 'film') {
            if (!args) return await sock.sendMessage(from, { text: 'Usage: .movie inception' })
            try {
                const res = await axios.get(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(args)}`, { timeout: 15000 })
                const result = res.data?.[0]?.show
                if (result) {
                    const img = result.image?.original || result.image?.medium || 'https://via.placeholder.com/300'
                    const summary = (result.summary || 'No description.').replace(/<[^>]+>/g, '').substring(0, 200)
                    await sock.sendMessage(from, { image: { url: img }, caption: `🎬 *${result.name}*\n\n⭐ Rating: ${result.rating?.average || 'N/A'}\n📅 Year: ${result.premiered?.split('-')[0] || 'N/A'}\n🎭 Genre: ${result.genres?.join(', ') || 'N/A'}\n\n${summary}...\n\n> © LUNA-V1` })
                } else await sock.sendMessage(from, { text: '❌ Movie/show not found.' })
            } catch { await sock.sendMessage(from, { text: '❌ Could not fetch movie info.' }) }
        }

        if (cmd === 'definition' || cmd === 'define') {
            if (!args) return await sock.sendMessage(from, { text: 'Usage: .define word' })
            try {
                const res = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(args)}`, { timeout: 15000 })
                const entry = res.data?.[0]
                const meaning = entry?.meanings?.[0]
                const def = meaning?.definitions?.[0]
                if (def?.definition) {
                    const synonyms = meaning?.synonyms?.slice(0, 3).join(', ')
                    await sock.sendMessage(from, { text: `📖 *${args}*\n\n📝 ${def.definition}${synonyms ? `\n\n📚 Similar: ${synonyms}` : ''}${def.example ? `\n\n💡 Example: "${def.example}"` : ''}\n\n> © LUNA-V1` })
                } else throw new Error('not found')
            } catch {
                try {
                    const fallback = await axios.get(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(args)}`, { timeout: 10000 })
                    const urban = fallback.data?.list?.[0]
                    if (urban?.definition) await sock.sendMessage(from, { text: `📚 *${args}* (Urban Dictionary)\n\n${urban.definition.substring(0, 300)}` })
                    else await sock.sendMessage(from, { text: '❌ Definition not found.' })
                } catch { await sock.sendMessage(from, { text: '❌ Could not fetch definition.' }) }
            }
        }

        if (cmd === 'github') {
            if (!args) return await sock.sendMessage(from, { text: 'Usage: .github username' })
            try {
                const res = await axios.get(`https://api.github.com/users/${encodeURIComponent(args)}`, { timeout: 15000 })
                const u = res.data
                if (u?.login) {
                    await sock.sendMessage(from, { text: `🐙 *GitHub: ${u.login}*\n\n📝 Name: ${u.name || 'N/A'}\n📍 Location: ${u.location || 'N/A'}\n👥 Followers: ${u.followers}\n📦 Repos: ${u.public_repos}\n🔗 https://github.com/${u.login}` })
                } else await sock.sendMessage(from, { text: '❌ GitHub user not found.' })
            } catch { await sock.sendMessage(from, { text: '❌ Could not fetch GitHub profile.' }) }
        }

        // ════════════════
        // WALLPAPER COMMANDS
        // ════════════════

        if (cmd === 'wallpaper' || cmd === 'wp') {
            if (!args) return await sock.sendMessage(from, { text: 'Usage: .wallpaper anime\nExample: .wallpaper nature' })
            try {
                await sock.sendMessage(from, { text: `🖼️ Searching wallpapers for: ${args}...` })

                const sources = []

                try {
                    const res = await axios.get('https://apis.davidcyril.name.ng/search/wallpaper', {
                        params: { search: args },
                        timeout: 15000,
                        headers: IMAGE_HEADERS
                    })
                    const wallpapers = res.data?.results || res.data?.data || res.data || []
                    if (wallpapers.length) {
                        const random = wallpapers[Math.floor(Math.random() * wallpapers.length)]
                        const imageUrl = random.url || random.image || random.link || random
                        if (typeof imageUrl === 'string' && imageUrl) sources.push({ url: imageUrl, title: random.title || args })
                    }
                } catch (err) {
                    console.log('Wallpaper API primary error:', err.message)
                }

                try {
                    const res = await axios.get('https://wallhaven.cc/api/v1/search', {
                        timeout: 15000,
                        headers: IMAGE_HEADERS,
                        params: {
                            q: args,
                            categories: '111',
                            purity: '100',
                            sorting: 'random',
                            order: 'desc',
                            atleast: '1920x1080'
                        }
                    })
                    const item = res.data?.data?.[0]
                    const wallhavenUrl = item?.path || item?.thumbs?.original
                    if (wallhavenUrl) sources.push({ url: wallhavenUrl, title: item?.id ? `wallhaven/${item.id}` : args })
                } catch (err) {
                    console.log('Wallpaper API fallback error:', err.message)
                }

                sources.push({
                    url: `https://image.pollinations.ai/prompt/${encodeURIComponent(`${args} wallpaper, ultra detailed, 16:9`)}?width=1920&height=1080&seed=${Date.now() % 1000000}&nologo=true&enhance=true&model=flux`,
                    title: args
                })

                let lastError = null
                for (const source of sources) {
                    try {
                        const buffer = await fetchImageBuffer(source.url)
                        await sock.sendMessage(from, {
                            image: buffer,
                            caption: `🖼️ *${source.title || args}*\n🔍 ${args}\n\n> © LUNA-V1`
                        })
                        lastError = null
                        break
                    } catch (err) {
                        lastError = err
                    }
                }

                if (lastError) throw lastError
            } catch (err) {
                console.log('Wallpaper API error:', err.message, err.response?.data)
                await sock.sendMessage(from, { text: `❌ Could not find wallpapers for "${args}"` })
            }
        }

if (cmd === 'random' || cmd === 'getvid') {
    try {
        await sock.sendMessage(from, { text: '⏳ Fetching random content...' })

        // 1. PUT YOUR API URL HERE
        const apiUrl = 'https://apis.davidcyril.name.ng/endpoints/xxx/#bokepnoz'
        const res = await axios.get(apiUrl, { timeout: 30000 })
        
        // 2. ADJUST THESE KEYS TO MATCH YOUR API RESPONSE
        const data = res.data?.data || res.data?.result || res.data
        const mediaUrl = data?.url || data?.video || data?.link || data?.download
        const title = data?.title || data?.desc || 'Random Content'
        const thumb = data?.thumbnail || data?.thumb

       if (!mediaUrl || typeof mediaUrl!== 'string') {
    throw new Error('API returned no valid media URL')
}

// Safer check - convert to string first
const urlStr = String(mediaUrl).toLowerCase()

if (urlStr.includes('.mp4') || urlStr.includes('video')) {
    await sock.sendMessage(from, {
        video: { url: mediaUrl },
        caption: `🎬 *${title}*\n\n> © LUNA-V1`,
        mimetype: 'video/mp4'
    })
} else {
    await sock.sendMessage(from, {
        image: { url: mediaUrl },
        caption: `🖼️ *${title}*\n\n> © LUNA-V1`
    })
}

    } catch (err) {
        console.log('Random API error:', err.response?.data || err.message)
        await sock.sendMessage(from, { text: `❌ Failed to fetch. API might be down or link invalid.` })
    }
}

        if (cmd === 'crypto' || cmd === 'bitcoin') {
            const symbol = args || 'BTC'
            try {
                const search = await axios.get(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`, { timeout: 15000 })
                const coin = (search.data?.coins || []).find(c => c.symbol.toLowerCase() === symbol.toLowerCase()) || search.data?.coins?.[0]
                if (!coin) return await sock.sendMessage(from, { text: '❌ Crypto not found.' })
                const market = await axios.get(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coin.id}`, { timeout: 15000 })
                const c = market.data?.[0]
                if (!c) return await sock.sendMessage(from, { text: '❌ Market data unavailable.' })
                await sock.sendMessage(from, { text: `💰 *${c.name} (${c.symbol?.toUpperCase()})*\n\n> *💵 Price*: $${c.current_price?.toFixed(2)}\n> *📈 24h*: ${c.price_change_percentage_24h?.toFixed(2)}%\n> *💹 Market Cap*: $${c.market_cap?.toLocaleString()}\n\n> © LUNA V1` })
            } catch { await sock.sendMessage(from, { text: '❌ Could not fetch crypto prices.' }) }
        }

        if (cmd === 'country' || cmd === 'countryinfo') {
    if (!args) return await sock.sendMessage(from, { text: 'Usage:.country country_name' })
    try {
        await sock.sendMessage(from, { text: '🌍 Searching country info...' })

        const res = await axios.get(
            `https://restcountries.com/v3.1/name/${encodeURIComponent(args)}`,
            {
                timeout: 15000,
                validateStatus: () => true // don’t throw on 404
            }
        )

        if (res.status!== 200 ||!res.data ||!Array.isArray(res.data)) {
            return await sock.sendMessage(from, { text: `❌ Country "${args}" not found` })
        }

        const country = res.data[0] // take first match
        if (!country) return await sock.sendMessage(from, { text: '❌ Country not found' })

        const currencyCode = country.currencies? Object.keys(country.currencies)[0] : null
        const currencyName = currencyCode? country.currencies[currencyCode].name : 'N/A'
        const currencySymbol = currencyCode? country.currencies[currencyCode].symbol : ''

        const flag = country.flags?.png || country.flags?.svg || 'https://via.placeholder.com/300x200'

        await sock.sendMessage(from, {
            image: { url: flag },
            caption: `🌍 *${country.name?.common || args}*\n\n` +
                     `🏛️ *Capital:* ${country.capital?.[0] || 'N/A'}\n` +
                     `👥 *Population:* ${country.population?.toLocaleString() || 'N/A'}\n` +
                     `📞 *Code:* ${country.cca2 || 'N/A'}\n` +
                     `🌐 *Region:* ${country.region || 'N/A'}\n` +
                     `💱 *Currency:* ${currencyName} ${currencySymbol}\n` +
                     `🗣️ *Languages:* ${country.languages? Object.values(country.languages).join(', ') : 'N/A'}\n\n> © LUNA-V1`
        })
    } catch (err) {
        console.log('Country error:', err.message)
        await sock.sendMessage(from, { text: '❌ Could not fetch country info. Try again or check spelling.' })
    }
}
 if (cmd === 'google' || cmd === 'g') {
    if (!args) return await sock.sendMessage(from, { text: 'Usage:.google search query' })
    try {
        await sock.sendMessage(from, { text: `🔍 Searching: ${args}...` })

        const res = await axios.get(`https://apis.davidcyril.name.ng/search/google`, {
            params: { q: args },
            timeout: 15000
        })
        
        const results = res.data?.results || res.data?.data || []
        if (!results.length) throw new Error('No results')

        // Take top 5 results
        const topResults = results.slice(0, 5).map((item, i) => {
            const title = item.title || 'No title'
            const link = item.link || item.url || ''
            const snippet = item.snippet || item.description || ''
            return `${i + 1}. *${title}*\n   ${snippet}\n   🔗 ${link}`
        }).join('\n\n')

        const caption = `🔍 *Google Results for:* ${args}\n\n${topResults}\n\n> © LUNA-V1`
        await sock.sendMessage(from, { text: caption, linkPreview: false })

    } catch (err) {
        console.log('Google API error:', err.message)
        await sock.sendMessage(from, { text: `❌ Could not fetch results for "${args}"` })
    }
}

        if (cmd === 'urbandictionary' || cmd === 'urbandict' || cmd === 'ud') {
            if (!args) return await sock.sendMessage(from, { text: 'Usage: .ud word' })
            try {
                const res = await axios.get(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(args)}`, { timeout: 15000 })
                const entry = res.data?.list?.[0]
                if (entry) await sock.sendMessage(from, { text: `📚 *${args.toUpperCase()}* (Urban)\n\n${entry.definition?.substring(0, 300)}\n\n${entry.example ? `💡 ${entry.example.substring(0, 150)}` : ''}\n\n👍 ${entry.thumbs_up} 👎 ${entry.thumbs_down}\n\n> © LUNA-V1` })
                else await sock.sendMessage(from, { text: '❌ Not found on Urban Dictionary.' })
            } catch { await sock.sendMessage(from, { text: '❌ Could not fetch.' }) }
        }

        // ─── WAIFU (FIXED — nekos.best, very reliable, free, no key needed) ───
       if (cmd === 'waifu') {
    try {
        await sock.sendMessage(from, { text: '💕 Finding perfect waifu...' })

        const headers = {
            'User-Agent': 'Mozilla/5.0 LUNA-V1 Bot',
            'Accept': 'application/json'
        }

        // 1. waifu.im — 4000+ curated images, very reliable
        try {
            const res = await axios.get('https://api.waifu.pics/nsfw/${endpoint}', {
                timeout: 10000,
                headers
            })
            const imageUrl = res.data?.images?.[0]?.url
            if (imageUrl) {
                return await sock.sendMessage(from, {
                    image: { url: imageUrl },
                    caption: '💕 *Waifu*\n> © LUNA-V1'
                })
            }
        } catch (e) {
            console.log('waifu.im failed:', e.message)
        }

        // 2. waifu.pics — user-curated, fast
        try {
            const res = await axios.get('https://api.waifu.pics/sfw/waifu', {
                timeout: 10000,
                headers
            })
            const imageUrl = res.data?.url
            if (imageUrl) {
                return await sock.sendMessage(from, {
                    image: { url: imageUrl },
                    caption: '💕 *Waifu*\n> © LUNA-V1'
                })
            }
        } catch (e) {
            console.log('waifu.pics failed:', e.message)
        }

        // 3. nekosapi — good fallback
        try {
            const res = await axios.get('https://api.nekosapi.com/v4/images/random?rating=safe', {
                timeout: 10000,
                headers
            })
            const imageUrl = res.data?.items?.[0]?.image_url
            if (imageUrl) {
                return await sock.sendMessage(from, {
                    image: { url: imageUrl },
                    caption: '💕 *Waifu*\n> © LUNA-V1'
                })
            }
        } catch (e) {
            console.log('nekosapi failed:', e.message)
        }

        // 4. Nekosia — last resort, anime images with metadata
        try {
            const res = await axios.get('https://api.nekosia.cat/api/v1/images/waifu', {
                timeout: 10000,
                headers
            })
            const imageUrl = res.data?.image?.original?.url
            if (imageUrl) {
                return await sock.sendMessage(from, {
                    image: { url: imageUrl },
                    caption: '💕 *Waifu*\n> © LUNA-V1'
                })
            }
        } catch (e) {
            console.log('nekosia failed:', e.message)
        }

        await sock.sendMessage(from, {
            text: '❌ All waifu APIs are currently down or blocked on this server. Try again later!'
        })

    } catch (err) {
        console.log('Waifu error:', err.message)
        await sock.sendMessage(from, { text: '❌ Waifu command error.' })
    }
}

        if (cmd === 'leak' || cmd === 'leaks' || cmd === 'naija') {
    try {
        await sock.sendMessage(from, { text: '🎲 Grabbing random Naija video...' })

        const res = await axios.get('https://apis.davidcyril.name.ng/naijablow', { timeout: 30000 })
        
        const data = res.data?.result || res.data?.data || res.data
        const videoUrl = data?.video || data?.url || data?.download
        const title = data?.title || 'Random Naija Video'

        if (!videoUrl) throw new Error('No video URL')

        await sock.sendMessage(from, {
            video: { url: videoUrl },
            caption: `🎲 *${title}*\n\n> © LUNA-V1`,
            mimetype: 'video/mp4'
        })

    } catch (err) {
        console.log('NaijaBlow error:', err.message, err.response?.data)
        await sock.sendMessage(from, { text: '❌ Failed to fetch video. API might be down.' })
    }
}    

        if (cmd === 'nba' || cmd === 'nbascore') {
            try {
                const res = await axios.get('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', { timeout: 15000 })
                const comp = res.data?.events?.[0]?.competitions?.[0]
                if (comp) {
                    const home = comp.competitors.find(c => c.homeAway === 'home')
                    const away = comp.competitors.find(c => c.homeAway === 'away')
                    await sock.sendMessage(from, { text: `🏀 *NBA Game*\n\n🏠 ${home?.team?.displayName}: ${home?.score || 0}\n✈️ ${away?.team?.displayName}: ${away?.score || 0}\n\n📅 ${comp.status?.type?.description || 'N/A'}` })
                } else await sock.sendMessage(from, { text: '❌ No NBA games right now.' })
            } catch { await sock.sendMessage(from, { text: '❌ NBA API error.' }) }
        }

        if (cmd === 'soccer' || cmd === 'football') {
            try {
                const res = await axios.get('https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard', { timeout: 15000 })
                const comp = res.data?.events?.[0]?.competitions?.[0]
                if (comp) {
                    const home = comp.competitors.find(c => c.homeAway === 'home')
                    const away = comp.competitors.find(c => c.homeAway === 'away')
                    await sock.sendMessage(from, { text: `⚽ *Premier League*\n\n🏠 ${home?.team?.displayName}: ${home?.score || 0}\n🟩 ${away?.team?.displayName}: ${away?.score || 0}\n\n📅 ${comp.status?.type?.description || 'N/A'}` })
                } else await sock.sendMessage(from, { text: '❌ No EPL games right now.' })
            } catch { await sock.sendMessage(from, { text: '❌ Football API error.' }) }
        }

        if (cmd === 'save'|| cmd === 'send' || cmd === 'steal') {
    const ctx = msg.message?.extendedTextMessage?.contextInfo
    if (!ctx?.quotedMessage) {
        return await sock.sendMessage(from, { text: 'Reply to a status image or video with *.save*' })
    }

    // Unwrap viewOnce and normal media
    let quoted = ctx.quotedMessage
    if (quoted.viewOnceMessageV2Extension) quoted = quoted.viewOnceMessageV2Extension.message
    else if (quoted.viewOnceMessageV2) quoted = quoted.viewOnceMessageV2.message
    else if (quoted.viewOnceMessage) quoted = quoted.viewOnceMessage.message

    let mediaType, mediaObj, caption = ''

    if (quoted.imageMessage) {
        mediaType = 'image'
        mediaObj = quoted.imageMessage
        caption = mediaObj.caption || ''
    } else if (quoted.videoMessage) {
        mediaType = 'video'
        mediaObj = quoted.videoMessage
        caption = mediaObj.caption || ''
    } else {
        return await sock.sendMessage(from, { text: '❌ Unsupported format. Only image/video statuses work.' })
    }

    try {
        await sock.sendMessage(from, { text: '⬇️ Stealing your status...' })

        const buffer = await downloadMediaMessage(
            { key: msg.key, message: { [mediaType + 'Message']: mediaObj } },
            'buffer',
            {},
            { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
        )

        if (mediaType === 'image') {
            await sock.sendMessage(from, { image: buffer, caption: `💾 Succesfully Stolen your Status 😈\n${caption}\n\n> © LUNA-V1` })
        } else {
            await sock.sendMessage(from, { video: buffer, caption: `💾 Succesfully Stolen your Status 😈\n${caption}\n\n> © LUNA-V1` })
        }
    } catch (err) {
        console.log('Steal error:', err)
        await sock.sendMessage(from, { text: `❌ Could not steal your status: ${err.message}` })
    }
}

        if (cmd === 'igstalk' || cmd === 'ig') {
    if (!args) return sock.sendMessage(from, { text: '📸 Usage: .igstalk username' })
    
    const username = args.trim().replace('@', '')
    try {
        sock.sendMessage(from, { text: `🔍 Stalking @${username}... LUNA V1 is digging ✨` })
        
        const apiUrl = `https://apis.davidcyril.name.ng/igstalk?username=${encodeURIComponent(username)}`
        const res = await axios.get(apiUrl, { timeout: 30000 })
        
        // David uses "usrname" and "status" object, not "success"
        if (!res.data.usrname) {
            return sock.sendMessage(from, { text: `❌ User @${username} not found` })
        }
        
        const data = res.data
        const stats = data.status || {}
        const caption = `📸 *INSTAGRAM STALK*\n\n` +
                        `*Username*: @${data.usrname}\n` +
                        `*Posts*: ${stats.post || 0}\n` +
                        `*Followers*: ${stats.follower || 0}\n` +
                        `*Following*: ${stats.following || 0}\n` +
                        `*Bio*: ${data.desk || 'No bio'}`
        
        // pp = profile pic
        if (data.pp) {
            sock.sendMessage(from, { 
                image: { url: data.pp }, 
                caption: caption 
            })
        } else {
            sock.sendMessage(from, { text: caption })
        }
        
    } catch (e) {
        console.log('IGStalk error:', e.response?.data || e.message)
        sock.sendMessage(from, { text: `❌ Could not fetch @${username}` })
    }
}

        // ════════════════
        // MENU
        // ════════════════
        if (cmd === 'menu') {
    const now = new Date()
    const uptimeSeconds = process.uptime() 
    const hrs = Math.floor(uptimeSeconds / 3600)
    const mins = Math.floor((uptimeSeconds % 3600) / 60)
    const secs = Math.floor(uptimeSeconds % 60)

    // Check if the sender is the owner
    const totalCommandsCount = baseTotal + (isOwner ? ownerCmds.length : 0)

    // Create the owner text block ONLY if they are the owner
    const ownerSection = isOwner 
        ? `\n┌─ OWNER ──┐\n${ownerCmds.map(c => `│ ${PREFIX}${c}`).join('\n')}\n└──────────┘\n`
        : ''

    const menuText = `
╔══════════════════════╗
╠ 🌙 LUNA V1 STATUS PANEL     ╠
╚══════════════════════╝

┌─ SYSTEM ──────────────┐
│ *Owner*: ${OWNER_NAME}
│ *Prefix*: ${PREFIX}
│ *Version*: 1.0.0
│ *Commands*: ${totalCommandsCount}
│ *Day*: ${now.toLocaleDateString('en-US', { weekday: 'long' })}
│ *Date*: ${now.toLocaleDateString('en-GB')}
│ *Time*: ${now.toLocaleTimeString('en-GB', { hour12: false })}
│ *Uptime*: ${hrs}h ${mins}m ${secs}s
└──────────────────────┘

┌─ PUBLIC ──┐
${publicCmds.map(c => `│ ${PREFIX}${c}`).join('\n')}
└───────────┘

┌─ MEDIA ───┐
${mediaCmds.map(c => `│ ${PREFIX}${c}`).join('\n')}
└───────────┘

┌─ AI ──────┐
${aiCmds.map(c => `│ ${PREFIX}${c}`).join('\n')}
└───────────┘

┌─ UTILITY ─┐
${utilityCmds.map(c => `│ ${PREFIX}${c}`).join('\n')}
└───────────┘

┌─ GAMES ───┐
${gameCmds.map(c => `│ ${PREFIX}${c}`).join('\n')}
└───────────┘

┌─ DOWNLOAD ─┐
${ytCmds.map(c => `│ ${PREFIX}${c}`).join('\n')}
└───────────┘

┌─ GROUP ───┐
${groupCmds.map(c => `│ ${PREFIX}${c}`).join('\n')}
└───────────┘

┌─ NSFW ───┐
${nsfwCmds.map(c => `│ ${PREFIX}${c}`).join('\n')}
└───────────┘

┌─ AWESOME ─┐
${awesomeCmds.map(c => `│ ${PREFIX}${c}`).join('\n')}
└───────────┘
${ownerSection}` // This will inject the owner panel seamlessly at the bottom if isOwner is true

    if (menuImage) await sock.sendMessage(from, {
        image: menuImage,
        mimetype: 'image/jpeg',
        caption: menuText
    })
    else await sock.sendMessage(from, { text: menuText })
}

        // ════════════════
        // OWNER ONLY COMMANDS
        // ════════════════
        if (!isOwner) return

         if (cmd === 'account' || cmd === 'aza' ) {
    const accountText = `🏦 *Account Details*\n\n` +
                        `Account Number: ${ACCOUNT_NUMBER}\n` +
                        `Account Name: ${ACCOUNT_NAME}\n` +
                        `BANK: ${BANK_NAME}\n` +
                        `\n> © LUNA-V1`

    
    await sock.sendMessage(from, { text: accountText })
    return
}

        if (cmd === 'prefix') {
            const parts = args.split(/\s+/).filter(Boolean)
            const newPrefix = parts[0]
            if (!newPrefix) {
                return await sock.sendMessage(from, { text: `Usage: ${PREFIX}prefix <newPrefix>` })
            }
            if (newPrefix.length > 2) {
                return await sock.sendMessage(from, { text: '❌ Prefix can only be 1-2 characters long.' })
            }
            const oldPrefix = PREFIX
            if (newPrefix === oldPrefix) {
                return await sock.sendMessage(from, { text: `✅ Prefix is already set to ${oldPrefix}` })
            }
            PREFIX = newPrefix
            saveConfig()
            await sock.sendMessage(from, { text: `✅ Prefix changed from ${oldPrefix} to ${PREFIX}` })
            return
        }

        if (cmd === 'restart') {
            await sock.sendMessage(from, { text: '🔄 Restarting LUNA-V1...' })
            await sock.ws?.close()
            setTimeout(() => {
                const args = process.argv.slice(1)
                const child = spawn(process.execPath, args, {
                    detached: true,
                    stdio: 'inherit',
                    cwd: process.cwd(),
                    env: process.env
                })
                child.unref()
                process.exit(0)
            }, 1000)
        }

        if (cmd === 'studown') {
            await sock.sendMessage(from, { text: '⛔ Shutting down LUNA-V1...' })
            setTimeout(() => process.exit(0), 500)
        }

        if (cmd === 'broadcast') {
            if (!args) return await sock.sendMessage(from, { text: 'Usage: .broadcast message' })
            await sock.sendMessage(from, { text: '📢 Broadcast sent.' })
        }

    }) // end messages.upsert

    // ════════ ANTI-DELETE ═════════
    sock.ev.on('messages.delete', async ({ keys }) => {
        for (const key of keys) {
            try {
                const deletedMsg = global.messageStore[key.id]
                if (!groupSettings.get(key.remoteJid + '_antidelete')) continue
                if (!deletedMsg || !ownerConfig.numbers.length) continue
                const ownerJid = ownerConfig.numbers[0] + '@s.whatsapp.net'
                // If it's a text message
                if (deletedMsg.conversation || deletedMsg.extendedTextMessage) {
                    const text = deletedMsg.conversation || deletedMsg.extendedTextMessage?.text
                    await sock.sendMessage(ownerJid, { text: `🗒️ *Deleted Message*\nChat: ${key.remoteJid}\nFrom: ${key.participant || key.remoteJid}\n\n${text}` })
                    continue
                }
                // If it's media (image/video/audio/document), try to re-download and forward to owner
                const mediaTypes = ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage']
                const foundType = mediaTypes.find(t => !!deletedMsg[t])
                if (foundType) {
                    try {
                        const downloadMsg = { message: { [foundType]: deletedMsg[foundType] }, key }
                        const buffer = await downloadMediaMessage(
                            downloadMsg, 'buffer', {},
                            { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
                        )
                        if (buffer && buffer.length) {
                            if (foundType === 'imageMessage') await sock.sendMessage(ownerJid, { image: buffer, caption: `🗒️ Deleted image from ${key.remoteJid}\nFrom: ${key.participant || key.remoteJid}` })
                            else if (foundType === 'videoMessage') await sock.sendMessage(ownerJid, { video: buffer, caption: `🗒️ Deleted video from ${key.remoteJid}\nFrom: ${key.participant || key.remoteJid}` })
                            else if (foundType === 'audioMessage') await sock.sendMessage(ownerJid, { audio: buffer, caption: `🗒️ Deleted audio from ${key.remoteJid}\nFrom: ${key.participant || key.remoteJid}` })
                            else if (foundType === 'documentMessage') await sock.sendMessage(ownerJid, { document: buffer, caption: `🗒️ Deleted document from ${key.remoteJid}\nFrom: ${key.participant || key.remoteJid}` })
                        }
                    } catch (e) {
                        console.log('Anti-delete media error:', e?.message || e)
                        await sock.sendMessage(ownerJid, { text: `🗒️ Deleted message in ${key.remoteJid} (media) — failed to retrieve content.` })
                    }
                }
            } catch (e) {
                console.log('Anti-delete error:', e?.message || e)
            }
        }
    })

    // ════════ ANTILINK ════════════
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg?.message || !msg.key.remoteJid.endsWith('@g.us')) return
        const from = msg.key.remoteJid
        const sender = await resolveLidJid(sock, msg.key.participant || from)
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ''
        if (groupSettings.get(from + '_antilink') && /https?:\/\//.test(text)) {
            try {
                const meta = await sock.groupMetadata(from)
                const isAdmin = meta.participants.find(p => p.id === sender)?.admin
                if (!isAdmin) {
                    await sock.sendMessage(from, { delete: msg.key })
                    await sock.sendMessage(from, { text: '🚫 Links are not allowed in this group!' })
                }
            } catch(e) { console.log('Antilink error:', e.message) }
        }
    })
}

startBot()