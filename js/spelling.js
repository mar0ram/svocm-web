// 頻出英単語スペルミス辞書
const COMMON_MISSPELLINGS = {
    teh: "the",
    recieve: "receive",
    recieved: "received",
    occured: "occurred",
    occuring: "occurring",
    seperate: "separate",
    definately: "definitely",
    definitly: "definitely",
    accomodate: "accommodate",
    untill: "until",
    beggining: "beginning",
    convinient: "convenient",
    techonological: "technological",
    arguement: "argument",
    beleive: "believe",
    enviroment: "environment",
    goverment: "government",
    independant: "independent",
    neccessary: "necessary",
    occassion: "occasion",
    priviledge: "privilege",
    recomend: "recommend",
    succesful: "successful",
    successfull: "successful",
    tommorow: "tomorrow",
    wierd: "weird",
    writting: "writing",
    freind: "friend",
    knowlege: "knowledge",
    maintainance: "maintenance",
    percieve: "perceive",
    appearence: "appearance",
    buisness: "business",
    calender: "calendar",
    collegue: "colleague",
    concious: "conscious",
    curiousity: "curiosity",
    dissapear: "disappear",
    embarass: "embarrass",
    existance: "existence",
    foriegn: "foreign",
    fourty: "forty",
    grammer: "grammar",
    harrass: "harass",
    immediatly: "immediately",
    lonley: "lonely",
    millenium: "millennium",
    mispell: "misspell",
    noticable: "noticeable",
    parliment: "parliament",
    persistant: "persistent",
    politican: "politician",
    posession: "possession",
    prefered: "preferred",
    publically: "publicly",
    realy: "really",
    refered: "referred",
    religous: "religious",
    rember: "remember",
    sieze: "seize",
    similer: "similar",
    speach: "speech",
    stoped: "stopped",
    studing: "studying",
    suprise: "surprise",
    tendancy: "tendency",
    therefor: "therefore",
    threshhold: "threshold",
    truely: "truly",
    unfortunatly: "unfortunately",
    whereever: "wherever",
    wich: "which",
    peopel: "people",
    becuase: "because",
    thier: "their",
    alothough: "although",
    thoought: "thought",
    recogize: "recognize"
};

// 母音なしでも許容される略語・語彙セット
const ALLOWED_NO_VOWEL_WORDS = new Set([
    "mr", "mrs", "ms", "dr", "st", "vs", "etc", "tv", "pc", "ai", "it", "uk", "us", "un", "eu",
    "by", "my", "try", "fly", "cry", "dry", "shy", "sky", "spy", "why", "gym", "myth", "rhythm", "lynx", "hymn",
    "shh", "hmm", "brr", "nth"
]);

// 英語入力時の全角スペース・全角英数記号・スマートクォートを自動正規化
export function normalizeEnglishInput(text) {
    return String(text || "")
        .replace(/\u3000/g, " ")
        .replace(/[‘’′]/g, "'")
        .replace(/[“”″]/g, '"')
        .replace(/[\uFF01-\uFF5E]/g, (ch) =>
            String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
        )
        .replace(/[ \t]+/g, " ")
        .trim();
}

// ① 入力言語のバリデーション（英語のみ）
export function validateLanguageInput(text) {
    const hasJaChars = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F\uFF01-\uFF60]/.test(text);
    const hasEnAlpha = /[a-zA-Z]/.test(text);

    if (hasJaChars || !hasEnAlpha) {
        return "英語で入力してください（日本語や全角記号が含まれているか、英単語が入力されていません）。";
    }
    return null;
}

