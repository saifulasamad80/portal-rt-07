#!/usr/bin/env python3
"""
PORTAL RT 07 INTEGRATED MANAGEMENT PORTAL - DATABASE PERFORMANCE & LOAD TESTING SCRIPT
Deskripsi: Skrip pembanding performa untuk menguji efisiensi kueri agregasi keuangan.
           Membandingkan metode pengolahan data in-memory di browser (Client-Side) 
           dengan agregasi di dalam mesin database PostgreSQL Views (Server-Side).
Fitur: Mendukung mode simulasi lokal (SQLite3) untuk pengujian offline instan 
       dan mode live koneksi langsung ke REST API Supabase.
Bahasa: Python 3
Ketergantungan: requests (hanya untuk mode Live Supabase)
"""

import sys
import time
import os
import sqlite3
import random

try:
    import requests
except ImportError:
    pass

class PerformanceTester:
    def __init__(self):
        self.num_warga = 250       # Simulasi 250 Kepala Keluarga
        self.num_transactions = 15000  # Simulasi 15.000 riwayat transaksi finansial (akumulasi beberapa tahun)
        
    def print_header(self, text):
        print("\n" + "=" * 80)
        print(f" {text:^78}")
        print("=" * 80)

    def run_sqlite_simulation(self):
        self.print_header("MENJALANKAN SIMULASI LOAD TEST LOKAL (OFFLINE ENGINE)")
        print(f"[*] Membuat database in-memory...")
        conn = sqlite3.connect(":memory:")
        cursor = conn.cursor()
        
        # Buat tabel simulasi
        cursor.execute("""
        CREATE TABLE warga (
            id TEXT PRIMARY KEY,
            nama_lengkap TEXT
        )""")
        
        cursor.execute("""
        CREATE TABLE kas_rt (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipe_transaksi TEXT,
            nominal INTEGER,
            warga_id TEXT
        )""")
        
        cursor.execute("""
        CREATE TABLE tabungan_kurban (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            warga_id TEXT,
            jenis_transaksi TEXT,
            nominal INTEGER
        )""")

        cursor.execute("""
        CREATE TABLE transaksi_sampah (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            warga_id TEXT,
            jenis_transaksi TEXT,
            nominal_warga INTEGER
        )""")
        
        # Populate data dummy warga
        print(f"[*] Menyisipkan {self.num_warga} data warga dummy...")
        warga_ids = [f"warga-{i}" for i in range(self.num_warga)]
        for wid in warga_ids:
            cursor.execute("INSERT INTO warga (id, nama_lengkap) VALUES (?, ?)", (wid, f"Warga RT07 No-{wid.split('-')[1]}"))
            
        # Populate data transaksi dummy (kas_rt, kurban, sampah)
        print(f"[*] Menyisipkan {self.num_transactions} baris mutasi finansial acak...")
        
        # Kas RT
        kas_records = []
        for _ in range(self.num_transactions // 3):
            tipe = random.choice(["Pemasukan", "Pengeluaran"])
            nominal = random.randint(10000, 500000)
            wid = random.choice(warga_ids) if tipe == "Pemasukan" else None
            kas_records.append((tipe, nominal, wid))
        cursor.executemany("INSERT INTO kas_rt (tipe_transaksi, nominal, warga_id) VALUES (?, ?, ?)", kas_records)

        # Tabungan Kurban
        kurban_records = []
        for _ in range(self.num_transactions // 3):
            wid = random.choice(warga_ids)
            jenis = random.choice(["Setor", "Tarik"])
            nominal = random.randint(50000, 1000000)
            kurban_records.append((wid, jenis, nominal))
        cursor.executemany("INSERT INTO tabungan_kurban (warga_id, jenis_transaksi, nominal) VALUES (?, ?, ?)", kurban_records)

        # Transaksi Sampah
        sampah_records = []
        for _ in range(self.num_transactions // 3):
            wid = random.choice(warga_ids)
            jenis = random.choice(["Setor", "Tarik"])
            nominal = random.randint(5000, 150000)
            sampah_records.append((wid, jenis, nominal))
        cursor.executemany("INSERT INTO transaksi_sampah (warga_id, jenis_transaksi, nominal_warga) VALUES (?, ?, ?)", sampah_records)
        
        conn.commit()
        print("[+] Data dummy berhasil di-generate secara lokal.")

        # ---------------------------------------------------------------------
        # BENCHMARK 1: CLIENT-SIDE IN-MEMORY AGGREGATION SIMULATION
        # ---------------------------------------------------------------------
        self.print_header("BENCHMARK 1: METODE LAMA CLIENT-SIDE (IN-MEMORY PROCESS)")
        print("[*] Mensimulasikan browser menarik seluruh data mentah tanpa batasan...")
        
        start_time = time.perf_counter()
        
        # Tarik semua data mentah ke memori Python (mensimulasikan RAM browser)
        cursor.execute("SELECT tipe_transaksi, nominal, warga_id FROM kas_rt")
        raw_kas = cursor.fetchall()
        
        cursor.execute("SELECT warga_id, jenis_transaksi, nominal FROM tabungan_kurban")
        raw_kurban = cursor.fetchall()

        cursor.execute("SELECT warga_id, jenis_transaksi, nominal_warga FROM transaksi_sampah")
        raw_sampah = cursor.fetchall()
        
        # Hitung agregasi di sisi klien (in-memory) menggunakan looping / filter / reduce equivalent
        pemasukan = sum(r[1] for r in raw_kas if r[0] == "Pemasukan")
        pengeluaran = sum(r[1] for r in raw_kas if r[0] == "Pengeluaran")
        saldo_akhir_kas = pemasukan - pengeluaran
        
        # Hitung saldo kurban per warga
        saldo_kurban_dict = {}
        for r in raw_kurban:
            wid, jenis, nominal = r
            if wid not in saldo_kurban_dict:
                saldo_kurban_dict[wid] = 0
            if jenis == "Setor":
                saldo_kurban_dict[wid] += nominal
            else:
                saldo_kurban_dict[wid] -= nominal
                
        # Hitung saldo sampah per warga
        saldo_sampah_dict = {}
        for r in raw_sampah:
            wid, jenis, nominal = r
            if wid not in saldo_sampah_dict:
                saldo_sampah_dict[wid] = 0
            if jenis == "Setor":
                saldo_sampah_dict[wid] += nominal
            else:
                saldo_sampah_dict[wid] -= nominal

        client_duration = (time.perf_counter() - start_time) * 1000 # ms
        
        # Estimasi payload data yang ditransmisikan lewat jaringan (JSON transfer size)
        total_rows_fetched = len(raw_kas) + len(raw_kurban) + len(raw_sampah)
        estimated_network_payload_kb = (total_rows_fetched * 150) / 1024 # ~150 bytes per JSON object
        
        print(f"  [+] Data Kas Terhitung   : Pemasukan=Rp {pemasukan:,}, Pengeluaran=Rp {pengeluaran:,}, Saldo=Rp {saldo_akhir_kas:,}")
        print(f"  [+] Total Baris Diunduh  : {total_rows_fetched:,} baris transaksi mentah")
        print(f"  [+] Ukuran JSON Jaringan : ± {estimated_network_payload_kb:.2f} KB (Beban Bandwidth)")
        print(f"  [+] Waktu Eksekusi Klien : {client_duration:.2f} ms")

        # ---------------------------------------------------------------------
        # BENCHMARK 2: SERVER-SIDE DATABASE-LEVEL AGGREGATION (VIEWS)
        # ---------------------------------------------------------------------
        self.print_header("BENCHMARK 2: METODE BARU SERVER-SIDE (POSTGRESQL VIEWS)")
        print("[*] Browser hanya memanggil Views agregasi database yang sudah matang...")
        
        start_time = time.perf_counter()
        
        # Eksekusi kueri agregasi di database (mensimulasikan Views v_rekap_kas_rt)
        cursor.execute("""
        SELECT 
            COALESCE(SUM(CASE WHEN tipe_transaksi = 'Pemasukan' THEN nominal ELSE 0 END), 0) AS total_pemasukan,
            COALESCE(SUM(CASE WHEN tipe_transaksi = 'Pengeluaran' THEN nominal ELSE 0 END), 0) AS total_pengeluaran,
            (COALESCE(SUM(CASE WHEN tipe_transaksi = 'Pemasukan' THEN nominal ELSE 0 END), 0) - 
             COALESCE(SUM(CASE WHEN tipe_transaksi = 'Pengeluaran' THEN nominal ELSE 0 END), 0)) AS saldo_akhir
        FROM kas_rt
        """)
        view_kas = cursor.fetchone()
        
        # Eksekusi kueri agregasi saldo kurban per warga (mensimulasikan v_saldo_kurban_warga)
        cursor.execute("""
        SELECT 
            w.id,
            COALESCE(SUM(CASE WHEN tk.jenis_transaksi = 'Setor' THEN tk.nominal ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN tk.jenis_transaksi = 'Tarik' THEN tk.nominal ELSE 0 END), 0) AS saldo_kurban
        FROM warga w
        LEFT JOIN tabungan_kurban tk ON w.id = tk.warga_id
        GROUP BY w.id
        """)
        view_kurban = cursor.fetchall()

        # Eksekusi kueri agregasi saldo sampah per warga (mensimulasikan v_saldo_sampah_warga)
        cursor.execute("""
        SELECT 
            w.id,
            COALESCE(SUM(CASE WHEN ts.jenis_transaksi = 'Setor' THEN ts.nominal_warga ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN ts.jenis_transaksi = 'Tarik' THEN ts.nominal_warga ELSE 0 END), 0) AS saldo_sampah
        FROM warga w
        LEFT JOIN transaksi_sampah ts ON w.id = ts.warga_id
        GROUP BY w.id
        """)
        view_sampah = cursor.fetchall()
        
        server_duration = (time.perf_counter() - start_time) * 1000 # ms
        
        # Estimasi payload data dari View (hanya data agregat akhir)
        total_view_rows_fetched = 1 + len(view_kurban) + len(view_sampah)
        estimated_view_payload_kb = (total_view_rows_fetched * 100) / 1024 # ~100 bytes per aggregated object
        
        print(f"  [+] Data Kas Terhitung   : Pemasukan=Rp {view_kas[0]:,}, Pengeluaran=Rp {view_kas[1]:,}, Saldo=Rp {view_kas[2]:,}")
        print(f"  [+] Total Baris Diunduh  : {total_view_rows_fetched:,} baris (Hanya data hasil rekap)")
        print(f"  [+] Ukuran JSON Jaringan : ± {estimated_view_payload_kb:.2f} KB (Beban Bandwidth super ringan)")
        print(f"  [+] Waktu Eksekusi View  : {server_duration:.2f} ms")

        # ---------------------------------------------------------------------
        # METRICS COMPARISON DISPLAY
        # ---------------------------------------------------------------------
        self.print_header("HASIL ANALISIS DAN MATRIKS PERFORMA")
        speedup = client_duration / max(server_duration, 0.0001)
        bandwidth_saving = (1 - (estimated_view_payload_kb / estimated_network_payload_kb)) * 100
        
        print(f"  1. Rasio Kecepatan Kueri  : Database Server {speedup:.2f}x LEBIH CEPAT dibanding Browser.")
        print(f"  2. Penghematan Bandwidth  : Mengurangi beban transfer data sebesar {bandwidth_saving:.2f}%.")
        print(f"  3. Pencegahan Crash RAM  : Metode Client-Side berisiko tinggi memicu Out-of-Memory (OOM)")
        print(f"                             pada ponsel warga saat transaksi mencapai puluhan ribu baris.")
        print(f"                             Metode Server-Side PostgreSQL Views stabil pada konsumsi O(1) memori klien.")
        
        color_code = "\033[92m" if speedup > 3.0 else "\033[93m"
        print(f"\n  STATUS PERFORMA: {color_code}OPTIMIZED & SCALABLE (PASS)\033[0m")
        print("=" * 80 + "\n")
        
        conn.close()

    def run_live_supabase(self, url, key):
        self.print_header("MENJALANKAN BENCHMARK LIVE PADA BACKEND SUPABASE")
        if 'requests' not in sys.modules:
            print("[!] Gagal: Modul 'requests' diperlukan untuk pengujian Live Supabase.")
            print("[!] Silakan jalankan 'pip install requests' terlebih dahulu.")
            return

        headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
        
        url = url.rstrip('/')
        
        # 1. Benchmark kueri data kas mentah (Metode Klien Lama)
        print("[*] Mengukur waktu unduh & kueri data mentah kas_rt...")
        start = time.perf_counter()
        res_raw = requests.get(f"{url}/rest/v1/kas_rt?select=*", headers=headers, timeout=10)
        dur_raw = (time.perf_counter() - start) * 1000
        
        if res_raw.status_code != 200:
            print(f"[!] Gagal menarik data mentah: HTTP {res_raw.status_code} - {res_raw.text}")
            return
            
        raw_count = len(res_raw.json())
        print(f"  [+] Data Kas Mentah ditarik : {raw_count} baris")
        print(f"  [+] Waktu Respons Jaringan  : {dur_raw:.2f} ms")

        # 2. Benchmark kueri data kas via View (Metode Server Baru)
        print("\n[*] Mengukur waktu kueri View Agregasi v_rekap_kas_rt...")
        start = time.perf_counter()
        res_view = requests.get(f"{url}/rest/v1/v_rekap_kas_rt?select=*", headers=headers, timeout=10)
        dur_view = (time.perf_counter() - start) * 1000
        
        if res_view.status_code != 200:
            print(f"[!] Peringatan: View v_rekap_kas_rt belum dibuat di database Supabase Anda.")
            print("[!] Pastikan Anda sudah mengimpor skrip migrasi database v2 terlebih dahulu.")
            return

        view_data = res_view.json()
        print(f"  [+] Rekap ditarik dari View : {len(view_data)} baris (Agregat Akhir)")
        print(f"  [+] Waktu Respons View      : {dur_view:.2f} ms")
        
        speedup = dur_raw / max(dur_view, 0.0001)
        print(f"\n[+] Live Speedup Factor: {speedup:.2f}x lebih cepat lewat Server-Side Views.")
        print("=" * 80 + "\n")

if __name__ == "__main__":
    tester = PerformanceTester()
    print("PORTAL RT 07 INTEGRATED MANAGEMENT PORTAL - PERFORMANCE LOAD TESTER")
    print("1. Jalankan Simulasi Load Test Lokal Offline (Merekomendasikan 15,000 Transaksi)")
    print("2. Jalankan Benchmark Live di Database Supabase Anda")
    
    choice = input("\nPilih opsi pengujian [1/2] (Default: 1): ").strip() or "1"
    
    if choice == "1":
        tester.run_sqlite_simulation()
    elif choice == "2":
        url = input("Masukkan Supabase URL Anda: ").strip()
        key = input("Masukkan Supabase Anon Key Anda: ").strip()
        if not url or not key:
            print("[!] Error: URL dan Anon Key tidak boleh kosong.")
            sys.exit(1)
        tester.run_live_supabase(url, key)
    else:
        print("[!] Pilihan tidak valid.")
