# 🏸 AmbaLanton — Badminton Tournament & Ranking App

**AmbaLanton** (sebelumnya *Mabar Smash*) adalah aplikasi web premium modern untuk mengelola mabar (main bareng) badminton, membuat bagan pertandingan ganda putra (*Men's Doubles - MD*) atau tunggal (*Singles*), serta menghitung peringkat pemain dan pasangan secara otomatis secara real-time.

Aplikasi ini dilengkapi desain *glassmorphism* modern, animasi latar belakang dinamis, mode gelap (*dark mode*) yang harmonis, serta translasi antarmuka penuh ke **Bahasa Indonesia**.

---

## ✨ Fitur Utama

1. **🔌 Mode Demo Otomatis (LocalStorage Fallback)**:
   - Aplikasi dapat langsung dicoba tanpa database! Jika file `.env` tidak dikonfigurasi, aplikasi secara otomatis berjalan dalam **Mode Demo** menggunakan penyimpanan lokal browser (*LocalStorage*) dan langsung terisi 8 sampel pemain untuk dicoba.

2. **👥 Manajemen Pemain (Kelola Pemain)**:
   - Tambah, edit, dan hapus pemain dengan validasi otomatis (nama unik dan panjang karakter).
   - Kartu profil pemain menampilkan jumlah main (*MP*), rekor menang/kalah (*W/L*), rasio menang (*Win Rate*), dan selisih poin.

3. **⚖️ Generator Pasangan Pintar (Smart Pairing Generator)**:
   - **Otomatis (Seimbang)**: Algoritma cerdas yang mengurutkan peringkat performa pemain lalu memasangkan pemain terkuat dengan terlemah (peringkat 1 dengan terakhir, peringkat 2 dengan kedua dari belakang, dst) agar pertandingan mabar tetap kompetitif dan seru.
   - **Otomatis (Acak)**: Mengacak pemain dan memasangkannya secara acak.
   - **Manual**: Klik pemain secara bergantian untuk membentuk tim sendiri.
   - **Main Ganda (Double-Up)**: Mendukung jumlah pemain ganjil dengan membiarkan satu pemain terpilih bermain ganda (bermain dua kali dengan pasangan berbeda).

4. **🌿 Bagan Pertandingan SVG Interaktif (Interactive Bracket)**:
   - Visualisasi bagan pertandingan eliminasi tunggal (*single-elimination*) dengan garis konektor SVG dinamis yang menyala saat pemenang melaju.
   - Menangani jumlah tim ganjil/acak secara dinamis dengan menghasilkan *BYE* (lolos otomatis ke babak berikutnya) di ronde pertama.
   - Klik kartu pertandingan untuk memasukkan skor. Pemenang otomatis dipromosikan ke babak berikutnya, dan menyelesaikan babak final akan memicu efek kembang api/konfeti (*canvas-confetti*).
   - Memungkinkan pergantian pemain (*substitution*) atau formasi langsung di dalam modal pertandingan jika terjadi cedera atau kendala.

5. **🏆 Papan Klasemen Real-Time (Leaderboard & Rankings)**:
   - **Klasemen Ganda Putra**: Peringkat performa untuk pasangan ganda unik berdasarkan Rasio Menang, Total Menang, dan Selisih Poin (*Point Difference*).
   - **Klasemen Individu**: Peringkat performa per pemain yang dihitung dari total semua pertandingan yang dimainkannya bersama mitra yang berbeda-beda.
   - Dilengkapi fitur pencarian instan.

---

## 🛠️ Teknologi yang Digunakan

* **Frontend**: React + Vite + TypeScript
* **Styling**: Tailwind CSS v4 (Desain Glassmorphism & Custom Gradient Orbs)
* **Icons**: Lucide React
* **State Management**: `@tanstack/react-query` (Caching & sinkronisasi data yang cepat)
* **Effects**: `canvas-confetti`
* **Database (Opsional)**: Supabase (PostgreSQL)

---

## 🚀 Panduan Memulai

### 1. Kloning Repositori
```bash
git clone https://github.com/faturrahmanalharitszoe/badminton-app.git
cd badminton-app
```

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Jalankan Aplikasi Secara Lokal
Jika Anda ingin mencoba aplikasi langsung dalam **Mode Demo** (data tersimpan di browser Anda):
```bash
npm run dev
```
Aplikasi akan berjalan di `http://localhost:5173/`

---

## 🔌 Setup Database Cloud (Supabase)

Jika Anda ingin menyimpan data mabar di cloud agar dapat diakses dari perangkat mana saja:

### 1. Buat File Konfigurasi Lingkungan
Salin file `.env.example` menjadi `.env` di direktori utama proyek:
```bash
cp .env.example .env
```
Buka file `.env` dan isi dengan URL dan Anon Key proyek Supabase Anda:
```env
VITE_SUPABASE_URL=https://proyek-anda.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Jalankan Skema Database di Supabase
Buka dasbor proyek Anda di [Supabase](https://supabase.com), pilih menu **SQL Editor** -> **New query**, lalu salin dan jalankan perintah SQL berikut yang juga terdapat dalam file [`supabase-schema.sql`](file:///c:/Personal-Project/badminton-app/supabase-schema.sql):

```sql
-- 1. Tabel Pemain (Players)
CREATE TABLE public.players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabel Turnamen (Tournaments)
CREATE TABLE public.tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    format VARCHAR(50) DEFAULT 'double' NOT NULL, -- 'single' atau 'double'
    status VARCHAR(50) DEFAULT 'active' NOT NULL, -- 'active' atau 'completed'
    winner_team_ids TEXT[], -- Array ID pemain pemenang
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabel Pertandingan (Matches)
CREATE TABLE public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
    round INTEGER NOT NULL,
    match_index INTEGER NOT NULL,
    team1_ids TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    team2_ids TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    score1 INTEGER DEFAULT NULL,
    score2 INTEGER DEFAULT NULL,
    winner INTEGER DEFAULT NULL, -- 1 atau 2
    next_match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
    next_match_is_team2 BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Mengaktifkan Row Level Security (RLS) tetapi mengizinkan akses publik untuk kemudahan Mabar
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access" ON public.players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access" ON public.tournaments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access" ON public.matches FOR ALL USING (true) WITH CHECK (true);
```

Setelah itu, jalankan kembali server dev:
```bash
npm run dev
```
Indikator koneksi di pojok kiri bawah aplikasi akan berubah warna menjadi hijau: **"Terhubung Supabase"**.

---

## 📦 Perintah Build (Produksi)
Untuk menguji kebenaran tipe TypeScript dan membuat bundel produksi:
```bash
npm run build
```
Hasil kompilasi akan berada di dalam folder `/dist` dan siap dideploy ke platform seperti Vercel, Netlify, atau Cloudflare Pages.
