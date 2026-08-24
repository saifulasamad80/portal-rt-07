#!/usr/bin/env python3
"""
PORTAL RT 07 - CI/CD AUTOMATED SECURITY ALERT NOTIFIER
Deskripsi: Mengirimkan notifikasi darurat instan ke Telegram Admin / WhatsApp Group
           ketika pipa pengujian keamanan (security penetration test) CI/CD gagal.
Bahasa: Python 3
"""

import os
import sys
import requests

def send_telegram_alert(bot_token, chat_id, message):
    """Mengirim pesan peringatan ke Telegram Channel / Chat Admin"""
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

def send_whatsapp_alert(api_url, token, phone, message):
    """Mengirim pesan peringatan ke WhatsApp via Gateway API (Contoh: Wablas/Fona/Twilio)"""
    # Catatan: Struktur payload dapat bervariasi tergantung provider gateway Anda.
    # Di bawah ini adalah skema umum POST payload yang didukung banyak penyedia API lokal.
    headers = {
        "Authorization": token,
        "Content-Type": "application/json"
    }
    payload = {
        "phone": phone,
        "message": message
    }
    try:
        response = requests.post(api_url, json=payload, headers=headers, timeout=10)
        if response.status_code in [200, 201]:
            print("[✓] Peringatan keamanan berhasil dikirim ke WhatsApp!")
            return True
        else:
            print(f"[!] Gagal mengirim ke WhatsApp. HTTP {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print(f"[!] Error saat menghubungi WhatsApp API Gateway: {e}")
        return False

def main():
    # Mengambil variabel lingkungan dari GitHub Actions default envs & custom secrets
    repo = os.getenv("GITHUB_REPOSITORY", "saifulasamad80/portal-rt-07")
    branch = os.getenv("GITHUB_REF_NAME", "main")
    commit_sha = os.getenv("GITHUB_SHA", "N/A")[:8]
    actor = os.getenv("GITHUB_ACTOR", "N/A")
    run_id = os.getenv("GITHUB_RUN_ID", "N/A")
    run_url = f"https://github.com/{repo}/actions/runs/{run_id}"

    # Telegram Secrets
    tg_token = os.getenv("TELEGRAM_BOT_TOKEN")
    tg_chat_id = os.getenv("TELEGRAM_CHAT_ID")

    # WhatsApp Gateway Secrets (Opsional)
    wa_url = os.getenv("WHATSAPP_API_URL")
    wa_token = os.getenv("WHATSAPP_API_TOKEN")
    wa_phone = os.getenv("WHATSAPP_PHONE_NUMBER")

    # Format Pesan Notifikasi (Markdown)
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

    sent = False
    
    # Eksekusi Telegram Alerting jika kredensial lengkap
    if tg_token and tg_chat_id:
        print("[*] Mengirim alarm ke Telegram...")
        tg_success = send_telegram_alert(tg_token, tg_chat_id, alert_message)
        if tg_success:
            sent = True

    # Eksekusi WhatsApp Alerting jika kredensial lengkap
    if wa_url and wa_token and wa_phone:
        print("[*] Mengirim alarm ke WhatsApp...")
        # Bersihkan markdown khusus telegram untuk kecocokan WhatsApp format (* bold, _ italic)
        wa_message = alert_message.replace("`", "").replace("📍 ", "• ").replace("🌿 ", "• ").replace("👨‍💻 ", "• ").replace("🔢 ", "• ").replace("💔 ", "• ")
        wa_success = send_whatsapp_alert(wa_url, wa_token, wa_phone, wa_message)
        if wa_success:
            sent = True

    if not sent:
        print("[!] Warning: Tidak ada notifikasi yang dikirim. Harap periksa apakah Secrets TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID atau WHATSAPP_* telah didaftarkan di GitHub!")
        sys.exit(0)

if __name__ == "__main__":
    main()
