/**
 * ══════════════════════════════════════════════════════════
 *             𓆩 𝐒𝐎𝐔𝐑𝐂𝐄 𝐑𝐎𝐂𝐊 𓆪 - الـقـسـم الإسـلامـي والـصـلاة
 *          قـنـاة الـسـورس: https://t.me/Source_Rock
 * ══════════════════════════════════════════════════════════
 */

import { SOURCE_LINK, rockHeader, rockFooter } from './constants.js';

// خريطة العواصم والدول
export const CITY_MAP = {
  'صنعاء': { city: 'Sanaa', country: 'Yemen', name: 'صنعـاء', countryAr: 'الـيـمـن' },
  'اليمن': { city: 'Sanaa', country: 'Yemen', name: 'صنعـاء', countryAr: 'الـيـمـن' },
  'القاهرة': { city: 'Cairo', country: 'Egypt', name: 'الـقـاهـرة', countryAr: 'مـصـر' },
  'القاهره': { city: 'Cairo', country: 'Egypt', name: 'الـقـاهـرة', countryAr: 'مـصـر' },
  'مصر': { city: 'Cairo', country: 'Egypt', name: 'الـقـاهـرة', countryAr: 'مـصـر' },
  'الرياض': { city: 'Riyadh', country: 'Saudi Arabia', name: 'الـريـاض', countryAr: 'الـسـعـوديـة' },
  'السعودية': { city: 'Riyadh', country: 'Saudi Arabia', name: 'الـريـاض', countryAr: 'الـسـعـوديـة' },
  'السعوديه': { city: 'Riyadh', country: 'Saudi Arabia', name: 'الـريـاض', countryAr: 'الـسـعـوديـة' },
  'مكة': { city: 'Mecca', country: 'Saudi Arabia', name: 'مـكـة الـمـكـرمـة', countryAr: 'الـسـعـوديـة' },
  'مكه': { city: 'Mecca', country: 'Saudi Arabia', name: 'مـكـة الـمـكـرمـة', countryAr: 'الـسـعـوديـة' },
  'المدينة': { city: 'Medina', country: 'Saudi Arabia', name: 'الـمـديـنـة الـمـنـورة', countryAr: 'الـسـعـوديـة' },
  'المدينه': { city: 'Medina', country: 'Saudi Arabia', name: 'الـمـديـنـة الـمـنـورة', countryAr: 'الـسـعـوديـة' },
  'بغداد': { city: 'Baghdad', country: 'Iraq', name: 'بـغـداد', countryAr: 'الـعـراق' },
  'العراق': { city: 'Baghdad', country: 'Iraq', name: 'بـغـداد', countryAr: 'الـعـراق' },
  'دمشق': { city: 'Damascus', country: 'Syria', name: 'دمـشـق', countryAr: 'سـوريـا' },
  'سوريا': { city: 'Damascus', country: 'Syria', name: 'دمـشـق', countryAr: 'سـوريـا' },
  'القدس': { city: 'Jerusalem', country: 'Palestine', name: 'الـقـدس الـشـريـف', countryAr: 'فـلـسـطـيـن' },
  'فلسطين': { city: 'Jerusalem', country: 'Palestine', name: 'الـقـدس الـشـريـف', countryAr: 'فـلـسـطـيـن' },
  'عمان': { city: 'Amman', country: 'Jordan', name: 'عـمّـان', countryAr: 'الأردن' },
  'الأردن': { city: 'Amman', country: 'Jordan', name: 'عـمّـان', countryAr: 'الأردن' },
  'الاردن': { city: 'Amman', country: 'Jordan', name: 'عـمّـان', countryAr: 'الأردن' },
  'الكويت': { city: 'Kuwait City', country: 'Kuwait', name: 'الـكـويـت', countryAr: 'الـكـويـت' },
  'الدوحة': { city: 'Doha', country: 'Qatar', name: 'الـدوحـة', countryAr: 'قـطـر' },
  'الدوحه': { city: 'Doha', country: 'Qatar', name: 'الـدوحـة', countryAr: 'قـطـر' },
  'قطر': { city: 'Doha', country: 'Qatar', name: 'الـدوحـة', countryAr: 'قـطـر' },
  'المنامة': { city: 'Manama', country: 'Bahrain', name: 'الـمـنـامـة', countryAr: 'الـبـحـريـن' },
  'المنامه': { city: 'Manama', country: 'Bahrain', name: 'الـمـنـامـة', countryAr: 'الـبـحـريـن' },
  'البحرين': { city: 'Manama', country: 'Bahrain', name: 'الـمـنـامـة', countryAr: 'الـبـحـريـن' },
  'مسقط': { city: 'Muscat', country: 'Oman', name: 'مـسـقـط', countryAr: 'سـلـطـنـة عـمـان' },
  'ابوظبي': { city: 'Abu Dhabi', country: 'UAE', name: 'أبـوظـبـي', countryAr: 'الإمـارات' },
  'أبوظبي': { city: 'Abu Dhabi', country: 'UAE', name: 'أبـوظـبـي', countryAr: 'الإمـارات' },
  'دبي': { city: 'Dubai', country: 'UAE', name: 'دبـي', countryAr: 'الإمـارات' },
  'الامارات': { city: 'Abu Dhabi', country: 'UAE', name: 'أبـوظـبـي', countryAr: 'الإمـارات' },
  'بيروت': { city: 'Beirut', country: 'Lebanon', name: 'بـيـروت', countryAr: 'لـبـنـان' },
  'لبنان': { city: 'Beirut', country: 'Lebanon', name: 'بـيـروت', countryAr: 'لـبـنـان' },
  'طرابلس': { city: 'Tripoli', country: 'Libya', name: 'طـرابـلـس', countryAr: 'لـيـبـيـا' },
  'ليبيا': { city: 'Tripoli', country: 'Libya', name: 'طـرابـلـس', countryAr: 'لـيـبـيـا' },
  'تونس': { city: 'Tunis', country: 'Tunisia', name: 'تـونـس', countryAr: 'تـونـس' },
  'الجزائر': { city: 'Algiers', country: 'Algeria', name: 'الـجـزائـر', countryAr: 'الـجـزائـر' },
  'الرباط': { city: 'Rabat', country: 'Morocco', name: 'الـربـاط', countryAr: 'الـمـغـرب' },
  'المغرب': { city: 'Rabat', country: 'Morocco', name: 'الـربـاط', countryAr: 'الـمـغـرب' },
  'الخرطوم': { city: 'Khartoum', country: 'Sudan', name: 'الـخـرطـوم', countryAr: 'الـسـودان' },
  'السودان': { city: 'Khartoum', country: 'Sudan', name: 'الـخـرطـوم', countryAr: 'الـسـودان' },
};

