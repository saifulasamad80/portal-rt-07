#!/usr/bin/env python3
"""
PORTAL RT 07 - CI/CD AUTOMATED SECURITY ALERT NOTIFIER
Deskripsi: Mengirimkan notifikasi darurat instan ke Telegram Admin
           ketika pipa pengujian keamanan (security penetration test) CI/CD gagal.
Bahasa: Python 3
"""

import os
import sys
import requests

def send_telegram_alert(bot_token, chat_id, message):
    """Mengirim pesan peringatan ke Telegram Channel / Chat Admin"""
    # AMAN DARI SSRF: URL dipatok mati secara hardcoded, tidak bisa diinjeksi pihak luar
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown"
    }
    try:
        response = requests.post(url, json=payload, timeout=10)
        if response.status_code == 200:
            print("[✓] Peringatan keamanan berhasil dikirim ke Telegram!")
            return True
        else:
            print(f"[!] Gagal mengirim ke Telegram. HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print(f"[!] Error saat menghubungi Telegram API: {e}")
        return False

def main():
    # Mengambil variabel lingkungan dari GitHub Actions
    repo = os.getenv("GITHUB_REPOSITORY", "saifulasamad80/portal-rt-07")
    branch = os.getenv("GITHUB_REF_NAME", "main")
    commit_sha = os.getenv("GITHUB_SHA", "N/A")[:8]
    actor = os.getenv("GITHUB_ACTOR", "N/A")
    run_id = os.getenv("GITHUB_RUN_ID", "N/A")
    run_url = f"https://github.com/{repo}/actions/runs/{run_id}"

    # Telegram Secrets
    tg_token = os.getenv("TELEGRAM_BOT_TOKEN")
    tg_chat_id = os.getenv("TELEGRAM_CHAT_ID")

    # Format Pesan Notifikasi
    alert_message = (
        "🚨 *[ALARM KEAMANAN]* *PORTAL RT 07 CI/CD FAIL* 🚨\n"
        "=========================================\n"
        f"⚠️ *DETEKSI KERENTANAN SIBER PADA PIPA DEPLOYMENT!*\n\n"
        f"📍 *Repositori:* `{repo}`\n"
        f"🌿 *Branch:* `{branch}`\n"
        f"👨‍💻 *Pemicu:* @{actor}\n"
        f"🔢 *Commit SHA:* `{commit_sha}`\n"
        f"💔 *Status Uji:* *VULNERABLE (GAGAL / REGRASI)*\n\n"
        "=========================================\n"
        "🚫 *Tindakan Otomatis:* Deployment di-block secara sepihak di server CI/CD "
        "karena ditemukan celah keamanan pada Supabase API / RLS yang tidak lolos pentest.\n\n"
        f"🔍 *Detail Kegagalan:* Periksa log audit lengkap pipa pengujian pada tautan berikut:\n"
        f"[Lihat Log Pengujian GitHub Actions]({run_url})\n"
        "========================================="
    )

    if not (tg_token and tg_chat_id):
        print("[!] Warning: Secrets TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID tidak lengkap! Eksekusi dibatalkan.")
        sys.exit(0)

    print("[*] Mengirim alarm ke Telegram...")
    send_telegram_alert(tg_token, tg_chat_id, alert_message)

if __name__ == "__main__":
    main()