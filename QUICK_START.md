# Quick Start / Tez Boshlash

## O'zbekcha 🇺🇿

### 1. Brauzer kengaytmasini o'rnating
- **Chrome:** [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
- **Firefox:** [Get cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)

### 2. Cookie'larni eksport qiling
1. **YouTube:** youtube.com → Login → Kengaytma → Export → `youtube_cookies.txt` sifatida saqlang
2. **Instagram:** instagram.com → Login → Kengaytma → Export → `instagram_cookies.txt` sifatida saqlang

### 3. Fayllarni `myMusic` papkasiga ko'chiring
```bash
# Fayllarni Downloads papkasidan ko'chiring
mv ~/Downloads/youtube_cookies.txt /Users/islomannazarov/Desktop/myMusic/
mv ~/Downloads/instagram_cookies.txt /Users/islomannazarov/Desktop/myMusic/
```

### 4. Avtomatik setup'ni ishga tushiring
```bash
cd /Users/islomannazarov/Desktop/myMusic
./scripts/setup-cookies.sh
```

### 5. Cookie fayllarni o'chiring (xavfsizlik!)
```bash
rm youtube_cookies.txt instagram_cookies.txt
```

### 6. Botni test qiling
```bash
npm run dev
```

Instagram yoki YouTube linkini yuboring! ✅

---

## English 🇬🇧

### 1. Install browser extension
- **Chrome:** [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
- **Firefox:** [Get cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)

### 2. Export cookies
1. **YouTube:** youtube.com → Login → Extension → Export → Save as `youtube_cookies.txt`
2. **Instagram:** instagram.com → Login → Extension → Export → Save as `instagram_cookies.txt`

### 3. Move files to `myMusic` folder
```bash
# Move files from Downloads
mv ~/Downloads/youtube_cookies.txt /Users/islomannazarov/Desktop/myMusic/
mv ~/Downloads/instagram_cookies.txt /Users/islomannazarov/Desktop/myMusic/
```

### 4. Run automatic setup
```bash
cd /Users/islomannazarov/Desktop/myMusic
./scripts/setup-cookies.sh
```

### 5. Delete cookie files (security!)
```bash
rm youtube_cookies.txt instagram_cookies.txt
```

### 6. Test the bot
```bash
npm run dev
```

Send an Instagram or YouTube link! ✅

---

## 🚀 Render Deployment

### Copy cookies to Render:
```bash
# Show your cookie values
cat .env | grep COOKIES
```

Copy the output and add to Render:
1. Go to https://dashboard.render.com
2. Select your service
3. Environment → Add variables:
   - `YT_COOKIES_B64` = (paste value)
   - `IG_COOKIES_B64` = (paste value)
4. Save Changes

---

## ⚠️ Troubleshooting

### Agar avtomatik skript ishlamasa / If automatic script doesn't work:
```bash
./scripts/manual-cookie-setup.sh
```

Bu sizga cookie'larni qo'lda qo'shish uchun ko'rsatmalar beradi.
This will give you instructions to add cookies manually.

### Agar hali ham ishlamasa / If still not working:
1. Cookie'lar to'g'ri eksport qilinganini tekshiring / Verify cookies exported correctly
2. YouTube va Instagram'da login qilganingizni tasdiqlang / Confirm you're logged in
3. Cookie'larni yangilang / Refresh cookies
4. Botni qayta ishga tushiring / Restart bot

---

## 📚 Batafsil ma'lumot / Detailed Guide
Ko'proq ma'lumot uchun: [COOKIE_SETUP_GUIDE.md](./COOKIE_SETUP_GUIDE.md)
For more information: [COOKIE_SETUP_GUIDE.md](./COOKIE_SETUP_GUIDE.md)