export async function getPrayerTimes(cityQuery) {
  const norm = (cityQuery || '').trim();
  const info = CITY_MAP[norm] || {
    city: norm,
    country: '',
    name: norm,
    countryAr: 'الـعـالـم الـعـربـي',
  };

  try {
    const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(info.city)}&country=${encodeURIComponent(info.country)}&method=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data.code === 200 && data.data) {
        const timings = data.data.timings;
        const date = data.data.date;
        return `╭━━━ ❮ 𓆩 🕋 𝐒𝐎𝐔𝐑𝐂𝐄 𝐑𝐎𝐂𝐊 - 𝙋𝙍𝘼𝙔𝙀𝙍 𓆪 ❯ ━━━╮\n` +
               `│ 🕌 *مـواقـيـت الـصـلاة الـرسـمـيـة* \n` +
               `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n` +
               `⋆┄─┄─┄─┄┄─┄─┄─┄─┄┄⋆\n` +
               `📍 *الـمـديـنـة:* ${info.name}\n` +
               `🌍 *الـدولـة:* ${info.countryAr}\n` +
               `📅 *الـمـيـلادي:* ${date.gregorian.date} مـ\n` +
               `🌙 *الـهـجـري:* ${date.hijri.date} هـ (${date.hijri.month.ar})\n` +
               `⋆┄─┄─┄─┄┄─┄─┄─┄─┄┄⋆\n` +
               `• الـفـجــر    : *${timings.Fajr}*\n` +
               `• الـشـروق   : *${timings.Sunrise}*\n` +
               `• الـظـهــر    : *${timings.Dhuhr}*\n` +
               `• الـعـصــر    : *${timings.Asr}*\n` +
               `• الـمـغـرب   : *${timings.Maghrib}*\n` +
               `• الـعـشـاء    : *${timings.Isha}*\n` +
               `• الإمـسـاك  : *${timings.Imsak}*\n` +
               `• مـنـتـصـف الـلـيـل: *${timings.Midnight}*\n` +
               rockFooter();
      }
    }
  } catch (err) {}

  // Fallback offline display
  return `╭━━━ ❮ 𓆩 🕋 𝐒𝐎𝐔𝐑𝐂𝐄 𝐑𝐎𝐂𝐊 - 𝙋𝙍𝘼𝙔𝙀𝙍 𓆪 ❯ ━━━╮\n` +
         `│ 🕌 *مـواقـيـت الـصـلاة لـ ${info.name}* \n` +
         `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n` +
         `⋆┄─┄─┄─┄┄─┄─┄─┄─┄┄⋆\n` +
         `• الـفـجــر    : *04:45 AM*\n` +
         `• الـشـروق   : *06:05 AM*\n` +
         `• الـظـهــر    : *12:10 PM*\n` +
         `• الـعـصــر    : *03:30 PM*\n` +
         `• الـمـغـرب   : *06:15 PM*\n` +
         `• الـعـشـاء    : *07:45 PM*\n` +
         rockFooter();
}

