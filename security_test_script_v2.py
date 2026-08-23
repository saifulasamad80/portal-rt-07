#!/usr/bin/env python3
"""
PORTAL RT 07 INTEGRATED MANAGEMENT PORTAL - AUTOMATED SECURITY AUDIT & PENETRATION TEST SCRIPT (V2)
Deskripsi: Skrip otomasi uji penetrasi (pentest) untuk memvalidasi keamanan database Supabase 
           terhadap bypass otentikasi, kebocoran PII (NIK), dan pengujian RLS.
           V2 dioptimalkan untuk integrasi CI/CD (Non-Interaktif berbasis Environment Variables).
Bahasa: Python 3
Ketergantungan: requests
"""

import sys
import os
import json

try:
    import requests
except ImportError:
    print("[!] Error: Modul 'requests' tidak ditemukan. Silakan jalankan 'pip install requests' terlebih dahulu.")
    sys.exit(1)

# Konstanta Pengujian
DEFAULT_URL = "https://jsprzayqrjdbuuqretec.supabase.co"
DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzcHJ6YXlxcmpkYnV1cXJldGVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ0NTAwMDAsImV4cCI6MjAzOTg4NjAwMH0.sample-key"

class SupabaseSecurityTester:
    def __init__(self, supabase_url, anon_key):
        self.url = supabase_url.rstrip('/')
        self.key = anon_key
        self.headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        self.has_vulnerabilities = False
        
    def print_result(self, test_id, name, result, details, severity="HIGH"):
        color_start = "\033[92m" if result == "SECURE (PASS)" else "\033[91m"
        color_end = "\033[0m"
        print(f"[{test_id}] {name}")
        print(f"    - Status    : {color_start}{result}{color_end}")
        print(f"    - Keterangan: {details}")
        if result != "SECURE (PASS)":
            print(f"    - Tingkat Keparahan: {severity}")
            self.has_vulnerabilities = True
        print("-" * 75)

    def run_all_tests(self):
        print("=" * 75)
        print("     STARTING AUTOMATED SECURITY PENETRATION TEST FOR PORTAL RT 07 (V2)")
        print("=" * 75)
        print(f"Target URL: {self.url}")
        print("-" * 75)
        
        self.test_anonymous_warga_read()
        self.test_pii_nik_leakage()
        self.test_audit_log_immutability()
        self.test_unauthorized_financial_insert()
        
        print("=" * 75)
        print("                 PENGUJIAN SELESAI / AUDIT FINISHED")
        print("=" * 75)
        
        if self.has_vulnerabilities:
            print("[!] Peringatan: Sistem terdeteksi VULNERABLE pada satu atau lebih skenario!")
            sys.exit(1) # Return non-zero status code for CI/CD failures
        else:
            print("[+] Sukses: Seluruh skenario pengujian berstatus SECURE (PASS)!")
            sys.exit(0)

    def test_anonymous_warga_read(self):
        """Uji 1: Membaca tabel 'warga' langsung via REST API tanpa otentikasi JWT personal"""
        endpoint = f"{self.url}/rest/v1/warga"
        try:
            response = requests.get(endpoint, headers=self.headers, timeout=5)
            if response.status_code in [401, 403]:
                self.print_result(
                    "TC-SEC-01", 
                    "Membaca Tabel Warga Tanpa JWT Personal", 
                    "SECURE (PASS)", 
                    "Akses ditolak oleh database (HTTP 401/403). Row Level Security (RLS) aktif."
                )
            elif response.status_code == 200:
                data = response.json()
                if len(data) == 0:
                    self.print_result(
                        "TC-SEC-01", 
                        "Membaca Tabel Warga Tanpa JWT Personal", 
                        "SECURE (PASS)", 
                        "Akses diterima namun data kosong (0 baris dikembalikan) berkat filter RLS."
                    )
                else:
                    self.print_result(
                        "TC-SEC-01", 
                        "Membaca Tabel Warga Tanpa JWT Personal", 
                        "VULNERABLE (FAIL)", 
                        f"Database mengembalikan {len(data)} data warga secara telanjang! Segera aktifkan RLS.",
                        "CRITICAL"
                    )
            else:
                self.print_result(
                    "TC-SEC-01", 
                    "Membaca Tabel Warga Tanpa JWT Personal", 
                    "UNKNOWN", 
                    f"Respon server tidak biasa: HTTP {response.status_code}"
                )
        except Exception as e:
            self.print_result("TC-SEC-01", "Membaca Tabel Warga Tanpa JWT Personal", "ERROR", str(e))

    def test_pii_nik_leakage(self):
        """Uji 2: Memeriksa apakah kolom NIK terekspos dalam bentuk teks biasa (cleartext)"""
        endpoint = f"{self.url}/rest/v1/warga?select=nik"
        try:
            response = requests.get(endpoint, headers=self.headers, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if len(data) > 0 and "nik" in data[0]:
                    nik_sample = str(data[0]["nik"])
                    if "X" in nik_sample or "x" in nik_sample:
                        self.print_result(
                            "TC-COMP-01", 
                            "Eksposur NIK Plaintext", 
                            "SECURE (PASS)", 
                            f"NIK berhasil disamarkan (masking): {nik_sample}"
                        )
                    else:
                        self.print_result(
                            "TC-COMP-01", 
                            "Eksposur NIK Plaintext", 
                            "VULNERABLE (FAIL)", 
                            f"NIK terekspos mentah: {nik_sample}. Harap terapkan masking atau enkripsi pgcrypto!",
                            "HIGH"
                        )
                else:
                    self.print_result(
                        "TC-COMP-01", 
                        "Eksposur NIK Plaintext", 
                        "SECURE (PASS)", 
                        "Tidak ada data NIK yang bocor secara publik."
                    )
            else:
                self.print_result(
                    "TC-COMP-01", 
                    "Eksposur NIK Plaintext", 
                    "SECURE (PASS)", 
                    f"Akses ditolak oleh database (HTTP {response.status_code}), data pribadi aman."
                )
        except Exception as e:
            self.print_result("TC-COMP-01", "Eksposur NIK Plaintext", "ERROR", str(e))

    def test_audit_log_immutability(self):
        """Uji 3: Mencoba menghapus atau mengedit catatan di tabel 'audit_log'"""
        delete_endpoint = f"{self.url}/rest/v1/audit_log"
        try:
            # Mencoba menghapus semua log audit menggunakan Anon Key
            response = requests.delete(delete_endpoint, headers=self.headers, timeout=5)
            # Sistem aman akan menolak keras dengan pesan error kustom kita atau HTTP 400/403
            if response.status_code in [400, 401, 403, 405] and ("KEBIJAKAN KEAMANAN" in response.text or response.status_code == 400):
                self.print_result(
                    "TC-SEC-03", 
                    "Upaya/Manipulasi Penghapusan Audit Log", 
                    "SECURE (PASS)", 
                    f"Database memblokir keras upaya penghapusan log audit secara mutlak (HTTP {response.status_code}: {response.text.strip()})"
                )
            else:
                # Jika mengembalikan 204 atau sukses tanpa memicu Trigger Exception Statement
                self.print_result(
                    "TC-SEC-03", 
                    "Upaya/Manipulasi Penghapusan Audit Log", 
                    "VULNERABLE (FAIL)", 
                    f"Sistem mengembalikan HTTP {response.status_code} tanpa pesan penolakan exception! Log audit tidak sepenuhnya immutable di tingkat statemen.",
                    "HIGH"
                )
        except Exception as e:
            self.print_result("TC-SEC-03", "Upaya/Manipulasi Penghapusan Audit Log", "ERROR", str(e))

    def test_unauthorized_financial_insert(self):
        """Uji 4: Mencoba melakukan penulisan transaksi langsung ke tabel finansial kas_rt"""
        endpoint = f"{self.url}/rest/v1/kas_rt"
        payload = {
            "tipe_transaksi": "Pengeluaran",
            "kategori": "Operasional",
            "nominal": 10000000, # Rp 10 Juta palsu
            "keterangan": "Eksploitasi Gelap Kas RT"
        }
        try:
            response = requests.post(endpoint, json=payload, headers=self.headers, timeout=5)
            if response.status_code in [200, 201]:
                self.print_result(
                    "TC-BUS-01", 
                    "Penyusupan Entri Finansial Kas RT", 
                    "VULNERABLE (FAIL)", 
                    "Berhasil menyusupkan mutasi pengeluaran palsu senilai Rp 10.000.000 langsung ke database!",
                    "CRITICAL"
                )
            else:
                self.print_result(
                    "TC-BUS-01", 
                    "Penyusupan Entri Finansial Kas RT", 
                    "SECURE (PASS)", 
                    f"Akses ditolak (HTTP {response.status_code}). Operasi finansial dibatasi oleh database constraint/RLS."
                )
        except Exception as e:
            self.print_result("TC-BUS-01", "Penyusupan Entri Finansial Kas RT", "ERROR", str(e))

if __name__ == "__main__":
    # Prioritaskan pembacaan dari Environment Variables untuk mode non-interaktif CI/CD
    url = os.environ.get("SUPABASE_TEST_URL", "").strip()
    key = os.environ.get("SUPABASE_TEST_ANON_KEY", "").strip()
    
    # Jika tidak ada Env Var, jatuh kembali ke mode interaktif (pentest lokal)
    if not url or not key:
        print("[*] Info: Environment variables tidak lengkap. Berpindah ke mode interaktif.")
        url = url or input(f"Masukkan Supabase URL Anda [{DEFAULT_URL}]: ").strip() or DEFAULT_URL
        key = key or input(f"Masukkan Supabase Anon Key Anda (Tekan Enter untuk default): ").strip() or DEFAULT_KEY
    
    tester = SupabaseSecurityTester(url, key)
    tester.run_all_tests()
