import json
import logging
import random
import signal
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Update,
)
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)
from telegram.error import TelegramError, Forbidden, BadRequest

# ════════════════════════════════════════════════════════════
#  CONFIGURATION
# ════════════════════════════════════════════════════════════

BOT_TOKEN = "8616789206:AAHfHzVF9ks0dFfr1BJ8cbTdCnP2dXw-Lr8"

BLOCKED_PHRASES = [
    "stop target hit",
]

BLOCKED_EMOJIS = ["⛔"]

DELETE_PROBABILITY = 0.60   # 60% delete, 40% skip

STATS_FILE = Path("stats.json")

# ════════════════════════════════════════════════════════════
#  LOGGING
# ════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# ════════════════════════════════════════════════════════════
#  PERSISTENT STATE  (stats.json)
# ════════════════════════════════════════════════════════════

def _default_stats() -> dict:
    return {
        "owner_chat_id": None,
        "is_running": False,
        "notify_enabled": True,
        "channels": {},
    }


def load_stats() -> dict:
    if STATS_FILE.exists():
        try:
            with open(STATS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                base = _default_stats()
                for k, v in base.items():
                    data.setdefault(k, v)
                return data
        except Exception as e:
            logger.error(f"Failed to load stats: {e}")
    return _default_stats()


def save_stats(stats: dict) -> None:
    try:
        with open(STATS_FILE, "w", encoding="utf-8") as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Failed to save stats: {e}")


def _prune_old(timestamps: list[str], days: int = 30) -> list[str]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    return [t for t in timestamps if datetime.fromisoformat(t) > cutoff]


def _count_since(timestamps: list[str], hours: int = 24) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    return sum(1 for t in timestamps if datetime.fromisoformat(t) > cutoff)


def ensure_channel(stats: dict, chat_id: int, title: str,
                   username: str | None = None,
                   invite_link: str | None = None) -> dict:
    key = str(chat_id)
    if key not in stats["channels"]:
        stats["channels"][key] = {
            "title": title,
            "username": username,
            "invite_link": invite_link,
            "lifetime_deleted": 0,
            "lifetime_skipped": 0,
            "deletions_24h": [],
            "skipped_24h": [],
        }
    else:
        ch = stats["channels"][key]
        ch["title"] = title
        if username:
            ch["username"] = username
        if invite_link:
            ch["invite_link"] = invite_link
    return stats["channels"][key]


def channel_link(ch: dict) -> str:
    if ch.get("username"):
        return f"https://t.me/{ch['username']}"
    if ch.get("invite_link"):
        return ch["invite_link"]
    return "_(no public link)_"


def record_deletion(stats: dict, chat_id: int) -> None:
    key = str(chat_id)
    ch = stats["channels"].get(key, {})
    ch["lifetime_deleted"] = ch.get("lifetime_deleted", 0) + 1
    ts = datetime.now(timezone.utc).isoformat()
    ch.setdefault("deletions_24h", []).append(ts)
    ch["deletions_24h"] = _prune_old(ch["deletions_24h"])
    stats["channels"][key] = ch
    save_stats(stats)


def record_skip(stats: dict, chat_id: int) -> None:
    key = str(chat_id)
    ch = stats["channels"].get(key, {})
    ch["lifetime_skipped"] = ch.get("lifetime_skipped", 0) + 1
    ts = datetime.now(timezone.utc).isoformat()
    ch.setdefault("skipped_24h", []).append(ts)
    ch["skipped_24h"] = _prune_old(ch["skipped_24h"])
    stats["channels"][key] = ch
    save_stats(stats)


# ════════════════════════════════════════════════════════════
#  HELPER UTILITIES
# ════════════════════════════════════════════════════════════

def message_is_blocked(text: str) -> bool:
    if not text:
        return False
    lower = text.lower()
    for phrase in BLOCKED_PHRASES:
        if phrase in lower:
            return True
    for emoji in BLOCKED_EMOJIS:
        if emoji in text:
            return True
    return False


def should_delete() -> bool:
    return random.random() < DELETE_PROBABILITY


def notify_owner_sync(bot_token: str, chat_id: int, text: str) -> None:
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown",
    }).encode()
    try:
        urllib.request.urlopen(url, data=payload, timeout=10)
    except Exception as e:
        logger.error(f"Failed to notify owner on shutdown: {e}")


async def get_or_fetch_invite_link(bot, chat_id: int) -> str | None:
    try:
        link = await bot.export_chat_invite_link(chat_id)
        return link
    except Exception:
        return None


