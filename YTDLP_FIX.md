# yt-dlp Fix / yt-dlp Tuzatish

## O'zbekcha 🇺🇿

### Muammo
Bot YouTube'dan musiqa yuklab olishda quyidagi xatoni ko'rsatdi:
```
/opt/homebrew/opt/python@3.14/bin/python3.14: No module named yt-dlp
```

### Sabab
`.env` faylingizda `YT_DLP_BIN=python3 -m yt-dlp` deb yozilgan edi, lekin yt-dlp Python moduli sifatida o'rnatilmagan. Faqat oddiy binary sifatida o'rnatilgan.

### ✅ Yechim (Avtomatik bajarildi)
Men avtomatik ravishda tuzatdim:
1. `.env` faylingizni yangiladim
2. `YT_DLP_BIN=yt-dlp` ga o'zgartirdim
3. To'g'ridan-to'g'ri binary ishlatiladi

### Keyingi qadam
**Botni qayta ishga tushiring:**
```bash
# Terminal'da hozir ishlab turgan botni to'xtating (Ctrl+C)
# Keyin qayta ishga tushiring:
npm run dev
```

---

## English 🇬🇧

### Problem
Bot showed this error when downloading from YouTube:
```
/opt/homebrew/opt/python@3.14/bin/python3.14: No module named yt-dlp
```

### Cause
Your `.env` file had `YT_DLP_BIN=python3 -m yt-dlp`, but yt-dlp is not installed as a Python module. It's only installed as a standalone binary.

### ✅ Solution (Automatically Applied)
I automatically fixed it:
1. Updated your `.env` file
2. Changed to `YT_DLP_BIN=yt-dlp`
3. Now uses the direct binary

### Next Step
**Restart your bot:**
```bash
# Stop the currently running bot in terminal (Ctrl+C)
# Then restart:
npm run dev
```

---

## 🔍 Technical Details

### What Changed
- **Before:** `YT_DLP_BIN=python3 -m yt-dlp`
- **After:** `YT_DLP_BIN=yt-dlp`

### Why This Works
- yt-dlp is installed at `/opt/homebrew/bin/yt-dlp`
- This is a standalone binary, not a Python module
- Using the direct binary is more reliable on macOS

### For Render Deployment
On Render, you should use `python3 -m yt-dlp` because:
- Render installs yt-dlp as a Python package
- The Python module approach works better in containerized environments

Add this to Render environment variables:
```
YT_DLP_BIN=python3 -m yt-dlp
```

---

## ✅ Verification

Run this to verify yt-dlp works:
```bash
yt-dlp --version
```

Should output: `2025.12.08` (or similar version)

---

## 🚀 Next Steps

1. **Restart bot** (see above)
2. **Test YouTube download** - Send a YouTube link
3. **Setup cookies** for Instagram (see QUICK_START.md)
4. **Deploy to Render** with correct environment variables