// スペルチェック外部通信の削減用（高頻度基本語セット＋セッション内キャッシュ）
const COMMON_VALID_WORDS = new Set([
    "the", "and", "for", "that", "with", "this", "from", "have", "has", "had",
    "are", "was", "were", "been", "being", "not", "but", "you", "your", "they",
    "them", "their", "she", "her", "him", "his", "its", "our", "who", "whom",
    "whose", "which", "what", "when", "where", "why", "how", "will", "would",
    "can", "could", "shall", "should", "may", "might", "must", "did", "does",
    "done", "doing", "all", "any", "some", "many", "much", "more", "most",
    "few", "little", "other", "another", "such", "only", "just", "also", "very",
    "too", "even", "still", "yet", "now", "then", "here", "there", "than",
    "about", "into", "over", "after", "before", "under", "between", "through",
    "during", "without", "within", "against", "among", "around", "because",
    "although", "though", "while", "since", "until", "unless", "whether",
    "both", "either", "neither", "nor", "each", "every", "one", "two", "three",
    "make", "made", "take", "took", "taken", "give", "gave", "given", "get",
    "got", "see", "saw", "seen", "know", "knew", "known", "think", "thought",
    "come", "came", "want", "use", "used", "find", "found", "tell", "told",
    "ask", "asked", "work", "seem", "feel", "felt", "try", "tried", "leave",
    "left", "call", "keep", "kept", "let", "put", "say", "said", "people",
    "time", "year", "way", "day", "man", "thing", "woman", "life", "child",
    "world", "school", "state", "family", "student", "group", "country",
    "problem", "hand", "part", "place", "case", "week", "company", "system",
    "good", "new", "first", "last", "long", "great", "own", "old", "right",
    "big", "high", "different", "small", "large", "next", "early", "young",
    "important", "public", "bad", "same", "able", "hard", "easy", "difficult"
]);

const SPELLING_API_CACHE = new Map();

// ② 英語スペルミス検査（ローカル辞書＋綴り字ルール＋Datamuse辞書API照会）
export async function checkEnglishSpelling(text) {
    const rawWords = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [];
    const findings = [];
    const seenLower = new Set();
    const candidatesForApi = [];

    for (const raw of rawWords) {
        if (raw.includes("'")) continue;
        const lower = raw.toLowerCase();
        if (seenLower.has(lower)) continue;
        seenLower.add(lower);

        // 1. 頻出タイポ辞書に一致
        if (COMMON_MISSPELLINGS[lower]) {
            findings.push(`"${raw}"（候補: ${COMMON_MISSPELLINGS[lower]}）`);
            continue;
        }

        // 2. 同じ文字が3連続以上（例: goood, theee）
        if (/(.)\1\1/i.test(raw)) {
            findings.push(`"${raw}"`);
            continue;
        }

        // 3. 母音(a,e,i,o,u,y)が1つもない2文字以上の小文字語
        if (lower.length >= 2 && !/[aeiouy]/.test(lower) && !ALLOWED_NO_VOWEL_WORDS.has(lower) && raw === lower) {
            findings.push(`"${raw}"`);
            continue;
        }

        // 4. 高頻度基本語およびキャッシュ済みの単語は外部API照会を省略
        if (COMMON_VALID_WORDS.has(lower)) {
            continue;
        }
        if (SPELLING_API_CACHE.has(lower)) {
            const cached = SPELLING_API_CACHE.get(lower);
            if (cached) {
                findings.push(cached);
            }
            continue;
        }

        // 5. オンライン辞書APIによるチェック対象（固有名詞の可能性がある先頭大文字語以外の3文字以上の単語）
        if (lower.length >= 3 && raw === lower) {
            candidatesForApi.push(raw);
        }
    }

    // Datamuse APIでスペル実在確認（最大10語・候補取得は最大3語・タイムアウト1.5秒）
    if (candidatesForApi.length > 0) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        let sugRequestCount = 0;
        try {
            await Promise.all(
                candidatesForApi.slice(0, 10).map(async (word) => {
                    const low = word.toLowerCase();
                    const res = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(low)}&max=5`, {
                        signal: controller.signal
                    });
                    if (!res.ok) return;
                    const list = await res.json();
                    const exactMatch = Array.isArray(list) && list.some((item) => item.word && item.word.toLowerCase() === low);
                    if (exactMatch) {
                        SPELLING_API_CACHE.set(low, null);
                    } else {
                        let suggestionText = "";
                        if (sugRequestCount < 3) {
                            sugRequestCount += 1;
                            const sugRes = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(low)}&max=3`, {
                                signal: controller.signal
                            });
                            if (sugRes.ok) {
                                const sugList = await sugRes.json();
                                if (Array.isArray(sugList) && sugList.length > 0) {
                                    const topSug = sugList[0].word;
                                    if (topSug && topSug.toLowerCase() !== low) {
                                        suggestionText = `（候補: ${topSug}）`;
                                    }
                                }
                            }
                        }
                        const entry = `"${word}"${suggestionText}`;
                        SPELLING_API_CACHE.set(low, entry);
                        findings.push(entry);
                    }
                })
            );
        } catch (_) {
            // ネットワーク制限やタイムアウト時はローカル検出結果のみ使用
        } finally {
            clearTimeout(timeoutId);
        }
    }

    return findings;
}