# 🍪 Cookie Setup Guide / Cookie O'rnatish Qo'llanmasi

## Uzbek / O'zbekcha

### Muammo
Instagram va YouTube'dan musiqa yuklab olishda "Authentication required" xatosi chiqmoqda.

### Yechim
Brauzeringizdan cookie'larni eksport qilish va botga qo'shish kerak.

### Qadamma-qadam yo'riqnoma:

#### 1-qadam: Brauzer kengaytmasini o'rnating

**Chrome uchun:**
1. Ushbu havolaga o'ting: https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc
2. "Add to Chrome" tugmasini bosing
3. "Add extension" ni tasdiqlang

**Firefox uchun:**
1. Ushbu havolaga o'ting: https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/
2. "Add to Firefox" tugmasini bosing

#### 2-qadam: YouTube cookie'larini eksport qiling

1. YouTube.com saytiga kiring
2. Hisobingizga login qiling (agar login qilmagan bo'lsangiz)
3. Brauzer yuqori o'ng burchagida "Get cookies.txt LOCALLY" kengaytmasini bosing
4. "Export" tugmasini bosing
5. Faylni `youtube_cookies.txt` nomi bilan saqlang
6. Bu faylni `myMusic` papkasiga ko'chiring

#### 3-qadam: Instagram cookie'larini eksport qiling

1. Instagram.com saytiga kiring
2. Hisobingizga login qiling (agar login qilmagan bo'lsangiz)
3. Brauzer yuqori o'ng burchagida "Get cookies.txt LOCALLY" kengaytmasini bosing
4. "Export" tugmasini bosing
5. Faylni `instagram_cookies.txt` nomi bilan saqlang
6. Bu faylni `myMusic` papkasiga ko'chiring

#### 4-qadam: Avtomatik setup skriptini ishga tushiring

Terminal'da quyidagi buyruqlarni bajaring:

```bash
cd /Users/islomannazarov/Desktop/myMusic
chmod +x scripts/setup-cookies.sh
./scripts/setup-cookies.sh
```

Skript avtomatik ravishda:
- Cookie fayllarini o'qiydi
- Base64 formatiga o'zgartiradi
- `.env` fayliga qo'shadi

#### 5-qadam: Cookie fayllarini o'chiring (xavfsizlik uchun)

```bash
rm youtube_cookies.txt instagram_cookies.txt
```

#### 6-qadam: Botni test qiling

```bash
npm run dev
```

Instagram yoki YouTube linkini yuboring va tekshiring!

---

## English

### Problem
Getting "Authentication required" error when downloading from Instagram and YouTube.

### Solution
Export cookies from your browser and add them to the bot.

### Step-by-step guide:

#### Step 1: Install browser extension

**For Chrome:**
1. Go to: https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc
2. Click "Add to Chrome"
3. Confirm "Add extension"

**For Firefox:**
1. Go to: https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/
2. Click "Add to Firefox"

#### Step 2: Export YouTube cookies

1. Go to YouTube.com
2. Make sure you're logged in
3. Click the "Get cookies.txt LOCALLY" extension in the top-right corner
4. Click "Export"
5. Save the file as `youtube_cookies.txt`
6. Move this file to the `myMusic` folder

#### Step 3: Export Instagram cookies

1. Go to Instagram.com
2. Make sure you're logged in
3. Click the "Get cookies.txt LOCALLY" extension in the top-right corner
4. Click "Export"
5. Save the file as `instagram_cookies.txt`
6. Move this file to the `myMusic` folder

#### Step 4: Run the automatic setup script

In terminal, run:

```bash
cd /Users/islomannazarov/Desktop/myMusic
chmod +x scripts/setup-cookies.sh
./scripts/setup-cookies.sh
```

The script will automatically:
- Read the cookie files
- Convert to Base64 format
- Add to `.env` file

#### Step 5: Delete cookie files (for security)

```bash
rm youtube_cookies.txt instagram_cookies.txt
```

#### Step 6: Test the bot

```bash
npm run dev
```

Send an Instagram or YouTube link and test!

---

## 🚀 Render Deployment / Render'ga Deploy Qilish

### O'zbekcha:

1. Render dashboard'ga kiring: https://dashboard.render.com
2. Sizning service'ingizni tanlang
3. "Environment" bo'limiga o'ting
4. Quyidagi environment variable'larni qo'shing:

`.env` faylingizdan qiymatlarni ko'chirib oling:

```bash
cat .env | grep COOKIES
```

Natijada ko'rsatiladigan qiymatlarni Render'ga qo'shing:
- `YT_COOKIES_B64` - YouTube cookie'lari
- `IG_COOKIES_B64` - Instagram cookie'lari

5. "Save Changes" tugmasini bosing
6. Service avtomatik ravishda qayta ishga tushadi

### English:

1. Go to Render dashboard: https://dashboard.render.com
2. Select your service
3. Go to "Environment" section
4. Add the following environment variables:

Copy values from your `.env` file:

```bash
cat .env | grep COOKIES
```

Add the displayed values to Render:
- `YT_COOKIES_B64` - YouTube cookies
- `IG_COOKIES_B64` - Instagram cookies

5. Click "Save Changes"
6. Service will automatically redeploy

---

## ⚠️ Important Notes / Muhim Eslatmalar

### O'zbekcha:
- Cookie'lar 6-12 oy amal qiladi, keyin yangilash kerak
- Cookie fayllarini hech kimga bermang (xavfsizlik!)
- Agar bot ishlamasa, cookie'larni yangilang
- Cookie'lar faqat sizning hisobingiz uchun ishlaydi

### English:
- Cookies are valid for 6-12 months, then need renewal
- Never share cookie files with anyone (security!)
- If bot stops working, refresh cookies
- Cookies only work for your account

---

## 🔧 Troubleshooting / Muammolarni Hal Qilish

### Agar bot hali ham ishlamasa:

1. Cookie'lar to'g'ri eksport qilinganini tekshiring
2. YouTube va Instagram'da login qilganingizni tasdiqlang
3. Botni qayta ishga tushiring: `npm run dev`
4. Log'larni tekshiring: `DEBUG=true npm run dev`

### If bot still doesn't work:

1. Verify cookies were exported correctly
2. Confirm you're logged in to YouTube and Instagram
3. Restart the bot: `npm run dev`
4. Check logs: `DEBUG=true npm run dev`
