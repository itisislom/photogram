import { Translations } from './types';

export const uz: Translations = {
  code: 'uz',
  name: "O'zbekcha",

  common: {
    appName: 'Photogram',
    loading: 'Yuklanmoqda...',
    saving: 'Saqlanmoqda...',
    creating: 'Yaratilmoqda...',
    save: 'Saqlash',
    cancel: 'Bekor qilish',
    delete: "O'chirish",
    close: 'Yopish',
    attention: 'Diqqat',
    authRequired: 'Avtorizatsiya talab qilinadi',
    authRequiredMsg: 'Bu amalni bajarish uchun hisobingizga kirishingiz lozim.',
    networkError: 'Tarmoq xatosi',
    understood: 'Tushunarli',
    yes: 'Ha',
    no: "Yo'q",
    justNow: 'hozirgina',
    minutesShort: 'daq.',
    hoursShort: 'soat',
    daysShort: 'kun',
    likesCount: (n: number) => {
      if (n === 1) return '1 ta yoqdi';
      return `${n} ta yoqdi`;
    },
    commentsCount: (n: number) => `Izohlar (${n})`,
    postsCount: (n: number) => `${n}`,
    followersCount: (n: number) => `${n}`,
    followingCount: (n: number) => `${n}`,
    selectLanguage: 'Tilni tanlash',
  },

  nav: {
    feed: 'Tasma',
    explore: 'Qidiruv va tavsiyalar',
    create: 'Post yaratish',
    profile: 'Profil',
    menu: 'Menyu',
    settings: 'Sozlamalar',
    logout: 'Hisobdan chiqish',
  },

  auth: {
    loginTitle: 'Photogram-ga kirish',
    registerTitle: "Photogram-da ro'yxatdan o'tish",
    username: 'Foydalanuvchi nomi',
    displayName: 'Ism',
    password: 'Parol',
    loginBtn: 'Kirish',
    registerBtn: "Ro'yxatdan o'tish",
    noAccount: 'Hisobingiz yo‘qmi?',
    haveAccount: 'Hisobingiz bormi?',
    termsNotice: "Ro'yxatdan o'tishdan oldin siz qabul qilishingiz kerak:",
    termsLinkText: 'foydalanuvchi kelishuvi',
    termsModalTitle: 'Foydalanuvchi kelishuvi',
    accept18Plus: 'Qabul qilish (18+)',
    errUsernameFormat: 'Foydalanuvchi nomi: 3–24 belgi, faqat kichik harflar, raqamlar va pastki chiziq',
    errDisplayNameRequired: 'Ismingizni kiriting',
    errPasswordMin: 'Parol kamida 8 ta belgidan iborat bo‘lishi kerak',
    errTermsRequired: "Ro'yxatdan o'tishdan oldin foydalanuvchi kelishuvini qabul qilish lozim",
  },

  feed: {
    noPosts: 'Hozircha postlar yo‘q',
    noPostsDesc: "Qidiruv bo'limida boshqa foydalanuvchilarga obuna bo‘ling yoki birinchi suratingizni ulashing!",
    addComment: 'Izoh qo‘shing...',
    viewAllComments: (n: number) => `Barcha ${n} ta izohni ko‘rish`,
  },

  explore: {
    title: 'Tavsiyalar',
    searchPlaceholder: 'Foydalanuvchilarni qidirish...',
    noResults: 'Foydalanuvchilar topilmadi',
    users: 'Foydalanuvchilar',
    posts: 'Postlar',
  },

  profile: {
    editProfile: 'Tahrirlash',
    follow: 'Obuna bo‘lish',
    following: 'Obunadasiz',
    followBack: 'Qayta obuna bo‘lish',
    followsYou: 'Sizga obuna bo‘lgan',
    bio: 'Ma’lumot',
    changePhoto: 'Suratni o‘zgartirish',
    uploadPhoto: 'Surat yuklash',
    removePhoto: 'Joriy suratni o‘chirish',
    noPosts: 'Hozircha postlar yo‘q',
    postsTab: 'Postlar',
    savedTab: 'Saqlanganlar',
    menuTitle: 'Menyu',
    logoutConfirmTitle: 'Hisobdan chiqish?',
    logoutConfirmDesc: 'Haqiqatan ham o‘z hisobingizdan chiqmoqchimisiz?',
    deletePostConfirmTitle: 'Postni o‘chirish?',
    deletePostConfirmDesc: 'Haqiqatan ham bu postni o‘chirmoqchimisiz? Bu amalni ortga qaytarib bo‘lmaydi.',
    usernameLimitWarning: (left: number, days: number) =>
      `Limit tugadi (3 dan 3). O‘zgartirish ${days} kundan keyin mavjud bo‘ladi.`,
    usernameLimitLeft: (left: number) => `14 kun ichida yana ${left} marta o‘zgartirish mumkin`,
    usernameLimitNormal: '14 kun ichida 3 martagacha o‘zgartirish mumkin',
  },

  post: {
    newPostTitle: 'Yangi post',
    selectPhotoDropzone: 'Surat tanlash uchun bosing yoki surib keling',
    changePhoto: 'Boshqa surat tanlash',
    captionLabel: 'Nashr izohi',
    captionPlaceholder: 'Postga izoh yozing...',
    publishBtn: 'Ulashish',
    publishing: 'Ulashilmoqda...',
    nsfwBlocked: 'Surat avtomatik xavfsizlik tekshiruvidan o‘tmadi (18+ taqiqlangan kontent aniqlandi)',
    deletePost: 'Postni o‘chirish',
  },

  error: {
    offlineTitle: 'Internet aloqasi yo‘q',
    offlineDesc: 'Iltimos, internet ulanishini tekshiring va qaytadan urinib ko‘ring',
    reloadBtn: 'Qayta yuklash',
  },

  comments: {
    title: 'Izohlar',
    commentsHeader: (n: number) => `Izohlar (${n})`,
    firstCommentPrompt: 'Birinchi bo‘lib izoh qoldiring...',
    loading: 'Izohlar yuklanmoqda...',
    inputPlaceholder: 'Izoh qoldiring...',
    send: 'Yuborish',
    deleteTitle: 'Izohni o‘chirish?',
    deleteConfirm: 'Haqiqatan ham bu izohni o‘chirmoqchimisiz?',
  },

  recommendations: {
    allCaughtUp: 'Barcha yangi nashrlarni ko‘rib chiqdingiz',
    allCaughtUpDesc: 'Sizga yoqishi mumkin bo‘lgan tavsiya etilgan nashrlar',
    suggestedForYou: 'Siz uchun tavsiyalar',
    whoToFollow: 'Siz uchun tavsiya etilgan obunalar',
    follow: 'Obuna bo‘lish',
    following: 'Obunadasiz',
    notInterested: 'Qiziq emas',
    postHidden: 'Nashr tavsiyalardan yashirildi',
    relatedPosts: 'O‘xshash nashrlar',
    similarAccounts: 'O‘xshash profillar',
    tagForYou: 'Siz uchun',
    tagPopular: 'Ommabop',
    tagRecent: 'Yangi',
  },

  legal: {
    backToRegister: 'Ro‘yxatdan o‘tishga qaytish',
    title: 'Foydalanuvchi kelishuvi va ma’lumotlarni qayta ishlash siyosati',
    date: 'Amaldagi tahrir: 2026-yil 19-oktabr',
    cards: [
      {
        title: '1. Servis maqomi (Vaybkoding / As Is)',
        paragraphs: [
          'Ushbu Kelishuv «Photogram» veb-ilovasidan (keyingi o‘rinlarda — «Servis», «Platforma») Ma’muriyat (Egasi) hamda Servisdan foydalanuvchi har qanday jismoniy shaxs (keyingi o‘rinlarda — «Foydalanuvchi») o‘rtasida foydalanish shartlarini belgilaydi.',
          '«Photogram» servisi vaybkoding (Vibe Coding) formatida yaratilgan eksperimental dasturiy mahsulot hisoblanadi. Servis bepul asosda faqat «XUDDI SHUNDAY» («AS IS») va «MAVJUD BO‘LGANIDEK» («AS AVAILABLE») tamoyillari bo‘yicha taqdim etiladi.',
          'Ma’muriyat Servisning uzluksiz, xatosiz, to‘xtovsiz ishlashi, ma’lumotlarning saqlanishi yoki Foydalanuvchi kutgan talablarga mos kelishi bo‘yicha hech qanday kafolat bermaydi.',
        ],
      },
      {
        title: '2. Shaxsiy ma’lumotlarni to‘plash va qayta ishlashga rozilik',
        paragraphs: [
          'Servisda ro‘yxatdan o‘tish va rozilik belgisini qo‘yish orqali Foydalanuvchi O‘zbekiston Respublikasining «Shaxsiy ma’lumotlar to‘g‘risida»gi Qonuni (O‘RQ-547) va xalqaro standartlarga muvofiq Ma’muriyatga o‘z shaxsiy ma’lumotlarini (foydalanuvchi nomi, ko‘rsatiladigan ism, tarjimai hol, avatarlar, IP-manzillar, nashrlar metama’lumotlari, sessiyalarning texnik identifikatorlari) to‘plash, tizimlashtirish, saqlash, o‘zgartirish, foydalanish, egasizlantirish, bloklash va yo‘q qilishga ixtiyoriy, to‘g‘ridan-to‘g‘ri, so‘zsiz va qaytarib olinmaydigan rozilik beradi.',
          'Foydalanuvchi har qanday fotosuratlar va matnlarni mustaqil va ixtiyoriy ravishda cheklanmagan shaxslar doirasi uchun ochiq kirish imkoniyati bilan joylashtirayotganini tasdiqlaydi.',
        ],
      },
      {
        title: '3. Xakerlik hujumlari va nosozliklar uchun javobgarlikdan to‘liq voz kechish',
        paragraphs: [
          'Servis Ma’muriyati, egalari va dasturchilari quyidagi holatlar uchun Foydalanuvchi yoki uchinchi shaxslar oldida hech qanday javobgarlikni (fuqarolik, jinoiy, ma’muriy yoki moliyaviy) o‘z zimmasiga olmaydi:',
        ],
        list: [
          'Har qanday ruxsatsiz kirish, xakerlar harakati, kiberhujumlar, zararli dasturlar, ma’lumotlarni tutib olish, o‘g‘irlash yoki sizib chiqishi, axborotni o‘zgartirish yoki yo‘q qilish;',
          'Apparat, server va tarmoq nosozliklari, bulut provayderlari, xosting (Cloudflare Workers, D1, R2) yoki aloqa kanallari ishidagi uzilishlar;',
          'Nashrlar, fotosuratlar yoki profil ma’lumotlarining yo‘qolishi, shikastlanishi, o‘chirilishi yoki buzilishi;',
          'Har qanday to‘g‘ridan-to‘g‘ri, bilvosita, tasodifiy zararlar, boy berilgan foyda yoki ma’naviy zarar.',
        ],
      },
      {
        title: '4. Kontent uchun Foydalanuvchining mutlaq javobgarligi',
        paragraphs: [
          'Foydalanuvchi Servisga yuklangan har qanday materiallar (fotosuratlar, tasvirlar, ularga yozilgan izohlar, ism va tavsif) uchun O‘zbekiston Respublikasi Konstitutsiyasi, O‘zbekiston Respublikasi Jinoyat kodeksi, Ma’muriy javobgarlik to‘g‘risidagi kodeksi, «Axborotlashtirish to‘g‘risida»gi qonunlari hamda xalqaro huquq normalariga (jumladan DMCA) muvofiq yakka o‘zi, to‘g‘ridan-to‘g‘ri va to‘liq (jinoiy, ma’muriy va fuqarolik-huquqiy) javobgar bo‘ladi:',
        ],
        list: [
          'Ekstremistik, terroristik yoki separatistik xarakterdagi materiallarni, konstitutsiyaviy tuzumni zo‘rlik bilan o‘zgartirishga chaqiriqlarni, milliy, irqiy yoki diniy adovatni qo‘zg‘atuvchi materiallarni e’lon qilish qat’iyan man etiladi;',
          'Tuhmat, haqorat, pornografik materiallar, zo‘ravonlik, giyohvandlik vositalarini targ‘ib qilish, shuningdek uchinchi shaxslarning shaxsiy ma’lumotlarini ularning roziligisiz joylashtirish taqiqlanadi;',
          'Uchinchi shaxslarning mualliflik huquqlari va intellektual mulk huquqlarini buzish qat’iyan man etiladi.',
        ],
      },
      {
        title: '5. Ma’muriyatning huquqlari',
        paragraphs: [
          'Ma’muriyat istalgan vaqtda, bir tomonlama tartibda, oldindan ogohlantirmasdan va sabablarini tushuntirmasdan quyidagi huquqlarni o‘zida saqlab qoladi:',
        ],
        list: [
          'Har qanday Foydalanuvchilarning hisoblarini bloklash, kirishni cheklash yoki butunlay o‘chirib tashlash;',
          'Har qanday nashrlar va fotosuratlarni moderatsiya qilish, yashirish yoki o‘chirish;',
          'Servis funksiyalarini o‘zgartirish, texnik ishlarni o‘tkazish, ma’lumotlar bazalarini tozalash yoki istalgan vaqtda hech qanday tovon to‘lamasdan Servis faoliyatini to‘liq to‘xtatish.',
        ],
      },
      {
        title: '6. Qo‘llaniladigan huquq va nizolarni hal qilish',
        paragraphs: [
          'Ushbu Kelishuvdan kelib chiqadigan barcha munosabatlar O‘zbekiston Respublikasining amaldagi qonunchiligi bilan tartibga solinadi.',
          'Nizolarni sudgacha bo‘lgan da’vo tartibida hal qilish majburiydir. Yozma da’voga javob berish muddati 30 ta taqvimiy kunni tashkil etadi. Barcha hal etilmagan nizolar Ma’muriyat joylashgan joydagi sudda ko‘rib chiqiladi.',
        ],
      },
      {
        title: '7. Yosh cheklovlari (18+) va Kelishuvni qabul qilish',
        paragraphs: [
          'Ushbu Kelishuvni qabul qilish va Servisda ro‘yxatdan o‘tish orqali Foydalanuvchi o‘zining 18 yoshga to‘lganligini (balog‘at yoshiga yetganini va amaldagi qonunchilikka muvofiq to‘liq muomala layoqatiga ega shaxs ekanligini) to‘g‘ridan-to‘g‘ri bildiradi va tasdiqlaydi. 18 yoshga to‘lmagan shaxslarning Servisda ro‘yxatdan o‘tishi va undan foydalanishi qat’iyan man etiladi.',
          'Ro‘yxatdan o‘tish sahifasidagi «Ro‘yxatdan o‘tishdan oldin siz foydalanuvchi kelishuvini qabul qilishingiz kerak» bandiga belgi (galochka) qo‘yish Foydalanuvchining 18 yoshga to‘lganligini so‘zsiz tasdiqlaydi va O‘zbekiston Respublikasi Fuqarolik kodeksining 370-moddasiga muvofiq ushbu Kelishuvning to‘liq aksepti hisoblanadi.',
        ],
      },
    ],
  },
};
