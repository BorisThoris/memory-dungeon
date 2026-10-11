// Bobball's complete name filter, shared by the Memory Dungeon renderer and record Worker.
// The classic-script wrapper is ESM here. PHONETIC_NAMES adds the owner's requested disguised-name checks.
//
// It is deliberately aggressive. The public record shows a name to everyone who plays, so a false
// positive costs one player a retry and a false negative costs everyone. A name is read several
// ways before the lists are searched:
//   * lower-cased, compatibility-decomposed (fullwidth, circled, bold, superscript letters fold
//     back), accents and invisible characters dropped, regional-indicator flags read as letters;
//   * transliterated (Cyrillic, Greek, a few stray Latin letters) so "сука" reads "suka", and
//     separately read by LOOKS, so "fuсk" typed with a Cyrillic с reads "fuck" too;
//   * leetspeak undone ("sh1t", "a$$"), separators dropped ("s.h.i.t"), repeats collapsed ("shiiit").
// The STRONG list is then searched as substrings; WHOLE words (those that also live inside ordinary
// names: "ass" in "cassandra", "kur" in "kurt") match only as whole words; PATTERNS are the few
// regexes that need context; NATIVE words are searched in their own script (Arabic, Hebrew, Hindi,
// CJK, Thai) on the compacted original. Languages: English, Bulgarian (this is Sofia), Russian,
// Ukrainian, Serbian/Croatian, Polish, Czech/Slovak, Romanian, Hungarian, Greek, Turkish, Albanian,
// German, Dutch, French, Spanish, Portuguese, Italian, the Nordics, Finnish, Baltic, Arabic, Hebrew,
// Persian, Hindi/Urdu, Japanese, Chinese, Korean, Thai, Vietnamese, Indonesian/Malay, Filipino,
// Swahili, Afrikaans. Extra words can be added at run time through extend().

  // ---- transliteration (what the word sounds like) ----
  const CYR = { "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ж": "zh", "з": "z", "и": "i", "й": "i", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sht", "ъ": "a", "ы": "i", "ь": "", "э": "e", "ю": "yu", "я": "ya", "ё": "e",
    // Ukrainian, Belarusian, Serbian, Macedonian
    "є": "ye", "і": "i", "ї": "yi", "ґ": "g", "ў": "u", "ђ": "dj", "ј": "j", "љ": "lj", "њ": "nj", "ћ": "c", "џ": "dz", "ѕ": "s", "ѓ": "g", "ќ": "k" };
  const GRK = { "α": "a", "β": "v", "γ": "g", "δ": "d", "ε": "e", "ζ": "z", "η": "i", "θ": "th", "ι": "i", "κ": "k", "λ": "l", "μ": "m", "ν": "n", "ξ": "x", "ο": "o", "π": "p", "ρ": "r", "σ": "s", "ς": "s", "τ": "t", "υ": "u", "φ": "f", "χ": "h", "ψ": "ps", "ω": "o" };
  // ---- what the glyph looks like (homoglyphs); the transliteration pass cannot see these ----
  const LOOK = { "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "к": "k", "н": "h", "в": "b", "т": "t", "м": "m", "ѕ": "s", "і": "i", "ј": "j", "ԁ": "d", "ԛ": "q", "ԝ": "w", "г": "r", "п": "n", "и": "u", "ь": "b", "ъ": "b", "б": "6", "з": "3", "ч": "4",
    "α": "a", "β": "b", "ε": "e", "η": "n", "ι": "i", "κ": "k", "ν": "v", "ο": "o", "ρ": "p", "τ": "t", "υ": "u", "χ": "x", "ω": "w", "γ": "y", "μ": "u", "ζ": "z", "δ": "d", "ς": "s", "σ": "o", "ϲ": "c", "λ": "l" };
  // Latin letters NFKD leaves alone, small capitals, and the odd symbol used as a letter
  const LAT = { "ß": "ss", "æ": "ae", "œ": "oe", "ø": "o", "đ": "d", "ł": "l", "ı": "i", "þ": "th", "ð": "d", "ƒ": "f", "ŋ": "n", "ħ": "h", "ŧ": "t", "ƀ": "b", "ƈ": "c", "ɑ": "a", "ɡ": "g", "ɩ": "i", "ɪ": "i", "ʀ": "r", "ʙ": "b", "ɢ": "g", "ʜ": "h", "ᴀ": "a", "ᴄ": "c", "ᴅ": "d", "ᴇ": "e", "ꜰ": "f", "ᴊ": "j", "ᴋ": "k", "ʟ": "l", "ᴍ": "m", "ɴ": "n", "ᴏ": "o", "ᴘ": "p", "ꞯ": "q", "ꜱ": "s", "ᴛ": "t", "ᴜ": "u", "ᴠ": "v", "ᴡ": "w", "ʏ": "y", "ᴢ": "z", "ə": "e", "ɛ": "e", "ɔ": "o", "ʊ": "u", "ɲ": "n", "ʃ": "s", "ʒ": "z", "¢": "c", "€": "e", "£": "l", "¥": "y", "§": "s", "×": "x", "¡": "i", "¿": "?" };
  const LEET = { "0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "4": "a", "@": "a", "5": "s", "$": "s", "7": "t", "+": "t", "8": "b", "9": "g", "6": "g", "2": "z", "(": "c", "<": "c", "{": "c", "[": "c", "^": "a", "&": "and" };

  // ---- substrings: match anywhere after normalisation ----
  const STRONG = [
    // English
    "fuck", "fuk", "fck", "fvck", "fvk", "fuq", "shit", "btch", "bitch", "biatch", "biotch", "beotch", "bytch", "cunt", "kunt", "nigg", "negro", "faggot", "fagot", "dyke", "retard",
    "rapist", "whore", "slut", "cock", "dick", "penis", "pussy", "vagin", "boob", "tits", "titt", "wank", "jerkoff", "jackoff", "blowjob", "handjob", "rimjob", "jizz", "jism", "semen", "porn",
    "asshole", "ashole", "arsehole", "bastard", "piss", "twat", "prick", "bollock", "bugger", "motherf", "mofo", "milf", "dildo", "orgasm", "clit", "coochie", "cumshot", "fellat", "goddamn",
    "masturb", "nipple", "nutsack", "phallus", "queef", "schlong", "scrotum", "smegma", "testicle", "vulva", "gangbang", "bukkake", "sodom", "douchebag", "dumbas", "jackas", "kickas", "smartas",
    "lardas", "fatas", "badas", "nazi", "hitler", "swastika", "siegheil", "genocide", "holocaust", "jihad", "terror", "murder", "suicide", "killyourself", "killurself", "molest", "pedo", "paedo",
    "incest", "bestial", "zoophil", "chink", "wetback", "towelhead", "raghead", "tranny", "shemale", "lesbo", "cripple", "spastic", "chinaman", "darkie", "darky", "zipperhead", "polack",
    "redskin", "currymuncher", "cameljockey", "gyppo", "pikey", "midget", "fatso", "schoolshoot", "binladen", "alqaeda", "alqaida", "onlyfans", "pornhub", "xvideo", "xhamster", "xnxx", "redtube",
    "brazzers", "http", "www",
    // Bulgarian, as the transliteration spells it
    "kurva", "kurvi", "kurve", "kurvo", "kurv", "putka", "putki", "putkat", "pichka", "pichki", "picka", "pederas", "ebah", "ebal", "ebat", "ebasi", "ebavam", "ebach", "maikata", "mainata", "maikamu",
    "maikati", "mamkat", "shibam", "shiban", "shibana", "laina", "laino", "govna", "govno", "boklu", "kopele", "kopeleta", "mangasar", "mangali", "mangalk", "cigan", "tsigan", "chernilk", "prostitu",
    "chukam", "chukane", "huya", "huyo", "gomnar", "mrasni", "obratni",
    // Russian, Ukrainian, Belarusian
    "blyad", "blyat", "blyad", "bliat", "pizd", "pizda", "huinya", "huyn", "huila", "huilo", "nahui", "nahuy", "pohui", "pohuy", "ohui", "ohuel", "ohuen", "huev", "eblya", "eban", "uebok",
    "uebish", "zaebal", "pidor", "pidar", "pidr", "pedik", "mudak", "mudil", "mudoz", "gandon", "gondon", "zalupa", "droch", "shlyuh", "shluh", "shalav", "dolboeb", "suchka", "padla", "chmo",
    "zhopa", "zhop", "srak", "sranii", "hohol", "zhid", "churka", "chernozhop", "svoloch", "svolot", "padlyuk", "givno", "yibav", "sukin",
    // Serbian, Croatian, Bosnian, Slovene, Macedonian
    "jebem", "jebi", "jebo", "jebat", "jebac", "jebany", "jeban", "jebiga", "jebote", "jebe", "jebn", "jebl", "zajeb", "pojeb", "wyjeb", "rozjeb", "najeb", "dojeb", "ujeb", "kurac", "kurcina",
    "kurc", "sranje", "guzica", "drkati", "drkadz", "djubre", "smrad", "mamicu", "pusikurac", "picku", "pickic",
    // Polish
    "kurwa", "kurwi", "kurwo", "kurw", "chuj", "pierdol", "pierdal", "spierd", "wypierd", "zapierd", "pierdz", "skurw", "cipk", "dupek", "dupc", "dupsk", "gowno", "dziwk", "szmat", "kutas",
    "ruchac", "ruchan", "kurewsk", "pedaly",
    // Czech, Slovak
    "kokot", "hovno", "hovna", "hovne", "sracka", "zmrd", "mrdat", "mrdk", "mrdn", "buzerant", "hajzl", "picus", "kokotina",
    // Romanian
    "muie", "muist", "futu", "fute", "futai", "cacat", "pisat", "curva", "coaie", "bulangiu", "bagami", "jegos", "tigan", "bozgor", "jidan", "poponar", "labagiu", "nenorocit", "sugio",
    // Hungarian
    "baszd", "baszni", "bassza", "bazmeg", "bazdmeg", "baszmeg", "basz", "picsa", "fasz", "geci", "szarik", "seggfej", "anyad", "cigany", "ribanc", "kocsog", "csicska",
    // Greek, as the transliteration spells it
    "malaka", "malakia", "malakas", "gamot", "gamies", "gamiso", "gamis", "poutan", "putan", "arxidi", "archidi", "arhidi", "kariol", "poust", "psol", "skatof", "mounop",
    // Turkish
    "amcik", "amck", "aminakoy", "aminak", "sikerim", "sikeyim", "siktir", "sikik", "sikis", "sikim", "sikti", "sikeceg", "orospu", "oruspu", "orosbu", "pezevenk", "ibne", "yarrak", "yarak",
    "tasak", "kahpe", "kahba", "boktan", "gerizekal", "gotveren", "gotunu",
    // Albanian
    "pidh", "qifsh", "qij", "byth", "pordh", "budalla", "kurvar",
    // German
    "scheiss", "scheis", "arschloch", "fotz", "votz", "hurens", "wichs", "ficken", "fickt", "fickst", "fickdi", "schwanz", "schlampe", "miststuck", "mistst", "nutte", "drecksau", "schwuchtel",
    "kanack", "neger", "missgeb", "misgeb", "spast", "titten", "pimmel", "bumsen", "wixer", "zigeuner", "judensau", "heilhitler",
    // Dutch
    "kutwijf", "kanker", "klootzak", "godverd", "nikker", "smeerlap", "kutje",
    // French
    "merde", "putain", "salop", "salaud", "connar", "connas", "encul", "niqueta", "niquesa", "niquez", "niquer", "couill", "foutre", "tapette", "branl", "gouine", "bougnoul", "suceu",
    "enfoire", "poufiass", "pouffiass", "troudu", "tagueul", "nichon", "chinetoque", "youpin", "bamboula",
    // Spanish
    "puta", "mierda", "cabron", "pendej", "joder", "jodid", "jodet", "cojon", "chinga", "chingad", "maricon", "gilipoll", "hijueput", "hijoput", "hijaput", "hijeput", "culero", "culera",
    "culiao", "culiado", "culear", "carajo", "follar", "follad", "follam", "mamad", "malparid", "gonorrea", "bolud", "pelotud", "chupam", "chupal", "chupame", "marimach", "sudaca", "sudak",
    "panocha",
    // Portuguese
    "caralh", "foda", "fodas", "fodid", "fodase", "fodese", "fuder", "fudeu", "fudid", "bucet", "bocet", "viado", "viadinh", "arrombad", "piroca", "cacete", "punhet", "babaca", "xoxota", "cuzao",
    "cuzinho", "pentelho", "sapatao", "escroto", "desgracad",
    // Italian
    "cazz", "stronz", "fancul", "puttan", "minchi", "coglion", "pompin", "porcod", "porcamad", "froci", "mignott", "ricchion", "sborr", "scopare", "cagat", "culatton", "inculat", "fott",
    "vaffa",
    // Swedish, Norwegian, Danish
    "fitta", "kukk", "horunge", "javla", "javlar", "jaevla", "knulla", "knull", "runka", "rasshol", "rassh",
    // Finnish, Estonian
    "vittu", "vitun", "kyrpa", "mulkku", "mulkk", "huora", "pillu", "runkkar", "runkk", "saatana", "neekeri", "perkele", "hintti", "persse", "putsi",
    // Lithuanian, Latvian
    "bybi", "pimpis",
    // Arabic, Persian, Hebrew, Urdu, romanised
    "sharmut", "sharmoot", "sharmot", "kosomak", "kosumak", "kosomk", "kusemek", "kusemak", "kusamak", "koskesh", "kosskesh", "koskhol", "kharkos", "manyak", "manyouk", "manyok", "ibnkalb",
    "khawal", "khawel", "zobr", "zobbi", "zubbi", "nikomak", "nikmok", "benzona", "kunde", "kooni", "jende", "pedarsag", "harumzad", "haramzad", "haramkhor", "harami",
    // Hindi, Urdu, romanised
    "chutiy", "chutya", "bhosdi", "bhosad", "bhosri", "bhenchod", "behenchod", "behnchod", "bhnchod", "madarchod", "maderchod", "madarchd", "gaandu", "gandu", "chinal", "chhinal", "jhaat",
    "jhant", "bakchod", "chodu", "chod", "bhadwa", "bhadva", "lavda", "lawda",
    // Japanese, Chinese, Korean, Thai, romanised
    "chinko", "chinpo", "kintama", "omanko", "kichigai", "oppai", "caonima", "caoni", "tamade", "ganniniang", "wangbadan", "biaozi", "nmsl", "heigui", "ssibal", "ssipal", "shibal",
    "byungsin", "byeongsin", "pyongshin", "gaesaek", "gaesek", "saekki", "jiral", "jilal", "michin", "changnyeo", "dokthong",
    // Vietnamese, Indonesian, Malay, Filipino, romanised
    "ditme", "ditcon", "cailon", "daubuoi", "bangsat", "kontol", "kontl", "memek", "ngentot", "ngentod", "entot", "pantek", "pepek", "pukimak", "pukima", "goblok", "goblog", "tolol",
    "jancok", "jancuk", "pelacur", "lonte", "bajingan", "kimak", "keparat", "sundal", "perek", "ngewe", "itil", "jembut", "cibai", "chibai", "cheebye", "kanina", "lanjiao", "lanciao",
    "kanasai", "pundek", "pundeh", "putang", "tangina", "tarantado", "pekpek", "kantot", "bwisit", "pakyu", "hindot", "kupal", "punyeta", "jakol",
    // Swahili, Afrikaans
    "kumamayo", "kumamako", "mkundu", "mjinga", "fokken", "fokof", "fokkof", "bliksem", "kaffir", "kaffer", "poephol",
  ];
  // ---- whole words only: these also live inside ordinary names ----
  const WHOLE = [
    "ass", "asses", "arse", "tit", "cum", "gay", "hoe", "ho", "sex", "fag", "fags", "fgt", "kur", "gaz", "gyz", "eba", "ebi", "ebe", "hui", "huy",
    "poo", "pee", "crap", "suck", "sucks", "nob", "knob", "butt", "balls", "nuts", "wtf", "stfu", "lmfao", "kys", "die", "dead",
    "hell", "damn", "kill", "anal", "anus", "coon", "gyp", "spic", "gook", "kike", "homo", "queer", "pedal", "peder", "gej", "gey",
    "mrsh", "isis", "isil", "kkk", "klan", "puss", "hoes", "slag", "skank", "tard", "fap", "cuck", "simp", "thot", "cooch", "douche", "hooker", "horny", "orgy", "pecker", "poon",
    "shag", "skeet", "spunk", "tosser", "sperm", "boner", "hentai", "beaner", "gringo", "cracker", "honky", "jap", "coolie", "sambo", "kraut", "yid", "heeb", "injun", "abo", "paki",
    "chav", "mong", "spaz", "autist", "downie", "taliban", "hamas", "heil", "noose", "rape", "raped", "rapes", "raping", "idiot", "admin", "moderator", "mod",
    // Bulgarian, Russian, the Balkans
    "mangal", "kuro", "suka", "suki", "manda", "tvar", "mraz", "srat", "daun", "debil", "urod", "loh", "hach", "moskal", "kuchka", "gazar", "zadnik", "minet", "svinya", "prostak",
    "tapanar", "dupe", "duped", "pusi", "mrs", "stoka", "budala", "prdel", "blbec", "svina", "buzna", "buzik", "kunda", "hajzel", "kreten", "pica", "pico", "pici", "srac", "curak", "mrd",
    "cwel", "huj", "cipa", "dupa", "ciota", "cycki", "gnoj", "murzyn", "pula", "fut", "curve", "sugi", "cur", "coae", "sula", "dracu", "laba", "pina", "buzi", "szar", "segg", "hulye",
    "sudas", "suds", "mauka", "perse", "tura", "munn", "sitt", "lits", "kurat", "kar", "mut", "verga", "polla",
    // Greek, Turkish, Arabic, Persian, Hebrew
    "mouni", "skata", "skato", "vlakas", "sik", "pic", "bok", "salak", "amk", "anani", "anan", "kus", "kuss", "kos", "khara", "kharra", "zeb", "zebi", "zib", "tiz", "ars", "zona",
    "kir", "koon", "gooh", "goh",
    // Hindi, Urdu
    "chut", "gand", "gaand", "lund", "loda", "kutta", "kutti", "kuttiya", "kamina", "kamine", "tatti", "hijra", "hijda",
    // Japanese, Chinese, Korean, Thai, Vietnamese
    "manko", "korosu", "unko", "kuso", "busu", "shabi", "jiba", "cnm", "tmd", "diao", "zhina", "sibal", "sipal", "saeki", "sekki", "boji", "jaji", "hia", "kuay", "sus", "yed",
    "dit", "duma", "vcl", "vkl", "cac", "buoi",
    // Indonesian, Malay, Filipino
    "anjing", "babi", "puki", "bodoh", "tetek", "asu", "bego", "taik", "monyet", "peler", "titit", "butoh", "sohai", "knn", "ccb", "gago", "gaga", "ulol", "bobo", "tanga", "puke", "titi",
    "burat", "hayop", "inutil", "ungas",
    // Spanish, Portuguese, French, Italian
    "cono", "pinche", "zorra", "perra", "pija", "mamon", "cago", "cagon", "marica", "chocho", "pito", "teta", "tetas", "orto", "trolo", "trola", "puto", "porra",
    "bicha", "cu", "corno", "vadia", "otario", "otaria", "bosta", "piranha", "xota", "bunda", "veado", "bite", "chatte", "pute", "putes", "batard", "bordel", "fdp", "ntm",
    "nique", "chier", "zizi", "pouffe", "pd", "cul", "burne", "clito", "chiasse", "culo", "troia", "figa", "fica", "finocchio", "zoccola", "pisello", "cornuto", "checca", "sfigato",
    "cesso", "terrone",
    // German, Dutch, Nordic, Finnish, Afrikaans
    "arsch", "hure", "fick", "schwul", "kanake", "kanacke", "muschi", "kacke", "penner", "trottel", "tunte", "kotze", "kut", "lul", "neuk", "neuken", "hoer", "tering", "tyfus",
    "mongool", "mongol", "flikker", "eikel", "pik", "trut", "teef", "sukkel", "klote", "reet", "slet", "mietje", "debiel", "poep", "gvd", "kuk", "hora", "pikk", "luder", "kusse",
    "fisse", "svans", "paska", "kulli", "ryssa", "poes", "doos", "naai", "fok", "kak", "moer", "kafir", "piel", "tief",
    // Swahili
    "kuma", "shoga", "mavi", "fala",
  ];
  // ---- regexes on the normalised string, for the few words that need context ----
  const PATTERNS = [
    /n[iy]g+[aur]/, /n[iy]g+er/,     // nigga, niggr, niger; "nigel" is left alone
    /(^|[^dgt])rap(e|ist|ing)/,     // rape, rapist; not grape, drape, trap
    /(^|[^s])sex/,                  // sexgod, sexy; not essex, sussex
    /f+[uv]+c+k+/, /s+h+[i1]+t+/,   // belt and braces for the two everyone tries
  ];
  // ---- fake-name soundalikes, matched against joined words ----
  // Joining already removes spaces, punctuation, invisible characters and leetspeak. Whole-name
  // anchors avoid banning an ordinary Nick, Ben, Mike, Hugh or Phil merely for their first name.
  // Contiguous word groups below also catch a title or suffix around a fake name.
  const PHONETIC_NAMES = [
    /^n[iy]+(?:c+k+|c+|k+|q+)g+[aeu]+r+[aeu]*$/, // Nick Gera / Nick Gurr and spelling disguises
    /^kn[eiy]+gr[oa]+w?$/,                       // Knee Grow
    /^m[iy]+k+e?h[uoa]+nt$/,                     // Mike Hunt
    /^b[e]+nd[oau]+v[e]+r$/,                     // Ben Dover
    /^h[u]+g+h+j+a+s+$/,                         // Hugh Jass
    /^filmc+rac?k[ei]n$/,                        // Phil McCracken (ph normalises to f)
    /^jac+k+g+[oa]+f+$/                          // Jack Goff
  ];
  // ---- on the digits of the original, before leetspeak is undone ----
  const DIGITS = [/(^|\D)1488(\D|$)/, /(^|\D)69(\D|$)/, /(^|\D)14\D*88(\D|$)/];
  // ---- words in their own script, searched in the compacted original ----
  const NATIVE = [
    // Arabic, Persian, Urdu
    "شرموط", "كسم", "كسام", "كسك", "زبر", "خرا", "عرص", "منيك", "منيوك", "طيز", "قحب", "ابنالكلب",
    "کیر", "جنده", "کسکش", "کونی", "مادرجنده", "پدرسگ", "خارکسه", "کصکش", "کصشر",
    "چوتیا", "مادرچود", "بہنچود", "گانڈ", "رنڈی", "حرامی", "کتیا",
    // Hebrew
    "זין", "זונה", "בןזונה", "כוסאמק", "חרא", "מניאק", "שרמוטה", "קוקסינל", "הומו",
    // Hindi (Devanagari)
    "चूतिय", "भोसड़", "भोसड", "मादरचोद", "बहनचोद", "गांड", "लंड", "लौड़", "लौड", "रंडी", "हरामी", "चोद", "भड़वा", "भडवा", "भोसड़ा", "गांडू", "लवड़ा",
    // Japanese (hiragana; katakana is folded to hiragana first)
    "まんこ", "ちんこ", "ちんぽ", "きんたま", "せっくす", "ふぁっく", "死ね", "殺す", "くたばれ", "きちがい", "気違い", "れいぷ", "おっぱい", "あなる", "ぺにす", "ばぎな", "ゔぁぎな", "強姦", "売女", "マンコ", "チンコ",
    // Chinese (simplified and traditional)
    "操你", "肇", "傻逼", "傻屄", "煞笔", "沙比", "妈的", "媽的", "你妈", "你媽", "去死", "婊子", "贱人", "賤人", "狗屎", "屌", "鸡巴", "雞巴", "屄", "干你娘", "幹你娘", "干你妈", "幹你媽", "王八蛋", "混蛋", "日你", "草泥马", "草泥馬", "法克", "尼玛", "尼瑪", "傻屌", "阴茎", "陰莖", "阴道", "陰道", "强奸", "強姦", "妓女", "白痴", "智障", "弱智", "黑鬼", "支那", "蠢货", "蠢貨", "死全家", "龟头", "龜頭",
    // Korean
    "씨발", "시발", "씨팔", "시팔", "씩", "좋", "자지", "보지", "병신", "개새끼", "개새", "새끼", "지랄", "미친", "니미", "엿먹어", "꺼져", "죽어", "죽을래", "창녀", "걸레", "호모", "쌍놈", "쌍년", "개년", "개놈", "썭", "시부랄", "씨부랄", "좋까", "좋같", "염병", "닥쳤",
    // Thai
    "เหี้ย", "ควย", "สัส", "แม่ง", "เย็ด", "ส้นตีน", "จัญไร", "ระยำ", "อีดอก", "ดอกทอง", "หน้าหี", "กะหรี่", "ชิบหาย", "หี",
    // Cyrillic words the transliteration would not spell as listed
    "хуй", "хуя", "хуе", "хер", "еба", "ебё", "йоб", "уёб", "бля", "гъз", "ѓз",
  ];
  const EMOJI = /\u{1F595}|\u{1F346}|\u{1F351}|\u{1F4A6}|\u{1F595}/u;   // middle finger, aubergine, peach, sweat drops

  const added = [];   // optional run-time additions through extend()
  // These are individual invisible code points to remove, including standalone Hangul fillers.
  // eslint-disable-next-line no-misleading-character-class
  const INVISIBLE = /[\u00ad\u034f\u061c\u180e\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufe00-\ufe0f\ufeff\u1160\u115f\u3164\uffa0\u{e0000}-\u{e007f}]/gu;
  const fold = (s) => String(s || "").normalize("NFKD").replace(INVISIBLE, "").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, (c) => String.fromCharCode(c.codePointAt(0) - 0x1F1E6 + 97))   // 🇫🇺🇨🇰
    .replace(/[¡-ɏɐ-ʯᴀ-ᵿꜰ-ꟿ€]/g, (c) => LAT[c] ?? c);
  const leet = (s) => s.replace(/vv/g, "w").replace(/ph/g, "f").replace(/[0-9!@$+|(<{[^&]/g, (c) => LEET[c] ?? c);
  // two Latin readings of the name: by sound and by looks
  const bySound = (s) => leet(fold(s).replace(/[а-џҐґ]/g, (c) => CYR[c] ?? c).replace(/[α-ω]/g, (c) => GRK[c] ?? c));
  const byLooks = (s) => leet(fold(s).replace(/[а-џԀ-ԯα-ωϲ]/g, (c) => LOOK[c] ?? c));
  const squeeze = (s) => s.replace(/(.)\1+/g, "$1");
  const letters = (s) => s.replace(/[^a-z]/g, "");
  function normalise(raw) { return letters(bySound(raw)); }
  // the original with katakana folded to hiragana and everything but letters and marks dropped
  const compact = (raw) => String(raw || "").normalize("NFKC").replace(INVISIBLE, "").toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/[\p{Z}\p{P}\p{S}\p{C}]/gu, "");
  function hit(word, n, c) { return n.includes(word) || c.includes(word); }
  function bad(raw) {
    raw = String(raw || "");
    if (EMOJI.test(raw)) return true;
    const digits = raw.replace(INVISIBLE, "").replace(/[\s.,_'-]+/g, "");
    for (const p of DIGITS) if (p.test(digits)) return true;
    const cpt = compact(raw);
    for (const w of NATIVE) if (cpt.includes(w)) return true;
    let anyLetters = false;
    for (const read of [bySound(raw), byLooks(raw)]) {
      const n = letters(read), c = squeeze(n);
      if (n.length) anyLetters = true;
      for (const w of STRONG) if (hit(w, n, c)) return true;
      for (const w of added) if (hit(w, n, c)) return true;
      for (const p of PATTERNS) if (p.test(n)) return true;                 // not on c: "essex" collapses to "esex"
      for (const p of PHONETIC_NAMES) if (p.test(n) || p.test(c)) return true;
      if (WHOLE.includes(n) || WHOLE.includes(c)) return true;              // "s.e.x"
      const words = read.split(/[^a-z]+/).filter(Boolean);
      for (const w of words) if (WHOLE.includes(w) || WHOLE.includes(squeeze(w))) return true;
      for (let start = 0; start < words.length; start++) {
        let joined = "";
        for (let end = start; end < Math.min(words.length, start + 4); end++) {
          joined += words[end];
          for (const p of PHONETIC_NAMES) if (p.test(joined) || p.test(squeeze(joined))) return true;
        }
      }
    }
    return !anyLetters && !cpt.length;                                       // nothing but symbols
  }
  // what the page and the Worker both store: letters, digits, space . ' _ - ; 16 chars
  function clean(raw) { return String(raw || "").normalize("NFKC").replace(INVISIBLE, "").replace(/[^\p{L}\p{N} .'_-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 16); }
  // null if it passes, otherwise the reason to show the player
  function reject(raw) {
    const n = clean(raw);
    if (n.replace(/[^\p{L}]/gu, "").length < 2) return "Two letters at least";   // letters, not digits: "666" is not a name
    if (/\.(com|net|org|gg|xyz|io|me|ru|bg|tv|co|app|link|site|club|to|cc)\b/i.test(n)) return "That name is not going on the board";
    if (bad(raw) || bad(n)) return "That name is not going on the board";           // the raw form too: clean() strips the "!" out of "b!tch"
    return null;
  }
  // more STRONG words at run time, already in the normalised (lower-case Latin letters) spelling
  function extend(words) { for (const w of words || []) { const n = normalise(w); if (n.length >= 3 && !added.includes(n)) added.push(n); } return added.length; }
export { clean, reject, bad, normalise, extend };
