# Sonex Music Bot

Telegram bot - YouTube va Instagram linklaridan video va musiqani yuklab olish.

## 🚀 Xususiyatlar

- ✅ YouTube linklaridan video va musiqani yuklab olish
- ✅ Instagram Reels, Posts, TV videolaridan musiqani ajratish
- ✅ Linkdagi qo'shiqning to'liq versiyasini topish va yuklab berish
- ✅ Tez va samarali ishlash
- ✅ Real-time progress ko'rsatish
- ✅ Xatoliklarni to'g'ri boshqarish

## 📋 Talablar

- Node.js 22+
- Python 3 (yt-dlp uchun)
- ffmpeg (audio/video qayta ishlash uchun)
- yt-dlp (video yuklab olish uchun)

## 🔧 O'rnatish

### Lokal o'rnatish

1. Repository'ni klon qiling:
```bash
git clone <your-repo-url>
cd myMusic
```

2. Dependencies'ni o'rnating:
```bash
npm install
```

3. `.env` fayl yarating:
```env
BOT_TOKEN=your_telegram_bot_token_here
```

4. Botni ishga tushiring:
```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

### Docker orqali

```bash
# Build
docker build -t sonex-music-bot .

# Run
docker run -d -p 3000:3000 -e BOT_TOKEN=your_token_here sonex-music-bot
```

## 🌐 Render'ga deploy qilish

1. Render dashboard'ga kiring
2. "New Web Service" ni tanlang
3. Repository'ni ulang
4. Quyidagi sozlamalarni kiriting:
   - **Build Command**: (Dockerfile avtomatik ishlaydi)
   - **Start Command**: (Dockerfile avtomatik ishlaydi)
   - **Environment Variables**: `BOT_TOKEN` ni qo'shing

5. Deploy qiling!

## 📱 Foydalanish

1. Botga `/start` yuboring
2. Quyidagilardan birini yuboring:
   - **YouTube link**: `https://www.youtube.com/watch?v=...`
   - **Instagram link**: `https://www.instagram.com/reel/...`
   - **Qo'shiq nomi**: `Aga - Xushla mani`

Bot avtomatik ravishda:
- Videoni yuklab oladi
- Audioni ajratadi
- To'liq qo'shiqni topib yuboradi (agar mavjud bo'lsa)

## 🧪 Testlar

```bash
npm test
```

## 📝 Scripts

- `npm run dev` - Development mode (tsx bilan)
- `npm run build` - TypeScript'ni compile qilish
- `npm start` - Production mode
- `npm test` - Testlarni ishga tushirish

## 🔍 Muammolarni hal qilish

### Bot ishga tushmayapti

1. `BOT_TOKEN` to'g'ri o'rnatilganligini tekshiring
2. `yt-dlp` va `ffmpeg` o'rnatilganligini tekshiring:
```bash
yt-dlp --version
ffmpeg -version
```

### Render'da xatolik

1. Environment variables'da `BOT_TOKEN` borligini tekshiring
2. Build loglarini ko'rib chiqing
3. Dockerfile to'g'ri ishlayotganligini tekshiring

## 📄 License

ISC