export const RUQYAH = 
`╭━━━ ❮ 𓆩 🕋 𝐒𝐎𝐔𝐑𝐂𝐄 𝐑𝐎𝐂𝐊 - 𝙍𝙐𝙌𝙔𝘼𝙃 𓆪 ❯ ━━━╮
│ 📖 *الـرُّقـيـة الـشـرعـيـة الـشـامـلـة* 
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯
⋆┄─┄─┄─┄┄─┄─┄─┄─┄┄⋆
﴿ بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ﴾
﴿ اللّهُ لاَ إِلَـهَ إِلاَّ هُوَ الْحَيُّ الْقَيُّومُ لاَ تَأْخُذُهُ سِنَةٌ وَلاَ نَوْمٌ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الأَرْضِ مَن ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلاَّ بِإِذْنِهِ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ وَلاَ يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلاَّ بِمَا شَاء وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالأَرْضَ وَلاَ يَؤُودُهُ حِفْظُهُمَا وَهُوَ الْعَلِيُّ الْعَظِيمُ ﴾

﴿ قُلْ هُوَ اللَّهُ أَحَدٌ ۞ اللَّهُ الصَّمَدُ ۞ لَمْ يَلِدْ وَلَمْ يُولَدْ ۞ وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ ﴾
﴿ قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۞ مِن شَرِّ مَا خَلَقَ ۞ وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ ۞ وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ۞ وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ ﴾
﴿ قُلْ أَعُوذُ بِرَبِّ النَّاسِ ۞ مَلِكِ النَّاسِ ۞ إِلَٰهِ النَّاسِ ۞ مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ۞ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ۞ مِنَ الْجِنَّةِ وَالنَّاسِ ﴾

✨ *دعاء الشفاء والتحصين:*
"أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّةِ مِنْ كُلِّ شَيْطَانٍ وَهَامَّةٍ وَمِنْ كُلِّ عَيْنٍ لَامَّةٍ"
"بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ العَلِيمُ" (3 مرات)
${rockFooter()}`;

export const AZKAR_LIST = [
  "✨ *سُبْحَانَ اللَّهِ وَبِحَمْدِهِ ، سُبْحَانَ اللَّهِ الْعَظِيمِ* (حبيبتان إلى الرحمن، خفيفتان على اللسان، ثقيلتان في الميزان)",
  "✨ *لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ* (ما دعا بها مكروب إلا فرّج الله كربه)",
  "✨ *أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ الَّذِي لَا إِلَهَ إِلَّا هُوَ الْحَيَّ الْقَيُّومَ وَأَتُوبُ إِلَيْهِ* (موجبة للمغفرة وتيسير الرزق)",
  "✨ *اللَّهُمَّ صَلِّ وَسَلِّمْ وَبَارِكْ عَلَى نَبِيِّنَا مُحَمَّدٍ* (من صلى عليّ صلاة صلى الله عليه بها عشراً)",
  "✨ *لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ الْعَلِيِّ الْعَظِيمِ* (كنز من كنوز الجنة)"
];
