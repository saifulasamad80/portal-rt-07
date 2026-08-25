#!/usr/bin/env python3
"""
PORTAL RT 07 INTEGRATED MANAGEMENT PORTAL - AUTOMATED SECURITY AUDIT & PENETRATION TEST SCRIPT (V2)
Deskripsi: Skrip otomasi uji penetrasi (pentest) untuk memvalidasi keamanan database Supabase 
           terhadap bypass otentikasi, kebocoran PII (NIK), dan pengujian RLS.
           V2 (DIAMANAKAN): Menghapus seluruh hardcoded credential untuk keamanan CI/CD.
Bahasa: Python 3
Ketergantungan: requests
"""

import sys
import os

try:
    import requests
except ImportError:
    print("[!] Error: Modul 'requests' tidak ditemukan. Silakan jalankan 'pip install requests' terlebih dahulu.")
    sys.exit(1)

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
            sys.exit(1) 
        else:
            print("[+] Sukses: Seluruh skenario pengujian berstatus SECURE (PASS)!")
            sys.exit(0)

    def test_anonymous_warga_read(self):
        endpoint = f"{self.url}/rest/v1/warga"
        try:
            response = requests.get(endpoint, headers=self.headers, timeout=5)
            if response.status_code in [401, 403]:
                self.print_result("TC-SEC-01", "Membaca Tabel Warga Tanpa JWT Personal", "SECURE (PASS)", "Akses ditolak oleh database. RLS aktif.")
            elif response.status_code == 200:
                data = response.json()
                if len(data) == 0:
                    self.print_result("TC-SEC-01", "Membaca Tabel Warga Tanpa JWT Personal", "SECURE (PASS)", "Akses diterima namun data kosong (0 baris) berkat filter RLS.")
                else:
                    self.print_result("TC-SEC-01", "Membaca Tabel Warga Tanpa JWT Personal", "VULNERABLE (FAIL)", f"Database mengembalikan {len(data)} data warga secara telanjang!", "CRITICAL")
            else:
                self.print_result("TC-SEC-01", "Membaca Tabel Warga Tanpa JWT Personal", "UNKNOWN", f"Respon server: HTTP {response.status_code}")
        except Exception as e:
            self.print_result("TC-SEC-01", "Membaca Tabel Warga Tanpa JWT Personal", "ERROR", str(e))

    def test_pii_nik_leakage(self):
        endpoint = f"{self.url}/rest/v1/warga?select=nik"
        try:
            response = requests.get(endpoint, headers=self.headers, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if len(data) > 0 and "nik" in data[0]:
                    nik_sample = str(data[0]["nik"])
                    if "X" in nik_sample or "x" in nik_sample:
                        self.print_result("TC-COMP-01", "Eksposur NIK Plaintext", "SECURE (PASS)", f"NIK berhasil disamarkan: {nik_sample}")
                    else:
                        self.print_result("TC-COMP-01", "Eksposur NIK Plaintext", "VULNERABLE (FAIL)", f"NIK terekspos mentah: {nik_sample}. Harap terapkan masking!", "HIGH")
                else:
                    self.print_result("TC-COMP-01", "Eksposur NIK Plaintext", "SECURE (PASS)", "Tidak ada data NIK yang bocor publik.")
            else:
                self.print_result("TC-COMP-01", "Eksposur NIK Plaintext", "SECURE (PASS)", f"Akses ditolak database (HTTP {response.status_code}).")
        except Exception as e:
            self.print_result("TC-COMP-01", "Eksposur NIK Plaintext", "ERROR", str(e))

    def test_audit_log_immutability(self):
        delete_endpoint = f"{self.url}/rest/v1/audit_log"
        try:
            response = requests.delete(delete_endpoint, headers=self.headers, timeout=5)
            if response.status_code in [400, 401, 403, 405] and ("KEBIJAKAN KEAMANAN" in response.text or response.status_code == 400):
                self.print_result("TC-SEC-03", "Upaya Penghapusan Audit Log", "SECURE (PASS)", f"Penghapusan log ditolak mutlak (HTTP {response.status_code})")
            else:
                self.print_result("TC-SEC-03", "Upaya Penghapusan Audit Log", "VULNERABLE (FAIL)", f"Sistem mengembalikan HTTP {response.status_code} tanpa penolakan keras!", "HIGH")
        except Exception as e:
            self.print_result("TC-SEC-03", "Upaya Penghapusan Audit Log", "ERROR", str(e))

    def test_unauthorized_financial_insert(self):
        endpoint = f"{self.url}/rest/v1/kas_rt"
        payload = {"tipe_transaksi": "Pengeluaran", "kategori": "Operasional", "nominal": 10000000, "keterangan": "Eksploitasi Kas"}
        try:
            response = requests.post(endpoint, json=payload, headers=self.headers, timeout=5)
            if response.status_code in [200, 201]:
                self.print_result("TC-BUS-01", "Penyusupan Entri Finansial", "VULNERABLE (FAIL)", "Berhasil menyusupkan pengeluaran palsu Rp 10 Juta!", "CRITICAL")
            else:
                self.print_result("TC-BUS-01", "Penyusupan Entri Finansial", "SECURE (PASS)", f"Akses ditolak (HTTP {response.status_code}). Dibatasi RLS.")
        except Exception as e:
            self.print_result("TC-BUS-01", "Penyusupan Entri Finansial", "ERROR", str(e))

if __name__ == "__main__":
    # Prioritaskan pembacaan dari Environment Variables untuk mode non-interaktif CI/CD
    url = os.environ.get("SUPABASE_TEST_URL", "").strip()
    key = os.environ.get("SUPABASE_TEST_ANON_KEY", "").strip()
    
    # Mode interaktif: Wajib memasukkan URL dan Key jika Env Var kosong
    if not url or not key:
        print("[*] Info: Environment variables tidak lengkap. Meminta otentikasi manual...")
        url = url or input("Masukkan Supabase URL Anda (Wajib): ").strip()
        key = key or input("Masukkan Supabase Anon Key Anda (Wajib): ").strip()
    
    if not url or not key:
        print("[!] FATAL: URL dan Anon Key tidak boleh kosong. Eksekusi dibatalkan demi keamanan.")
        sys.exit(1)

    tester = SupabaseSecurityTester(url, key)
    tester.run_all_tests()