def _escape(text: str) -> str:
    special = r"\_*[]()~`>#+-=|{}.!"
    return "".join(("\\" + c) if c in special else c for c in text)


def _url_md(url: str, label: str = "🔗 Open Channel") -> str:
    if not url or not url.startswith("http"):
        return _escape(url or "no link")
    safe_url = url.replace("\\", "\\\\").replace(")", "\\)")
    return f"[{label}]({safe_url})"


# ════════════════════════════════════════════════════════════
#  COMMAND HANDLERS
# ════════════════════════════════════════════════════════════

async def cmd_go(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    stats = load_stats()

    if update.channel_post:
        msg = update.channel_post
        chat = msg.chat
        chat_id = chat.id
        title = chat.title or str(chat_id)
        username = chat.username

        invite_link = None
        if not username:
            invite_link = await get_or_fetch_invite_link(context.bot, chat_id)

        ensure_channel(stats, chat_id, title, username, invite_link)
        stats["is_running"] = True
        save_stats(stats)
        logger.info(f"/go in channel '{title}' ({chat_id})")

        link = f"https://t.me/{username}" if username else (invite_link or "")
        link_escaped = _escape(link)
        link_part = ("\n🔗 " + link_escaped) if link else ""

        await context.bot.send_message(
            chat_id=chat_id,
            text=(
                "🤖 *Moderation Bot Activated*\n\n"
                "✅ I am now actively monitoring this channel\\.\n"
                "🛡 Blocked messages will be automatically removed\\."
                + link_part
            ),
            parse_mode="MarkdownV2",
        )
        try:
            await context.bot.delete_message(chat_id=chat_id, message_id=msg.message_id)
        except Exception:
            pass
        return

    if not update.message:
        return

    stats["is_running"] = True
    stats["owner_chat_id"] = update.effective_chat.id
    save_stats(stats)

    total = len(stats["channels"])
    await update.message.reply_text(
        "🟢 *Bot is now* *ACTIVE*\n\n"
        f"🔍 Monitoring *{total}* channels for blocked content\\.\n"
        "🛡 Blocked messages will be deleted automatically\\.",
        parse_mode="MarkdownV2",
    )


async def cmd_stop(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    stats = load_stats()
    stats["is_running"] = False
    save_stats(stats)

    await update.message.reply_text(
        "🔴 *Bot is now* *STOPPED*\n\n"
        "⏸ No messages will be deleted from any channel until you send /go again\\.",
        parse_mode="MarkdownV2",
    )


async def cmd_summary(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    stats = load_stats()
    channels = stats.get("channels", {})

    if not channels:
        await update.message.reply_text(
            "📭 *No channels tracked yet\\.*\n\n"
            "Add me as admin to a channel and send /go there to start\\.",
            parse_mode="MarkdownV2",
        )
        return

    keyboard = []
    for cid, ch in channels.items():
        keyboard.append([InlineKeyboardButton(f"📊 {ch['title']}", callback_data=f"summary:{cid}")])
    keyboard.append([InlineKeyboardButton("📈 Overall Summary", callback_data="summary:ALL")])

    await update.message.reply_text(
        "📊 *Channel Summary*\n\n"
        "Tap a channel below to see its deletion statistics\\:",
        parse_mode="MarkdownV2",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def cmd_channel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    stats = load_stats()
    channels = stats.get("channels", {})

    if not channels:
        await update.message.reply_text(
            "📭 *No channels tracked yet\\.*\n\n"
            "Add me as admin to a channel and send /go there to start\\.",
            parse_mode="MarkdownV2",
        )
        return

    lines = ["📡 *Channels I'm Monitoring*\n"]
    for idx, (cid, ch) in enumerate(channels.items(), 1):
        link = channel_link(ch)
        link_text = _url_md(link) if link.startswith("https") else _escape(link)
        lines.append(f"*{idx}\\. {_escape(ch['title'])}*")
        lines.append(f"   {link_text}")
        lines.append("")
    lines.append(f"_Total: {len(channels)} channels_")

    await update.message.reply_text(
        "\n".join(lines),
        parse_mode="MarkdownV2",
        disable_web_page_preview=True,
    )


async def cmd_check(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    phrases = "\n".join(f"  • `{p}`" for p in BLOCKED_PHRASES)
    emojis  = "  " + "  ".join(BLOCKED_EMOJIS)

    await update.message.reply_text(
        "🔍 *Blocked Keywords & Emojis*\n\n"
        "📝 *Phrases* \\(case\\-insensitive\\):\n"
        f"{phrases}\n\n"
        "🚫 *Emojis*:\n"
        f"{emojis}\n\n"
        f"_Delete probability per blocked message: {int(DELETE_PROBABILITY * 100)}%_",
        parse_mode="MarkdownV2",
    )


async def cmd_notify(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    stats = load_stats()
    stats["notify_enabled"] = not stats.get("notify_enabled", True)
    save_stats(stats)

    state = stats["notify_enabled"]
    icon  = "🔔" if state else "🔕"
    word  = "ON" if state else "OFF"

    await update.message.reply_text(
        f"{icon} *Notifications turned* *{word}*\n\n"
        + (
            "You will receive a message each time a blocked message is deleted or skipped\\."
            if state else
            "You will no longer receive deletion notifications\\."
        ),
        parse_mode="MarkdownV2",
    )


async def cmd_reset(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    stats = load_stats()
    args  = context.args

    if not args:
        await update.message.reply_text(
            "⚠️ *Usage:* `/reset <channel_link_or_id>`\n\n"
            "Example:\n"
            "`/reset https://t\\.me/mychannel`\n"
            "`/reset \\-1001234567890`",
            parse_mode="MarkdownV2",
        )
        return

    target = args[0].strip().rstrip("/")
    channels = stats.get("channels", {})
    matched_key = None

    for cid, ch in channels.items():
        uname = ch.get("username") or ""
        link  = ch.get("invite_link") or ""
        if (
            cid == target
            or f"https://t.me/{uname}" == target
            or link == target
            or uname == target.lstrip("@")
        ):
            matched_key = cid
            break

    if not matched_key:
        await update.message.reply_text(
            "❌ *Channel not found\\.*\n\n"
            "Use /channel to see the list of tracked channels and their links\\.",
            parse_mode="MarkdownV2",
        )
        return

    ch = channels[matched_key]
    title = _escape(ch["title"])
    ch["lifetime_deleted"] = 0
    ch["lifetime_skipped"]  = 0
    ch["deletions_24h"]     = []
    ch["skipped_24h"]       = []
    save_stats(stats)

    await update.message.reply_text(
        f"♻️ *Stats reset for* _{title}_\n\n"
        "All deletion and skip counters have been cleared\\.",
        parse_mode="MarkdownV2",
    )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "🤖 *Bot Command Guide*\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n\n"
        "▶️ */go*\n"
        "  Start monitoring all channels\\. Send inside a channel to activate it and post an announcement\\.\n\n"
        "⏹ */stop*\n"
        "  Pause monitoring globally across every channel\\.\n\n"
        "📊 */summary*\n"
        "  Pick a channel to view its 24h and lifetime deletion stats\\.\n\n"
        "📡 */channel*\n"
        "  List all channels the bot is monitoring with clickable links\\.\n\n"
        "🔍 */check*\n"
        "  Show currently blocked phrases and emojis\\.\n\n"
        "🔔 */notify*\n"
        "  Toggle deletion notifications on or off\\.\n\n"
        "♻️ */reset \\<channel\\_link\\>*\n"
        "  Reset stats for a specific channel\\. Use the link shown by /channel\\.\n\n"
        "❓ */help*\n"
        "  Show this guide\\.\n\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        "_Delete rate: 60% random • Leave rate: 40% random_",
        parse_mode="MarkdownV2",
    )


# ════════════════════════════════════════════════════════════
#  INLINE CALLBACK — summary picker
# ════════════════════════════════════════════════════════════

async def callback_summary(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()

    stats = load_stats()
    channels = stats.get("channels", {})
    _, cid = query.data.split(":", 1)

    if cid == "ALL":
        total_del  = sum(ch.get("lifetime_deleted", 0) for ch in channels.values())
        total_skip = sum(ch.get("lifetime_skipped", 0) for ch in channels.values())
        del_24h    = sum(_count_since(ch.get("deletions_24h", [])) for ch in channels.values())
        skip_24h   = sum(_count_since(ch.get("skipped_24h", [])) for ch in channels.values())
        status = "🟢 ACTIVE" if stats.get("is_running") else "🔴 STOPPED"

        text = (
            "📈 *Overall Summary — All Channels*\n"
            "━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"🤖 Bot Status: *{status}*\n"
            f"📡 Channels tracked: *{len(channels)}*\n\n"
            f"🗑 Deleted \\(last 24h\\): *{del_24h}*\n"
            f"⏭ Skipped \\(last 24h\\): *{skip_24h}*\n\n"
            f"🗑 Deleted \\(lifetime\\): *{total_del}*\n"
            f"⏭ Skipped \\(lifetime\\): *{total_skip}*"
        )
    elif cid in channels:
        ch = channels[cid]
        del_24h  = _count_since(ch.get("deletions_24h", []))
        skip_24h = _count_since(ch.get("skipped_24h", []))
        title    = _escape(ch["title"])
        link     = channel_link(ch)
        link_md  = _url_md(link) if link.startswith("https") else _escape(link)

        text = (
            f"📊 *Channel Summary*\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"📡 *{title}*\n"
            f"{link_md}\n\n"
            f"🗑 *Deleted* \\(last 24h\\): *{del_24h}*\n"
            f"⏭ *Skipped* \\(last 24h\\): *{skip_24h}*\n\n"
            f"🗑 *Deleted* \\(lifetime\\): *{ch.get('lifetime_deleted', 0)}*\n"
            f"⏭ *Skipped* \\(lifetime\\): *{ch.get('lifetime_skipped', 0)}*\n\n"
            f"_Use /reset with the channel link to clear stats\\._"
        )
    else:
        text = "❌ Channel not found in records\\."

    await query.edit_message_text(text, parse_mode="MarkdownV2", disable_web_page_preview=True)


# ════════════════════════════════════════════════════════════
#  CHANNEL POST HANDLER
# ════════════════════════════════════════════════════════════

async def handle_channel_post(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    stats = load_stats()

    message = update.channel_post or update.edited_channel_post
    if not message:
        return

    chat     = message.chat
    chat_id  = chat.id
    title    = chat.title or str(chat_id)
    username = chat.username
    text     = message.text or message.caption or ""

    invite_link = None
    if not username:
        invite_link = await get_or_fetch_invite_link(context.bot, chat_id)
    ensure_channel(stats, chat_id, title, username, invite_link)
    save_stats(stats)

    if not stats.get("is_running"):
        return
    if not message_is_blocked(text):
        return

    ch         = stats["channels"][str(chat_id)]
    message_id = message.message_id
    owner_id   = stats.get("owner_chat_id")
    notify_on  = stats.get("notify_enabled", True)
    link       = channel_link(ch)
    link_md    = f"[{_escape(title)}]({link})" if link.startswith("https") else _escape(title)

    if should_delete():
        try:
            await context.bot.delete_message(chat_id=chat_id, message_id=message_id)
            record_deletion(stats, chat_id)
            logger.info(f"🗑 Deleted msg {message_id} from '{title}' ({chat_id})")

            if owner_id and notify_on:
                preview   = _escape(text[:100].replace("\n", " "))
                open_link = _url_md(link) if link.startswith("http") else _escape(link)
                await context.bot.send_message(
                    chat_id=owner_id,
                    text=(
                        "🗑 *Blocked Message Deleted*\n"
                        "━━━━━━━━━━━━━━━━━━━━━━\n\n"
                        f"📡 *Channel:* {link_md}\n"
                        f"🔗 *Link:* {open_link}\n\n"
                        f"📝 *Preview:*\n`{preview}…`\n\n"
                        f"⏱ _{_escape(datetime.now(IST).strftime('%d %b %Y, %I:%M %p IST'))}_"
                    ),
                    parse_mode="MarkdownV2",
                    disable_web_page_preview=True,
                )

        except Forbidden:
            logger.warning(f"No permission to delete in '{title}'")
            if owner_id:
                await context.bot.send_message(
                    chat_id=owner_id,
                    text=(
                        "⚠️ *Permission Error*\n\n"
                        f"I could not delete a message in *{_escape(title)}*\\.\n"
                        "Please ensure I'm an admin with *Delete Messages* permission\\."
                    ),
                    parse_mode="MarkdownV2",
                )
        except BadRequest as e:
            logger.warning(f"BadRequest deleting msg {message_id}: {e}")
        except TelegramError as e:
            logger.error(f"TelegramError: {e}")
            if owner_id:
                await context.bot.send_message(
                    chat_id=owner_id,
                    text=f"❌ *Error deleting message:*\n`{_escape(str(e))}`",
                    parse_mode="MarkdownV2",
                )
    else:
        record_skip(stats, chat_id)
        logger.info(f"⏭ Skipped msg {message_id} from '{title}' (40% pass-through)")

        if owner_id and notify_on:
            preview   = _escape(text[:100].replace("\n", " "))
            open_link = _url_md(link) if link.startswith("http") else _escape(link)
            await context.bot.send_message(
                chat_id=owner_id,
                text=(
                    "⏭ *Blocked Message — Not Deleted \\(40% Pass\\)*\n"
                    "━━━━━━━━━━━━━━━━━━━━━━\n\n"
                    f"📡 *Channel:* {link_md}\n"
        
