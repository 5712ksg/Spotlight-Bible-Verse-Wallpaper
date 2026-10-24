let readTime = 5;
let bibleVerses = {};
let isRunning = false;
let isPaused = false;

let isShuffle = true;

let shuffleHistory = [];
let shuffleHistoryIndex = -1;
let currentVerseText = "";
let currentKey = "";

const BIBLE_CONTENT_TRANSLATION_KEY = "bible_content_translation";
const OFFLINE_BIBLE_SOURCE_KEY = "bible_offline_source";

const BIBLE_COM_BASE = "https://www.bible.com";
const BIBLE_COM_API_BASE = `${BIBLE_COM_BASE}/api/bible`;
const BIBLE_COM_NODE_API_BASE = "https://nodejs.bible.com/api/bible";
let localBibleVerses = {};
let currentBibleTranslation = {
  type: "local",
  id: "local-ko",
  language: "kor",
  name: "기본 한국어 본문 (내장)",
  shortName: "기본 역본",
};
let onlineTranslationCatalog = null;
let onlineTranslationCatalogPromise = null;
let bibleComBuildId = null;
let bibleComBuildIdPromise = null;
const onlineTranslationBooksCache = new Map();
const onlineTranslationMetadataCache = new Map();
const onlineTranslationVersionsCache = new Map();
const onlineChapterCache = new Map();
const onlineChapterRouteIndex = new Map();
const MAX_CACHED_ONLINE_CHAPTERS = 48;
let activeTranslationBooks = [];
let activeOnlineChapter = null;
let activeOfflineBibleSource = "";

const activeBibleDownloadJobs = new Map();

const pendingCancelledBibleDownloadKeys = new Set();
let activeBibleDownloadJob = null;
let bibleDownloadJobSequence = 0;
const PLAYBACK_STATE_KEY = "bible_playback_state";
const STATE_MEMORY_KEY = "bible_state_memory_enabled";
let isStateMemoryEnabled = localStorage.getItem(STATE_MEMORY_KEY) === "true";
let restoreCurrentKeyOnNextLoop = false;

function savePlaybackState() {
  if (!isStateMemoryEnabled) return;
  try {
    localStorage.setItem(
      PLAYBACK_STATE_KEY,
      JSON.stringify({ currentKey, isShuffle, savedAt: Date.now() }),
    );
  } catch (error) {
    console.warn("Failed to save playback state.", error);
  }
}

let currentElapsed = 0;
let currentFinalDelay = 0;
let playbackRecoveryAttempts = 0;

let userNotes = JSON.parse(localStorage.getItem("bible_notes") || "{}");
let bookmarks = JSON.parse(localStorage.getItem("bible_bookmarks") || "[]");
let readingHistory = JSON.parse(localStorage.getItem("bible_history") || "[]");

let storageLimits = JSON.parse(
  localStorage.getItem("bible_storage_limits") ||
    '{"bookmark":50, "note":50, "history":30}',
);

const UI_LANGUAGE_KEY = "bible_ui_language";
const BIBLE_FONT_MODE_KEY = "bible_font_mode";
const BIBLE_FONT_CHOICES = {
  handwriting: {
    label: "손글씨 글꼴 (현재)",
    legacyClass: "font-choice-handwriting",
  },
  "system-ui": { label: "System UI", legacyClass: "font-choice-system-ui" },
  georgia: { label: "Georgia", legacyClass: "font-choice-georgia" },
  "palatino-linotype": {
    label: "Palatino Linotype",
    legacyClass: "font-choice-palatino-linotype",
  },
  "book-antiqua": {
    label: "Book Antiqua",
    legacyClass: "font-choice-book-antiqua",
  },
  cambria: { label: "Cambria", legacyClass: "font-choice-cambria" },
  constantia: { label: "Constantia", legacyClass: "font-choice-constantia" },
  garamond: { label: "Garamond", legacyClass: "font-choice-garamond" },
  baskerville: { label: "Baskerville", legacyClass: "font-choice-baskerville" },
  "times-new-roman": {
    label: "Times New Roman",
    legacyClass: "font-choice-times-new-roman",
  },
  "sitka-text": { label: "Sitka Text", legacyClass: "font-choice-sitka-text" },
  batang: { label: "바탕 (Batang)", legacyClass: "font-choice-batang" },
  "nanum-myeongjo": {
    label: "나눔명조 (Nanum Myeongjo)",
    legacyClass: "font-choice-nanum-myeongjo",
  },
  "noto-serif-kr": {
    label: "Noto Serif KR",
    legacyClass: "font-choice-noto-serif-kr",
  },
  "kopub-batang": {
    label: "KoPub 바탕",
    legacyClass: "font-choice-kopub-batang",
  },
  "malgun-gothic": {
    label: "맑은 고딕 (Malgun Gothic)",
    legacyClass: "font-choice-malgun-gothic",
  },
  "noto-sans-kr": {
    label: "Noto Sans KR",
    legacyClass: "font-choice-noto-sans-kr",
  },
  "yu-mincho": { label: "Yu Mincho", legacyClass: "font-choice-yu-mincho" },
  meiryo: { label: "Meiryo", legacyClass: "font-choice-meiryo" },
  simsun: { label: "SimSun / 宋体", legacyClass: "font-choice-simsun" },
  "microsoft-yahei": {
    label: "Microsoft YaHei",
    legacyClass: "font-choice-microsoft-yahei",
  },
  pmingliu: {
    label: "PMingLiU / 新細明體",
    legacyClass: "font-choice-pmingliu",
  },
  "microsoft-jhenghei": {
    label: "Microsoft JhengHei",
    legacyClass: "font-choice-microsoft-jhenghei",
  },
  "noto-serif-cjk": {
    label: "Noto Serif CJK",
    legacyClass: "font-choice-noto-serif-cjk",
  },
};
const LEGACY_BIBLE_FONT_MODE_MIGRATIONS = {
  "segoe-ui": "system-ui",
  arial: "system-ui",
  verdana: "system-ui",
  tahoma: "system-ui",
  "trebuchet-ms": "system-ui",
  "yu-gothic": "meiryo",
};
const UI_TRANSLATIONS = {
  en: {
    "성경 제어 패널": "Bible controls",
    "이전 구절": "Previous verse",
    일시정지: "Pause",
    "다음 구절": "Next verse",
    "북마크 추가": "Add bookmark",
    "성경 목차 직접 찾기": "Browse Bible",
    "이모지 태그 선택": "Choose emoji tag",
    "나의 보관함": "My library",
    "성경 메뉴": "Bible menu",
    닫기: "Close",
    "UI 언어 변경": "Change interface language",
    "🌐 UI 언어": "🌐 Interface language",
    "시스템 언어": "System language",
    영어: "English",
    한국어: "Korean",
    중국어: "Chinese",
    일본어: "Japanese",
    "시스템 언어에 따라 UI 언어를 자동으로 설정합니다.":
      "Automatically match the interface language to your system language.",
    "⚙️ 환경 설정": "⚙️ Settings",
    "🔤 폰트 및 시각 효과 설정": "🔤 Font and visual effects",
    "🖼️ 배경 이미지 해상도 지정": "🖼️ Background image resolution",
    "1K 해상도": "1K resolution",
    "2K 해상도": "2K resolution",
    "4K 해상도 (기본)": "4K resolution (default)",
    "글자 크기 조절": "Text size",
    "크기 축소": "Decrease size",
    "크기 확대": "Increase size",
    "글자 선명도 처리": "Text sharpness",
    "기본 선명함": "Default sharpness",
    스무스: "Smooth",
    "끔(픽셀)": "Off (pixelated)",
    "그림자 효과": "Text shadow",
    없음: "None",
    은은함: "Subtle",
    보통: "Normal",
    진함: "Strong",
    "글자 필터 블러 효과": "Text blur effect",
    "약한 블러": "Slight blur",
    "폰트 설정 전체 초기화": "🔄 Reset all font settings",
    "모든 폰트 및 시각 효과 설정을 기본값으로 초기화합니다":
      "Reset all font and visual-effect settings to their defaults",
    "임시 데이터 및 캐시 삭제": "🧹 Clear temporary data and cache",
    "⚠️ 삭제하려면 한 번 더 누르세요": "⚠️ Click again to confirm deletion",
    "⏳ 임시 데이터 및 캐시 삭제 중…": "⏳ Clearing temporary data and cache…",
    "프로젝트 임시 저장소와 앱 캐시를 삭제합니다. 폰트 설정 및 보관함 데이터는 유지됩니다":
      "Clear only explicitly named temporary/cache data and runtime Bible lookup caches; preferences and library data are preserved",
    "• 사진 원본:": "• Photo source:",
    "• 성경 원본:": "• Bible source:",
    "클릭 시 사진 API 주소가 복사됩니다": "Click to copy the photo API URL",
    "클릭 시 GitHub 주소가 복사됩니다": "Click to copy the GitHub URL",
    "📖 성경 목차 선택": "📖 Browse Bible",
    "📚 읽고 싶은 성경 책을 선택하세요": "📚 Select a Bible book",
    "성경 책 목록으로 돌아가기": "◀ Back to Bible books",
    "장 목록으로 돌아가기": "◀ Back to chapters",
    "장 선택": "Select chapter",
    "절 선택": "Select verse",
    "✨ 이모지 태그 선택": "✨ Choose an emoji tag",
    "이 구절에 어울리는 묵상 태그를 선택하세요.":
      "Choose a reflection tag for this verse.",
    "📖 나의 성경 보관함": "📖 My Bible library",
    "⭐ 북마크": "⭐ Bookmarks",
    "🏷️ 이모지 태그": "🏷️ Emoji tags",
    "📜 최근 히스토리": "📜 Recent history",
    북마크: "Bookmarks",
    "이모지 태그": "Emoji tags",
    이모지태그: "Emoji tags",
    히스토리: "History",
    "전체 선택/해제": "Select/deselect all",
    "선택 항목 내보내기": "Export selected items",
    "선택 항목 복사": "Copy selected items",
    "공유(📤)": " Share (📤)",
    "복사(📋)": " Copy (📋)",
    "항목 선택": "Select item",
    "북마크 삭제": "Delete bookmark",
    "태그 삭제": "Delete tag",
    "전체 삭제": "Delete all",
    삭제: "Delete",
    "저장된 북마크가 없습니다.": "No saved bookmarks.",
    "저장된 태그가 없습니다.": "No saved tags.",
    "히스토리가 없습니다.": "No history.",
    "보관함 최대 저장 개수 설정": "Set library item limits",
    "설정 저장하기": "Save settings",
    "모든 저장 데이터 초기화": "Reset all saved data",
    "⚠️ 데이터 전체 초기화 (캐시 삭제)": "⚠️ Reset all data (clear cache)",
    "성경 책 목차로 돌아가기": "Back to Bible books",
    "성경 책 목록으로 돌아가기": "Back to the Bible book list",
    "장 목록으로 돌아가기": "Back to the chapter list",
    "해당 구절을 찾을 수 없습니다.": "The selected verse could not be found.",
    "복사할 현재 성경 본문이 없습니다.":
      "There is no current Bible text to copy.",
    "이미 북마크에 등록된 구절입니다.": "This verse is already bookmarked.",
    "복사할 항목이 없습니다.": "There are no items to copy.",
    "내보낼 항목이 없습니다.": "There are no items to export.",
    "클립보드 복사에 실패했습니다.": "Could not copy to the clipboard.",
    "설정 저장하기": "Save settings",
    "랜덤 셔플 모드 토글 (ON/OFF)": "Toggle random shuffle mode (ON/OFF)",
    "환경 설정 및 폰트 효과 제어": "Settings and font effects",
    "자동 넘김 재생 / 일시정지": "Toggle automatic verse playback",
    "이전 구절 (1절씩 순차 이동)": "Previous verse (move one verse at a time)",
    "다음 구절 (순차 또는 셔플)": "Next verse (sequential or shuffle)",
    "구절 전환 재생 속도 조절 (0.5x ~ 4.0x)":
      "Adjust verse playback speed (0.5x–4.0x)",
    "성경 목차 선택 열기": "Open Bible browser",
    "현재 성경 본문을 클립보드에 복사": "Copy current Bible text to clipboard",
    "현재 구절 북마크에 추가": "Bookmark current verse",
    "이모지 묵상 태그 남기기": "Add an emoji reflection tag",
    "나의 성경 보관함 열기": "Open my Bible library",
    "랜덤 셔플 모드: 켜짐": "Random shuffle: on",
    "랜덤 셔플 모드: 꺼짐": "Random shuffle: off",
    "상태 기억: 켜짐 (마지막 구절과 셔플 상태 저장)":
      "Remember state: on (save last verse and shuffle state)",
    "상태 기억: 꺼짐 (재시작 시 위치 복원 안 함)":
      "Remember state: off (do not restore position on restart)",
    "UI 언어 설정이 저장되었습니다.": "Interface language preference saved.",
    "성경 언어 및 역본 선택": "Choose Bible language and translation",
    "🌍 성경 언어 선택": "🌍 Choose a Bible language",
    "🌍 성경 역본 선택": "🌍 Choose a Bible translation",
    "언어 목록을 불러오는 중입니다...": "Loading available languages...",
    "역본 목록을 불러오는 중입니다...": "Loading translations...",
    "언어 또는 역본 검색": "Search languages or translations",
    "언어를 고른 다음 해당 언어에서 제공되는 역본을 선택하세요.":
      "Choose a language, then select a translation available in that language.",
    "Bible.com에서 언어를 선택한 다음, 해당 언어에 실제로 제공되는 역본을 고르세요.":
      "Choose a language on Bible.com, then select a translation actually available in that language.",
    "성경 본문 파일을 다운로드하거나 앱에 저장하지 않습니다. 선택한 역본의 장만 필요할 때 Bible.com에서 조회합니다.":
      "Bible text files are not downloaded or stored in the app. Only the selected chapter is queried from Bible.com when needed.",
    "언어 검색": "Search languages",
    "역본 이름, 약칭 또는 제공처 검색":
      "Search translation name, abbreviation, or publisher",
    "⌨ 가상 키보드 표시": "⌨ Show keyboard",
    "⌨ 가상 키보드 숨기기": "⌨ Hide keyboard",
    띄어쓰기: "Space",
    지우기: "Clear",
    "키보드 배열": "Keyboard layout",
    "Bible.com 역본 보기": "View Bible.com translations",
    "Bible.com에서 보기": "View on Bible.com",
    "전체 성경을 다운로드하지 않습니다. 현재 필요한 장 본문과 해당 역본의 책·장 정보를 Bible.com에서 실시간으로 조회합니다.":
      "The whole Bible is not downloaded. Only the needed chapter and that version's book/chapter index are queried live from Bible.com.",
    "Bible.com 역본 목록을 불러오지 못했습니다. 네트워크 연결 또는 브라우저의 CORS 정책에 의해 직접 요청이 차단되었을 수 있습니다.":
      "Could not load Bible.com translations. The request may be blocked by network access or browser CORS policy.",
    "Bible.com 언어 목록을 불러오지 못했습니다. 네트워크 또는 브라우저 CORS 정책에 의해 직접 요청이 차단되었을 수 있습니다.":
      "Could not load Bible.com languages. The request may be blocked by network access or browser CORS policy.",
    "Bible.com 직접 요청이 브라우저에서 차단되었습니다(CORS/네트워크). 아래 역본 링크로 사이트가 열리는지 확인해 주세요.":
      "The direct Bible.com request was blocked by the browser (CORS/network). Check whether the translation link below opens.",
    "선택한 Bible.com 역본의 책 목록과 현재 장 본문을 확인하는 중입니다...":
      "Checking the book index and current chapter for the selected Bible.com version...",

    "선택한 장 본문을 불러오는 중입니다...": "Loading the selected chapter...",
    "역본 본문을 불러오는 중입니다...": "Loading translation text...",
    "성경 데이터를 불러오는 중입니다...": "Loading Bible data...",
    "로컬파일을 읽는 중입니다...": "Reading local Bible data...",
    "성경 데이터를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.":
      "Could not load Bible data. Check your network connection.",
    "지원 역본": "translations",
    "기본 한국어 본문 (내장)": "Built-in Korean Bible text",
    "기본 역본": "Built-in version",
    "선택한 장 본문만 온라인에서 참조하며 전체 역본을 다운로드하지 않습니다.":
      "Only the selected chapter is referenced online; the entire translation is not downloaded.",
    "Bible.com에서 역본 목록과 본문을 조회합니다. 각 역본의 제공처 및 라이선스 정보를 확인하세요.":
      "Translation lists and verses are queried live from Bible.com. Check each version's publisher and license information.",
    "◀ 언어 목록으로 돌아가기": "◀ Back to languages",
    "◀ 역본 목록으로 돌아가기": "◀ Back to translations",
    "역본 정보를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도하세요.":
      "Could not load translation information. Check your network and try again.",
    "역본 본문을 불러오지 못했습니다. 다른 역본을 선택하거나 네트워크를 확인하세요.":
      "Could not load the translation text. Choose another version or check your network.",
    "역본이 변경되었습니다.": "Bible translation changed.",
    "현재 장절이 해당 역본에 없어 가장 가까운 지원 장절로 이동했습니다.":
      "The exact passage is unavailable in this version; moved to the nearest supported passage.",
    "요청한 장절이 이 역본에 없어 가장 가까운 지원 장절을 표시했습니다.":
      "The requested passage is unavailable in this translation; showing the nearest supported passage.",
    "현재 프로젝트의 내장 본문 · 오프라인 폴백":
      "Built-in text from this project · offline fallback",
    "이 언어에서 현재 제공되는 온라인 역본이 없습니다. 내장 한국어 본문을 선택하세요.":
      "No online translations are currently available for this language. Choose the built-in Korean text.",
    "이 언어에서 현재 제공되는 온라인 역본이 없습니다. 다른 언어를 선택하세요.":
      "No online translations are currently available for this language. Choose another language.",
    "성경 본문 역본": "Bible text version",
    "제공처 / 라이선스": "Publisher / license",
    "본문 조회 오류": "Error loading Bible text",
    "역본 본문을 찾지 못했습니다. 이 역본에서 지원되는 다른 장을 선택하거나 네트워크를 확인하세요.":
      "Could not find the chapter in this translation. Choose another supported chapter or check your network.",
  },
  zh: {
    "성경 제어 패널": "圣经控制栏",
    "이전 구절": "上一节",
    일시정지: "暂停",
    "다음 구절": "下一节",
    "북마크 추가": "添加书签",
    "성경 목차 직접 찾기": "浏览圣经目录",
    "이모지 태그 선택": "选择表情标签",
    "나의 보관함": "我的收藏库",
    "성경 메뉴": "圣经菜单",
    닫기: "关闭",
    "UI 언어 변경": "更改界面语言",
    "🌐 UI 언어": "🌐 界面语言",
    "시스템 언어": "系统语言",
    영어: "英语",
    한국어: "韩语",
    중국어: "中文",
    일본어: "日语",
    "시스템 언어에 따라 UI 언어를 자동으로 설정합니다.":
      "根据系统语言自动设置界面语言。",
    "⚙️ 환경 설정": "⚙️ 设置",
    "🔤 폰트 및 시각 효과 설정": "🔤 字体与视觉效果",
    "🖼️ 배경 이미지 해상도 지정": "🖼️ 背景图像分辨率",
    "1K 해상도": "1K 分辨率",
    "2K 해상도": "2K 分辨率",
    "4K 해상도 (기본)": "4K 分辨率（默认）",
    "글자 크기 조절": "文字大小",
    "크기 축소": "缩小",
    "크기 확대": "放大",
    "글자 선명도 처리": "文字清晰度",
    "기본 선명함": "默认清晰",
    스무스: "平滑",
    "끔(픽셀)": "关闭（像素化）",
    "그림자 효과": "文字阴影",
    없음: "无",
    은은함: "淡",
    보통: "普通",
    진함: "强",
    "글자 필터 블러 효과": "文字模糊效果",
    "약한 블러": "轻微模糊",
    "폰트 설정 전체 초기화": "🔄 重置所有字体设置",
    "모든 폰트 및 시각 효과 설정을 기본값으로 초기화합니다":
      "将字体和视觉效果设置恢复为默认值",
    "임시 데이터 및 캐시 삭제": "🧹 清除临时数据和缓存",
    "⚠️ 삭제하려면 한 번 더 누르세요": "⚠️ 再按一次确认删除",
    "⏳ 임시 데이터 및 캐시 삭제 중…": "⏳ 正在清理临时数据和缓存…",
    "프로젝트 임시 저장소와 앱 캐시를 삭제합니다. 폰트 설정 및 보관함 데이터는 유지됩니다":
      "清除项目临时数据和应用缓存。字体设置与收藏数据会保留",
    "• 사진 원본:": "• 图片来源：",
    "• 성경 원본:": "• 圣经来源：",
    "클릭 시 사진 API 주소가 복사됩니다": "点击复制图片 API 地址",
    "클릭 시 GitHub 주소가 복사됩니다": "点击复制 GitHub 地址",
    "📖 성경 목차 선택": "📖 浏览圣经",
    "📚 읽고 싶은 성경 책을 선택하세요": "📚 请选择要阅读的圣经书卷",
    "성경 책 목록으로 돌아가기": "◀ 返回圣经书卷",
    "장 목록으로 돌아가기": "◀ 返回章节列表",
    "장 선택": "选择章节",
    "절 선택": "选择经节",
    "✨ 이모지 태그 선택": "✨ 选择表情标签",
    "이 구절에 어울리는 묵상 태그를 선택하세요.":
      "请选择适合此经文的默想标签。",
    "📖 나의 성경 보관함": "📖 我的圣经收藏库",
    "⭐ 북마크": "⭐ 书签",
    "🏷️ 이모지 태그": "🏷️ 表情标签",
    "📜 최근 히스토리": "📜 最近记录",
    북마크: "书签",
    "이모지 태그": "表情标签",
    이모지태그: "表情标签",
    히스토리: "历史记录",
    "전체 선택/해제": "全选/取消全选",
    "선택 항목 내보내기": "导出所选项",
    "선택 항목 복사": "复制所选项",
    "공유(📤)": " 分享(📤)",
    "복사(📋)": " 复制(📋)",
    "항목 선택": "选择项目",
    "북마크 삭제": "删除书签",
    "태그 삭제": "删除标签",
    "전체 삭제": "全部删除",
    삭제: "删除",
    "저장된 북마크가 없습니다.": "没有已保存的书签。",
    "저장된 태그가 없습니다.": "没有已保存的标签。",
    "히스토리가 없습니다.": "没有历史记录。",
    "보관함 최대 저장 개수 설정": "设置收藏库保存数量上限",
    "설정 저장하기": "保存设置",
    "모든 저장 데이터 초기화": "重置所有保存数据",
    "⚠️ 데이터 전체 초기화 (캐시 삭제)": "⚠️ 重置所有数据（清除缓存）",
    "성경 책 목차로 돌아가기": "返回圣经书卷列表",
    "해당 구절을 찾을 수 없습니다.": "找不到所选经文。",
    "복사할 현재 성경 본문이 없습니다.": "没有可复制的当前圣经内容。",
    "이미 북마크에 등록된 구절입니다.": "此经文已添加到书签。",
    "복사할 항목이 없습니다.": "没有可复制的项目。",
    "내보낼 항목이 없습니다.": "没有可导出的项目。",
    "클립보드 복사에 실패했습니다.": "复制到剪贴板失败。",
    "랜덤 셔플 모드 토글 (ON/OFF)": "切换随机播放模式（开/关）",
    "환경 설정 및 폰트 효과 제어": "设置与字体效果",
    "자동 넘김 재생 / 일시정지": "自动切换经文/暂停",
    "이전 구절 (1절씩 순차 이동)": "上一节（逐节顺序移动）",
    "다음 구절 (순차 또는 셔플)": "下一节（顺序或随机）",
    "구절 전환 재생 속도 조절 (0.5x ~ 4.0x)": "调整经文切换速度（0.5x–4.0x）",
    "성경 목차 선택 열기": "打开圣经目录",
    "현재 성경 본문을 클립보드에 복사": "复制当前圣经内容",
    "현재 구절 북마크에 추가": "将当前经文添加到书签",
    "이모지 묵상 태그 남기기": "添加表情默想标签",
    "나의 성경 보관함 열기": "打开我的圣经收藏库",
    "랜덤 셔플 모드: 켜짐": "随机播放：开",
    "랜덤 셔플 모드: 꺼짐": "随机播放：关",
    "상태 기억: 켜짐 (마지막 구절과 셔플 상태 저장)":
      "记住状态：开（保存上次经文和随机播放状态）",
    "상태 기억: 꺼짐 (재시작 시 위치 복원 안 함)":
      "记住状态：关（重启时不恢复位置）",
    "UI 언어 설정이 저장되었습니다.": "界面语言设置已保存。",
    "성경 언어 및 역본 선택": "选择圣经语言和译本",
    "🌍 성경 언어 선택": "🌍 选择圣经语言",
    "🌍 성경 역본 선택": "🌍 选择圣经译本",
    "언어 목록을 불러오는 중입니다...": "正在加载可用语言...",
    "역본 목록을 불러오는 중입니다...": "正在加载译本...",
    "언어 또는 역본 검색": "搜索语言或译本",
    "언어를 고른 다음 해당 언어에서 제공되는 역본을 선택하세요.":
      "请先选择语言，再选择该语言提供的译本。",
    "Bible.com에서 언어를 선택한 다음, 해당 언어에 실제로 제공되는 역본을 고르세요.":
      "请先在 Bible.com 中选择语言，再选择该语言实际提供的译本。",
    "성경 본문 파일을 다운로드하거나 앱에 저장하지 않습니다. 선택한 역본의 장만 필요할 때 Bible.com에서 조회합니다.":
      "不会下载或保存整部圣经文本；仅在需要时从 Bible.com 查询所选译本的章节。",
    "언어 검색": "搜索语言",
    "역본 이름, 약칭 또는 제공처 검색": "搜索译本名称、缩写或出版方",
    "⌨ 가상 키보드 표시": "⌨ 显示键盘",
    "⌨ 가상 키보드 숨기기": "⌨ 隐藏键盘",
    띄어쓰기: "空格",
    지우기: "清除",
    "키보드 배열": "键盘布局",
    "Bible.com 역본 보기": "查看 Bible.com 译本",
    "Bible.com에서 보기": "在 Bible.com 查看",
    "전체 성경을 다운로드하지 않습니다. 현재 필요한 장 본문과 해당 역본의 책·장 정보를 Bible.com에서 실시간으로 조회합니다.":
      "不会下载整部圣经，仅从 Bible.com 实时查询当前需要的章节和该译本的目录信息。",
    "Bible.com 역본 목록을 불러오지 못했습니다. 네트워크 연결 또는 브라우저의 CORS 정책에 의해 직접 요청이 차단되었을 수 있습니다.":
      "无法加载 Bible.com 译本列表。请求可能被网络或浏览器 CORS 策略阻止。",
    "Bible.com 언어 목록을 불러오지 못했습니다. 네트워크 또는 브라우저 CORS 정책에 의해 직접 요청이 차단되었을 수 있습니다.":
      "无法加载 Bible.com 语言列表。请求可能被网络或浏览器 CORS 策略阻止。",
    "Bible.com 직접 요청이 브라우저에서 차단되었습니다(CORS/네트워크). 아래 역본 링크로 사이트가 열리는지 확인해 주세요.":
      "浏览器阻止了对 Bible.com 的直接请求（CORS/网络）。请检查下方译本链接能否打开。",
    "선택한 Bible.com 역본의 책 목록과 현재 장 본문을 확인하는 중입니다...":
      "正在检查所选 Bible.com 译本的目录和当前章节……",

    "선택한 장 본문을 불러오는 중입니다...": "正在加载所选章节...",
    "역본 본문을 불러오는 중입니다...": "正在加载译本文本...",
    "지원 역본": "个译本",
    "기본 한국어 본문 (내장)": "内置韩语圣经文本",
    "기본 역본": "内置版本",
    "선택한 장 본문만 온라인에서 참조하며 전체 역본을 다운로드하지 않습니다.":
      "仅在线读取所选章节，不会下载整部译本。",
    "Bible.com에서 역본 목록과 본문을 조회합니다. 각 역본의 제공처 및 라이선스 정보를 확인하세요.":
      "通过 Bible.com 实时查询译本列表和经文。请查看各译本的出版方和许可信息。",
    "◀ 언어 목록으로 돌아가기": "◀ 返回语言列表",
    "◀ 역본 목록으로 돌아가기": "◀ 返回译本列表",
    "역본 정보를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도하세요.":
      "无法加载译本信息。请检查网络后重试。",
    "역본 본문을 불러오지 못했습니다. 다른 역본을 선택하거나 네트워크를 확인하세요.":
      "无法加载译本文本。请选择其他版本或检查网络。",
    "역본이 변경되었습니다.": "圣经译本已更改。",
    "현재 장절이 해당 역본에 없어 가장 가까운 지원 장절로 이동했습니다.":
      "此译本不含当前经文，已跳转到最接近的可用经文。",
    "요청한 장절이 이 역본에 없어 가장 가까운 지원 장절을 표시했습니다.":
      "此译本不包含所请求的经文，现显示最接近的可用经文。",
    "현재 프로젝트의 내장 본문 · 오프라인 폴백": "项目内置经文 · 离线备用",
    "이 언어에서 현재 제공되는 온라인 역본이 없습니다. 내장 한국어 본문을 선택하세요.":
      "该语言目前没有可用的在线译本。请选择内置韩语经文。",
    "이 언어에서 현재 제공되는 온라인 역본이 없습니다. 다른 언어를 선택하세요.":
      "该语言目前没有可用的在线译本。请选择其他语言。",
    "성경 본문 역본": "圣经文本版本",
    "제공처 / 라이선스": "出版方 / 许可",
    "본문 조회 오류": "圣经文本读取错误",
    "역본 본문을 찾지 못했습니다. 이 역본에서 지원되는 다른 장을 선택하거나 네트워크를 확인하세요.":
      "无法找到该译本的章节。请选择此译本支持的其他章节或检查网络。",
  },
  ja: {
    "성경 제어 패널": "聖書コントロール",
    "이전 구절": "前の節",
    일시정지: "一時停止",
    "다음 구절": "次の節",
    "북마크 추가": "ブックマークを追加",
    "성경 목차 직접 찾기": "聖書の目次を開く",
    "이모지 태그 선택": "絵文字タグを選択",
    "나의 보관함": "マイライブラリ",
    "성경 메뉴": "聖書メニュー",
    닫기: "閉じる",
    "UI 언어 변경": "UI言語を変更",
    "🌐 UI 언어": "🌐 UI言語",
    "시스템 언어": "システム言語",
    영어: "英語",
    한국어: "韓国語",
    중국어: "中国語",
    일본어: "日本語",
    "시스템 언어에 따라 UI 언어를 자동으로 설정합니다.":
      "システム言語に合わせてUI言語を自動設定します。",
    "⚙️ 환경 설정": "⚙️ 設定",
    "🔤 폰트 및 시각 효과 설정": "🔤 フォントと視覚効果",
    "🖼️ 배경 이미지 해상도 지정": "🖼️ 背景画像の解像度",
    "1K 해상도": "1K 解像度",
    "2K 해상도": "2K 解像度",
    "4K 해상도 (기본)": "4K 解像度（標準）",
    "글자 크기 조절": "文字サイズ",
    "크기 축소": "縮小",
    "크기 확대": "拡大",
    "글자 선명도 처리": "文字の鮮明さ",
    "기본 선명함": "標準",
    스무스: "スムーズ",
    "끔(픽셀)": "オフ（ピクセル）",
    "그림자 효과": "文字の影",
    없음: "なし",
    은은함: "弱め",
    보통: "標準",
    진함: "強め",
    "글자 필터 블러 효과": "文字のぼかし効果",
    "약한 블러": "軽いぼかし",
    "폰트 설정 전체 초기화": "🔄 フォント設定をすべてリセット",
    "모든 폰트 및 시각 효과 설정을 기본값으로 초기화합니다":
      "フォントと視覚効果の設定を初期値に戻します",
    "임시 데이터 및 캐시 삭제": "🧹 一時データとキャッシュを削除",
    "⚠️ 삭제하려면 한 번 더 누르세요": "⚠️ もう一度押して削除を確認",
    "⏳ 임시 데이터 및 캐시 삭제 중…":
      "⏳ 一時データとキャッシュを削除しています…",
    "프로젝트 임시 저장소와 앱 캐시를 삭제합니다. 폰트 설정 및 보관함 데이터는 유지됩니다":
      "プロジェクトの一時データとアプリキャッシュを削除します。フォント設定とライブラリデータは保持されます",
    "• 사진 원본:": "• 写真ソース：",
    "• 성경 원본:": "• 聖書ソース：",
    "클릭 시 사진 API 주소가 복사됩니다":
      "クリックすると写真APIのURLをコピーします",
    "클릭 시 GitHub 주소가 복사됩니다":
      "クリックするとGitHubのURLをコピーします",
    "📖 성경 목차 선택": "📖 聖書を選択",
    "📚 읽고 싶은 성경 책을 선택하세요":
      "📚 読みたい聖書の書を選択してください",
    "성경 책 목록으로 돌아가기": "◀ 聖書の書一覧に戻る",
    "장 목록으로 돌아가기": "◀ 章一覧に戻る",
    "장 선택": "章を選択",
    "절 선택": "節を選択",
    "✨ 이모지 태그 선택": "✨ 絵文字タグを選択",
    "이 구절에 어울리는 묵상 태그를 선택하세요.":
      "この節に合う黙想タグを選択してください。",
    "📖 나의 성경 보관함": "📖 マイ聖書ライブラリ",
    "⭐ 북마크": "⭐ ブックマーク",
    "🏷️ 이모지 태그": "🏷️ 絵文字タグ",
    "📜 최근 히스토리": "📜 最近の履歴",
    북마크: "ブックマーク",
    "이모지 태그": "絵文字タグ",
    이모지태그: "絵文字タグ",
    히스토리: "履歴",
    "전체 선택/해제": "すべて選択/解除",
    "선택 항목 내보내기": "選択項目をエクスポート",
    "선택 항목 복사": "選択項目をコピー",
    "공유(📤)": " 共有(📤)",
    "복사(📋)": " コピー(📋)",
    "항목 선택": "項目を選択",
    "북마크 삭제": "ブックマークを削除",
    "태그 삭제": "タグを削除",
    "전체 삭제": "すべて削除",
    삭제: "削除",
    "저장된 북마크가 없습니다.": "保存されたブックマークはありません。",
    "저장된 태그가 없습니다.": "保存されたタグはありません。",
    "히스토리가 없습니다.": "履歴はありません。",
    "보관함 최대 저장 개수 설정": "ライブラリの最大保存数を設定",
    "설정 저장하기": "設定を保存",
    "모든 저장 데이터 초기화": "保存データをすべてリセット",
    "⚠️ 데이터 전체 초기화 (캐시 삭제)":
      "⚠️ すべてのデータをリセット（キャッシュ削除）",
    "성경 책 목차로 돌아가기": "聖書の書一覧に戻る",
    "해당 구절을 찾을 수 없습니다.": "該当する節が見つかりません。",
    "복사할 현재 성경 본문이 없습니다.":
      "コピーする現在の聖書本文がありません。",
    "이미 북마크에 등록된 구절입니다.":
      "この節はすでにブックマークされています。",
    "복사할 항목이 없습니다.": "コピーする項目がありません。",
    "내보낼 항목이 없습니다.": "エクスポートする項目がありません。",
    "클립보드 복사에 실패했습니다.": "クリップボードへのコピーに失敗しました。",
    "랜덤 셔플 모드 토글 (ON/OFF)": "ランダムシャッフルの切り替え（ON/OFF）",
    "환경 설정 및 폰트 효과 제어": "設定とフォント効果",
    "자동 넘김 재생 / 일시정지": "自動送り/一時停止",
    "이전 구절 (1절씩 순차 이동)": "前の節（1節ずつ移動）",
    "다음 구절 (순차 또는 셔플)": "次の節（順番またはシャッフル）",
    "구절 전환 재생 속도 조절 (0.5x ~ 4.0x)": "節の切り替え速度（0.5x～4.0x）",
    "성경 목차 선택 열기": "聖書の目次を開く",
    "현재 성경 본문을 클립보드에 복사": "現在の聖書本文をコピー",
    "현재 구절 북마크에 추가": "現在の節をブックマークに追加",
    "이모지 묵상 태그 남기기": "絵文字の黙想タグを追加",
    "나의 성경 보관함 열기": "マイ聖書ライブラリを開く",
    "랜덤 셔플 모드: 켜짐": "ランダムシャッフル：オン",
    "랜덤 셔플 모드: 꺼짐": "ランダムシャッフル：オフ",
    "상태 기억: 켜짐 (마지막 구절과 셔플 상태 저장)":
      "状態記憶：オン（最後の節とシャッフル状態を保存）",
    "상태 기억: 꺼짐 (재시작 시 위치 복원 안 함)":
      "状態記憶：オフ（再起動時に位置を復元しない）",
    "UI 언어 설정이 저장되었습니다.": "UI言語の設定を保存しました。",
  },
};

Object.assign(UI_TRANSLATIONS.en, {
  "바탕 (Batang)": "Batang (Korean serif)",
  "나눔명조 (Nanum Myeongjo)": "Nanum Myeongjo",
  "KoPub 바탕": "KoPub Batang",
  "맑은 고딕 (Malgun Gothic)": "Malgun Gothic",
  "현재 스타일": "Current style",
  "화면 읽기용": "Screen reading",
  "화면 친화적 세리프": "Screen-friendly serif",
  "인문·고전 서적": "Literary and classical books",
  "책 본문용": "Book text",
  "긴 본문 읽기": "Long-form reading",
  "균형 잡힌 세리프": "Balanced serif",
  "전통 출판 스타일": "Traditional publishing",
  "고전 인쇄체": "Classic print serif",
  "범용 고전 세리프": "General-purpose classic serif",
  "텍스트용 디자인": "Text-oriented design",
  "한국어 고전 본문": "Korean classic text",
  "명조 계열": "Myeongjo serif",
  "한국어 세리프": "Korean serif",
  "출판용 본문": "Publishing text",
  "화면용 고딕": "Screen Gothic",
  "현대적 화면 읽기": "Modern screen reading",
  "일본어 명조": "Japanese Mincho serif",
  "일본어 화면용": "Japanese screen type",
  "중국어 간체 명조": "Simplified Chinese serif",
  "중국어 간체 고딕": "Simplified Chinese sans serif",
  "중국어 번체 명조": "Traditional Chinese serif",
  "중국어 번체 고딕": "Traditional Chinese sans serif",
  "다국어 동아시아 세리프": "Multilingual East Asian serif",

  "🙏 기도/간구": "🙏 Prayer / supplication",
  "✝️ 십자가/구원": "✝️ Cross / salvation",
  "🕊️ 성령/평안": "🕊️ Holy Spirit / peace",
  "📖 말씀/묵상": "📖 Word / reflection",
  "✨ 은혜/영광": "✨ Grace / glory",
  "🔥 성령의 불/열정": "🔥 Fire of the Spirit / passion",
  "💧 생명수/정결": "💧 Living water / purity",
  "❤️ 사랑/감사": "❤️ Love / gratitude",
  "🌟 축복/인도": "🌟 Blessing / guidance",
  "💡 진리/지혜": "💡 Truth / wisdom",
  "🌿 회복/성장": "🌿 Renewal / growth",
  "⚓ 소망/믿음": "⚓ Hope / faith",
  "🔄 폰트 설정 전체 초기화": "🔄 Reset all font settings",
  "🧹 임시 데이터 및 캐시 삭제": "🧹 Clear temporary data and cache",
  "⚙️ 보관함 최대 저장 개수 설정": "⚙️ Set library item limits",
  "◀ 성경 책 목록으로 돌아가기": "◀ Back to the Bible book list",
  "◀ 장 목록으로 돌아가기": "◀ Back to the chapter list",
  "자동 넘김 재생": "Resume automatic verse playback",
  "자동 넘김 일시정지": "Pause automatic verse playback",
  "자동 넘김 재생 (이어하기)": "Resume automatic verse playback",
  "랜덤 셔플 모드: 켜짐": "Random shuffle: on",
  "랜덤 셔플 모드: 꺼짐": "Random shuffle: off",
  "이메일 주소가 클립보드에 복사되었습니다.":
    "Email address copied to clipboard.",
  "참고 사진 주소가 클립보드에 복사되었습니다.":
    "Photo reference URL copied to clipboard.",
  "성경 데이터 GitHub 주소가 클립보드에 복사되었습니다.":
    "Bible data GitHub URL copied to clipboard.",
  "저장 개수 제한이 설정되었습니다.": "Storage limits saved.",
  "히스토리가 모두 삭제되었습니다.": "All history entries were deleted.",
  "공유할 항목을 체크해 주세요.": "Select items to share.",
  "복사할 항목을 체크해 주세요.": "Select items to copy.",
  "저장된 항목이 없어 복사할 내용이 없습니다.":
    "There are no saved items to copy.",
  "모든 저장 데이터와 캐시가 초기화되었습니다.":
    "All saved data and cache have been reset.",
  "❗ 정말 초기화하시겠습니까? (한번 더 누르세요)":
    "❗ Reset everything? Click once more to confirm.",
});
Object.assign(UI_TRANSLATIONS.zh, {
  "바탕 (Batang)": "바탕（韩语衬线字体）",
  "나눔명조 (Nanum Myeongjo)": "Nanum 明朝体",
  "KoPub 바탕": "KoPub 바탕字体",
  "맑은 고딕 (Malgun Gothic)": "Malgun Gothic",
  "현재 스타일": "当前样式",
  "화면 읽기용": "屏幕阅读",
  "화면 친화적 세리프": "适合屏幕的衬线字体",
  "인문·고전 서적": "文学与古典书籍",
  "책 본문용": "书籍正文",
  "긴 본문 읽기": "长篇阅读",
  "균형 잡힌 세리프": "均衡衬线字体",
  "전통 출판 스타일": "传统出版风格",
  "고전 인쇄체": "经典印刷字体",
  "범용 고전 세리프": "通用经典衬线字体",
  "텍스트용 디자인": "正文阅读设计",
  "한국어 고전 본문": "韩语经典正文字体",
  "명조 계열": "明朝风格衬线",
  "한국어 세리프": "韩语衬线字体",
  "출판용 본문": "出版正文",
  "화면용 고딕": "屏幕黑体",
  "현대적 화면 읽기": "现代屏幕阅读",
  "일본어 명조": "日语明朝体",
  "일본어 화면용": "日语屏幕字体",
  "중국어 간체 명조": "简体中文衬线字体",
  "중국어 간체 고딕": "简体中文黑体",
  "중국어 번체 명조": "繁体中文衬线字体",
  "중국어 번체 고딕": "繁体中文黑体",
  "다국어 동아시아 세리프": "多语言东亚衬线字体",

  "🙏 기도/간구": "🙏 祷告 / 恳求",
  "✝️ 십자가/구원": "✝️ 十字架 / 救赎",
  "🕊️ 성령/평안": "🕊️ 圣灵 / 平安",
  "📖 말씀/묵상": "📖 圣言 / 默想",
  "✨ 은혜/영광": "✨ 恩典 / 荣耀",
  "🔥 성령의 불/열정": "🔥 圣灵之火 / 热忱",
  "💧 생명수/정결": "💧 生命之水 / 洁净",
  "❤️ 사랑/감사": "❤️ 爱 / 感恩",
  "🌟 축복/인도": "🌟 祝福 / 引导",
  "💡 진리/지혜": "💡 真理 / 智慧",
  "🌿 회복/성장": "🌿 恢复 / 成长",
  "⚓ 소망/믿음": "⚓ 盼望 / 信心",
  "🔄 폰트 설정 전체 초기화": "🔄 重置所有字体设置",
  "🧹 임시 데이터 및 캐시 삭제": "🧹 清除临时数据和缓存",
  "⚙️ 보관함 최대 저장 개수 설정": "⚙️ 设置收藏库保存数量上限",
  "◀ 성경 책 목록으로 돌아가기": "◀ 返回圣经书卷列表",
  "◀ 장 목록으로 돌아가기": "◀ 返回章节列表",
  "자동 넘김 재생": "继续自动切换经文",
  "자동 넘김 일시정지": "暂停自动切换经文",
  "자동 넘김 재생 (이어하기)": "继续自动切换经文",
  "이메일 주소가 클립보드에 복사되었습니다.": "电子邮件地址已复制到剪贴板。",
  "참고 사진 주소가 클립보드에 복사되었습니다.": "参考图片网址已复制到剪贴板。",
  "성경 데이터 GitHub 주소가 클립보드에 복사되었습니다.":
    "圣经数据 GitHub 地址已复制到剪贴板。",
  "저장 개수 제한이 설정되었습니다.": "已保存收藏数量限制。",
  "히스토리가 모두 삭제되었습니다.": "已删除全部历史记录。",
  "공유할 항목을 체크해 주세요.": "请勾选要分享的项目。",
  "복사할 항목을 체크해 주세요.": "请勾选要复制的项目。",
  "저장된 항목이 없어 복사할 내용이 없습니다.": "没有已保存的项目可供复制。",
  "모든 저장 데이터와 캐시가 초기화되었습니다.": "所有保存数据和缓存已重置。",
  "❗ 정말 초기화하시겠습니까? (한번 더 누르세요)":
    "❗ 确定要重置吗？请再点击一次确认。",
});
Object.assign(UI_TRANSLATIONS.ja, {
  "바탕 (Batang)": "Batang（韓国語セリフ）",
  "나눔명조 (Nanum Myeongjo)": "Nanum 明朝",
  "KoPub 바탕": "KoPub バタン",
  "맑은 고딕 (Malgun Gothic)": "Malgun Gothic",
  "현재 스타일": "現在のスタイル",
  "화면 읽기용": "画面での読書",
  "화면 친화적 세리프": "画面向けセリフ",
  "인문·고전 서적": "文学・古典書籍向け",
  "책 본문용": "書籍本文向け",
  "긴 본문 읽기": "長文読書向け",
  "균형 잡힌 세리프": "バランスのよいセリフ",
  "전통 출판 스타일": "伝統的な出版書体",
  "고전 인쇄체": "クラシックな印刷書体",
  "범용 고전 세리프": "汎用クラシックセリフ",
  "텍스트용 디자인": "本文向けデザイン",
  "한국어 고전 본문": "韓国語の古典本文向け",
  "명조 계열": "明朝系セリフ",
  "한국어 세리프": "韓国語セリフ",
  "출판용 본문": "出版本文向け",
  "화면용 고딕": "画面向けゴシック",
  "현대적 화면 읽기": "現代的な画面読書",
  "일본어 명조": "日本語の明朝体",
  "일본어 화면용": "日本語の画面表示向け",
  "중국어 간체 명조": "簡体中国語セリフ",
  "중국어 간체 고딕": "簡体中国語サンセリフ",
  "중국어 번체 명조": "繁体中国語セリフ",
  "중국어 번체 고딕": "繁体中国語サンセリフ",
  "다국어 동아시아 세리프": "多言語東アジアセリフ",

  "🙏 기도/간구": "🙏 祈り / 願い",
  "✝️ 십자가/구원": "✝️ 十字架 / 救い",
  "🕊️ 성령/평안": "🕊️ 聖霊 / 平安",
  "📖 말씀/묵상": "📖 御言葉 / 黙想",
  "✨ 은혜/영광": "✨ 恵み / 栄光",
  "🔥 성령의 불/열정": "🔥 聖霊の火 / 情熱",
  "💧 생명수/정결": "💧 生命の水 / 清め",
  "❤️ 사랑/감사": "❤️ 愛 / 感謝",
  "🌟 축복/인도": "🌟 祝福 / 導き",
  "💡 진리/지혜": "💡 真理 / 知恵",
  "🌿 회복/성장": "🌿 回復 / 成長",
  "⚓ 소망/믿음": "⚓ 希望 / 信仰",
  "🔄 폰트 설정 전체 초기화": "🔄 フォント設定をすべてリセット",
  "🧹 임시 데이터 및 캐시 삭제": "🧹 一時データとキャッシュを削除",
  "⚙️ 보관함 최대 저장 개수 설정": "⚙️ ライブラリの最大保存数を設定",
  "◀ 성경 책 목록으로 돌아가기": "◀ 聖書の書一覧に戻る",
  "◀ 장 목록으로 돌아가기": "◀ 章一覧に戻る",
  "자동 넘김 재생": "自動送りを再開",
  "자동 넘김 일시정지": "自動送りを一時停止",
  "자동 넘김 재생 (이어하기)": "自動送りを再開",
  "이메일 주소가 클립보드에 복사되었습니다.":
    "メールアドレスをクリップボードにコピーしました。",
  "참고 사진 주소가 클립보드에 복사되었습니다.":
    "参考写真のURLをクリップボードにコピーしました。",
  "성경 데이터 GitHub 주소가 클립보드에 복사되었습니다.":
    "聖書データのGitHub URLをコピーしました。",
  "저장 개수 제한이 설정되었습니다.": "保存件数の上限を設定しました。",
  "히스토리가 모두 삭제되었습니다.": "履歴をすべて削除しました。",
  "공유할 항목을 체크해 주세요.": "共有する項目にチェックを入れてください。",
  "복사할 항목을 체크해 주세요.": "コピーする項目にチェックを入れてください。",
  "저장된 항목이 없어 복사할 내용이 없습니다.":
    "コピーできる保存項目がありません。",
  "모든 저장 데이터와 캐시가 초기화되었습니다.":
    "保存データとキャッシュをすべてリセットしました。",
  "❗ 정말 초기화하시겠습니까? (한번 더 누르세요)":
    "❗ 本当にリセットしますか？確認のためもう一度クリックしてください。",
  "성경 언어 및 역본 선택": "聖書の言語と翻訳を選択",
  "🌍 성경 언어 선택": "🌍 聖書の言語を選択",
  "🌍 성경 역본 선택": "🌍 聖書翻訳を選択",
  "언어 목록을 불러오는 중입니다...": "利用可能な言語を読み込み中...",
  "역본 목록을 불러오는 중입니다...": "翻訳を読み込み中...",
  "언어 또는 역본 검색": "言語または翻訳を検索",
  "지원 역본": "件の翻訳",
  "기본 한국어 본문 (내장)": "内蔵韓国語聖書本文",
  "기본 역본": "内蔵版",
  "선택한 장 본문만 온라인에서 참조하며 전체 역본을 다운로드하지 않습니다.":
    "選択した章だけをオンラインで参照し、聖書全体はダウンロードしません。",
  "Bible.com에서 언어를 선택한 다음, 해당 언어에 실제로 제공되는 역본을 고르세요.":
    "Bible.comで言語を選び、その言語で実際に提供されている翻訳を選択してください。",
  "성경 본문 파일을 다운로드하거나 앱에 저장하지 않습니다. 선택한 역본의 장만 필요할 때 Bible.com에서 조회합니다.":
    "聖書本文をダウンロードしてアプリに保存することはありません。必要な章のみBible.comから参照します。",
  "언어 검색": "言語を検索",
  "역본 이름, 약칭 또는 제공처 검색": "翻訳名・略称・提供元を検索",
  "⌨ 가상 키보드 표시": "⌨ キーボードを表示",
  "⌨ 가상 키보드 숨기기": "⌨ キーボードを隠す",
  띄어쓰기: "空白",
  지우기: "クリア",
  "키보드 배열": "キーボード配列",
  "Bible.com 역본 보기": "Bible.comの翻訳を表示",
  "Bible.com에서 보기": "Bible.comで表示",
  "전체 성경을 다운로드하지 않습니다. 현재 필요한 장 본문과 해당 역본의 책·장 정보를 Bible.com에서 실시간으로 조회합니다.":
    "聖書全体はダウンロードせず、必要な章本文と目次情報だけをBible.comから取得します。",
  "Bible.com 역본 목록을 불러오지 못했습니다. 네트워크 연결 또는 브라우저의 CORS 정책에 의해 직접 요청이 차단되었을 수 있습니다.":
    "Bible.comの翻訳一覧を読み込めませんでした。ネットワークまたはブラウザーのCORSポリシーで拒否された可能性があります。",
  "Bible.com 언어 목록을 불러오지 못했습니다. 네트워크 또는 브라우저 CORS 정책에 의해 직접 요청이 차단되었을 수 있습니다.":
    "Bible.comの言語一覧を読み込めませんでした。ネットワークまたはブラウザーのCORSポリシーで拒否された可能性があります。",
  "Bible.com 직접 요청이 브라우저에서 차단되었습니다(CORS/네트워크). 아래 역본 링크로 사이트가 열리는지 확인해 주세요.":
    "ブラウザーがBible.comへの直接リクエストをブロックしました（CORS/ネットワーク）。下の翻訳リンクが開くか確認してください。",
  "선택한 Bible.com 역본의 책 목록과 현재 장 본문을 확인하는 중입니다...":
    "選択したBible.com翻訳の目次と現在の章を確認中です……",

  "Bible.com에서 역본 목록과 본문을 조회합니다. 각 역본의 제공처 및 라이선스 정보를 확인하세요.":
    "Bible.comから翻訳一覧と本文をリアルタイムで取得します。各翻訳の提供元とライセンスを確認してください。",
  "◀ 언어 목록으로 돌아가기": "◀ 言語一覧に戻る",
  "◀ 역본 목록으로 돌아가기": "◀ 翻訳一覧に戻る",
  "역본 정보를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도하세요.":
    "翻訳情報を読み込めませんでした。ネットワークを確認して再試行してください。",
  "역본 본문을 불러오지 못했습니다. 다른 역본을 선택하거나 네트워크를 확인하세요.":
    "翻訳本文を読み込めませんでした。別の版を選ぶかネットワークを確認してください。",
  "역본이 변경되었습니다.": "聖書翻訳を変更しました。",
  "현재 장절이 해당 역본에 없어 가장 가까운 지원 장절로 이동했습니다.":
    "現在の箇所はこの版にないため、最も近い利用可能な箇所に移動しました。",
  "요청한 장절이 이 역본에 없어 가장 가까운 지원 장절을 표시했습니다.":
    "指定箇所がこの翻訳にないため、最も近い利用可能な箇所を表示しています。",
  "현재 프로젝트의 내장 본문 · 오프라인 폴백":
    "プロジェクト内蔵本文 · オフライン用",
  "이 언어에서 현재 제공되는 온라인 역본이 없습니다. 내장 한국어 본문을 선택하세요.":
    "この言語で利用できるオンライン訳はありません。内蔵韓国語本文を選択してください。",
  "이 언어에서 현재 제공되는 온라인 역본이 없습니다. 다른 언어를 선택하세요.":
    "この言語で利用できるオンライン訳はありません。別の言語を選択してください。",
  "성경 본문 역본": "聖書本文の翻訳",
  "제공처 / 라이선스": "提供元 / ライセンス",
  "본문 조회 오류": "聖書本文の読み込みエラー",
  "역본 본문을 찾지 못했습니다. 이 역본에서 지원되는 다른 장을 선택하거나 네트워크를 확인하세요.":
    "この翻訳の章が見つかりません。対応している別の章を選ぶか、ネットワークを確認してください。",
});

Object.assign(UI_TRANSLATIONS.en, {
  "✍️ 본문 글꼴 미리보기": "✍️ Text font preview",
  "본문 글꼴": "Text font",
  "큰 미리보기 창에서 글꼴을 비교하고 바로 적용할 수 있습니다.":
    "Compare fonts in the larger preview and apply one instantly.",
  "큰 미리보기 열기": "Open large preview",
  "✍️ 글꼴 미리보기": "✍️ Font preview",
  "글꼴을 선택하면 실제 성경 본문에 즉시 적용됩니다. 설치되지 않은 글꼴은 시스템 대체 글꼴로 표시될 수 있습니다.":
    "Select a font to apply it to the Bible text immediately. Fonts not installed on this PC may use a system fallback.",
  "현재 선택:": "Selected:",
  "현재 글꼴": "Current",
  완료: "Done",
  "글꼴이 적용되었습니다.": "Font applied.",
  "24개 글꼴 · 한국어, 영어, 일본어, 중국어 미리보기":
    "24 reading typefaces · Korean, English, Japanese and Chinese samples",
  "기본 및 편안한 읽기": "Default and comfortable reading",
  "서양 고전 · 성경 및 도서용 세리프": "Classic Western book and Bible serifs",
  "한국어 성경 · 책 본문용": "Korean Bible and book typefaces",
  "일본어 · 중국어 성경 및 도서용":
    "Japanese and Chinese Bible and book typefaces",
  "글꼴은 시스템에서 사용할 수 있는 글꼴을 이용합니다. 설치되지 않은 경우 대체 글꼴이 사용됩니다.":
    "Font choices rely on fonts available to the system. If a font is missing, the browser uses a fallback.",
  "손글씨 글꼴 (현재)": "Handwriting (current)",
  "시스템 글꼴": "System font",
  "손글씨 글꼴이 적용되었습니다.": "Handwriting font applied.",
  "시스템 글꼴이 적용되었습니다.": "System font applied.",
});
Object.assign(UI_TRANSLATIONS.zh, {
  "✍️ 본문 글꼴 미리보기": "✍️ 字体预览",
  "본문 글꼴": "正文字体",
  "큰 미리보기 창에서 글꼴을 비교하고 바로 적용할 수 있습니다.":
    "在大尺寸预览窗口中比较字体并立即应用。",
  "큰 미리보기 열기": "打开大尺寸预览",
  "✍️ 글꼴 미리보기": "✍️ 字体预览",
  "글꼴을 선택하면 실제 성경 본문에 즉시 적용됩니다. 설치되지 않은 글꼴은 시스템 대체 글꼴로 표시될 수 있습니다.":
    "选择字体后会立即应用于圣经正文。未安装的字体可能使用系统替代字体。",
  "현재 선택:": "当前选择：",
  "현재 글꼴": "当前",
  완료: "完成",
  "글꼴이 적용되었습니다.": "字体已应用。",
  "24개 글꼴 · 한국어, 영어, 일본어, 중국어 미리보기":
    "24 种适合阅读的字体 · 韩语、英语、日语和中文预览",
  "기본 및 편안한 읽기": "默认与舒适阅读",
  "서양 고전 · 성경 및 도서용 세리프": "西文经典圣经与书籍衬线字体",
  "한국어 성경 · 책 본문용": "韩语圣经与书籍正文字体",
  "일본어 · 중국어 성경 및 도서용": "日语与中文圣经及书籍字体",
  "글꼴은 시스템에서 사용할 수 있는 글꼴을 이용합니다. 설치되지 않은 경우 대체 글꼴이 사용됩니다.":
    "字体取决于系统中可用的字体；未安装时将使用备用字体。",
  "두 가지 글꼴을 비교한 뒤 원하는 스타일을 선택하세요.":
    "比较两种样式，然后选择您喜欢的字体。",
  "손글씨 글꼴 (현재)": "手写字体（当前）",
  "시스템 글꼴": "系统字体",
  "손글씨 글꼴이 적용되었습니다.": "已应用手写字体。",
  "시스템 글꼴이 적용되었습니다.": "已应用系统字体。",
});
Object.assign(UI_TRANSLATIONS.ja, {
  "✍️ 본문 글꼴 미리보기": "✍️ フォントのプレビュー",
  "본문 글꼴": "本文フォント",
  "큰 미리보기 창에서 글꼴을 비교하고 바로 적용할 수 있습니다.":
    "大きなプレビュー画面でフォントを比較し、その場で適用できます。",
  "큰 미리보기 열기": "大きなプレビューを開く",
  "✍️ 글꼴 미리보기": "✍️ フォントプレビュー",
  "글꼴을 선택하면 실제 성경 본문에 즉시 적용됩니다. 설치되지 않은 글꼴은 시스템 대체 글꼴로 표시될 수 있습니다.":
    "フォントを選ぶと聖書本文にすぐ適用されます。未インストールのフォントはシステムの代替フォントで表示される場合があります。",
  "현재 선택:": "選択中：",
  "현재 글꼴": "現在",
  완료: "完了",
  "글꼴이 적용되었습니다.": "フォントを適用しました。",
  "24개 글꼴 · 한국어, 영어, 일본어, 중국어 미리보기":
    "読書向け24書体 · 韓国語、英語、日本語、中国語のプレビュー",
  "기본 및 편안한 읽기": "標準・読みやすいフォント",
  "서양 고전 · 성경 및 도서용 세리프": "欧文の聖書・書籍向けクラシックセリフ",
  "한국어 성경 · 책 본문용": "韓国語の聖書・書籍本文向け",
  "일본어 · 중국어 성경 및 도서용": "日本語・中国語の聖書・書籍向け",
  "글꼴은 시스템에서 사용할 수 있는 글꼴을 이용합니다. 설치되지 않은 경우 대체 글꼴이 사용됩니다.":
    "システムで利用できるフォントを使用します。未インストールの場合は代替フォントが使われます。",
  "두 가지 글꼴을 비교한 뒤 원하는 스타일을 선택하세요.":
    "2つのスタイルを比較して、お好みのフォントを選択してください。",
  "손글씨 글꼴 (현재)": "手書きフォント（現在）",
  "시스템 글꼴": "システムフォント",
  "손글씨 글꼴이 적용되었습니다.": "手書きフォントを適用しました。",
  "시스템 글꼴이 적용되었습니다.": "システムフォントを適用しました。",
});

Object.assign(UI_TRANSLATIONS.en, {
  "• 성경 기본 데이터:": "• Bible data source:",
  "• 사진 소스:": "• Photo source:",
  "클릭 시 기본 성경 데이터 저장소 주소가 복사됩니다":
    "Click to copy the default Bible data repository URL",
  "목록 출처:": "Source:",
  "Bible.com 언어 목록": "Bible.com language list",
  ". Bible.com 웹사이트에서 제공하는 공개 웹 엔드포인트를 참조합니다.":
    ". Uses public web endpoints provided by the Bible.com website.",
});
Object.assign(UI_TRANSLATIONS.zh, {
  "• 성경 기본 데이터:": "• 圣经数据来源：",
  "• 사진 소스:": "• 图片来源：",
  "클릭 시 기본 성경 데이터 저장소 주소가 복사됩니다":
    "点击复制默认圣经数据仓库网址",
  "목록 출처:": "列表来源：",
  "Bible.com 언어 목록": "Bible.com 语言列表",
  ". Bible.com 웹사이트에서 제공하는 공개 웹 엔드포인트를 참조합니다.":
    "。此功能参照 Bible.com 网站提供的公开网络端点。",
});
Object.assign(UI_TRANSLATIONS.ja, {
  "• 성경 기본 데이터:": "• 聖書データソース：",
  "• 사진 소스:": "• 写真ソース：",
  "클릭 시 기본 성경 데이터 저장소 주소가 복사됩니다":
    "クリックすると既定の聖書データリポジトリ URL をコピーします",
  "목록 출처:": "一覧の出典：",
  "Bible.com 언어 목록": "Bible.com の言語一覧",
  ". Bible.com 웹사이트에서 제공하는 공개 웹 엔드포인트를 참조합니다.":
    "。Bible.com ウェブサイトが提供する公開エンドポイントを参照します。",
});

Object.assign(UI_TRANSLATIONS.en, {
  "✍️ 본문 글꼴": "✍️ Text font",
  "본문 글꼴 설정": "Text font settings",
  "글꼴 선택": "Font selection",
  "현재 선택: 손글씨 글꼴": "Selected: Handwriting font",
  "현재 선택: 손글씨 글꼴 (현재)": "Selected: Handwriting (current)",
  "이 언어에서 사용 가능한 역본을 찾지 못했습니다.":
    "No translations are available for this language.",
  "📖 본문 조회": "📖 Bible text lookup",
  "📖 본문 조회 오류": "📖 Bible text lookup error",
  "역본 본문을 불러오지 못했습니다. 인터넷 연결과 Bible.com 접속 상태를 확인해 주세요.":
    "Could not load the translation text. Check your internet connection or direct access to Bible.com.",
  "🌐 직접 연결 도움말 보기": "🌐 Direct connection help",
  "다시 시도": "Try again",
  "역본 검색": "Search translations",
  "Bible.com에서 언어 목록을 불러오는 중입니다...":
    "Loading the Bible.com language list...",
  "Bible.com 언어 목록을 불러오지 못했습니다.":
    "Could not load the Bible.com language list.",
  "저장된 온라인 역본을 복원하지 못했습니다. 내장 본문을 사용합니다.":
    "Could not restore the saved online translation. The built-in Bible text will be used.",
  "Bible.com 직접 연결에 실패했습니다. 네트워크를 확인해 주세요.": "The connection to Bible.com failed.",
  "역본 본문을 확인하지 못했습니다.": "Could not verify the translation text.",
  "선명도 설정이 적용되었습니다.": "Text sharpness setting applied.",
  "그림자 효과가 적용되었습니다.": "Text shadow setting applied.",
  "블러 효과가 적용되었습니다.": "Text blur setting applied.",
  "모든 폰트 및 시각 효과가 초기화되었습니다.":
    "All font and visual-effect settings were reset.",
  셔플: "Shuffle",
  "🔀 셔플 모드 켜짐 (다음 곡부터 무작위 재생)":
    "🔀 Shuffle mode enabled (random verses from the next verse).",
  "▶ 순차 재생 모드 켜짐 (1절씩 순서대로)":
    "▶ Sequential mode enabled (one verse at a time).",
  "💾 상태 기억 켜짐: 현재 구절과 셔플 상태를 저장합니다.":
    "💾 State memory enabled: the current verse and shuffle state will be saved.",
  "상태 기억 꺼짐: 재시작 시 마지막 위치를 복원하지 않습니다.":
    "State memory disabled: the last position will not be restored on restart.",
  "⚡ 재생 속도: 2.0배속 (빠름)": "⚡ Playback speed: 2.0× (fast).",
  "🚀 재생 속도: 4.0배속 (매우 빠름)": "🚀 Playback speed: 4.0× (very fast).",
  "🐢 재생 속도: 0.5배속 (느림)": "🐢 Playback speed: 0.5× (slow).",
  "▶ 재생 속도: 1.0배속 (기본)": "▶ Playback speed: 1.0× (normal).",
  "정렬 및 그룹화된 내용이 클립보드에 복사되었습니다.":
    "Sorted and grouped content copied to the clipboard.",
  "보관함 복사 데이터를 읽지 못했습니다.":
    "Could not read the library data for copying.",
  "저장된 재생 상태를 읽지 못했습니다.":
    "Could not read the saved playback state.",
  "온라인 성경 다음 본문을 불러오지 못했습니다.":
    "Could not load the next online Bible passage.",
  "기본 한국어 본문 (내장)": "Built-in Korean Bible text",
  "현재 프로젝트의 내장 본문 · 오프라인 폴백":
    "Built-in text from this project · offline fallback",
  "Bible.com 역본이 변경되었습니다.": "The Bible.com translation has changed.",
});
Object.assign(UI_TRANSLATIONS.zh, {
  "✍️ 본문 글꼴": "✍️ 正文字体",
  "본문 글꼴 설정": "正文字体设置",
  "글꼴 선택": "字体选择",
  "현재 선택: 손글씨 글꼴": "当前选择：手写字体",
  "현재 선택: 손글씨 글꼴 (현재)": "当前选择：手写字体（当前）",
  "이 언어에서 사용 가능한 역본을 찾지 못했습니다.":
    "此语言没有可用的圣经译本。",
  "📖 본문 조회": "📖 圣经正文查询",
  "📖 본문 조회 오류": "📖 圣经正文查询错误",
  "역본 본문을 불러오지 못했습니다. 인터넷 연결과 Bible.com 접속 상태를 확인해 주세요.":
    "无法加载译本正文。请检查本地连接助手或 Bible.com 访问状态。",
  "🌐 직접 연결 도움말 보기": "🔌 查看连接帮助",
  "다시 시도": "重试",
  "역본 검색": "搜索译本",
  "Bible.com에서 언어 목록을 불러오는 중입니다...":
    "正在加载 Bible.com 语言列表...",
  "Bible.com 언어 목록을 불러오지 못했습니다.": "无法加载 Bible.com 语言列表。",
  "저장된 온라인 역본을 복원하지 못했습니다. 내장 본문을 사용합니다.":
    "无法恢复已保存的在线译本，将使用内置圣经文本。",
  "Bible.com 직접 연결에 실패했습니다. 네트워크를 확인해 주세요.": "连接 Bible.com 失败。",
  "역본 본문을 확인하지 못했습니다.": "无法验证译本正文。",
  "선명도 설정이 적용되었습니다.": "文字清晰度设置已应用。",
  "그림자 효과가 적용되었습니다.": "文字阴影设置已应用。",
  "블러 효과가 적용되었습니다.": "文字模糊设置已应用。",
  "모든 폰트 및 시각 효과가 초기화되었습니다.":
    "所有字体和视觉效果设置已重置。",
  셔플: "随机播放",
  "🔀 셔플 모드 켜짐 (다음 곡부터 무작위 재생)":
    "🔀 已启用随机模式（从下一节开始随机播放）。",
  "▶ 순차 재생 모드 켜짐 (1절씩 순서대로)":
    "▶ 已启用顺序模式（每次播放一节）。",
  "💾 상태 기억 켜짐: 현재 구절과 셔플 상태를 저장합니다.":
    "💾 已启用状态记忆：保存当前经文和随机播放状态。",
  "상태 기억 꺼짐: 재시작 시 마지막 위치를 복원하지 않습니다.":
    "已关闭状态记忆：重启时不会恢复上次位置。",
  "⚡ 재생 속도: 2.0배속 (빠름)": "⚡ 播放速度：2.0 倍（快）。",
  "🚀 재생 속도: 4.0배속 (매우 빠름)": "🚀 播放速度：4.0 倍（非常快）。",
  "🐢 재생 속도: 0.5배속 (느림)": "🐢 播放速度：0.5 倍（慢）。",
  "▶ 재생 속도: 1.0배속 (기본)": "▶ 播放速度：1.0 倍（正常）。",
  "정렬 및 그룹화된 내용이 클립보드에 복사되었습니다.":
    "已将排序和分组后的内容复制到剪贴板。",
  "보관함 복사 데이터를 읽지 못했습니다.": "无法读取要复制的收藏数据。",
  "저장된 재생 상태를 읽지 못했습니다.": "无法读取已保存的播放状态。",
  "온라인 성경 다음 본문을 불러오지 못했습니다.":
    "无法加载下一段在线圣经经文。",
  "기본 한국어 본문 (내장)": "内置韩语圣经文本",
  "현재 프로젝트의 내장 본문 · 오프라인 폴백": "项目内置文本 · 离线备用",
  "Bible.com 역본이 변경되었습니다.": "Bible.com 译本已更改。",
});
Object.assign(UI_TRANSLATIONS.ja, {
  "✍️ 본문 글꼴": "✍️ 本文フォント",
  "본문 글꼴 설정": "本文フォント設定",
  "글꼴 선택": "フォント選択",
  "현재 선택: 손글씨 글꼴": "選択中：手書きフォント",
  "현재 선택: 손글씨 글꼴 (현재)": "選択中：手書きフォント（現在）",
  "이 언어에서 사용 가능한 역본을 찾지 못했습니다.":
    "この言語で利用できる聖書翻訳はありません。",
  "📖 본문 조회": "📖 聖書本文の参照",
  "📖 본문 조회 오류": "📖 聖書本文の取得エラー",
  "역본 본문을 불러오지 못했습니다. 인터넷 연결과 Bible.com 접속 상태를 확인해 주세요.":
    "翻訳本文を読み込めませんでした。ローカル接続ヘルパーまたは Bible.com への接続を確認してください。",
  "🌐 직접 연결 도움말 보기": "🔌 接続ヘルプを表示",
  "다시 시도": "再試行",
  "역본 검색": "翻訳を検索",
  "Bible.com에서 언어 목록을 불러오는 중입니다...":
    "Bible.com の言語一覧を読み込み中...",
  "Bible.com 언어 목록을 불러오지 못했습니다.":
    "Bible.com の言語一覧を読み込めませんでした。",
  "저장된 온라인 역본을 복원하지 못했습니다. 내장 본문을 사용합니다.":
    "保存したオンライン翻訳を復元できないため、内蔵聖書本文を使用します。",
  "Bible.com 직접 연결에 실패했습니다. 네트워크를 확인해 주세요.": "Bible.com への接続に失敗しました。",
  "역본 본문을 확인하지 못했습니다.": "翻訳本文を確認できませんでした。",
  "선명도 설정이 적용되었습니다.": "文字の鮮明度設定を適用しました。",
  "그림자 효과가 적용되었습니다.": "文字の影を適用しました。",
  "블러 효과가 적용되었습니다.": "ぼかし効果を適用しました。",
  "모든 폰트 및 시각 효과가 초기화되었습니다.":
    "フォントと視覚効果の設定をすべてリセットしました。",
  셔플: "シャッフル",
  "🔀 셔플 모드 켜짐 (다음 곡부터 무작위 재생)":
    "🔀 シャッフルモードを有効にしました（次の節からランダム再生）。",
  "▶ 순차 재생 모드 켜짐 (1절씩 순서대로)":
    "▶ 順番再生モードを有効にしました（1節ずつ再生）。",
  "💾 상태 기억 켜짐: 현재 구절과 셔플 상태를 저장합니다.":
    "💾 状態記憶を有効にしました：現在の節とシャッフル状態を保存します。",
  "상태 기억 꺼짐: 재시작 시 마지막 위치를 복원하지 않습니다.":
    "状態記憶を無効にしました：再起動時に前回の位置を復元しません。",
  "⚡ 재생 속도: 2.0배속 (빠름)": "⚡ 再生速度：2.0倍（速い）。",
  "🚀 재생 속도: 4.0배속 (매우 빠름)": "🚀 再生速度：4.0倍（非常に速い）。",
  "🐢 재생 속도: 0.5배속 (느림)": "🐢 再生速度：0.5倍（遅い）。",
  "▶ 재생 속도: 1.0배속 (기본)": "▶ 再生速度：1.0倍（標準）。",
  "정렬 및 그룹화된 내용이 클립보드에 복사되었습니다.":
    "並べ替え・グループ化した内容をクリップボードにコピーしました。",
  "보관함 복사 데이터를 읽지 못했습니다.":
    "コピーするライブラリデータを読み込めませんでした。",
  "저장된 재생 상태를 읽지 못했습니다.":
    "保存された再生状態を読み込めませんでした。",
  "온라인 성경 다음 본문을 불러오지 못했습니다.":
    "次のオンライン聖書本文を読み込めませんでした。",
  "기본 한국어 본문 (내장)": "内蔵韓国語聖書本文",
  "현재 프로젝트의 내장 본문 · 오프라인 폴백":
    "プロジェクト内蔵本文 · オフライン用",
  "Bible.com 역본이 변경되었습니다.": "Bible.com の翻訳を変更しました。",
});

Object.assign(UI_TRANSLATIONS.en, {
  "두 가지 글꼴을 비교한 뒤 원하는 스타일을 선택하세요.":
    "Compare the two fonts and choose your preferred style.",
  "한 번 더 누르세요": "Click once more to confirm",
  "로컬 연결 복구 중입니다...": "Recovering the local connection...",
  "파일 목록을 새로고침했습니다.": "File list refreshed.",
});
Object.assign(UI_TRANSLATIONS.zh, {
  "성경 데이터를 불러오는 중입니다...": "正在加载圣经文本...",
  "로컬파일을 읽는 중입니다...": "正在读取本地圣经文件...",
  "성경 데이터를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.":
    "无法加载圣经文本。请检查网络连接。",
});
Object.assign(UI_TRANSLATIONS.ja, {
  "언어를 고른 다음 해당 언어에서 제공되는 역본을 선택하세요.":
    "言語を選び、その言語で利用できる聖書翻訳を選択してください。",
  "선택한 장 본문을 불러오는 중입니다...": "選択した章の本文を読み込み中...",
  "역본 본문을 불러오는 중입니다...": "翻訳本文を読み込み中...",
  "성경 데이터를 불러오는 중입니다...": "聖書本文を読み込み中...",
  "로컬파일을 읽는 중입니다...": "ローカル聖書ファイルを読み込み中...",
  "성경 데이터를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.":
    "聖書本文を読み込めませんでした。ネットワーク接続を確認してください。",
});

Object.assign(UI_TRANSLATIONS.en, {
  "임시 데이터 및 캐시 삭제 중 오류가 발생했습니다.":
    "An error occurred while clearing temporary data and cache.",
  "현재 장절이 해당 역본에 없어 가장 가까운 지원 장절로 이동했습니다.":
    "This translation does not contain the requested passage. Moved to the nearest available passage.",
  "자동 넘김 일시정지": "Automatic verse advance paused.",
  "자동 넘김 재생 (이어하기)": "Automatic verse advance resumed.",
  "이메일 주소가 클립보드에 복사되었습니다.":
    "Email address copied to the clipboard.",
  "참고 사진 주소가 클립보드에 복사되었습니다.":
    "Reference photo URL copied to the clipboard.",
  "성경 데이터 GitHub 주소가 클립보드에 복사되었습니다.":
    "Bible data GitHub URL copied to the clipboard.",
  "복사할 현재 성경 본문이 없습니다.":
    "There is no current Bible text to copy.",
  "클립보드 복사에 실패했습니다.": "Could not copy to the clipboard.",
  "이미 북마크에 등록된 구절입니다.": "This verse is already bookmarked.",
  "내보낼 항목이 없습니다.": "There are no items to export.",
  "복사할 항목이 없습니다.": "There are no items to copy.",
  "공유할 항목을 체크해 주세요.": "Select the items you want to share.",
  "저장된 항목이 없어 복사할 내용이 없습니다.":
    "There are no saved items to copy.",
  "히스토리가 모두 삭제되었습니다.": "Reading history was cleared.",
  "저장 개수 제한이 설정되었습니다.": "Library item limits were saved.",
  "모든 저장 데이터와 캐시가 초기화되었습니다.":
    "All saved data and caches were reset.",
  "역본이 변경되었습니다.": "The Bible translation has changed.",
  "Bible.com 역본 목록을 불러오지 못했습니다.":
    "Could not load the Bible.com translation list.",
  "Bible.com 역본을 적용하지 못했습니다.":
    "Could not apply the Bible.com translation.",
  "역본 설정을 저장하지 못했습니다.":
    "Could not save the translation preference.",
  "선택한 장 본문 조회 실패:": "Failed to load the selected chapter:",
  "임시 데이터 및 캐시 삭제에 실패했습니다.":
    "Could not clear temporary data and cache.",
  "셔플 활성화 스타일을 읽지 못했습니다.":
    "Could not read the shuffle-enabled style.",
});
Object.assign(UI_TRANSLATIONS.zh, {
  "한 번 더 누르세요": "再按一次以确认",
  "로컬 연결 복구 중입니다...": "正在恢复本地连接...",
  "파일 목록을 새로고침했습니다.": "文件列表已刷新。",
  "두 가지 글꼴을 비교한 뒤 원하는 스타일을 선택하세요.":
    "比较两种字体后，选择您喜欢的样式。",
  "임시 데이터 및 캐시 삭제 중 오류가 발생했습니다.":
    "清理临时数据和缓存时发生错误。",
  "현재 장절이 해당 역본에 없어 가장 가까운 지원 장절로 이동했습니다.":
    "该译本没有所请求的经文，已跳转到最接近的可用经文。",
  "자동 넘김 일시정지": "已暂停自动切换经文。",
  "자동 넘김 재생 (이어하기)": "已恢复自动切换经文。",
  "이메일 주소가 클립보드에 복사되었습니다.": "电子邮件地址已复制到剪贴板。",
  "참고 사진 주소가 클립보드에 복사되었습니다.": "参考图片网址已复制到剪贴板。",
  "성경 데이터 GitHub 주소가 클립보드에 복사되었습니다.":
    "圣经数据 GitHub 网址已复制到剪贴板。",
  "복사할 현재 성경 본문이 없습니다.": "没有可复制的当前圣经正文。",
  "클립보드 복사에 실패했습니다.": "复制到剪贴板失败。",
  "이미 북마크에 등록된 구절입니다.": "此经文已添加到书签。",
  "내보낼 항목이 없습니다.": "没有可导出的项目。",
  "복사할 항목이 없습니다.": "没有可复制的项目。",
  "공유할 항목을 체크해 주세요.": "请选择要分享的项目。",
  "저장된 항목이 없어 복사할 내용이 없습니다.": "没有已保存的项目可供复制。",
  "히스토리가 모두 삭제되었습니다.": "阅读历史已清除。",
  "저장 개수 제한이 설정되었습니다.": "已保存收藏项目数量限制。",
  "모든 저장 데이터와 캐시가 초기화되었습니다.": "所有保存的数据和缓存已重置。",
  "역본이 변경되었습니다.": "圣经译本已更改。",
  "Bible.com 역본 목록을 불러오지 못했습니다.": "无法加载 Bible.com 译本列表。",
  "Bible.com 역본을 적용하지 못했습니다.": "无法应用 Bible.com 译本。",
  "역본 설정을 저장하지 못했습니다.": "无法保存译本设置。",
  "선택한 장 본문 조회 실패:": "所选章节加载失败：",
  "임시 데이터 및 캐시 삭제에 실패했습니다.": "无法清理临时数据和缓存。",
  "셔플 활성화 스타일을 읽지 못했습니다.": "无法读取随机播放模式的样式。",
});
Object.assign(UI_TRANSLATIONS.ja, {
  "한 번 더 누르세요": "もう一度押して確定",
  "로컬 연결 복구 중입니다...": "ローカル接続を復旧しています...",
  "파일 목록을 새로고침했습니다.": "ファイル一覧を更新しました。",
  "두 가지 글꼴을 비교한 뒤 원하는 스타일을 선택하세요.":
    "2種類のフォントを比較して、お好みのスタイルを選択してください。",
  "임시 데이터 및 캐시 삭제 중 오류가 발생했습니다.":
    "一時データとキャッシュの削除中にエラーが発生しました。",
  "현재 장절이 해당 역본에 없어 가장 가까운 지원 장절로 이동했습니다.":
    "この翻訳には指定された箇所がないため、最も近い利用可能な節に移動しました。",
  "자동 넘김 일시정지": "節の自動切り替えを一時停止しました。",
  "자동 넘김 재생 (이어하기)": "節の自動切り替えを再開しました。",
  "이메일 주소가 클립보드에 복사되었습니다.":
    "メールアドレスをクリップボードにコピーしました。",
  "참고 사진 주소가 클립보드에 복사되었습니다.":
    "参照画像の URL をクリップボードにコピーしました。",
  "성경 데이터 GitHub 주소가 클립보드에 복사되었습니다.":
    "聖書データの GitHub URL をクリップボードにコピーしました。",
  "복사할 현재 성경 본문이 없습니다.":
    "コピーできる現在の聖書本文がありません。",
  "클립보드 복사에 실패했습니다.": "クリップボードへのコピーに失敗しました。",
  "이미 북마크에 등록된 구절입니다.":
    "この節はすでにブックマークに登録されています。",
  "내보낼 항목이 없습니다.": "エクスポートする項目がありません。",
  "복사할 항목이 없습니다.": "コピーする項目がありません。",
  "공유할 항목을 체크해 주세요.": "共有する項目を選択してください。",
  "저장된 항목이 없어 복사할 내용이 없습니다.":
    "コピーできる保存済み項目がありません。",
  "히스토리가 모두 삭제되었습니다.": "閲覧履歴を削除しました。",
  "저장 개수 제한이 설정되었습니다.": "ライブラリ項目数の上限を保存しました。",
  "모든 저장 데이터와 캐시가 초기화되었습니다.":
    "保存データとキャッシュをすべてリセットしました。",
  "역본이 변경되었습니다.": "聖書翻訳を変更しました。",
  "Bible.com 역본 목록을 불러오지 못했습니다.":
    "Bible.com の翻訳一覧を読み込めませんでした。",
  "Bible.com 역본을 적용하지 못했습니다.":
    "Bible.com の翻訳を適用できませんでした。",
  "역본 설정을 저장하지 못했습니다.": "翻訳設定を保存できませんでした。",
  "선택한 장 본문 조회 실패:": "選択した章の読み込みに失敗しました：",
  "임시 데이터 및 캐시 삭제에 실패했습니다.":
    "一時データとキャッシュを削除できませんでした。",
  "셔플 활성화 스타일을 읽지 못했습니다.":
    "シャッフル有効時のスタイルを読み込めませんでした。",
});

const UI_NODE_ORIGINALS = new WeakMap();
const UI_ATTRIBUTE_ORIGINALS = new WeakMap();

Object.assign(UI_TRANSLATIONS.en, {
  "오프라인 성경 다운로드 진행 상황 보기": "View offline Bible download progress",
  "오프라인 성경 다운로드 진행 상황": "Offline Bible download progress",
  "오프라인 성경 다운로드": "Offline Bible download",
  "진행 상황 패널 닫기": "Close progress panel",
  "패널 닫기": "Close panel",
  "다운로드 준비 중": "Preparing download",
  "패널을 닫아도 현재 페이지가 실행되는 동안 다운로드는 계속됩니다.": "The download continues while this page is running, even when this panel is closed.",
  "다운로드와 전체 구절 재정렬이 완료되었습니다.": "The download and full verse reordering are complete.",
  "일부 장을 받지 못했습니다. 다시 시작하면 누락된 장을 이어받습니다.": "Some chapters could not be downloaded. Start again to resume the missing chapters.",
  "다운로드를 완료하지 못했습니다. 다시 시작하면 저장된 장을 건너뛰고 이어받습니다.": "The download did not finish. Start again to skip saved chapters and resume.",
  "한 번에 역본 하나만 다운로드할 수 있습니다.": "Multiple translations can download independently.",
  "다른 역본 다운로드가 끝난 후 시작할 수 있습니다.": "This translation is already downloading; other translations can run independently.",
  "브라우저 저장소 및 기존 역본 확인 중": "Checking browser storage and existing translations",
  "오프라인 파일 확인 중": "Checking offline file",
  "브라우저 저장소": "browser storage",
  "성경 순서 정렬 및 최종 저장 중": "Sorting in Bible order and saving the final file",
  "저장 중 오류": "Error while saving",
  "다운로드 실패": "Download failed",
  "다운로드가 예기치 않게 끝났습니다.": "The download ended unexpectedly.",
  "다시 시작하면 이미 저장된 장을 건너뛰고 이어받습니다.": "Restart to skip chapters already saved and resume.",
  "오프라인 저장 완료": "Saved for offline use",
  "전체 성경 순서 정렬 후 브라우저 저장소에 저장됨": "Saved to browser storage after ordering the full Bible",
  "다운로드 진행 중": "Download in progress",
  "다운로드 완료": "Download complete",
  "부분 다운로드 완료": "Partially downloaded",
  "이미 전체 저장됨": "Already fully saved",
  "Bible.com 역본의 책·장 정보를 찾지 못했습니다.": "Could not find book and chapter information for this Bible.com translation.",
  "장 본문에서 절 데이터를 찾지 못했습니다.": "No verse data was found in the chapter text.",
  "Bible.com 역본을 오프라인 파일로 저장하지 못했습니다.": "Could not save the Bible.com translation as an offline file.",
  "역본": "translation",
});
Object.assign(UI_TRANSLATIONS.zh, {
  "오프라인 성경 다운로드 진행 상황 보기": "查看离线圣经下载进度",
  "오프라인 성경 다운로드 진행 상황": "离线圣经下载进度",
  "오프라인 성경 다운로드": "离线圣经下载",
  "진행 상황 패널 닫기": "关闭进度面板",
  "패널 닫기": "关闭面板",
  "다운로드 준비 중": "正在准备下载",
  "패널을 닫아도 현재 페이지가 실행되는 동안 다운로드는 계속됩니다.": "只要当前页面仍在运行，即使关闭此面板，下载也会继续。",
  "다운로드와 전체 구절 재정렬이 완료되었습니다.": "下载和全部经文重新排序已完成。",
  "일부 장을 받지 못했습니다. 다시 시작하면 누락된 장을 이어받습니다.": "部分章节下载失败。再次开始时将继续下载缺失的章节。",
  "다운로드를 완료하지 못했습니다. 다시 시작하면 저장된 장을 건너뛰고 이어받습니다.": "下载未完成。再次开始时会跳过已保存的章节并继续下载。",
  "한 번에 역본 하나만 다운로드할 수 있습니다.": "一次只能下载一个译本。",
  "다른 역본 다운로드가 끝난 후 시작할 수 있습니다.": "此译本已在下载中，其他译本仍可独立下载。",
  "브라우저 저장소 및 기존 역본 확인 중": "正在检查浏览器存储和现有译本",
  "오프라인 파일 확인 중": "正在检查离线文件",
  "브라우저 저장소": "浏览器存储",
  "성경 순서 정렬 및 최종 저장 중": "正在按圣经顺序排序并保存最终文件",
  "저장 중 오류": "保存时出错",
  "다운로드 실패": "下载失败",
  "다운로드가 예기치 않게 끝났습니다.": "下载意外结束。",
  "다시 시작하면 이미 저장된 장을 건너뛰고 이어받습니다.": "重新开始时会跳过已保存的章节并继续下载。",
  "오프라인 저장 완료": "已保存供离线使用",
  "전체 성경 순서 정렬 후 브라우저 저장소에 저장됨": "已按整本圣经的顺序重新排序并保存到浏览器存储",
  "다운로드 진행 중": "正在下载",
  "다운로드 완료": "下载完成",
  "부분 다운로드 완료": "部分下载完成",
  "이미 전체 저장됨": "已完整保存",
  "Bible.com 역본의 책·장 정보를 찾지 못했습니다.": "无法找到此 Bible.com 译本的书卷和章节信息。",
  "장 본문에서 절 데이터를 찾지 못했습니다.": "未能在章节正文中找到经节数据。",
  "Bible.com 역본을 오프라인 파일로 저장하지 못했습니다.": "无法将 Bible.com 译本保存为离线文件。",
  "역본": "译本",
});
Object.assign(UI_TRANSLATIONS.ja, {
  "뷰어 모드로 역본 적용": "閲覧モードで聖書訳を適用",
  "오프라인 성경 다운로드 진행 상황 보기": "オフライン聖書のダウンロード状況を表示",
  "오프라인 성경 다운로드 진행 상황": "オフライン聖書のダウンロード状況",
  "오프라인 성경 다운로드": "オフライン聖書のダウンロード",
  "진행 상황 패널 닫기": "進行状況パネルを閉じる",
  "패널 닫기": "パネルを閉じる",
  "다운로드 준비 중": "ダウンロードを準備中",
  "패널을 닫아도 현재 페이지가 실행되는 동안 다운로드는 계속됩니다.": "このページが動作している間は、パネルを閉じてもダウンロードは続行されます。",
  "다운로드와 전체 구절 재정렬이 완료되었습니다.": "ダウンロードと全節の並べ替えが完了しました。",
  "일부 장을 받지 못했습니다. 다시 시작하면 누락된 장을 이어받습니다.": "一部の章をダウンロードできませんでした。再開すると不足分を取得します。",
  "다운로드를 완료하지 못했습니다. 다시 시작하면 저장된 장을 건너뛰고 이어받습니다.": "ダウンロードは完了していません。再開すると保存済みの章をスキップして続行します。",
  "한 번에 역본 하나만 다운로드할 수 있습니다.": "複数の聖書訳をそれぞれ独立してダウンロードできます。",
  "다른 역본 다운로드가 끝난 후 시작할 수 있습니다.": "この聖書訳はダウンロード中ですが、他の訳は独立してダウンロードできます。",
  "브라우저 저장소 및 기존 역본 확인 중": "ブラウザー保存領域と既存の翻訳を確認中",
  "오프라인 파일 확인 중": "オフラインファイルを確認中",
  "브라우저 저장소": "ブラウザー保存領域",
  "성경 순서 정렬 및 최종 저장 중": "聖書の順序に並べ替えて最終保存中",
  "저장 중 오류": "保存中にエラーが発生しました",
  "다운로드 실패": "ダウンロード失敗",
  "다운로드가 예기치 않게 끝났습니다.": "ダウンロードが予期せず終了しました。",
  "다시 시작하면 이미 저장된 장을 건너뛰고 이어받습니다.": "再開すると保存済みの章をスキップして続行します。",
  "오프라인 저장 완료": "オフライン用に保存しました",
  "전체 성경 순서 정렬 후 브라우저 저장소에 저장됨": "聖書全体の順序に並べ替えてブラウザー保存領域に保存しました",
  "다운로드 진행 중": "ダウンロード中",
  "다운로드 완료": "ダウンロード完了",
  "부분 다운로드 완료": "一部ダウンロード完了",
  "이미 전체 저장됨": "すでに全体を保存済み",
  "Bible.com 역본의 책·장 정보를 찾지 못했습니다.": "この Bible.com 訳の書巻・章の情報が見つかりませんでした。",
  "장 본문에서 절 데이터를 찾지 못했습니다.": "章本文から節のデータが見つかりませんでした。",
  "Bible.com 역본을 오프라인 파일로 저장하지 못했습니다.": "Bible.com の聖書訳をオフラインファイルとして保存できませんでした。",
  "역본": "聖書訳",
});

Object.assign(UI_TRANSLATIONS.en, {
  "검사": "Check", "무결성 검사": "Integrity check", "무결성 검사 실행": "Run integrity check",
  "뷰어 모드로 역본 적용": "Apply translation in viewer mode",
  "무결성 검사 중": "Checking integrity", "무결성 검사 완료": "Integrity check complete",
  "무결성 검사 실패": "Integrity check failed", "본문 순서가 올바릅니다.": "Verse order is correct.",
  "본문 순서가 올바르지 않습니다.": "Verse order is not canonical.",
  "본문 순서를 자동으로 바로잡을까요?": "Would you like to automatically repair the verse order?",
  "누락된 장이 있습니다.": "Some chapters are missing.", "누락된 장을 다시 다운로드할까요?": "Would you like to download the missing chapters again?",
  "잘못된 구절 키 또는 빈 본문이 있습니다.": "Invalid verse keys or empty verse text were found.", "중복된 구절 참조가 있습니다.": "Duplicate verse references were found.",
  "파일 무결성을 검사하지 못했습니다.": "Could not check file integrity.",
  "저장된 파일을 자동 검사 중입니다...": "Automatically checking saved files...",
  "검사 결과": "Check results", "정렬 수정 완료": "Order repair complete",
  "모든 다운로드 작업": "All download tasks", "활성 다운로드": "Active downloads",
  "진행 중인 다운로드가 없습니다.": "No downloads are currently running.",
  "다운로드 작업 개수": "Download tasks",
  "한 번에 역본 하나만 다운로드할 수 있습니다.": "Multiple translations can now download independently.",
  "다른 역본 다운로드가 끝난 후 시작할 수 있습니다.": "This translation is already downloading.",
  "한 번에 하나씩 다운로드할 수 있습니다.": "Each translation downloads independently.",
});
Object.assign(UI_TRANSLATIONS.zh, {
  "검사": "检查", "무결성 검사": "完整性检查", "무결성 검사 실행": "运行完整性检查",
  "뷰어 모드로 역본 적용": "以阅读模式应用译本",
  "무결성 검사 중": "正在检查完整性", "무결성 검사 완료": "完整性检查完成",
  "무결성 검사 실패": "完整性检查失败", "본문 순서가 올바릅니다.": "经文顺序正确。",
  "본문 순서가 올바르지 않습니다.": "经文顺序不符合正典顺序。",
  "본문 순서를 자동으로 바로잡을까요?": "是否自动修正经文顺序？",
  "누락된 장이 있습니다.": "存在缺失章节。", "누락된 장을 다시 다운로드할까요?": "是否重新下载缺失章节？",
  "잘못된 구절 키 또는 빈 본문이 있습니다.": "发现无效经节键或空白经文。", "중복된 구절 참조가 있습니다.": "发现重复的经节引用。",
  "파일 무결성을 검사하지 못했습니다.": "无法检查文件完整性。",
  "저장된 파일을 자동 검사 중입니다...": "正在自动检查已保存的文件…",
  "검사 결과": "检查结果", "정렬 수정 완료": "顺序修正完成",
  "무결성 검사 미완료 · 검사 버튼을 눌러 확인하세요.": "尚未完成完整性检查 · 点击检查按钮查看。",
  "모든 다운로드 작업": "所有下载任务", "활성 다운로드": "正在下载",
  "진행 중인 다운로드가 없습니다.": "当前没有正在进行的下载。", "다운로드 작업 개수": "下载任务数",
  "한 번에 역본 하나만 다운로드할 수 있습니다.": "现在可以同时独立下载多个译本。",
  "다른 역본 다운로드가 끝난 후 시작할 수 있습니다.": "此译本已经在下载中。", "한 번에 하나씩 다운로드할 수 있습니다.": "各译本可独立下载。",
});
Object.assign(UI_TRANSLATIONS.ja, {
  "검사": "チェック", "무결성 검사": "整合性チェック", "무결성 검사 실행": "整合性をチェック",
  "무결성 검사 중": "整合性を確認中", "무결성 검사 완료": "整合性チェック完了",
  "무결성 검사 실패": "整合性チェック失敗", "본문 순서가 올바릅니다.": "聖書本文の順序は正しいです。",
  "본문 순서가 올바르지 않습니다.": "聖書本文の順序が正典順ではありません。",
  "본문 순서를 자동으로 바로잡을까요?": "本文の順序を自動修正しますか？",
  "누락된 장이 있습니다.": "不足している章があります。", "누락된 장을 다시 다운로드할까요?": "不足している章を再ダウンロードしますか？",
  "잘못된 구절 키 또는 빈 본문이 있습니다.": "無効な節キーまたは空の本文が見つかりました。", "중복된 구절 참조가 있습니다.": "重複する節参照が見つかりました。",
  "파일 무결성을 검사하지 못했습니다.": "ファイルの整合性を確認できませんでした。",
  "저장된 파일을 자동 검사 중입니다...": "保存済みファイルを自動チェックしています…",
  "검사 결과": "チェック結果", "정렬 수정 완료": "順序の修正が完了しました",
  "무결성 검사 미완료 · 검사 버튼을 눌러 확인하세요.": "整合性チェック未完了 · チェックボタンで確認してください。",
  "모든 다운로드 작업": "すべてのダウンロード", "활성 다운로드": "ダウンロード中",
  "진행 중인 다운로드가 없습니다.": "実行中のダウンロードはありません。", "다운로드 작업 개수": "ダウンロード件数",
  "한 번에 역본 하나만 다운로드할 수 있습니다.": "複数の聖書訳をそれぞれ独立して同時にダウンロードできます。",
  "다른 역본 다운로드가 끝난 후 시작할 수 있습니다.": "この聖書訳はすでにダウンロード中です。", "한 번에 하나씩 다운로드할 수 있습니다.": "各聖書訳を独立してダウンロードできます。",
});

Object.assign(UI_TRANSLATIONS.en, {
  "🌍 성경 역본 선택": "🌍 Bible translations",
  "◀ 언어 목록으로 돌아가기": "◀ Back to language list",
  "역본 이름, 약칭 또는 제공처 검색": "Search translation name, abbreviation, or publisher",
  "이 언어에서 사용 가능한 역본을 찾지 못했습니다.": "No translations are available for this language.",
  "Bible.com 언어별 역본 페이지": "Bible.com translations for this language",
  "Bible.com 언어 목록": "Bible.com language list",
  "Bible.com 웹사이트에서 제공하는 공개 웹 엔드포인트를 참조합니다.": "This uses public web endpoints provided by the Bible.com website.",
  "출처:": "Source:",
  ". 본문 출처와 역본 상세 정보는 각 역본의 링크에서 확인하세요.": ". Check each translation’s link for source and edition details.",
  "이 역본은 이미 다운로드 중입니다.": "This translation is already downloading.",
  "오프라인 파일이 없습니다. 먼저 다운로드하세요.": "No offline file exists yet. Download this translation first.",
  "전체 다운로드 버튼으로 전체 성경을 이 배경화면의 브라우저 저장소에 저장할 수 있습니다.": "Use the download button to save the full Bible in this wallpaper's browser storage.",
  "역본 이름 옆의 다운로드 버튼으로 전체 성경을 이 배경화면의 브라우저 저장소에 저장할 수 있습니다. 저장 데이터는 앱을 다시 실행해도 유지되며, 중단 후 재시작하면 저장된 장을 건너뛰고 이어받습니다. 저장된 역본은 JSON 구조·구절 키·빈 본문·본문 순서를 자동 확인합니다. 다른 기기나 이전 버전에서 받은 JSON은 오프라인 역본 관리에서 가져올 수 있습니다. 뷰어 모드에서 역본을 적용하려면 역본 왼쪽의 눈 아이콘을 누르세요.": "Use the download button beside a translation to save the full Bible persistently in this wallpaper's browser storage. Downloads can resume after restart. Saved translations are checked for JSON structure, verse keys, empty text, and verse order. Use Import JSON in the offline source manager to migrate an existing JSON file. Click the eye icon to apply a translation in viewer mode.",
  "무결성 검사 실행": "Run integrity check",
  "누락된 장을 다시 다운로드할까요?": "Would you like to download the missing chapters again?",
});
Object.assign(UI_TRANSLATIONS.zh, {
  "🌍 성경 역본 선택": "🌍 圣经译本",
  "◀ 언어 목록으로 돌아가기": "◀ 返回语言列表",
  "역본 이름, 약칭 또는 제공처 검색": "搜索译本名称、缩写或出版方",
  "이 언어에서 사용 가능한 역본을 찾지 못했습니다.": "此语言没有可用的圣经译本。",
  "Bible.com 언어별 역본 페이지": "Bible.com 此语言的圣经译本",
  "Bible.com 언어 목록": "Bible.com 语言列表",
  "Bible.com 웹사이트에서 제공하는 공개 웹 엔드포인트를 참조합니다.": "此功能使用 Bible.com 网站提供的公开 Web 端点。",
  "출처:": "来源：",
  ". 본문 출처와 역본 상세 정보는 각 역본의 링크에서 확인하세요.": "。请通过各译本链接查看正文来源和版本详情。",
  "이 역본은 이미 다운로드 중입니다.": "此译本已在下载中。",
  "오프라인 파일이 없습니다. 먼저 다운로드하세요.": "尚无离线文件。请先下载此译本。",
  "역본 이름 옆의 다운로드 버튼으로 전체 성경을 이 배경화면의 브라우저 저장소에 저장할 수 있습니다. 저장 데이터는 앱을 다시 실행해도 유지되며, 중단 후 재시작하면 저장된 장을 건너뛰고 이어받습니다. 저장된 역본은 JSON 구조·구절 키·빈 본문·본문 순서를 자동 확인합니다. 다른 기기나 이전 버전에서 받은 JSON은 오프라인 역본 관리에서 가져올 수 있습니다. 뷰어 모드에서 역본을 적용하려면 역본 왼쪽의 눈 아이콘을 누르세요.": "点击译本旁的下载按钮，将整本圣经持续保存在此壁纸的浏览器存储中。下载中断后可在重启时继续。系统会检查 JSON 结构、经节键、空白经文和经文顺序。可在离线来源管理器中使用“导入 JSON”迁移以前保存的文件。点击译本左侧的眼睛图标可应用该译本。",
});
Object.assign(UI_TRANSLATIONS.ja, {
  "🌍 성경 역본 선택": "🌍 聖書の翻訳",
  "◀ 언어 목록으로 돌아가기": "◀ 言語一覧に戻る",
  "역본 이름, 약칭 또는 제공처 검색": "翻訳名・略称・提供元を検索",
  "이 언어에서 사용 가능한 역본을 찾지 못했습니다.": "この言語で利用可能な聖書訳は見つかりませんでした。",
  "Bible.com 언어별 역본 페이지": "Bible.com のこの言語の聖書訳",
  "Bible.com 언어 목록": "Bible.com の言語一覧",
  "Bible.com 웹사이트에서 제공하는 공개 웹 엔드포인트를 참조합니다.": "Bible.com ウェブサイトが提供する公開 Web エンドポイントを使用します。",
  "출처:": "出典：",
  ". 본문 출처와 역본 상세 정보는 각 역본의 링크에서 확인하세요.": "。本文の出典と版の詳細は各訳のリンクで確認してください。",
  "이 역본은 이미 다운로드 중입니다.": "この聖書訳はすでにダウンロード中です。",
  "오프라인 파일이 없습니다. 먼저 다운로드하세요.": "オフラインファイルがありません。先にこの聖書訳をダウンロードしてください。",
  "역본 이름 옆의 다운로드 버튼으로 전체 성경을 이 배경화면의 브라우저 저장소에 저장할 수 있습니다. 저장 데이터는 앱을 다시 실행해도 유지되며, 중단 후 재시작하면 저장된 장을 건너뛰고 이어받습니다. 저장된 역본은 JSON 구조·구절 키·빈 본문·본문 순서를 자동 확인합니다. 다른 기기나 이전 버전에서 받은 JSON은 오프라인 역본 관리에서 가져올 수 있습니다. 뷰어 모드에서 역본을 적용하려면 역본 왼쪽의 눈 아이콘을 누르세요.": "翻訳名の横にあるダウンロードボタンで、聖書全体をこの壁紙のブラウザー保存領域に保存できます。中断後も再起動して続行できます。JSON 構造、節キー、空本文、節の順序を自動確認します。以前の JSON ファイルはオフラインソース管理の「JSON をインポート」から移行できます。目のアイコンで閲覧モードに適用します。",
});

Object.assign(UI_TRANSLATIONS.en, {
  "Bible.com 직접 요청이 실패했습니다. 인터넷 연결과 Bible.com 접속 상태를 확인하세요.": "The direct Bible.com request failed. Check your internet connection and access to Bible.com.",
  "Bible.com 요청이 브라우저에서 차단되었거나 네트워크에 연결할 수 없습니다.": "The browser blocked the Bible.com request or the network is unavailable.",
  "Bible.com 응답을 JSON으로 해석하지 못했습니다.": "The Bible.com response could not be parsed as JSON.",
  "성경 구절을 불러오지 못했습니다. 네트워크를 확인하거나 로컬 연결을 복구해 주세요.": "Could not load the Bible verse. Check the internet connection and try again.",
  "로컬 데이터 폴더를 검색할 수 없습니다.": "Could not scan the local data folder.",
  "로컬 연결 복구에 실패했습니다. 로컬 도우미 상태를 확인하고 다시 시도해 주세요.": "Could not recover the local connection. Check the local helper and try again.",
  "프로젝트 경로를 확인할 수 없습니다.": "Could not determine the project path.",
  "data 폴더를 검색할 수 없습니다. 다시 검색을 누르면 연결을 복구한 뒤 재시도합니다.": "Could not scan the data folder. Select Retry scan to recover the connection and try again.",
  "내장 성경 본문이 아직 로드되지 않았습니다.": "The built-in Bible text has not loaded yet.",
  "다운로드한 파일을 삭제하려면 항목의 체크박스를 선택하세요.": "Select a file's checkbox to delete downloaded files.",
  "선택한 오프라인 성경 파일을 삭제하는 중입니다...": "Deleting the selected offline Bible files...",
});
Object.assign(UI_TRANSLATIONS.zh, {
  "Bible.com 직접 요청이 실패했습니다. 인터넷 연결과 Bible.com 접속 상태를 확인하세요.": "直接请求 Bible.com 失败。请检查网络连接以及对 Bible.com 的访问。",
  "Bible.com 요청이 브라우저에서 차단되었거나 네트워크에 연결할 수 없습니다.": "浏览器阻止了 Bible.com 请求，或当前网络不可用。",
  "Bible.com 응답을 JSON으로 해석하지 못했습니다.": "无法将 Bible.com 响应解析为 JSON。",
  "성경 구절을 불러오지 못했습니다. 네트워크를 확인하거나 로컬 연결을 복구해 주세요.": "无法加载圣经经文。请检查网络或恢复本地连接。",
  "로컬 데이터 폴더를 검색할 수 없습니다.": "无法扫描本地数据文件夹。",
  "로컬 연결 복구에 실패했습니다. 로컬 도우미 상태를 확인하고 다시 시도해 주세요.": "无法恢复本地连接。请检查本地助手状态后重试。",
  "프로젝트 경로를 확인할 수 없습니다.": "无法确定项目路径。",
  "data 폴더를 검색할 수 없습니다. 다시 검색을 누르면 연결을 복구한 뒤 재시도합니다.": "无法扫描 data 文件夹。点击“重新扫描”以恢复连接并重试。",
  "내장 성경 본문이 아직 로드되지 않았습니다.": "内置圣经正文尚未加载。",
  "다운로드한 파일을 삭제하려면 항목의 체크박스를 선택하세요.": "勾选文件复选框即可删除已下载的文件。",
  "선택한 오프라인 성경 파일을 삭제하는 중입니다...": "正在删除所选的离线圣经文件...",
});
Object.assign(UI_TRANSLATIONS.ja, {
  "Bible.com 직접 요청이 실패했습니다. 인터넷 연결과 Bible.com 접속 상태를 확인하세요.": "Bible.com への直接リクエストに失敗しました。ネットワークと Bible.com への接続を確認してください。",
  "Bible.com 요청이 브라우저에서 차단되었거나 네트워크에 연결할 수 없습니다.": "ブラウザーによって Bible.com のリクエストがブロックされたか、ネットワークに接続できません。",
  "Bible.com 응답을 JSON으로 해석하지 못했습니다.": "Bible.com の応答を JSON として解析できませんでした。",
  "성경 구절을 불러오지 못했습니다. 네트워크를 확인하거나 로컬 연결을 복구해 주세요.": "聖書の節を読み込めませんでした。ネットワークを確認するか、ローカル接続を復旧してください。",
  "로컬 데이터 폴더를 검색할 수 없습니다.": "ローカルのデータフォルダーを検索できません。",
  "로컬 연결 복구에 실패했습니다. 로컬 도우미 상태를 확인하고 다시 시도해 주세요.": "ローカル接続を復旧できませんでした。ローカルヘルパーの状態を確認して再試行してください。",
  "프로젝트 경로를 확인할 수 없습니다.": "プロジェクトのパスを確認できません。",
  "data 폴더를 검색할 수 없습니다. 다시 검색을 누르면 연결을 복구한 뒤 재시도합니다.": "data フォルダーを検索できません。「再検索」を押すと接続を復旧して再試行します。",
  "내장 성경 본문이 아직 로드되지 않았습니다.": "内蔵の聖書本文はまだ読み込まれていません。",
  "다운로드한 파일을 삭제하려면 항목의 체크박스를 선택하세요.": "ダウンロードしたファイルを削除するには、項目のチェックボックスを選択してください。",
  "선택한 오프라인 성경 파일을 삭제하는 중입니다...": "選択したオフライン聖書ファイルを削除しています...",
});

let cachedUILanguagePreference = "en";
let uiLanguagePreferenceLoaded = false;

const UI_LANGUAGE_DEFAULT_MIGRATION_KEY = "bible_ui_language_default_en_v2";

function getUILanguagePreference() {
  if (!uiLanguagePreferenceLoaded) {
    uiLanguagePreferenceLoaded = true;
    try {
      const saved = localStorage.getItem(UI_LANGUAGE_KEY);
      const migrationDone =
        localStorage.getItem(UI_LANGUAGE_DEFAULT_MIGRATION_KEY) === "true";

      if (!migrationDone) {
        cachedUILanguagePreference =
          !saved || saved === "system"
            ? "en"
            : ["system", "en", "ko", "zh", "ja"].includes(saved)
              ? saved
              : "en";
        localStorage.setItem(UI_LANGUAGE_KEY, cachedUILanguagePreference);
        localStorage.setItem(UI_LANGUAGE_DEFAULT_MIGRATION_KEY, "true");
      } else {
        cachedUILanguagePreference = [
          "system",
          "en",
          "ko",
          "zh",
          "ja",
        ].includes(saved)
          ? saved
          : "en";
        if (!saved) localStorage.setItem(UI_LANGUAGE_KEY, "en");
      }
    } catch (error) {
      cachedUILanguagePreference = "en";
    }
  }
  return cachedUILanguagePreference;
}

function saveUILanguagePreference(language) {
  cachedUILanguagePreference = language;
  uiLanguagePreferenceLoaded = true;
  try {
    localStorage.setItem(UI_LANGUAGE_KEY, language);
  } catch (error) {
    console.warn("Failed to save the interface language preference.", error);
  }
}

function getSystemUILanguage() {
  const locale = String(
    navigator.languages?.[0] || navigator.language || "en",
  ).toLowerCase();
  if (locale.startsWith("ko")) return "ko";
  if (locale.startsWith("zh")) return "zh";
  if (locale.startsWith("ja")) return "ja";
  return "en";
}

function getUILanguage() {
  const preference = getUILanguagePreference();
  return preference === "system" ? getSystemUILanguage() : preference;
}

const UI_STATIC_EN_TRANSLATIONS = {
  "System language": { ko: "시스템 언어", zh: "系统语言", ja: "システム言語" },
  "Bible controls": {
    ko: "성경 제어 패널",
    zh: "圣经控制",
    ja: "聖書コントロール",
  },
  "Choose Bible language and translation": {
    ko: "성경 언어 및 역본 선택",
    zh: "选择圣经语言和译本",
    ja: "聖書の言語と翻訳を選択",
  },
  "Change interface language": {
    ko: "UI 언어 변경",
    zh: "更改界面语言",
    ja: "UI 言語を変更",
  },
  "🌐 Interface language": {
    ko: "🌐 UI 언어",
    zh: "🌐 界面语言",
    ja: "🌐 UI 言語",
  },
  "Choose interface language": {
    ko: "UI 언어 선택",
    zh: "选择界面语言",
    ja: "UI 言語を選択",
  },
  "Automatically match the interface language to your system language.": {
    ko: "시스템 언어에 따라 UI 언어를 자동으로 설정합니다.",
    zh: "根据系统语言自动设置界面语言。",
    ja: "システム言語に合わせて UI 言語を自動設定します。",
  },
  Close: { ko: "닫기", zh: "关闭", ja: "閉じる" },
  "Bible data sources & APIs": {
    ko: "성경 데이터 소스 및 API",
    zh: "圣经数据来源与 API",
    ja: "聖書データソースと API",
  },
  "Bible.com translations": {
    ko: "Bible.com 제공 역본",
    zh: "Bible.com 提供的译本",
    ja: "Bible.com の翻訳",
  },
  "View all Bible data APIs": {
    ko: "사용 중인 성경 데이터 API 모두 보기",
    zh: "查看所有正在使用的圣经数据 API",
    ja: "使用中の聖書データ API をすべて表示",
  },
  "External data services": {
    ko: "외부 데이터 서비스",
    zh: "外部数据服务",
    ja: "外部データサービス",
  },
  "Local app endpoints (support services)": {
    ko: "로컬 앱 엔드포인트(보조 서비스)",
    zh: "本地应用端点（辅助服务）",
    ja: "ローカルアプリのエンドポイント（補助サービス）",
  },
  "Local endpoints run on this PC; they are not third-party Bible providers.": {
    ko: "로컬 엔드포인트는 이 PC에서 실행되며 외부 성경 제공 서비스가 아닙니다.",
    zh: "本地端点在此电脑上运行，并非第三方圣经提供商。",
    ja: "ローカルエンドポイントはこの PC 上で動作し、外部の聖書提供元ではありません。",
  },
  "Copy Bible API list": {
    ko: "성경 API 목록 복사",
    zh: "复制圣经 API 列表",
    ja: "聖書 API 一覧をコピー",
  },
  "Bible API endpoints copied.": {
    ko: "성경 API 목록을 복사했습니다.",
    zh: "已复制圣经 API 列表。",
    ja: "聖書 API 一覧をコピーしました。",
  },
  "Interface scale settings": {
    ko: "UI 배율 설정",
    zh: "界面缩放设置",
    ja: "UI スケール設定",
  },
  "🖥️ Interface scale": {
    ko: "🖥️ UI 배율",
    zh: "🖥️ 界面缩放",
    ja: "🖥️ UI スケール",
  },
  "Choose a comfortable interface size. Standard is the 100% baseline. Bible text size is managed separately.":
    {
      ko: "편안한 UI 크기를 선택하세요. Standard가 기준 크기(100%)입니다. 성경 본문 글자 크기는 별도로 설정합니다.",
      zh: "选择舒适的界面大小。Standard 为基准尺寸（100%）。圣经正文大小可单独设置。",
      ja: "使いやすい UI サイズを選択してください。Standard が基準サイズ（100%）です。聖書本文の文字サイズは別途設定します。",
    },
  "Interface scale": { ko: "UI 배율", zh: "界面缩放", ja: "UI スケール" },
  Compact: { ko: "작게", zh: "紧凑", ja: "コンパクト" },
  Comfortable: { ko: "편안하게", zh: "舒适", ja: "快適" },
  Standard: { ko: "표준", zh: "标准", ja: "標準" },
  Large: { ko: "크게", zh: "较大", ja: "大きめ" },
  "Extra Large": { ko: "매우 크게", zh: "特大", ja: "特大" },
  "Compact · 67%": {
    ko: "작게 · 67%",
    zh: "紧凑 · 67%",
    ja: "コンパクト · 67%",
  },
  "Comfortable · 83%": {
    ko: "편안하게 · 83%",
    zh: "舒适 · 83%",
    ja: "快適 · 83%",
  },
  "Standard · 100%": {
    ko: "표준 · 100%",
    zh: "标准 · 100%",
    ja: "標準 · 100%",
  },
  "Large · 117%": { ko: "크게 · 117%", zh: "较大 · 117%", ja: "大きめ · 117%" },
  "Extra Large · 133%": {
    ko: "매우 크게 · 133%",
    zh: "特大 · 133%",
    ja: "特大 · 133%",
  },
  "Reset to Standard": {
    ko: "표준 크기로 초기화",
    zh: "重置为标准尺寸",
    ja: "標準サイズにリセット",
  },
  "Interface scale reset to Standard": {
    ko: "UI 배율을 표준 크기로 초기화했습니다.",
    zh: "界面缩放已重置为标准尺寸。",
    ja: "UI スケールを標準サイズにリセットしました。",
  },
  "Additional visual data source": {
    ko: "추가 이미지 소스",
    zh: "其他图像来源",
    ja: "追加の画像ソース",
  },
  "Picsum Photos — wallpaper image source": {
    ko: "Picsum Photos — 배경 이미지 소스",
    zh: "Picsum Photos — 壁纸图像来源",
    ja: "Picsum Photos — 壁紙画像ソース",
  },
  "Used as the image source for the rotating wallpaper background.": {
    ko: "배경화면 이미지 소스로 사용합니다.",
    zh: "用作轮播壁纸的图像来源。",
    ja: "切り替わる壁紙の画像ソースとして使用します。",
  },

  "⌨ Show keyboard": {
    ko: "⌨ 가상 키보드 표시",
    zh: "⌨ 显示键盘",
    ja: "⌨ キーボードを表示",
  },
  "⌨ Hide keyboard": {
    ko: "⌨ 가상 키보드 숨기기",
    zh: "⌨ 隠す",
    ja: "⌨ キーボードを隠す",
  },
  "Keyboard layout": {
    ko: "키보드 배열",
    zh: "键盘布局",
    ja: "キーボード配列",
  },
  Space: { ko: "띄어쓰기", zh: "空格", ja: "空白" },
  Clear: { ko: "지우기", zh: "清除", ja: "クリア" },
  "Bible menu": { ko: "성경 메뉴", zh: "圣经菜单", ja: "聖書メニュー" },
  "Loading Bible text...": {
    ko: "성경 데이터를 불러오는 중입니다...",
    zh: "正在加载圣经文本...",
    ja: "聖書本文を読み込み中...",
  },
  "Loading the default Bible text...": {
    ko: "기본 성경 데이터를 불러오는 중입니다...",
    zh: "正在加载默认圣经文本...",
    ja: "既定の聖書本文を読み込み中...",
  },
  "Loading local Bible data...": {
    ko: "로컬 성경 데이터를 불러오는 중입니다...",
    zh: "正在加载本地圣经数据...",
    ja: "ローカル聖書データを読み込み中...",
  },
  "Bible text could not be loaded. Check the selected Bible source or network connection.":
    {
      ko: "성경 데이터를 불러오지 못했습니다. 선택한 역본 또는 네트워크 연결을 확인해 주세요.",
      zh: "无法加载圣经文本。请检查 data 文件夹或网络连接。",
      ja: "聖書本文を読み込めませんでした。data フォルダーまたはネットワーク接続を確認してください。",
    },
  "Scanning the data folder...": {
    ko: "data 폴더를 검색하는 중입니다...",
    zh: "正在扫描 data 文件夹...",
    ja: "data フォルダーをスキャン中...",
  },
  "Retry scan": { ko: "다시 검색", zh: "重新扫描", ja: "再スキャン" },
  "Choose an offline Bible source": {
    ko: "오프라인 성경 데이터 선택",
    zh: "选择离线圣经数据",
    ja: "オフライン聖書データを選択",
  },
  "Offline Bible sources": {
    ko: "오프라인 성경 데이터",
    zh: "离线圣经数据",
    ja: "オフライン聖書データ",
  },
  "Files found in the data folder": {
    ko: "data 폴더에서 찾은 파일",
    zh: "在 data 文件夹中找到的文件",
    ja: "data フォルダーで見つかったファイル",
  },
  "Check one or more boxes to delete downloaded files.": {
    ko: "다운로드한 파일을 삭제하려면 항목의 체크박스를 선택하세요.",
    zh: "勾选一个或多个项目即可删除已下载的文件。",
    ja: "ダウンロード済みファイルを削除するには、項目のチェックボックスを選択してください。",
  },
  "🗑 Delete selected": {
    ko: "🗑 선택 항목 삭제",
    zh: "🗑 删除所选项",
    ja: "🗑 選択項目を削除",
  },
  "Search offline Bible files": {
    ko: "오프라인 성경 파일 검색",
    zh: "搜索离线圣经文件",
    ja: "オフライン聖書ファイルを検索",
  },
  "Refresh file list": {
    ko: "파일 목록 새로고침",
    zh: "刷新文件列表",
    ja: "ファイル一覧を更新",
  },
  "Apply source": {
    ko: "이 데이터 적용",
    zh: "应用此数据",
    ja: "このデータを適用",
  },
  "Current source": { ko: "현재 사용 중", zh: "当前使用", ja: "現在使用中" },
  "Built-in Bible": { ko: "내장 성경", zh: "内置圣经", ja: "内蔵聖書" },
  "Start the local helper and try again.": {
    ko: "로컬 도우미를 실행한 뒤 다시 시도하세요.",
    zh: "启动本地助手后重试。",
    ja: "ローカルヘルパーを起動して再試行してください。",
  },
  "Saved offline source could not be loaded; the default source is being used.":
    {
      ko: "저장된 오프라인 데이터를 불러오지 못해 기본 데이터를 사용합니다.",
      zh: "无法加载已保存的离线数据，正在使用默认数据。",
      ja: "保存されたオフラインデータを読み込めないため、既定データを使用します。",
    },
  "JSON file": { ko: "JSON 파일", zh: "JSON 文件", ja: "JSON ファイル" },
  "No JSON files were found in the data folder.": {
    ko: "data 폴더에서 JSON 파일을 찾지 못했습니다.",
    zh: "在 data 文件夹中未找到 JSON 文件。",
    ja: "data フォルダーに JSON ファイルが見つかりません。",
  },
  "The data folder could not be scanned. Click Retry scan to reconnect automatically.":
    {
      ko: "data 폴더를 확인할 수 없습니다. ‘다시 검색’을 누르면 연결을 자동으로 복구한 뒤 다시 시도합니다.",
      zh: "无法扫描 data 文件夹。点击“重新扫描”后，应用会尝试自动修复连接并重试。",
      ja: "data フォルダーを確認できません。「再スキャン」を押すと、接続を自動修復して再試行します。",
    },
  "The selected file is not a supported Bible JSON format.": {
    ko: "선택한 파일은 지원하는 성경 JSON 형식이 아닙니다.",
    zh: "所选文件不是受支持的圣经 JSON 格式。",
    ja: "選択したファイルは対応する聖書 JSON 形式ではありません。",
  },
  "Only JSON files in the data folder are listed. Files are scanned each time this window opens.":
    {
      ko: "data 폴더의 JSON 파일만 표시합니다. 이 창을 열 때마다 파일을 다시 검색합니다.",
      zh: "仅显示 data 文件夹中的 JSON 文件。每次打开此窗口都会重新扫描。",
      ja: "data フォルダー内の JSON ファイルのみ表示します。この画面を開くたびに再スキャンします。",
    },
  "Offline Bible source applied.": {
    ko: "오프라인 성경 데이터가 적용되었습니다.",
    zh: "已应用离线圣经数据。",
    ja: "オフライン聖書データを適用しました。",
  },
  "Could not load the selected offline Bible file.": {
    ko: "선택한 오프라인 성경 파일을 불러오지 못했습니다.",
    zh: "无法加载所选的离线圣经文件。",
    ja: "選択したオフライン聖書ファイルを読み込めませんでした。",
  },
};

Object.assign(UI_STATIC_EN_TRANSLATIONS, {
  English: { ko: "영어", zh: "英语", ja: "英語" },
  Korean: { ko: "한국어", zh: "韩语", ja: "韓国語" },
  Chinese: { ko: "중국어", zh: "中文", ja: "中国語" },
  Japanese: { ko: "일본어", zh: "日语", ja: "日本語" },
  "View on Bible.com": {
    ko: "Bible.com에서 보기",
    zh: "在 Bible.com 查看",
    ja: "Bible.com で表示",
  },
  "Year source": { ko: "연도 출처", zh: "年份来源", ja: "年の出典" },
  "Release year unavailable": {
    ko: "출시년도 미확인",
    zh: "发行年份未知",
    ja: "発売年不明",
  },
  "Recovering local connection...": {
    ko: "로컬 연결을 복구하는 중...",
    zh: "正在恢复本地连接...",
    ja: "ローカル接続を復旧中...",
  },
  "Checking and restarting the local Bible services for this project...": {
    ko: "이 프로젝트의 로컬 성경 서비스를 확인하고 다시 시작하는 중입니다...",
    zh: "正在检查并重新启动此项目的本地圣经服务...",
    ja: "このプロジェクトのローカル聖書サービスを確認して再起動しています...",
  },
  "Could not copy the API list. Select the entries in the source panel manually.":
    {
      ko: "API 목록을 복사하지 못했습니다. 소스 패널에서 항목을 직접 선택해 주세요.",
      zh: "无法复制 API 列表。请在来源面板中手动选择条目。",
      ja: "API 一覧をコピーできませんでした。ソースパネルで項目を手動選択してください。",
    },
  "Could not load the Bible verse. Check the internet connection and try again.":
    {
      ko: "성경 구절을 불러오지 못했습니다. 네트워크를 확인하거나 로컬 연결을 복구해 주세요.",
      zh: "无法加载圣经经文。请检查网络或恢复本地连接。",
      ja: "聖書の節を読み込めません。ネットワークを確認するか、ローカル接続を復旧してください。",
    },
  "Offline Bible source applied.": {
    ko: "오프라인 성경 데이터가 적용되었습니다.",
    zh: "已应用离线圣经数据。",
    ja: "オフライン聖書データを適用しました。",
  },
  "The data folder could not be scanned. Click Retry scan to reconnect automatically.":
    {
      ko: "data 폴더를 검색할 수 없습니다. 다시 검색을 누르면 연결을 복구한 뒤 재시도합니다.",
      zh: "无法扫描 data 文件夹。点击“重新扫描”后会尝试恢复连接并重试。",
      ja: "data フォルダーをスキャンできません。「再スキャン」を押すと接続を復旧して再試行します。",
    },
  "No JSON files were found in the data folder.": {
    ko: "data 폴더에서 JSON 파일을 찾지 못했습니다.",
    zh: "在 data 文件夹中未找到 JSON 文件。",
    ja: "data フォルダーに JSON ファイルが見つかりません。",
  },
  "Scanning the data folder...": {
    ko: "data 폴더를 검색하는 중입니다...",
    zh: "正在扫描 data 文件夹...",
    ja: "data フォルダーをスキャン中...",
  },
  "The built-in Bible text has not loaded.": {
    ko: "내장 성경 본문이 아직 로드되지 않았습니다.",
    zh: "尚未加载内置圣经文本。",
    ja: "内蔵聖書本文がまだ読み込まれていません。",
  },
  "Provides default language and translation configuration.": {
    ko: "기본 언어 및 역본 설정을 제공합니다.",
    zh: "提供默认语言和译本配置。",
    ja: "既定の言語と翻訳の設定を提供します。",
  },
  "Lists translations for the selected language.": {
    ko: "선택한 언어에서 제공되는 역본 목록을 표시합니다.",
    zh: "列出所选语言的译本。",
    ja: "選択した言語の翻訳一覧を表示します。",
  },
  "Open an English sample": {
    ko: "영어 예시 열기",
    zh: "打开英文示例",
    ja: "英語のサンプルを開く",
  },
  "Fallback page patterns omit the locale or translation abbreviation.": {
    ko: "대체 페이지 경로에서는 언어 코드 또는 역본 약칭을 생략할 수 있습니다.",
    zh: "备用页面路径可能省略区域语言代码或译本缩写。",
    ja: "代替ページの URL では、ロケールまたは翻訳略称を省略する場合があります。",
  },
  "The build ID is read from": {
    ko: "빌드 ID는 다음 주소에서 읽습니다:",
    zh: "构建 ID 从此地址读取：",
    ja: "ビルド ID は次のアドレスから取得します：",
  },
  "This is only a fallback when the chapter page parser cannot find text.": {
    ko: "장 페이지에서 본문을 찾지 못한 경우에만 사용하는 대체 방식입니다.",
    zh: "仅当章节页面解析器找不到正文时才使用此备用方式。",
    ja: "章ページの解析で本文が見つからない場合のみ使用する代替手段です。",
  },
  "Used to enrich translation release/publication years when Bible.com metadata does not provide one.":
    {
      ko: "Bible.com 메타데이터에 연도가 없을 때 역본 출시·출판년도를 보완합니다.",
      zh: "当 Bible.com 元数据未提供年份时，用于补充译本发行或出版年份。",
      ja: "Bible.com のメタデータに年がない場合、翻訳の公開・出版年を補完します。",
    },
  "Used as a remote fallback only when the default local data/embedded/EN_ESV.json cannot be loaded.":
    {
      ko: "기본 로컬 데이터 data/embedded/EN_ESV.json을 불러오지 못했을 때만 사용하는 원격 대체 데이터입니다.",
      zh: "仅当无法加载默认本地数据 data/embedded/EN_ESV.json 时，才使用此远程备用数据。",
      ja: "既定のローカルデータ data/embedded/EN_ESV.json を読み込めない場合にのみ使用するリモート代替データです。",
    },
  "Source repository": {
    ko: "소스 저장소",
    zh: "源代码仓库",
    ja: "ソースリポジトリ",
  },
  "Not used": { ko: "사용하지 않음", zh: "未使用", ja: "未使用" },
  "API.Bible and Bible Brain / FCBH APIs are not called by this project.": {
    ko: "이 프로젝트는 API.Bible 및 Bible Brain / FCBH API를 호출하지 않습니다.",
    zh: "此项目不会调用 API.Bible 或 Bible Brain / FCBH API。",
    ja: "このプロジェクトは API.Bible と Bible Brain / FCBH API を呼び出しません。",
  },
  "Bible.com language/default-version catalog": {
    ko: "Bible.com 언어 및 기본 역본 카탈로그",
    zh: "Bible.com 语言／默认译本目录",
    ja: "Bible.com の言語・既定翻訳カタログ",
  },
  "Bible.com translation catalog": {
    ko: "Bible.com 역본 카탈로그",
    zh: "Bible.com 译本目录",
    ja: "Bible.com の翻訳カタログ",
  },
  "Bible.com translation metadata and book/chapter index": {
    ko: "Bible.com 역본 메타데이터 및 책·장 색인",
    zh: "Bible.com 译本元数据与书卷／章节索引",
    ja: "Bible.com の翻訳メタデータと書巻・章索引",
  },
  "Bible.com rendered chapter text": {
    ko: "Bible.com 렌더링 장 본문",
    zh: "Bible.com 渲染后的章节正文",
    ja: "Bible.com のレンダリング済み章本文",
  },
  "Bible.com legacy Next.js JSON fallback": {
    ko: "Bible.com 레거시 Next.js JSON 대체 경로",
    zh: "Bible.com 旧版 Next.js JSON 备用接口",
    ja: "Bible.com の旧 Next.js JSON フォールバック",
  },
  "Bible.com translation information pages": {
    ko: "Bible.com 역본 정보 페이지",
    zh: "Bible.com 译本信息页面",
    ja: "Bible.com の翻訳情報ページ",
  },
  "Wikidata Query Service — publication-year metadata (P577)": {
    ko: "Wikidata 쿼리 서비스 — 출판년도 메타데이터(P577)",
    zh: "Wikidata 查询服务 — 出版年份元数据（P577）",
    ja: "Wikidata クエリサービス — 出版年メタデータ（P577）",
  },
  "jsDelivr CDN — built-in Bible JSON fallback": {
    ko: "jsDelivr CDN — 내장 성경 JSON 대체 데이터",
    zh: "jsDelivr CDN — 内置圣经 JSON 备用数据",
    ja: "jsDelivr CDN — 内蔵聖書 JSON のフォールバック",
  },
  "The language index is": {
    ko: "언어 색인:",
    zh: "语言索引：",
    ja: "言語インデックス：",
  },
  "are shown as reference links in the selection UI; the language index is": {
    ko: "는 선택 UI의 참고 링크로 표시되며 언어 색인은 ",
    zh: "会作为选择界面的参考链接显示；语言索引为 ",
    ja: "は選択画面の参照リンクとして表示され、言語一覧は ",
  },
  "It also proxies the allowlisted Bible.com catalog, metadata and chapter routes.":
    {
      ko: "허용 목록에 포함된 Bible.com 카탈로그·메타데이터·장 본문 경로도 중계합니다.",
      zh: "它还会代理允许列表中的 Bible.com 目录、元数据和章节路径。",
      ja: "許可リストに含まれる Bible.com のカタログ、メタデータ、章本文のルートも中継します。",
    },
});

Object.assign(UI_STATIC_EN_TRANSLATIONS, {
  "; a second request may append": {
    ko: "; 두 번째 요청에는 다음 값이 추가될 수 있습니다 ",
    zh: "；第二次请求可能会附加 ",
    ja: "；2 回目のリクエストでは次が追加される場合があります ",
  },
  "are shown as reference links in the selection UI; the language index is": {
    ko: "는 선택 UI의 참고 링크로 표시되며 언어 색인은 ",
    zh: "会作为选择界面的参考链接显示；语言索引为 ",
    ja: "は選択画面の参照リンクとして表示され、言語一覧は ",
  },
  "The local service was restarted, but this request is still unavailable.": {
    ko: "로컬 서비스를 다시 시작했지만 이 요청은 여전히 사용할 수 없습니다.",
    zh: "本地服务已重启，但此请求仍不可用。",
    ja: "ローカルサービスを再起動しましたが、このリクエストはまだ利用できません。",
  },
  "Could not scan the local data folder.": {
    ko: "로컬 데이터 폴더를 검색할 수 없습니다.",
    zh: "无法扫描本地数据文件夹。",
    ja: "ローカルデータフォルダーをスキャンできません。",
  },
  "Local connection recovery failed. Check the local helper and try again.": {
    ko: "로컬 연결 복구에 실패했습니다. 로컬 도우미 상태를 확인하고 다시 시도해 주세요.",
    zh: "本地连接恢复失败。请检查本地助手后重试。",
    ja: "ローカル接続を復旧できませんでした。ローカルヘルパーを確認して再試行してください。",
  },
  "Project path could not be determined.": {
    ko: "프로젝트 경로를 확인할 수 없습니다.",
    zh: "无法确定项目路径。",
    ja: "プロジェクトのパスを確認できません。",
  },
  "Technical details": {
    ko: "기술 세부 정보",
    zh: "技术详情",
    ja: "技術的な詳細",
  },
});

Object.assign(UI_STATIC_EN_TRANSLATIONS, {
  "Project path could not be determined.": {
    ko: "프로젝트 경로를 확인할 수 없습니다.",
    zh: "无法确定项目路径。",
    ja: "プロジェクトのパスを確認できません。",
  },
  "The current project folder could not be determined from the active wallpaper page.": {
    ko: "현재 실행 중인 배경화면 페이지에서 프로젝트 폴더를 확인할 수 없습니다.",
    zh: "无法从当前运行的壁纸页面确定项目文件夹。",
    ja: "現在の壁紙ページからプロジェクトフォルダーを特定できません。",
  },
  "Local connection recovery did not complete.": {
    ko: "로컬 연결 복구가 완료되지 않았습니다.",
    zh: "本地连接恢复未完成。",
    ja: "ローカル接続の復旧が完了しませんでした。",
  },
});

function translateDynamicUIString(trimmed, language) {
  let match;
  if (
    (match = trimmed.match(
      /^Loading (.+) translations and verifying publication years\.\.\.$/,
    ))
  ) {
    const name = match[1];
    if (language === "ko")
      return `${name} 역본과 출시년도를 확인하는 중입니다...`;
    if (language === "zh") return `正在加载 ${name} 的译本并核验发行年份...`;
    if (language === "ja") return `${name} の翻訳と公開年を確認しています...`;
  }
  if (
    (match = trimmed.match(/^(.*?) · Release year: (\d{4})(.*)$/)) ||
    (match = trimmed.match(/^Release year: (\d{4})(.*)$/))
  ) {
    const hasPublisher = match.length === 4;
    const publisher = hasPublisher ? match[1] : "";
    const year = hasPublisher ? match[2] : match[1];
    const suffix = hasPublisher ? match[3] : match[2];
    const prefix =
      language === "ko"
        ? "출시 연도: "
        : language === "zh"
          ? "发行年份："
          : language === "ja"
            ? "公開年："
            : "Release year: ";
    return `${publisher ? `${publisher} · ` : ""}${prefix}${year}${suffix}`;
  }
  if ((match = trimmed.match(/^Loading (.+)\.\.\.$/))) {
    const item = match[1];
    if (language === "ko") return `${item} 불러오는 중...`;
    if (language === "zh") return `正在加载 ${item}...`;
    if (language === "ja") return `${item} を読み込み中...`;
  }
  if (
    (match = trimmed.match(
      /^Local connection recovered\. Found (\d+) JSON file\(s\) in this project's data folder\.$/,
    ))
  ) {
    const count = match[1];
    if (language === "ko")
      return `로컬 연결을 복구했습니다. 이 프로젝트의 data 폴더에서 JSON 파일 ${count}개를 찾았습니다.`;
    if (language === "zh")
      return `本地连接已恢复。在此项目的 data 文件夹中找到 ${count} 个 JSON 文件。`;
    if (language === "ja")
      return `ローカル接続を復旧しました。このプロジェクトの data フォルダーで JSON ファイルを ${count} 個見つけました。`;
  }
  if (
    (match = trimmed.match(
      /^Local connection recovered\. Found (\d+) offline JSON file\(s\)\.$/,
    ))
  ) {
    const count = match[1];
    if (language === "ko")
      return `로컬 연결을 복구했습니다. 오프라인 JSON 파일 ${count}개를 찾았습니다.`;
    if (language === "zh")
      return `本地连接已恢复。找到 ${count} 个离线 JSON 文件。`;
    if (language === "ja")
      return `ローカル接続を復旧しました。オフライン JSON ファイルを ${count} 個見つけました。`;
  }
  if ((match = trimmed.match(/^Local connection recovery failed:\s*(.*)$/))) {
    const detail = match[1];
    if (language === "ko") return `로컬 연결 복구 실패: ${detail}`;
    if (language === "zh") return `本地连接恢复失败：${detail}`;
    if (language === "ja") return `ローカル接続の復旧に失敗しました：${detail}`;
  }
  if (
    (match = trimmed.match(
      /^Temporary caches cleared \((\d+) entries\)\. Preferences, bookmarks, notes, history, offline files and the visible verse were preserved\.$/,
    ))
  ) {
    const count = match[1];
    if (language === "ko")
      return `임시 캐시 ${count}개 항목을 정리했습니다. 설정, 북마크, 노트, 히스토리, 오프라인 파일과 현재 구절은 유지했습니다.`;
    if (language === "zh")
      return `已清理 ${count} 项临时缓存。设置、书签、笔记、历史记录、离线文件和当前经文均已保留。`;
    if (language === "ja")
      return `一時キャッシュを ${count} 件削除しました。設定、ブックマーク、メモ、履歴、オフラインファイル、表示中の節は保持しました。`;
  }
  if (
    (match = trimmed.match(
      /^일부 임시 저장소 정리에 실패했습니다\. 삭제 완료 (\d+)개, 실패 (\d+)건\.$/,
    ))
  ) {
    if (language === "en")
      return `Some temporary data stores could not be cleared. Removed ${match[1]} item(s); ${match[2]} failure(s).`;
    if (language === "zh")
      return `部分临时存储清理失败。已删除 ${match[1]} 项，失败 ${match[2]} 项。`;
    if (language === "ja")
      return `一部の一時データを削除できませんでした。削除 ${match[1]} 件、失敗 ${match[2]} 件。`;
  }
  if (
    (match = trimmed.match(
      /^\[(.+)\] (Random verse|Next verse|Previous verse)$/,
    ))
  ) {
    const ref = match[1];
    const action = match[2];
    if (language === "ko")
      return `[${ref}] ${action === "Random verse" ? "무작위 구절" : action === "Next verse" ? "다음 구절" : "이전 구절"}`;
    if (language === "zh")
      return `[${ref}] ${action === "Random verse" ? "随机经文" : action === "Next verse" ? "下一节" : "上一节"}`;
    if (language === "ja")
      return `[${ref}] ${action === "Random verse" ? "ランダムな節" : action === "Next verse" ? "次の節" : "前の節"}`;
  }
  if (
    (match = trimmed.match(/^\[(.+)\] 본문이 클립보드에 복사되었습니다\.$/))
  ) {
    if (language === "en")
      return `[${match[1]}] Bible text copied to the clipboard.`;
    if (language === "zh") return `已将 [${match[1]}] 的圣经正文复制到剪贴板。`;
    if (language === "ja")
      return `[${match[1]}] の聖書本文をクリップボードにコピーしました。`;
  }
  if ((match = trimmed.match(/^\[(.+)\] 북마크에 추가되었습니다\.$/))) {
    if (language === "en") return `[${match[1]}] was added to bookmarks.`;
    if (language === "zh") return `已将 [${match[1]}] 添加到书签。`;
    if (language === "ja")
      return `[${match[1]}] をブックマークに追加しました。`;
  }
  if ((match = trimmed.match(/^\[(.+)\] 구절로 이동했습니다\.$/))) {
    if (language === "en") return `Moved to verse [${match[1]}].`;
    if (language === "zh") return `已跳转到经文 [${match[1]}]。`;
    if (language === "ja") return `節 [${match[1]}] に移動しました。`;
  }
  if ((match = trimmed.match(/^\[(.+)\] 구절로 이동 \(일시정지\)$/))) {
    if (language === "en")
      return `Moved to verse [${match[1]}] (playback paused).`;
    if (language === "zh") return `已跳转到经文 [${match[1]}]（播放已暂停）。`;
    if (language === "ja")
      return `節 [${match[1]}] に移動しました（再生一時停止）。`;
  }
  if ((match = trimmed.match(/^(\d+)개$/))) {
    const count = Number(match[1]);
    if (language === "en") return `${count} ${count === 1 ? "item" : "items"}`;
    if (language === "zh") return `${count} 项`;
    if (language === "ja") return `${count} 件`;
  }
  if ((match = trimmed.match(/^구절 전환 재생 속도:\s*(.+)$/))) {
    if (language === "en") return `Verse transition speed: ${match[1]}`;
    if (language === "zh") return `经文切换速度：${match[1]}`;
    if (language === "ja") return `節の切り替え速度：${match[1]}`;
  }
  if ((match = trimmed.match(/^태그 \[(.+?)\]가 저장되었습니다\.$/))) {
    const inner = match[1];
    const emojiMatch = inner.match(/^(\S+)\s+(.+)$/u);
    if (emojiMatch) {
      const mapped =
        UI_TRANSLATIONS[language]?.[`${emojiMatch[1]} ${emojiMatch[2]}`];
      const displayTag = mapped || inner;
      if (language === "en") return `Tag [${displayTag}] saved.`;
      if (language === "zh") return `已保存标签 [${displayTag}]。`;
      if (language === "ja") return `タグ [${displayTag}] を保存しました。`;
    }
  }
  if (
    (match = trimmed.match(
      /^%temp% 임시 저장소에 \[(.+)\] 파일이 저장되었습니다\.$/,
    ))
  ) {
    const category = match[1];
    const localizedCategory = UI_TRANSLATIONS[language]?.[category] || category;
    if (language === "en")
      return `Saved [${localizedCategory}] to the %temp% temporary folder.`;
    if (language === "zh")
      return `已将 [${localizedCategory}] 保存到 %temp% 临时文件夹。`;
    if (language === "ja")
      return `[${localizedCategory}] を %temp% 一時フォルダーに保存しました。`;
  }
  if ((match = trimmed.match(/^현재 선택:\s*(.+)$/))) {
    const label = match[1];
    if (language === "en")
      return `Selected: ${label === "손글씨 글꼴" ? "Handwriting font" : label === "손글씨 글꼴 (현재)" ? "Handwriting (current)" : label}`;
    if (language === "zh")
      return `当前选择：${label === "손글씨 글꼴" ? "手写字体" : label === "손글씨 글꼴 (현재)" ? "手写字体（当前）" : label}`;
    if (language === "ja")
      return `選択中：${label === "손글씨 글꼴" ? "手書きフォント" : label === "손글씨 글꼴 (현재)" ? "手書きフォント（現在）" : label}`;
  }
  return null;
}

function translateUIString(value) {
  if (typeof value !== "string") return value;
  const language = getUILanguage();
  const trimmed = value.trim();
  const staticTranslation = UI_STATIC_EN_TRANSLATIONS[trimmed];
  if (staticTranslation && staticTranslation[language])
    return staticTranslation[language];
  const dynamicTranslation = translateDynamicUIString(trimmed, language);
  if (dynamicTranslation !== null) return dynamicTranslation;
  if (language === "ko") return value;
  const dict = UI_TRANSLATIONS[language];
  if (!dict) return value;
  const translationCount = trimmed.match(/^(\d+)\s+지원 역본$/);
  if (translationCount) {
    const count = translationCount[1];
    if (language === "en") return `${count} translations`;
    if (language === "zh") return `${count} 个译本`;
    if (language === "ja") return `${count}件の翻訳`;
  }
  let translationMetaMatch = trimmed.match(/^(.+?) · (\d+)권 · (\d+)절$/);
  if (translationMetaMatch) {
    if (language === "en")
      return `${translationMetaMatch[1]} · ${translationMetaMatch[2]} books · ${translationMetaMatch[3]} verses`;
    if (language === "zh")
      return `${translationMetaMatch[1]} · ${translationMetaMatch[2]}卷 · ${translationMetaMatch[3]}节`;
    if (language === "ja")
      return `${translationMetaMatch[1]} · ${translationMetaMatch[2]}巻 · ${translationMetaMatch[3]}節`;
  }
  translationMetaMatch = trimmed.match(
    /^(.+?) \((.+?)\)에서 사용할 역본을 선택하세요\.$/,
  );
  if (translationMetaMatch) {
    if (language === "en")
      return `Choose a translation for ${translationMetaMatch[1]} (${translationMetaMatch[2]}).`;
    if (language === "zh")
      return `请选择 ${translationMetaMatch[1]}（${translationMetaMatch[2]}）的圣经译本。`;
    if (language === "ja")
      return `${translationMetaMatch[1]}（${translationMetaMatch[2]}）の聖書訳を選択してください。`;
  }
  if (Object.prototype.hasOwnProperty.call(dict, trimmed)) {
    return value.replace(trimmed, dict[trimmed]);
  }
  let match = trimmed.match(/^(.+?) \((.+?)\)에서 제공되는 Bible\.com 역본입니다\. 사용할 역본을 선택하세요\.$/);
  if (match) {
    if (language === "en") return `Bible.com translations available in ${match[1]} (${match[2]}). Choose a translation.`;
    if (language === "zh") return `${match[1]}（${match[2]}）提供的 Bible.com 译本。请选择要使用的译本。`;
    if (language === "ja") return `${match[1]}（${match[2]}）で利用できる Bible.com の聖書訳です。使用する訳を選択してください。`;
  }
  match = trimmed.match(/^(.+) 무결성 검사 실행$/);
  if (match) {
    if (language === "en") return `Run integrity check for ${match[1]}`;
    if (language === "zh") return `检查 ${match[1]} 的完整性`;
    if (language === "ja") return `${match[1]} の整合性を確認`;
  }
  match = trimmed.match(/^(.+) 오프라인 다운로드$/);
  if (match) {
    if (language === "en") return `Download ${match[1]} for offline use`;
    if (language === "zh") return `下载 ${match[1]} 以供离线使用`;
    if (language === "ja") return `${match[1]} をオフライン用にダウンロード`;
  }
  match = trimmed.match(/^(.+) 저장됨 · 누락된 장 확인 및 이어받기$/);
  if (match) {
    if (language === "en") return `${match[1]} saved · check missing chapters or resume`;
    if (language === "zh") return `${match[1]} 已保存 · 检查缺失章节或继续下载`;
    if (language === "ja") return `${match[1]} 保存済み · 欠落章を確認して再開`;
  }
  match = trimmed.match(/^(.+) 파일로 브라우저 저장소에 다운로드$/);
  if (match) {
    if (language === "en") return `Save ${match[1]} for offline use`;
    if (language === "zh") return `保存 ${match[1]} 以供离线使用`;
    if (language === "ja") return `${match[1]} をオフライン用に保存`;
  }
  match = trimmed.match(/^(.+) 다운로드 진행률$/);
  if (match) {
    if (language === "en") return `${match[1]} download progress`;
    if (language === "zh") return `${match[1]} 下载进度`;
    if (language === "ja") return `${match[1]} のダウンロード進捗`;
  }

  match = trimmed.match(/^📖 (.+) 장 선택$/);
  if (match) {
    if (language === "en") return `📖 Select chapter: ${match[1]}`;
    if (language === "zh") return `📖 选择章节：${match[1]}`;
    if (language === "ja") return `📖 ${match[1]}：章を選択`;
  }
  match = trimmed.match(/^(.+) 장 선택$/);
  if (match) {
    if (language === "en") return `Select chapter: ${match[1]}`;
    if (language === "zh") return `选择章节：${match[1]}`;
    if (language === "ja") return `${match[1]}：章を選択`;
  }
  match = trimmed.match(/^📖 (.+) (\d+)장 절 선택$/);
  if (match) {
    if (language === "en")
      return `📖 Select a verse in ${match[1]}, chapter ${match[2]}`;
    if (language === "zh") return `📖 选择${match[1]}第${match[2]}章的经节`;
    if (language === "ja") return `📖 ${match[1]} 第${match[2]}章の節を選択`;
  }
  match = trimmed.match(/^(.+) (\d+)장 절 선택$/);
  if (match) {
    if (language === "en")
      return `Select a verse in ${match[1]}, chapter ${match[2]}`;
    if (language === "zh") return `选择${match[1]}第${match[2]}章的经节`;
    if (language === "ja") return `${match[1]} 第${match[2]}章の節を選択`;
  }
  match = trimmed.match(/^(.+) (\d+)장 (\d+)절 선택$/);
  if (match) {
    if (language === "en") return `Select ${match[1]} ${match[2]}:${match[3]}`;
    if (language === "zh") return `选择${match[1]} ${match[2]}章${match[3]}节`;
    if (language === "ja")
      return `${match[1]} ${match[2]}章${match[3]}節を選択`;
  }
  match = trimmed.match(/^(.+) (\d+)장 선택$/);
  if (match) {
    if (language === "en") return `Select chapter ${match[2]} of ${match[1]}`;
    if (language === "zh") return `选择${match[1]}第${match[2]}章`;
    if (language === "ja") return `${match[1]}の第${match[2]}章を選択`;
  }
  match = trimmed.match(/^(\d+)장$/);
  if (match) {
    if (language === "en") return `Chapter ${match[1]}`;
    if (language === "zh") return `第${match[1]}章`;
    if (language === "ja") return `${match[1]}章`;
  }
  match = trimmed.match(/^(\d+)절$/);
  if (match) {
    if (language === "en") return `Verse ${match[1]}`;
    if (language === "zh") return `第${match[1]}节`;
    if (language === "ja") return `${match[1]}節`;
  }
  match = trimmed.match(/^(.+) 선택$/);
  if (match) {
    if (language === "en") return `Select ${match[1]}`;
    if (language === "zh") return `选择${match[1]}`;
    if (language === "ja") return `${match[1]}を選択`;
  }
  match = trimmed.match(/^\[(.+)\] 다음 구절 \((셔플|순차)\)$/);
  if (match) {
    const mode =
      language === "en"
        ? match[2] === "셔플"
          ? "shuffle"
          : "sequential"
        : language === "zh"
          ? match[2] === "셔플"
            ? "随机播放"
            : "顺序播放"
          : match[2] === "셔플"
            ? "シャッフル"
            : "順番再生";
    return language === "en"
      ? `[${match[1]}] Next verse (${mode})`
      : language === "zh"
        ? `[${match[1]}] 下一节（${mode}）`
        : `[${match[1]}] 次の節（${mode}）`;
  }
  match = trimmed.match(
    /^배경 이미지 해상도가 \[(.+)\] \(으\)로 설정되었습니다\.$/,
  );
  if (match)
    return language === "en"
      ? `Background image resolution set to [${match[1]}].`
      : language === "zh"
        ? `背景图像分辨率已设为 [${match[1]}]。`
        : `背景画像の解像度を [${match[1]}] に設定しました。`;

  return value;
}

function localizeUITree(root) {
  if (!root) return;
  const elements = [
    root,
    ...(root.querySelectorAll ? root.querySelectorAll("*") : []),
  ];
  for (const element of elements) {
    for (const attribute of [
      "title",
      "aria-label",
      "data-tip",
      "placeholder",
    ]) {
      if (!element.hasAttribute?.(attribute)) continue;
      let cache = UI_ATTRIBUTE_ORIGINALS.get(element);
      if (!cache) {
        cache = new Map();
        UI_ATTRIBUTE_ORIGINALS.set(element, cache);
      }
      const current = element.getAttribute(attribute);
      const record = cache.get(attribute);
      const source =
        record && current === record.translated ? record.source : current;
      const translated = translateUIString(source);
      cache.set(attribute, { source, translated });
      if (current !== translated) element.setAttribute(attribute, translated);
    }
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    let source = node.nodeValue;
    const record = UI_NODE_ORIGINALS.get(node);
    if (record && source === record.translated) source = record.source;
    const translated = translateUIString(source);
    UI_NODE_ORIGINALS.set(node, { source, translated });
    if (node.nodeValue !== translated) node.nodeValue = translated;
  }
}

function applyUILanguage() {
  const language = getUILanguage();
  document.documentElement.lang = language;
  localizeUITree(document.getElementById("bibleControlBar"));

  const modal = document.getElementById("bibleModal");
  if (modal && !modal.classList.contains("hidden")) localizeUITree(modal);
  const fontPreviewModal = document.getElementById("fontPreviewModal");
  if (fontPreviewModal && !fontPreviewModal.hidden)
    localizeUITree(fontPreviewModal);
  updateFontPreviewSelectionUI();
  const downloadFloat = document.getElementById("bibleDownloadFloat");
  if (downloadFloat) {
    localizeUITree(downloadFloat);
    if (activeBibleDownloadJobs.size) updateBibleDownloadFloatingWidget(activeBibleDownloadJob);
  }
}

export function getImageResolution() {
  const saved = localStorage.getItem("bg_image_resolution") || "4K";

  if (!["1K", "2K", "4K"].includes(saved)) {
    try {
      localStorage.setItem("bg_image_resolution", "4K");
    } catch {}
    return "4K";
  }
  return saved;
}

export function setImageResolution(resolution) {
  localStorage.setItem("bg_image_resolution", resolution);
}

export function getResolutionDimensions(resolution) {
  switch (resolution) {
    case "1K":
      return { width: 1920, height: 1080 };
    case "2K":
      return { width: 2560, height: 1440 };
    case "4K":
      return { width: 3840, height: 2160 };
    default:
      return { width: 3840, height: 2160 };
  }
}

const emojiTagMap = {
  "🙏": "기도/간구",
  "✝️": "십자가/구원",
  "🕊️": "성령/평안",
  "📖": "말씀/묵상",
  "✨": "은혜/영광",
  "🔥": "성령의 불/열정",
  "💧": "생명수/정결",
  "❤️": "사랑/감사",
  "🌟": "축복/인도",
  "💡": "진리/지혜",
  "🌿": "회복/성장",
  "⚓": "소망/믿음",
};

const bibleBookOrder = {
  창세기: 1,
  출애굽기: 2,
  레위기: 3,
  민수기: 4,
  신명기: 5,
  여호수아: 6,
  사사기: 7,
  룻기: 8,
  사무엘상: 9,
  사무엘하: 10,
  열왕기상: 11,
  열왕기하: 12,
  역대상: 13,
  역대하: 14,
  에스라: 15,
  느헤미야: 16,
  에스더: 17,
  욥기: 18,
  시편: 19,
  잠언: 20,
  전도서: 21,
  아가: 22,
  이사야: 23,
  예레미야: 24,
  예레미야애가: 25,
  에스겔: 26,
  다니엘: 27,
  호세아: 28,
  요엘: 29,
  아모스: 30,
  오바댜: 31,
  요나: 32,
  미가: 33,
  나훔: 34,
  하박국: 35,
  스바냐: 36,
  학개: 37,
  스가랴: 38,
  말라기: 39,
  마태복음: 40,
  마가복음: 41,
  누가복음: 42,
  요한복음: 43,
  사도행전: 44,
  로마서: 45,
  고린도전서: 46,
  고린도후서: 47,
  갈라디아서: 48,
  에베소서: 49,
  빌립보서: 50,
  골로새서: 51,
  데살로니가전서: 52,
  데살로니가후서: 53,
  디모데전서: 54,
  디모데후서: 55,
  디도서: 56,
  빌레몬서: 57,
  히브리서: 58,
  야고보서: 59,
  베드로전서: 60,
  베드로후서: 61,
  요한일서: 62,
  요한이서: 63,
  요한삼서: 64,
  유다서: 65,
  요한계시록: 66,
};

const bibleBookMap = {
  창: "창세기",
  출: "출애굽기",
  레: "레위기",
  민: "민수기",
  신: "신명기",
  수: "여호수아",
  삿: "사사기",
  룻: "룻기",
  삼상: "사무엘상",
  삼하: "사무엘하",
  왕상: "열왕기상",
  왕하: "열왕기하",
  대상: "역대상",
  대하: "역대하",
  스: "에스라",
  느: "느헤미야",
  에: "에스더",
  욥: "욥기",
  시: "시편",
  잠: "잠언",
  전: "전도서",
  아: "아가",
  사: "이사야",
  렘: "예레미야",
  애: "예레미야애가",
  겔: "에스겔",
  단: "다니엘",
  호: "호세아",
  욜: "요엘",
  암: "아모스",
  옵: "오바댜",
  욘: "요나",
  미: "미가",
  나: "나훔",
  합: "하박국",
  습: "스바냐",
  학: "학개",
  슥: "스가랴",
  말: "말라기",
  마: "마태복음",
  막: "마가복음",
  눅: "누가복음",
  요: "요한복음",
  행: "사도행전",
  롬: "로마서",
  고전: "고린도전서",
  고후: "고린도후서",
  갈: "갈라디아서",
  엡: "에베소서",
  빌: "빌립보서",
  골: "골로새서",
  살전: "데살로니가전서",
  살후: "데살로니가후서",
  딤전: "디모데전서",
  딤후: "디모데후서",
  딛: "디도서",
  몬: "빌레몬서",
  히: "히브리서",
  약: "야고보서",
  벧전: "베드로전서",
  벧후: "베드로후서",
  요일: "요한일서",
  요이: "요한이서",
  요삼: "요한삼서",
  유: "유다서",
  계: "요한계시록",
};

function escapeBibleHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

function isOnlineBibleTranslationActive() {
  return (
    currentBibleTranslation?.type === "api" && Boolean(activeOnlineChapter)
  );
}

const CANONICAL_API_BOOK_IDS = [
  "GEN",
  "EXO",
  "LEV",
  "NUM",
  "DEU",
  "JOS",
  "JDG",
  "RUT",
  "1SA",
  "2SA",
  "1KI",
  "2KI",
  "1CH",
  "2CH",
  "EZR",
  "NEH",
  "EST",
  "JOB",
  "PSA",
  "PRO",
  "ECC",
  "SNG",
  "ISA",
  "JER",
  "LAM",
  "EZK",
  "DAN",
  "HOS",
  "JOL",
  "AMO",
  "OBA",
  "JON",
  "MIC",
  "NAM",
  "HAB",
  "ZEP",
  "HAG",
  "ZEC",
  "MAL",
  "MAT",
  "MRK",
  "LUK",
  "JHN",
  "ACT",
  "ROM",
  "1CO",
  "2CO",
  "GAL",
  "EPH",
  "PHP",
  "COL",
  "1TH",
  "2TH",
  "1TI",
  "2TI",
  "TIT",
  "PHM",
  "HEB",
  "JAS",
  "1PE",
  "2PE",
  "1JN",
  "2JN",
  "3JN",
  "JUD",
  "REV",
];
const CANONICAL_API_BOOK_ORDER = new Map(
  CANONICAL_API_BOOK_IDS.map((id, index) => [id, index + 1]),
);

function getCanonicalOrderForApiBook(book) {
  const id = String(book?.id || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const canonicalOrder = CANONICAL_API_BOOK_ORDER.get(id);
  if (canonicalOrder) return canonicalOrder;
  const fallbackOrder = Number(book?.order);
  return !book?.isApocryphal && fallbackOrder >= 1 && fallbackOrder <= 66
    ? fallbackOrder
    : 0;
}

function getBookAbbrByOrder(order) {
  const numericOrder = Number(order);
  const entry = Object.entries(bibleBookMap).find(
    ([, fullName]) => bibleBookOrder[fullName] === numericOrder,
  );
  return entry ? entry[0] : null;
}

function getBookOrderByAbbr(abbr) {
  const fullName = bibleBookMap[abbr] || abbr;
  return bibleBookOrder[fullName] || 999;
}

function getBibleBookSelectionTooltip(bookName) {
  const language = getUILanguage();
  if (language === "en") return `Select ${bookName}`;
  if (language === "zh") return `选择${bookName}`;
  if (language === "ja") return `${bookName}を選択`;
  return `${bookName} 선택`;
}

function getBibleBookDisplayName(abbr) {
  const order = getBookOrderByAbbr(abbr);
  if (isOnlineBibleTranslationActive()) {
    const apiBook = activeTranslationBooks.find(
      (book) => Number(book.canonicalOrder ?? book.order) === order,
    );
    if (apiBook)
      return apiBook.commonName || apiBook.name || bibleBookMap[abbr] || abbr;
  }

  if (
    currentBibleTranslation?.type === "offline" &&
    order >= 1 &&
    order <= 66
  ) {
    const languageTag = String(
      currentBibleTranslation.language || "",
    )
      .trim()
      .toLowerCase()
      .replace(/_/g, "-");
    const languageCode = languageTag.split("-")[0];
    const index = order - 1;

    if (["en", "eng"].includes(languageCode) && OFFLINE_ENGLISH_BOOK_NAMES[index]) {
      return OFFLINE_ENGLISH_BOOK_NAMES[index];
    }
    if (["ja", "jpn"].includes(languageCode) && OFFLINE_JAPANESE_BOOK_NAMES[index]) {
      return OFFLINE_JAPANESE_BOOK_NAMES[index].split("|")[0];
    }
    if (["zh", "zho", "chi"].includes(languageCode) && OFFLINE_CHINESE_BOOK_NAMES[index]) {
      const names = OFFLINE_CHINESE_BOOK_NAMES[index].split("|");
      const isTraditionalChinese = /^(zh-(tw|hk|mo|hant))$/i.test(languageTag);
      return isTraditionalChinese ? names[1] || names[0] : names[0];
    }
  }
  return bibleBookMap[abbr] || abbr;
}

function getBibleApiLanguageCode(translation) {
  return String(translation?.language || translation?.languageCode || "und")
    .trim()
    .toLowerCase();
}

function unwrapBibleComPayload(payload) {
  return (
    payload?.response?.data ||
    payload?.response ||
    payload?.data ||
    payload ||
    {}
  );
}

function bibleComHttpError(status, url) {
  const error = new Error(`Bible.com HTTP ${status} (${url})`);
  error.status = status;
  return error;
}

async function fetchBibleComResponse(url, accept, signal = null) {
  if (signal?.aborted) {
    const error = new Error("Download cancelled.");
    error.name = "AbortError";
    throw error;
  }
  let response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: accept },
      ...(signal ? { signal } : {}),
    });
  } catch (cause) {
    if (cause?.name === "AbortError" || signal?.aborted) throw cause;
    const error = new Error("Bible.com direct request failed. Check the connection and try again.");
    error.cause = cause;
    error.isBibleComConnectionError = true;
    throw error;
  }
  if (!response.ok) {
    const error = bibleComHttpError(response.status, url);
    error.isBibleComConnectionError = true;
    if ([403, 429].includes(response.status)) error.noRetry = true;
    throw error;
  }
  return response;
}

async function fetchBibleComJson(url, signal = null) {
  const response = await fetchBibleComResponse(
    url,
    "application/json, text/plain, */*",
    signal,
  );
  try {
    return await response.json();
  } catch (cause) {
    const error = new Error("Bible.com 응답을 JSON으로 해석하지 못했습니다.");
    error.cause = cause;
    throw error;
  }
}

async function fetchBibleComText(url, signal = null) {
  const response = await fetchBibleComResponse(
    url,
    "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    signal,
  );
  return response.text();
}

function getBibleComLanguageSlug(language) {
  const code = String(
    typeof language === "string" ? language : language?.code || "",
  ).trim();
  const known = {
    ko: "kor",
    en: "eng",
    "en-US": "eng",
    "zh-CN": "chi",
    zh: "chi",
    ja: "jpn",
  };
  return (
    known[code] ||
    String(typeof language === "object" ? language?.languageSlug || code : code)
  );
}

function normalizeBibleComLanguageCatalog(rawLanguages) {
  const byCode = new Map();
  for (const item of rawLanguages) {
    const code = String(
      item?.language_tag ||
        item?.languageTag ||
        item?.language?.language_tag ||
        "",
    ).trim();
    if (!code) continue;
    const nativeNameRaw = String(
      item?.local_name ||
        item?.language_local_name ||
        item?.language?.local_name ||
        item?.language?.name_local ||
        "",
    ).trim();
    const englishNameRaw = String(
      item?.language_name ||
        item?.language_english_name ||
        item?.name ||
        item?.language?.name ||
        "",
    ).trim();
    const knownLabels = {
      ko: { nativeName: "한국어", englishName: "Korean" },
      en: { nativeName: "English", englishName: "English" },
      "en-US": { nativeName: "English", englishName: "English" },
      "zh-CN": {
        nativeName: "中文（简体）",
        englishName: "Chinese (Simplified)",
      },
      zh: { nativeName: "中文", englishName: "Chinese" },
      ja: { nativeName: "日本語", englishName: "Japanese" },
    };
    const nativeName = knownLabels[code]?.nativeName || nativeNameRaw;
    const englishName = knownLabels[code]?.englishName || englishNameRaw;
    const existing = byCode.get(code);
    if (!existing) {
      byCode.set(code, {
        code,
        nativeName: nativeName || englishName || code,
        englishName: englishName || nativeName || code,
        languageSlug: String(
          item?.language_slug ||
            item?.languageSlug ||
            item?.language?.slug ||
            getBibleComLanguageSlug(code),
        ),
        defaultVersionId: item?.id != null ? String(item.id) : "",
        source: "bible.com",
      });
    } else if (!existing.nativeName && nativeName) {
      existing.nativeName = nativeName;
    }
  }

  const fallbacks = [
    {
      code: "ko",
      nativeName: "한국어",
      englishName: "Korean",
      languageSlug: "kor",
    },
    {
      code: "en",
      nativeName: "English",
      englishName: "English",
      languageSlug: "eng",
    },
    {
      code: "zh-CN",
      nativeName: "中文（简体）",
      englishName: "Chinese (Simplified)",
      languageSlug: "chi",
    },
    {
      code: "ja",
      nativeName: "日本語",
      englishName: "Japanese",
      languageSlug: "jpn",
    },
  ];
  for (const item of fallbacks)
    if (!byCode.has(item.code))
      byCode.set(item.code, {
        ...item,
        defaultVersionId: "",
        source: "bible.com",
      });
  return [...byCode.values()].sort((a, b) =>
    String(a.nativeName || a.englishName).localeCompare(
      String(b.nativeName || b.englishName),
      undefined,
      { sensitivity: "base" },
    ),
  );
}

async function getOnlineTranslationCatalog() {
  if (onlineTranslationCatalog) return onlineTranslationCatalog;
  if (!onlineTranslationCatalogPromise) {
    onlineTranslationCatalogPromise = (async () => {
      const payload = await fetchBibleComJson(
        `${BIBLE_COM_API_BASE}/configuration`,
      );
      const data = unwrapBibleComPayload(payload);
      const defaults = Array.isArray(data?.default_versions)
        ? data.default_versions
        : [];
      if (!defaults.length)
        throw new Error(
          "Bible.com configuration did not contain default_versions.",
        );
      onlineTranslationCatalog = normalizeBibleComLanguageCatalog(defaults);
      return onlineTranslationCatalog;
    })().catch((error) => {
      onlineTranslationCatalogPromise = null;
      onlineTranslationCatalog = null;
      throw error;
    });
  }
  return onlineTranslationCatalogPromise;
}

function parseBibleComYearValue(value) {
  if (
    Number.isInteger(value) &&
    value >= 1450 &&
    value <= new Date().getFullYear() + 1
  )
    return value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  const match = text.match(/\b(14[5-9]\d|1[5-9]\d{2}|20\d{2}|21[0-9]{2})\b/);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1450 && year <= new Date().getFullYear() + 1 ? year : null;
}

function getBibleComReleaseMetadata(version) {
  if (!version || typeof version !== "object")
    return { year: null, source: "" };
  const explicitYearFields = [
    "release_year",
    "releaseYear",
    "publication_year",
    "publicationYear",
    "published_year",
    "publishedYear",
    "edition_year",
    "editionYear",
    "first_publication_year",
    "firstPublicationYear",
    "issued_year",
    "issuedYear",
    "year",
  ];
  for (const field of explicitYearFields) {
    const parsed = parseBibleComYearValue(version[field]);
    if (parsed) return { year: parsed, source: "Bible.com metadata" };
  }
  const dateFields = [
    "release_date",
    "releaseDate",
    "publication_date",
    "publicationDate",
    "published_at",
    "publishedAt",
    "published_date",
    "publishedDate",
    "issued_at",
    "issuedAt",
    "issued_date",
    "issuedDate",
  ];
  for (const field of dateFields) {
    const parsed = parseBibleComYearValue(version[field]);
    if (parsed) return { year: parsed, source: "Bible.com metadata" };
  }

  for (const field of [
    "local_title",
    "localized_title",
    "title",
    "english_title",
    "name",
  ]) {
    const parsed = parseBibleComYearValue(version[field]);
    if (parsed) return { year: parsed, source: "Edition title" };
  }
  return { year: null, source: "" };
}

function getWikidataLanguageTag(value) {
  const code = String(value || "en")
    .trim()
    .replace(/_/g, "-");
  const match = code.match(/^([a-z]{2,3})(?:-[A-Za-z0-9]+)?$/i);
  if (!match) return "en";
  const language = match[1].toLowerCase();
  return [
    "en",
    "ko",
    "ja",
    "zh",
    "fr",
    "de",
    "es",
    "pt",
    "ru",
    "ar",
    "hi",
    "id",
    "it",
    "nl",
    "sv",
    "da",
    "no",
    "fi",
    "th",
    "vi",
    "tl",
  ].includes(language)
    ? language
    : "en";
}

async function requestWikidataReleaseYearBatch(items) {
  if (!Array.isArray(items) || !items.length) return {};
  const rows = [];
  const seen = new Set();
  for (const item of items.slice(0, 100)) {
    const versionId = String(item?.id || "");
    if (!/^\d{1,12}$/.test(versionId)) continue;
    const candidates = Array.isArray(item?.candidates) ? item.candidates.slice(0, 4) : [];
    for (const candidate of candidates) {
      const label = String(candidate?.value || "").trim();
      let lang = String(candidate?.lang || "en").trim().toLowerCase();
      let rank = Number.parseInt(candidate?.rank, 10);
      if (!label || label.length < 2 || label.length > 180) continue;
      if (!/^[a-z]{2,3}$/.test(lang)) lang = "en";
      if (!Number.isInteger(rank) || rank < 0 || rank > 9) rank = 9;
      const key = `${versionId}\u0000${label}\u0000${lang}\u0000${rank}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ versionId, label, lang, rank });
    }
  }
  if (!rows.length) return {};

  const values = rows.map(({ versionId, label, lang, rank }) =>
    `(${JSON.stringify(versionId)} ${JSON.stringify(label)}@${lang} ${rank})`,
  ).join("\n");
  const query = `PREFIX wdt: <http://www.wikidata.org/prop/direct/>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\nPREFIX skos: <http://www.w3.org/2004/02/skos/core#>\nSELECT ?versionId ?needleLiteral ?rank ?item (MIN(YEAR(?publicationDate)) AS ?publicationYear) WHERE {\n  VALUES (?versionId ?needleLiteral ?rank) {\n${values}\n  }\n  ?item (rdfs:label|skos:altLabel) ?needleLiteral .\n  ?item wdt:P577 ?publicationDate .\n} GROUP BY ?versionId ?needleLiteral ?rank ?item\nLIMIT 1500`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch("https://query.wikidata.org/sparql", {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: new URLSearchParams({ query, format: "json" }).toString(),
    });
    if (!response.ok) throw new Error(`Wikidata Query Service returned HTTP ${response.status}.`);
    const payload = await response.json();
    const results = {};
    const bindings = Array.isArray(payload?.results?.bindings) ? payload.results.bindings : [];
    for (const binding of bindings) {
      const versionId = String(binding?.versionId?.value || "");
      const rawYear = binding?.publicationYear?.value;
      const itemUrl = String(binding?.item?.value || "");
      const matchedLabel = String(binding?.needleLiteral?.value || "");
      const rank = Number.parseInt(binding?.rank?.value, 10);
      const year = Number.parseInt(rawYear, 10);
      if (!/^\d{1,12}$/.test(versionId)) continue;
      if (!Number.isInteger(year) || year < 1450 || year > new Date().getFullYear() + 1) continue;
      if (!/^https:\/\/www\.wikidata\.org\/entity\/Q\d+$/.test(itemUrl)) continue;
      const normalizedRank = Number.isInteger(rank) ? rank : 9;
      const existing = results[versionId];
      if (!existing || normalizedRank < existing.rank || (normalizedRank === existing.rank && year < existing.year)) {
        results[versionId] = {
          year,
          rank: normalizedRank,
          url: itemUrl,
          matchedLabel,
          source: "Wikidata (P577)",
        };
      }
    }
    for (const entry of Object.values(results)) delete entry.rank;
    return results;
  } finally {
    clearTimeout(timeoutId);
  }
}

const WIKIDATA_RELEASE_YEAR_CACHE_KEY = "spotlight_bible_release_year_cache_v1";

function readWikidataReleaseYearCache() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(WIKIDATA_RELEASE_YEAR_CACHE_KEY) || "{}",
    );
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function writeWikidataReleaseYearCache(cache) {
  try {
    localStorage.setItem(
      WIKIDATA_RELEASE_YEAR_CACHE_KEY,
      JSON.stringify(cache),
    );
  } catch (error) {
    console.info("Could not save publication-year metadata cache.", error);
  }
}

function getWikidataReleaseCacheKey(version) {
  return `${String(version?.id || "")}|${String(version?.languageTag || version?.languageCode || "")}|${String(version?.localTitle || version?.name || "")}`.toLocaleLowerCase();
}

async function enrichBibleComReleaseYears(versions) {
  const savedCache = readWikidataReleaseYearCache();
  const missing = [];
  for (const version of versions) {
    if (Number.isInteger(version.releaseYear)) continue;
    const cached = savedCache[getWikidataReleaseCacheKey(version)];
    const cachedYear = Number(cached?.year);
    if (
      Number.isInteger(cachedYear) &&
      cachedYear >= 1450 &&
      cachedYear <= new Date().getFullYear() + 1
    ) {
      version.releaseYear = cachedYear;
      version.releaseYearSource = String(cached.source || "Wikidata (P577)");
      version.releaseYearUrl = String(cached.url || "");
    } else {
      missing.push(version);
    }
  }
  if (!missing.length) return versions;
  const chunkSize = 100;
  for (let offset = 0; offset < missing.length; offset += chunkSize) {
    const chunk = missing.slice(offset, offset + chunkSize);
    const items = chunk
      .map((version) => {
        const localLang = getWikidataLanguageTag(
          version.languageTag || version.languageCode || "en",
        );
        const candidates = [];
        const add = (value, lang, rank) => {
          const label = String(value || "").trim();
          if (!label || label.length < 2 || label.length > 180) return;
          if (
            candidates.some(
              (candidate) =>
                candidate.value.toLocaleLowerCase() ===
                  label.toLocaleLowerCase() && candidate.lang === lang,
            )
          )
            return;
          candidates.push({ value: label, lang, rank });
        };
        add(version.localTitle, localLang, 0);
        add(version.englishName, "en", 1);
        const abbreviation = version.shortName || version.abbreviation;
        add(abbreviation, "en", 2);
        if (localLang !== "en") add(abbreviation, localLang, 3);
        return { id: String(version.id), candidates };
      })
      .filter((item) => item.candidates.length);
    if (!items.length) continue;
    let metadata = {};
    try {
      metadata = await requestWikidataReleaseYearBatch(items);
    } catch (error) {
      console.debug("Optional Wikidata publication-year lookup was unavailable.", error);
    }
    for (const version of chunk) {
      const entry = metadata[String(version.id)];
      const year = Number(entry?.year);
      if (
        Number.isInteger(year) &&
        year >= 1450 &&
        year <= new Date().getFullYear() + 1
      ) {
        version.releaseYear = year;
        version.releaseYearSource = "Wikidata (P577)";
        version.releaseYearUrl =
          /^https:\/\/www\.wikidata\.org\/entity\/Q\d+$/.test(
            String(entry.url || ""),
          )
            ? String(entry.url).replace("/entity/", "/wiki/")
            : "https://www.wikidata.org/wiki/Special:Search?search=" +
              encodeURIComponent(
                version.englishName ||
                  version.localTitle ||
                  version.shortName ||
                  "Bible translation",
              );
        savedCache[getWikidataReleaseCacheKey(version)] = {
          year: version.releaseYear,
          source: version.releaseYearSource,
          url: version.releaseYearUrl,
          cachedAt: new Date().toISOString(),
        };
      }
    }
  }
  writeWikidataReleaseYearCache(savedCache);
  return versions;
}

async function getBibleComVersionsForLanguage(language) {
  const languageInfo =
    typeof language === "string"
      ? { code: language, nativeName: language, englishName: language }
      : language;
  const languageCode = String(languageInfo?.code || "").trim();
  if (!languageCode) throw new Error("Missing Bible.com language tag.");
  if (onlineTranslationVersionsCache.has(languageCode))
    return onlineTranslationVersionsCache.get(languageCode);
  const promise = (async () => {
    const aliases = {
      "zh-CN": ["zh-CN", "zh", "zh-Hans"],
      zh: ["zh", "zh-CN", "zh-Hans"],
      en: ["en", "en-US"],
      "en-US": ["en-US", "en"],
    };
    let rawVersions = [];
    let resolvedLanguageCode = languageCode;
    for (const candidateCode of aliases[languageCode] || [languageCode]) {
      const url = `${BIBLE_COM_API_BASE}/versions?language_tag=${encodeURIComponent(candidateCode)}&type=all`;
      const payload = await fetchBibleComJson(url);
      const data = unwrapBibleComPayload(payload);
      rawVersions = Array.isArray(data?.versions) ? data.versions : [];
      if (rawVersions.length) {
        resolvedLanguageCode = candidateCode;
        break;
      }
    }
    const versions = rawVersions
      .filter(
        (version) => version?.id != null && /^\d+$/.test(String(version.id)),
      )
      .map((version) => {
        const id = String(version.id);
        const localTitle = String(
          version.local_title ||
            version.localized_title ||
            version.name ||
            version.title ||
            id,
        ).trim();
        const englishTitle = String(
          version.title || version.english_title || version.name || localTitle,
        ).trim();
        const abbreviation = String(
          version.abbreviation ||
            version.local_abbreviation ||
            version.localized_abbreviation ||
            id,
        ).trim();
        const publisherObject =
          version.publisher && typeof version.publisher === "object"
            ? version.publisher
            : {};
        const organizationObject =
          version.organization && typeof version.organization === "object"
            ? version.organization
            : {};
        const publisher =
          [
            typeof version.publisher === "string" ? version.publisher : "",
            version.publisher_name,
            publisherObject.local_name,
            publisherObject.name,
            publisherObject.title,
            version.organization_name,
            organizationObject.local_name,
            organizationObject.name,
            version.owner_name,
          ]
            .find((value) => typeof value === "string" && value.trim())
            ?.trim() || "";
        const releaseMetadata = getBibleComReleaseMetadata(version);
        return {
          ...version,
          id,
          bibleComId: id,
          type: "api",
          source: "bible.com",
          language: String(version.language_tag || resolvedLanguageCode),
          languageTag: String(version.language_tag || resolvedLanguageCode),
          languageCode,
          languageName: languageInfo.nativeName || languageCode,
          languageEnglishName: languageInfo.englishName || languageCode,
          name: localTitle,
          localTitle,
          englishName: englishTitle,
          shortName: abbreviation,
          abbreviation,
          publisherName: publisher || "Bible.com / YouVersion",
          releaseYear: releaseMetadata.year,
          releaseYearSource: releaseMetadata.source,
          releaseYearUrl: "",
          website: `${BIBLE_COM_BASE}/versions/${id}`,
          licenseUrl: version.license_url || version.publisher_url || "",
        };
      });
    if (!versions.length)
      throw new Error(
        `Bible.com returned no translations for language ${languageCode}.`,
      );
    await enrichBibleComReleaseYears(versions);
    return versions;
  })().catch((error) => {
    onlineTranslationVersionsCache.delete(languageCode);
    throw error;
  });
  onlineTranslationVersionsCache.set(languageCode, promise);
  return promise;
}

async function getBibleComVersionMetadata(translationId) {
  const id = String(translationId || "");
  if (!/^\d+$/.test(id)) throw new Error("Invalid Bible.com version ID.");
  if (onlineTranslationMetadataCache.has(id))
    return onlineTranslationMetadataCache.get(id);
  const promise = (async () => {
    const payload = await fetchBibleComJson(
      `${BIBLE_COM_NODE_API_BASE}/version/3.3?id=${encodeURIComponent(id)}`,
    );
    const metadata = unwrapBibleComPayload(payload);
    if (!Array.isArray(metadata?.books) || !metadata.books.length) {
      throw new Error(
        "Bible.com version metadata did not include a book index.",
      );
    }
    return metadata;
  })().catch((error) => {
    onlineTranslationMetadataCache.delete(id);
    throw error;
  });
  onlineTranslationMetadataCache.set(id, promise);
  return promise;
}

async function getOnlineTranslationBooks(translationId) {
  const id = String(
    typeof translationId === "object" ? translationId?.id : translationId || "",
  );
  if (!/^\d+$/.test(id)) throw new Error("Invalid Bible.com translation ID.");
  if (onlineTranslationBooksCache.has(id))
    return onlineTranslationBooksCache.get(id);
  const promise = (async () => {
    const metadata = await getBibleComVersionMetadata(id);
    const rawBooks = Array.isArray(metadata.books) ? metadata.books : [];
    const books = rawBooks
      .map((book, index) => {
        const bookId = String(
          book?.usfm || book?.id || book?.abbreviation || "",
        )
          .trim()
          .toUpperCase();
        const canonicalOrder = CANONICAL_API_BOOK_ORDER.get(bookId) || 0;
        const rawChapters = Array.isArray(book?.chapters) ? book.chapters : [];
        const chapterPairs = rawChapters
          .map((chapter, chapterIndex) => {
            const usfm = String(
              chapter?.usfm || chapter?.passage_id || chapter?.id || "",
            ).trim();
            const rawNum = usfm.includes(".")
              ? usfm.split(".").pop()
              : (chapter?.number ?? chapter?.title ?? chapterIndex + 1);
            const number = Number(String(rawNum).match(/^\d+/)?.[0]);
            return { number, usfm: usfm || `${bookId}.${number}` };
          })
          .filter((item) => Number.isInteger(item.number) && item.number > 0);
        const chapterNumbers = [
          ...new Set(chapterPairs.map((item) => item.number)),
        ].sort((a, b) => a - b);
        const chapterRefs = chapterPairs
          .sort((a, b) => a.number - b.number)
          .filter(
            (item, idx, list) =>
              idx === 0 || item.number !== list[idx - 1].number,
          )
          .map((item) => item.usfm);
        return {
          ...book,
          id: bookId,
          usfm: bookId,
          order: canonicalOrder || index + 1,
          canonicalOrder,
          name: String(book?.human || book?.name || book?.title || bookId),
          commonName: String(
            book?.human || book?.human_long || book?.name || bookId,
          ),
          fullName: String(
            book?.human_long || book?.human || book?.name || bookId,
          ),
          chapterNumbers,
          chapterRefs,
          numberOfChapters:
            chapterNumbers.length || Number(book?.number_of_chapters) || 0,
          firstChapterNumber: chapterNumbers[0] || 1,
          lastChapterNumber:
            chapterNumbers[chapterNumbers.length - 1] ||
            Number(book?.number_of_chapters) ||
            1,
          isApocryphal:
            String(book?.canon || "")
              .toLowerCase()
              .includes("deuterocanon") || !canonicalOrder,
        };
      })
      .filter(
        (book) =>
          book.canonicalOrder > 0 && getBookAbbrByOrder(book.canonicalOrder),
      );
    if (!books.length)
      throw new Error("No canonical Bible books were returned by Bible.com.");
    return books;
  })().catch((error) => {
    onlineTranslationBooksCache.delete(id);
    throw error;
  });
  onlineTranslationBooksCache.set(id, promise);
  return promise;
}

async function getBibleComBuildId(signal = null) {
  if (signal?.aborted) { const error = new Error("Download cancelled."); error.name = "AbortError"; throw error; }
  if (bibleComBuildId) return bibleComBuildId;

  if (signal) {
    const html = await fetchBibleComText(`${BIBLE_COM_BASE}/`, signal);
    const match = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
    if (!match) throw new Error("Could not find Bible.com Next.js page metadata.");
    const data = JSON.parse(match[1]);
    const buildId = String(data?.buildId || "");
    if (!buildId) throw new Error("Bible.com did not publish a page build ID.");
    bibleComBuildId = buildId;
    return buildId;
  }
  if (!bibleComBuildIdPromise) {
    bibleComBuildIdPromise = (async () => {
      const html = await fetchBibleComText(`${BIBLE_COM_BASE}/`);
      const match = html.match(
        /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
      );
      if (!match)
        throw new Error("Could not find Bible.com Next.js page metadata.");
      const data = JSON.parse(match[1]);
      const buildId = String(data?.buildId || "");
      if (!buildId)
        throw new Error("Bible.com did not publish a page build ID.");
      bibleComBuildId = buildId;
      return buildId;
    })().catch((error) => {
      bibleComBuildIdPromise = null;
      throw error;
    });
  }
  return bibleComBuildIdPromise;
}

const BIBLE_ANNOTATION_SELECTOR = [
  "sup",
  "[role='doc-noteref']",
  "[data-footnote]",
  "[data-footnote-marker]",
  "[data-cross-reference]",
  "[data-xref]",
  "[data-testid*='footnote' i]",
  "[aria-label*='footnote' i]",
  "[aria-label*='cross reference' i]",
  "[class*='footnote' i]",
  "[class*='crossref' i]",
  "[class*='cross-ref' i]",
  "[class*='crossreference' i]",
  "[class*='note-marker' i]",
  "[class*='notemarker' i]",
  "[class*='versenumber' i]",
  "[class*='verse-number' i]",
  "[data-verse-number]",
  "a[href*='footnote' i]",
  "a[href*='crossref' i]",
  "a[href*='cross-reference' i]",
  "a[href*='reference' i]",
].join(",");

function removeBibleAnnotations(root, removeNestedVerseMarkers = false) {
  if (!root?.querySelectorAll) return;
  root
    .querySelectorAll("script, style, noscript, template")
    .forEach((node) => node.remove());
  try {
    root
      .querySelectorAll(BIBLE_ANNOTATION_SELECTOR)
      .forEach((node) => node.remove());
  } catch {}

  if (removeNestedVerseMarkers)
    root.querySelectorAll("[data-usfm]").forEach((node) => node.remove());
}

function cleanBibleVerseText(rawText, verseNumber = 0) {
  let text = String(rawText ?? "");
  if (typeof DOMParser !== "undefined" && /<\/?[a-z][^>]*>/i.test(text)) {
    const parsed = new DOMParser().parseFromString(
      `<div>${text}</div>`,
      "text/html",
    );
    removeBibleAnnotations(parsed.body);
    text = parsed.body.textContent || "";
  } else {
    text = text
      .replace(
        /<(script|style|sup|footnote|crossref|cross-reference)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
        " ",
      )
      .replace(
        /<([a-z][\w:-]*)\b(?=[^>]*(?:class|data-[\w-]+|aria-label|href)\s*=\s*["'][^"']*(?:footnote|cross.?ref|cross.?reference|note-marker|notemarker)[^"']*["'])[^>]*>[\s\S]*?<\/\1\s*>/gi,
        " ",
      )
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'");
  }
  text = text
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[\u00b9\u00b2\u00b3\u2070-\u2079\u2020\u2021]/g, "")
    .replace(/\[\s*(?:[a-z]|\d{1,3})\s*\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (Number.isInteger(Number(verseNumber)) && Number(verseNumber) > 0) {
    const number = String(Number(verseNumber));
    const prefix = new RegExp(`^${number}(?:\\s*[.)\\]:–-])?\\s+`, "u");
    text = text.replace(prefix, "").trim();
  }

  text = text.replace(/^[\s*†‡]+|[\s*†‡]+$/g, "").trim();
  return text;
}

function parseBibleComChapterContent(content, book, chapter) {
  const abbr = getBookAbbrByOrder(book.canonicalOrder ?? book.order);
  if (!abbr || !content || typeof DOMParser === "undefined") return {};
  const parsed = new DOMParser().parseFromString(String(content), "text/html");
  const verses = {};

  const verseNodes = [...parsed.querySelectorAll("span[data-usfm]")];
  const candidates = verseNodes.length
    ? verseNodes
    : [...parsed.querySelectorAll("[data-usfm]")];
  candidates.forEach((node) => {
    const parts = String(node.getAttribute("data-usfm") || "").split(".");
    if (
      parts.length < 3 ||
      parts[0].toUpperCase() !== String(book.usfm || book.id).toUpperCase()
    )
      return;
    if (Number(parts[1]) !== Number(chapter)) return;
    const verseMatch = String(parts[2]).match(/^\d+/);
    if (!verseMatch) return;
    const verseNumber = Number(verseMatch[0]);
    if (!Number.isInteger(verseNumber) || verseNumber < 1) return;

    const cleanNode = node.cloneNode(true);
    removeBibleAnnotations(cleanNode, true);
    let textParts = [
      ...cleanNode.querySelectorAll(
        "span.content, [class~='content'], [class*='VerseContent_content']",
      ),
    ]
      .map((part) =>
        cleanBibleVerseText(
          part.innerHTML || part.textContent || "",
          verseNumber,
        ),
      )
      .filter(Boolean);
    let verseText = textParts.join(" ").replace(/\s+/g, " ").trim();
    if (!verseText)
      verseText = cleanBibleVerseText(
        cleanNode.innerHTML || cleanNode.textContent || "",
        verseNumber,
      );
    if (!verseText) return;
    const key = `${abbr}${chapter}:${verseNumber}`;
    if (!verses[key]) verses[key] = verseText;
    else if (!verses[key].includes(verseText))
      verses[key] = cleanBibleVerseText(`${verses[key]} ${verseText}`);
  });
  return verses;
}

function getBibleComRouteLanguage(translation) {
  const raw = String(
    translation?.languageCode ||
      translation?.languageTag ||
      translation?.language ||
      "en",
  ).trim();
  const lower = raw.toLowerCase();
  if (lower.startsWith("ko")) return "ko";
  if (lower.startsWith("zh")) return "zh-CN";
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("en")) return "en";
  return raw.replace(/[^a-zA-Z0-9-]/g, "") || "en";
}

function parseBibleComChapterJsonPayload(payload, book, chapter) {
  const pageProps = payload?.pageProps || payload?.props?.pageProps || {};
  const chapterInfo =
    pageProps.chapterInfo || pageProps.chapter || payload?.chapterInfo || null;
  if (!chapterInfo) return {};
  const fromHtml =
    typeof chapterInfo.content === "string"
      ? parseBibleComChapterContent(chapterInfo.content, book, chapter)
      : {};
  if (Object.keys(fromHtml).length) return fromHtml;
  const abbr = getBookAbbrByOrder(book.canonicalOrder ?? book.order);
  const verses = {};
  if (abbr && Array.isArray(chapterInfo.verses)) {
    for (const verse of chapterInfo.verses) {
      const rawNumber =
        verse?.verseNumber ?? verse?.verse_number ?? verse?.number ?? verse?.id;
      const number = Number(String(rawNumber ?? "").match(/^\d+/)?.[0]);
      let content = verse?.content ?? verse?.text ?? verse?.value ?? "";
      if (typeof content !== "string") content = String(content ?? "");
      content = cleanBibleVerseText(content, number);
      if (Number.isInteger(number) && number > 0 && content)
        verses[`${abbr}${chapter}:${number}`] = content;
    }
  }
  return verses;
}

function extractBibleComNextDataFromHtml(html) {
  const match = String(html || "").match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

async function getOnlineChapter(translation, book, chapterNumber, signal = null) {
  if (!translation?.id || !book?.id)
    throw new Error("Missing Bible.com translation or book information.");
  const translationId = String(translation.id);
  if (!/^\d+$/.test(translationId))
    throw new Error("Invalid Bible.com version ID.");
  const chapter = Number(chapterNumber);
  if (!Number.isInteger(chapter) || chapter < 1)
    throw new Error("Invalid chapter number.");
  const cacheKey = `${translationId}:${book.id}:${chapter}`;
  if (signal?.aborted) { const error = new Error("Download cancelled."); error.name = "AbortError"; throw error; }

  if (!signal && onlineChapterCache.has(cacheKey)) {
    const cachedPromise = onlineChapterCache.get(cacheKey);
    onlineChapterCache.delete(cacheKey);
    onlineChapterCache.set(cacheKey, cachedPromise);
    return cachedPromise;
  }

  let promise;
  promise = (async () => {
    const canonicalBookUsfm = String(
      book.usfm && /^[A-Z0-9]{3}$/i.test(String(book.usfm))
        ? book.usfm
        : getBookAbbrByOrder(book.canonicalOrder ?? book.order) ||
            book.id ||
            "",
    )
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9]{3}$/.test(canonicalBookUsfm)) {
      throw new Error(
        `Could not map Bible.com book to a canonical USFM code (book=${String(book.id || book.name || "unknown")}).`,
      );
    }
    const chapterRef = Array.isArray(book.chapterRefs)
      ? book.chapterRefs.find((ref) => {
          const value = String(ref || "")
            .trim()
            .toUpperCase();
          const match = /^([A-Z0-9]{3})\.(\d+)(?:\.\d+)?$/.exec(value);
          return Boolean(
            match &&
            match[1] === canonicalBookUsfm &&
            Number(match[2]) === chapter,
          );
        })
      : null;
    const chapterRefMatch = /^([A-Z0-9]{3})\.(\d+)(?:\.\d+)?$/.exec(
      String(chapterRef || "")
        .trim()
        .toUpperCase(),
    );
    const usfm =
      chapterRefMatch &&
      chapterRefMatch[1] === canonicalBookUsfm &&
      Number(chapterRefMatch[2]) === chapter
        ? `${canonicalBookUsfm}.${chapter}`
        : `${canonicalBookUsfm}.${chapter}`;
    const routeLanguage = getBibleComRouteLanguage(translation);
    const abbreviation = String(
      translation.abbreviation ||
        translation.shortName ||
        translation.local_abbreviation ||
        "",
    )
      .trim()
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
    const routeCandidates = [
      `${BIBLE_COM_BASE}/${encodeURIComponent(routeLanguage)}/bible/${encodeURIComponent(translationId)}/${encodeURIComponent(usfm)}${abbreviation ? `.${encodeURIComponent(abbreviation)}` : ""}`,
      `${BIBLE_COM_BASE}/${encodeURIComponent(routeLanguage)}/bible/${encodeURIComponent(translationId)}/${encodeURIComponent(usfm)}`,
      `${BIBLE_COM_BASE}/bible/${encodeURIComponent(translationId)}/${encodeURIComponent(usfm)}${abbreviation ? `.${encodeURIComponent(abbreviation)}` : ""}`,
      `${BIBLE_COM_BASE}/bible/${encodeURIComponent(translationId)}/${encodeURIComponent(usfm)}`,
    ];
    let pageUrls = [...new Set(routeCandidates)];
    const preferredRouteIndex = onlineChapterRouteIndex.get(translationId);
    if (Number.isInteger(preferredRouteIndex) && routeCandidates[preferredRouteIndex]) {
      const preferred = routeCandidates[preferredRouteIndex];
      pageUrls = [preferred, ...pageUrls.filter((candidate) => candidate !== preferred)];
    }
    let chapterInfo = null;
    let lastError = null;

    for (const url of pageUrls) {
      try {
        const html = await fetchBibleComText(url, signal);
        const verses = parseBibleComChapterContent(html, book, chapter);
        if (Object.keys(verses).length) {
          const successfulRouteIndex = routeCandidates.indexOf(url);
          if (successfulRouteIndex >= 0) onlineChapterRouteIndex.set(translationId, successfulRouteIndex);
          return {
            translationId,
            book,
            chapterNumber: chapter,
            verses,
            translationInfo: translation,
            sourceUrl: url,
          };
        }
        const nextData = extractBibleComNextDataFromHtml(html);
        const jsonVerses = parseBibleComChapterJsonPayload(
          nextData,
          book,
          chapter,
        );
        if (Object.keys(jsonVerses).length) {
          return {
            translationId,
            book,
            chapterNumber: chapter,
            verses: jsonVerses,
            translationInfo: translation,
            sourceUrl: url,
          };
        }
        lastError = new Error(
          `Bible.com chapter HTML loaded but no verse markers were found: ${url}`,
        );
      } catch (error) {
        if (error?.name === "AbortError" || signal?.aborted) throw error;
        lastError = error;
        if (error?.isBibleComConnectionError || error?.noRetry || error?.status === 403 || error?.status === 429) throw error;
        if (
          error?.status !== 400 &&
          error?.status !== 404
        ) {
          console.warn(
            "Bible.com chapter route failed; trying another route.",
            error,
          );
        }
      }
    }

    let buildId = "";
    try {
      buildId = await getBibleComBuildId(signal);
    } catch (error) {
      lastError = new Error(
        `Tried chapter URLs: ${pageUrls.join(" | ")}. Bible.com chapter HTML did not expose usable verse markers; JSON fallback unavailable: ${error?.message || error}`,
      );
    }
    if (buildId && abbreviation) {
      const passage = `${usfm}.${abbreviation}`;
      const baseUrl = `${BIBLE_COM_BASE}/_next/data/${encodeURIComponent(buildId)}/en/bible/${encodeURIComponent(translationId)}/${encodeURIComponent(passage)}.json`;
      const candidates = [
        baseUrl,
        `${baseUrl}?version=${encodeURIComponent(translationId)}&usfm=${encodeURIComponent(passage)}`,
      ];
      for (const url of candidates) {
        try {
          const payload = await fetchBibleComJson(url, signal);
          const pageProps =
            payload?.pageProps || payload?.props?.pageProps || {};
          chapterInfo = pageProps.chapterInfo || null;
          const verses = parseBibleComChapterJsonPayload(
            payload,
            book,
            chapter,
          );
          if (Object.keys(verses).length) {
            return {
              translationId,
              book,
              chapterNumber: chapter,
              verses,
              translationInfo: translation,
              sourceUrl: `${BIBLE_COM_BASE}/${encodeURIComponent(routeLanguage)}/bible/${encodeURIComponent(translationId)}/${encodeURIComponent(passage)}`,
            };
          }
          if (payload?.__N_REDIRECT || pageProps?.__N_REDIRECT) continue;
          lastError = new Error(
            "Bible.com JSON response did not contain parsed chapter text.",
          );
        } catch (error) {
          if (error?.name === "AbortError" || signal?.aborted) throw error;
          lastError = error;
          if (error?.isBibleComConnectionError) throw error;
          if (error?.status !== 400 && error?.status !== 404) throw error;
        }
      }
    } else if (!abbreviation) {
      lastError = new Error(
        "Bible.com did not provide a version abbreviation for its Next.js fallback.",
      );
    }

    const error = new Error(
      `Bible.com did not return usable chapter text for ${translationId}/${usfm}. ${lastError?.message || "No verse data was found."}`,
    );
    error.status =
      lastError?.status === 400 || lastError?.status === 404
        ? 404
        : lastError?.status || 404;
    error.cause = lastError;
    throw error;
  })().catch((error) => {
    if (onlineChapterCache.get(cacheKey) === promise)
      onlineChapterCache.delete(cacheKey);
    throw error;
  });
  if (!signal) onlineChapterCache.set(cacheKey, promise);
  while (!signal && onlineChapterCache.size > MAX_CACHED_ONLINE_CHAPTERS) {
    const oldestKey = onlineChapterCache.keys().next().value;
    if (oldestKey === undefined) break;
    onlineChapterCache.delete(oldestKey);
  }
  return promise;
}

function activateOnlineChapter(chapterRecord) {
  activeOnlineChapter = chapterRecord;
  bibleVerses = chapterRecord.verses;
}

function canonicalBooksForActiveTranslation() {
  return activeTranslationBooks
    .filter((book) => getBookAbbrByOrder(book.canonicalOrder ?? book.order))
    .sort(
      (a, b) =>
        Number(a.canonicalOrder ?? a.order) -
        Number(b.canonicalOrder ?? b.order),
    );
}

function findNearestAvailableBook(books, targetOrder) {
  const canonicalBooks = books
    .filter((book) => getBookAbbrByOrder(book.canonicalOrder ?? book.order))
    .sort(
      (a, b) =>
        Number(a.canonicalOrder ?? a.order) -
        Number(b.canonicalOrder ?? b.order),
    );
  if (!canonicalBooks.length) return null;
  return (
    canonicalBooks.find(
      (book) =>
        Number(book.canonicalOrder ?? book.order) === Number(targetOrder),
    ) ||
    [...canonicalBooks].sort(
      (a, b) =>
        Math.abs(Number(a.canonicalOrder ?? a.order) - Number(targetOrder)) -
        Math.abs(Number(b.canonicalOrder ?? b.order) - Number(targetOrder)),
    )[0]
  );
}

function clampChapterToBook(book, targetChapter) {
  const available = Array.isArray(book?.chapterNumbers)
    ? book.chapterNumbers
        .filter(
          (number) => Number.isInteger(Number(number)) && Number(number) > 0,
        )
        .map(Number)
    : [];
  const target = Math.max(1, Number(targetChapter) || 1);
  if (available.length) {
    return [...available].sort(
      (a, b) => Math.abs(a - target) - Math.abs(b - target) || a - b,
    )[0];
  }
  const first = Math.max(1, Number(book.firstChapterNumber) || 1);
  const last = Math.max(
    first,
    Number(book.lastChapterNumber) || Number(book.numberOfChapters) || first,
  );
  return Math.max(first, Math.min(last, target));
}

function getSortedKeysForChapter(chapterRecord) {
  return sortVerseKeys(Object.keys(chapterRecord?.verses || {}));
}

async function findSupportedOnlinePassage(translation, books, targetKey) {
  const parsed = parseVerseKey(targetKey || "");
  const wantedOrder = parsed.bookIdx === 999 ? 1 : parsed.bookIdx;
  const requestedBook = findNearestAvailableBook(books, wantedOrder);
  if (!requestedBook)
    throw new Error("This translation has no supported canonical books.");

  const requestedChapter = Math.max(1, parsed.chapter || 1);
  const chapter = clampChapterToBook(requestedBook, requestedChapter);
  let chapterRecord;
  let chosenChapter = chapter;
  try {
    chapterRecord = await getOnlineChapter(translation, requestedBook, chapter);
  } catch (error) {
    if (error?.status !== 404) throw error;
    const first = Math.max(1, Number(requestedBook.firstChapterNumber) || 1);
    const last = Math.max(
      first,
      Number(requestedBook.lastChapterNumber) ||
        Number(requestedBook.numberOfChapters) ||
        first,
    );
    let found = false;
    for (
      let distance = 1;
      distance <= Math.max(last - first, 0) && !found;
      distance++
    ) {
      for (const candidate of [chapter - distance, chapter + distance]) {
        if (candidate < first || candidate > last) continue;
        try {
          chapterRecord = await getOnlineChapter(
            translation,
            requestedBook,
            candidate,
          );
          chosenChapter = candidate;
          found = true;
          break;
        } catch (candidateError) {
          if (candidateError?.status !== 404) throw candidateError;
        }
      }
    }
    if (!found) throw error;
  }

  const keys = getSortedKeysForChapter(chapterRecord);
  const targetVerse = parsed.verse || 1;
  let actualKey = keys.find((key) => parseVerseKey(key).verse === targetVerse);
  if (!actualKey) {
    actualKey = [...keys].sort(
      (a, b) =>
        Math.abs(parseVerseKey(a).verse - targetVerse) -
        Math.abs(parseVerseKey(b).verse - targetVerse),
    )[0];
  }
  if (!actualKey)
    throw new Error("No verse was found in the selected chapter.");
  const moved =
    Number(requestedBook.canonicalOrder ?? requestedBook.order) !==
      wantedOrder ||
    chosenChapter !== requestedChapter ||
    parseVerseKey(actualKey).verse !== targetVerse;
  return { chapterRecord, actualKey, moved };
}

function getVerseKeyForBookChapter(book, chapter, verse) {
  const abbr = getBookAbbrByOrder(book.canonicalOrder ?? book.order);
  return abbr ? `${abbr}${chapter}:${verse}` : "";
}

async function ensureOnlineVerseLoaded(key) {
  if (!isOnlineBibleTranslationActive()) return Boolean(bibleVerses[key]);
  if (bibleVerses[key]) return true;
  const parsed = parseVerseKey(key);
  const book = activeTranslationBooks.find(
    (item) => Number(item.canonicalOrder ?? item.order) === parsed.bookIdx,
  );
  if (!book) return false;
  const record = await getOnlineChapter(
    currentBibleTranslation,
    book,
    clampChapterToBook(book, parsed.chapter),
  );
  activateOnlineChapter(record);
  return Boolean(bibleVerses[key]);
}

async function getOnlineAdjacentVerseKey(key, direction) {
  const keys = sortVerseKeys(Object.keys(bibleVerses));
  if (!keys.length || !activeOnlineChapter) return keys[0] || "";
  const index = Math.max(0, keys.indexOf(key));
  const nextIndex = index + direction;
  if (nextIndex >= 0 && nextIndex < keys.length) return keys[nextIndex];

  const books = canonicalBooksForActiveTranslation();
  if (!books.length) return keys[direction > 0 ? 0 : keys.length - 1];
  const currentOrder = Number(
    activeOnlineChapter.book.canonicalOrder ?? activeOnlineChapter.book.order,
  );
  const currentBookIndex = books.findIndex(
    (book) => Number(book.canonicalOrder ?? book.order) === currentOrder,
  );
  let nextBook = activeOnlineChapter.book;
  let nextChapter = Number(activeOnlineChapter.chapterNumber) + direction;
  if (
    direction > 0 &&
    nextChapter >
      (Number(nextBook.lastChapterNumber) ||
        Number(nextBook.numberOfChapters) ||
        1)
  ) {
    nextBook = books[(Math.max(currentBookIndex, 0) + 1) % books.length];
    nextChapter = Math.max(1, Number(nextBook.firstChapterNumber) || 1);
  } else if (
    direction < 0 &&
    nextChapter < (Number(nextBook.firstChapterNumber) || 1)
  ) {
    nextBook =
      books[(Math.max(currentBookIndex, 0) - 1 + books.length) % books.length];
    nextChapter = Math.max(
      1,
      Number(nextBook.lastChapterNumber) ||
        Number(nextBook.numberOfChapters) ||
        1,
    );
  }

  const record = await getOnlineChapter(
    currentBibleTranslation,
    nextBook,
    nextChapter,
  );
  activateOnlineChapter(record);
  const chapterKeys = getSortedKeysForChapter(record);
  return chapterKeys[direction > 0 ? 0 : chapterKeys.length - 1] || "";
}

async function getRandomOnlineVerseKey() {
  const books = canonicalBooksForActiveTranslation();
  if (!books.length) {
    const currentKeys = sortVerseKeys(Object.keys(bibleVerses));
    const candidates = currentKeys.filter((key) => key !== currentKey);
    const pool = candidates.length ? candidates : currentKeys;
    return pool[Math.floor(Math.random() * pool.length)] || "";
  }
  const previousKey = currentKey;

  for (let attempt = 0; attempt < 8; attempt++) {
    const book = books[Math.floor(Math.random() * books.length)];
    const available =
      Array.isArray(book.chapterNumbers) && book.chapterNumbers.length
        ? book.chapterNumbers
        : null;
    const first = Math.max(1, Number(book.firstChapterNumber) || 1);
    const last = Math.max(
      first,
      Number(book.lastChapterNumber) || Number(book.numberOfChapters) || first,
    );
    const chapter = available
      ? available[Math.floor(Math.random() * available.length)]
      : first + Math.floor(Math.random() * (last - first + 1));
    try {
      const record = await getOnlineChapter(
        currentBibleTranslation,
        book,
        chapter,
      );
      const keys = getSortedKeysForChapter(record);
      if (!keys.length) continue;
      activateOnlineChapter(record);
      const candidates = keys.filter((key) => key !== previousKey);
      const pool = candidates.length ? candidates : keys;
      return pool[Math.floor(Math.random() * pool.length)] || "";
    } catch (error) {
      if (attempt === 7) throw error;
    }
  }
  const fallbackKeys = sortVerseKeys(Object.keys(bibleVerses));
  const fallbackCandidates = fallbackKeys.filter((key) => key !== previousKey);
  const fallbackPool = fallbackCandidates.length
    ? fallbackCandidates
    : fallbackKeys;
  return fallbackPool[Math.floor(Math.random() * fallbackPool.length)] || "";
}

async function getRandomNavigationVerseKey() {
  if (isOnlineBibleTranslationActive()) return getRandomOnlineVerseKey();
  const keys = sortVerseKeys(Object.keys(bibleVerses));
  const candidates = keys.filter((key) => key !== currentKey);
  const pool = candidates.length ? candidates : keys;
  return pool[Math.floor(Math.random() * pool.length)] || "";
}

function recordShuffleNavigation(targetKey) {
  if (!targetKey || targetKey === currentKey) return;
  if (shuffleHistoryIndex < 0) {
    shuffleHistory = currentKey ? [currentKey] : [];
    shuffleHistoryIndex = shuffleHistory.length - 1;
  }
  shuffleHistory = shuffleHistory.slice(0, shuffleHistoryIndex + 1);
  shuffleHistory.push(targetKey);
  shuffleHistoryIndex = shuffleHistory.length - 1;
}

function makeBibleTranslationLabel(translation) {
  const shortName =
    translation.shortName && translation.shortName !== translation.name
      ? ` · ${translation.shortName}`
      : "";
  const lang =
    translation.languageEnglishName ||
    translation.languageName ||
    translation.language ||
    "";
  return `${translation.name || translation.englishName || translation.id}${shortName} (${lang})`;
}

function buildVirtualKeyboardHtml(inputId) {
  const safeId = escapeBibleHtml(inputId);
  const layout = (id, rows, actions = true) =>
    `<div class="virtual-keyboard-layout" data-vkb-layout="${id}"${id === "en" ? "" : " hidden"}>${rows.map((row) => `<div class="virtual-keyboard-row">${row.map((key) => `<button type="button" class="virtual-key" data-vkb-char="${escapeBibleHtml(key)}">${escapeBibleHtml(key)}</button>`).join("")}</div>`).join("")}${actions ? `<div class="virtual-keyboard-row virtual-keyboard-actions"><button type="button" class="virtual-key virtual-key-wide" data-vkb-action="space">Space</button><button type="button" class="virtual-key" data-vkb-action="backspace" aria-label="Backspace">⌫</button><button type="button" class="virtual-key" data-vkb-action="clear">Clear</button></div>` : ""}</div>`;
  return `<div class="virtual-keyboard-wrap" data-vkb-for="${safeId}">
    <div class="virtual-keyboard-toolbar">
      <button type="button" class="virtual-keyboard-toggle" data-vkb-toggle="${safeId}" aria-expanded="false">⌨ Show keyboard</button>
      <div class="virtual-keyboard-modes" role="group" aria-label="Keyboard layout">
        <button type="button" class="virtual-keyboard-mode active" data-vkb-mode="en">ABC</button>
        <button type="button" class="virtual-keyboard-mode" data-vkb-mode="num">123</button>
      </div>
    </div>
    <div class="virtual-keyboard-panel" id="${safeId}VirtualKeyboard" hidden>
      ${layout("en", [
        ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
        ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
        ["z", "x", "c", "v", "b", "n", "m"],
      ])}
      ${layout("num", [
        ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
        ["-", "_", ".", ",", ":", ";", "/", "?", "!", "'"],
        ["@", "&", "(", ")", "+", "=", "#", "%", "*", '"'],
      ])}
    </div>
  </div>`;
}

function wireVirtualKeyboard(inputId) {
  const input = document.getElementById(inputId);
  const wrap = input?.parentElement?.querySelector(
    `.virtual-keyboard-wrap[data-vkb-for="${inputId}"]`,
  );
  if (!input || !wrap) return;

  wrap
    .querySelectorAll(
      [
        '[data-vkb-mode]:not([data-vkb-mode="en"]):not([data-vkb-mode="num"])',
        '[data-vkb-layout]:not([data-vkb-layout="en"]):not([data-vkb-layout="num"])',
        '[data-vkb-language="ko"]',
        ".hangul-keyboard",
        ".korean-keyboard",
        ".virtual-keyboard-korean",
        ".virtual-keyboard-hangul",
        ".virtual-keyboard-layout-korean",
      ].join(","),
    )
    .forEach((node) => node.remove());

  wrap.querySelectorAll(".virtual-keyboard-layout").forEach((layoutNode) => {
    const layoutId = layoutNode.getAttribute("data-vkb-layout");
    if (!["en", "num"].includes(layoutId)) layoutNode.remove();
  });
  wrap.querySelectorAll(".virtual-keyboard-row").forEach((row) => {
    if (row.closest(".virtual-keyboard-layout")) return;
    if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/u.test(row.textContent || "")) row.remove();
  });
  wrap
    .querySelectorAll(
      ".virtual-keyboard-mode, .virtual-keyboard-toggle, .virtual-keyboard-toolbar button",
    )
    .forEach((button) => {
      const label = String(button.textContent || "").trim();
      if (/^(?:한글|한국어|korean|hangul)$/i.test(label)) button.remove();
    });
  const panel = wrap.querySelector(".virtual-keyboard-panel");
  const toggle = wrap.querySelector(".virtual-keyboard-toggle");
  const modes = wrap.querySelectorAll("[data-vkb-mode]");
  const setMode = (mode) => {
    const selectedMode = mode === "num" ? "num" : "en";
    wrap.querySelectorAll(".virtual-keyboard-layout").forEach((layoutNode) => {
      layoutNode.hidden =
        layoutNode.getAttribute("data-vkb-layout") !== selectedMode;
    });
    modes.forEach((modeButton) =>
      modeButton.classList.toggle(
        "active",
        modeButton.getAttribute("data-vkb-mode") === selectedMode,
      ),
    );
  };
  toggle?.addEventListener("click", () => {
    const opening = panel?.hidden !== false;
    if (panel) panel.hidden = !opening;
    toggle.setAttribute("aria-expanded", String(opening));
    toggle.textContent = translateUIString(
      opening ? "⌨ Hide keyboard" : "⌨ Show keyboard",
    );
  });
  modes.forEach((button) =>
    button.addEventListener("click", () =>
      setMode(button.getAttribute("data-vkb-mode") || "en"),
    ),
  );
  setMode("en");
  wrap
    .querySelectorAll("[data-vkb-char], [data-vkb-action]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        const action = button.getAttribute("data-vkb-action");
        const character = button.getAttribute("data-vkb-char");
        let value = input.value;
        if (action === "clear") value = "";
        else if (action === "backspace") {
          const start = input.selectionStart ?? value.length;
          const end = input.selectionEnd ?? value.length;
          if (start !== end) value = value.slice(0, start) + value.slice(end);
          else if (start > 0)
            value = value.slice(0, start - 1) + value.slice(end);
        } else if (action === "space") {
          const start = input.selectionStart ?? value.length;
          const end = input.selectionEnd ?? value.length;
          value = value.slice(0, start) + " " + value.slice(end);
        } else if (character != null) {
          const start = input.selectionStart ?? value.length;
          const end = input.selectionEnd ?? value.length;
          value = value.slice(0, start) + character + value.slice(end);
        }
        input.value = value;
        input.focus({ preventScroll: true });
        try {
          input.setSelectionRange(value.length, value.length);
        } catch {}
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }),
    );
}

function getBibleComLetterGroup(name) {
  const first = [...String(name || "").trim()][0] || "#";
  const point = first.codePointAt(0);
  if (point >= 0xac00 && point <= 0xd7a3) {
    const initials = [
      "ㄱ",
      "ㄲ",
      "ㄴ",
      "ㄷ",
      "ㄸ",
      "ㄹ",
      "ㅁ",
      "ㅂ",
      "ㅃ",
      "ㅅ",
      "ㅆ",
      "ㅇ",
      "ㅈ",
      "ㅉ",
      "ㅊ",
      "ㅋ",
      "ㅌ",
      "ㅍ",
      "ㅎ",
    ];
    return initials[Math.floor((point - 0xac00) / 588)] || "#";
  }
  return /[A-Za-z]/.test(first) ? first.toLocaleUpperCase() : first;
}

function showBibleDirectConnectionGuide(options = {}) {
  const reason = String(options.reason || "").trim();
  const detail = reason
    ? `<p class="bible-translation-footnote">${escapeBibleHtml(reason)}</p>`
    : "";
  openModal(
    "Bible.com direct connection",
    `<div class="bible-direct-guide">
      <div class="bible-direct-guide-icon" aria-hidden="true">🌐</div>
      <h4>Bible.com could not be reached</h4>
      <p class="bible-direct-guide-intro">Online translations connect directly to Bible.com. No background service or automatic-start task is required.</p>
      <p class="bible-direct-guide-steps">Check your internet connection, then retry. Built-in and previously downloaded offline translations remain available without an internet connection.</p>
      ${detail}
      <div class="bible-direct-guide-actions">
        <button type="button" id="retryBibleDirectConnection" class="book-select-btn">Retry</button>
        <button type="button" id="closeBibleBridgeGuide" class="bible-translation-back">Close</button>
      </div>
    </div>`,
  );
  document.getElementById("closeBibleBridgeGuide")?.addEventListener("click", closeModal);
  document.getElementById("retryBibleDirectConnection")?.addEventListener("click", async () => {
    closeModal();
    try {
      if (typeof options.onRetry === "function") await options.onRetry();
      else if (options.retrySelector) await openBibleTranslationSelector();
      else await openBibleTranslationSelector();
    } catch (error) {
      console.warn("Bible.com direct connection retry failed.", error);
      showToast(String(error?.message || error));
    }
  });
}

function normalizeBibleLanguageSearch(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const COUNTRY_LANGUAGE_HINTS = [
  {
    aliases: [
      "usa",
      "u s a",
      "us",
      "u s",
      "united states",
      "united states of america",
      "united state",
      "unite state",
      "america",
      "american",
      "new york",
      "nyc",
      "los angeles",
      "la",
      "chicago",
      "houston",
      "san francisco",
      "seattle",
      "boston",
      "washington dc",
      "washington d c",
      "miami",
      "dallas",
      "philadelphia",
      "san diego",
      "뉴욕",
      "로스앤젤레스",
      "샌프란시스코",
      "시애틀",
      "워싱턴 dc",
      "마이애미",
    ],
    names: ["english", "spanish"],
    codes: ["en", "eng", "es", "spa"],
  },
  {
    aliases: [
      "uk",
      "u k",
      "united kingdom",
      "great britain",
      "britain",
      "british",
      "england",
      "scotland",
      "wales",
      "northern ireland",
      "london",
      "manchester",
      "birmingham",
      "liverpool",
      "glasgow",
      "edinburgh",
      "cardiff",
      "belfast",
      "런던",
      "맨체스터",
      "에든버러",
    ],
    names: ["english", "welsh", "irish", "scottish gaelic"],
    codes: ["en", "eng", "cy", "gle", "gd"],
  },
  {
    aliases: ["canada", "canadian"],
    names: ["english", "french", "cree", "inuktitut"],
    codes: ["en", "eng", "fr", "fra", "fre"],
  },
  {
    aliases: ["australia", "australian"],
    names: ["english"],
    codes: ["en", "eng"],
  },
  {
    aliases: ["new zealand", "aotearoa", "kiwi"],
    names: ["english", "maori"],
    codes: ["en", "eng", "mi"],
  },
  {
    aliases: [
      "india",
      "indian",
      "bharat",
      "new delhi",
      "delhi",
      "mumbai",
      "bombay",
      "bengaluru",
      "bangalore",
      "chennai",
      "madras",
      "kolkata",
      "calcutta",
      "hyderabad",
      "pune",
      "ahmedabad",
      "뉴델리",
      "뭄바이",
      "벵갈루루",
      "첸나이",
    ],
    names: [
      "hindi",
      "english",
      "bengali",
      "telugu",
      "marathi",
      "tamil",
      "urdu",
      "gujarati",
      "kannada",
      "malayalam",
      "punjabi",
      "odia",
      "oriya",
      "assamese",
      "nepali",
      "sanskrit",
    ],
    codes: [
      "hi",
      "hin",
      "en",
      "eng",
      "bn",
      "ben",
      "te",
      "tel",
      "mr",
      "mar",
      "ta",
      "tam",
      "ur",
      "urd",
      "gu",
      "guj",
      "kn",
      "kan",
      "ml",
      "mal",
      "pa",
      "pan",
      "or",
      "ori",
      "as",
      "asm",
      "ne",
      "nep",
      "sa",
      "san",
    ],
  },
  {
    aliases: [
      "china",
      "mainland china",
      "prc",
      "people's republic of china",
      "peoples republic of china",
      "beijing",
      "peking",
      "shanghai",
      "guangzhou",
      "canton",
      "shenzhen",
      "chengdu",
      "chongqing",
      "wuhan",
      "hangzhou",
      "nanjing",
      "tianjin",
      "xian",
      "xi an",
      "suzhou",
      "北京",
      "베이징",
      "上海",
      "상하이",
      "广州",
      "광저우",
      "深圳",
      "선전",
      "成都",
      "청두",
      "重庆",
      "충칭",
    ],
    names: [
      "chinese",
      "mandarin",
      "cantonese",
      "simplified chinese",
      "traditional chinese",
    ],
    codes: ["zh", "zho", "chi", "cmn", "yue"],
  },
  {
    aliases: [
      "taiwan",
      "taiwanese",
      "roc",
      "republic of china",
      "taipei",
      "taichung",
      "tainan",
      "kaohsiung",
      "hsinchu",
      "keelung",
      "台北",
      "타이베이",
      "台中",
      "타이중",
      "高雄",
      "가오슝",
    ],
    names: ["chinese", "mandarin", "traditional chinese", "taiwanese hokkien"],
    codes: ["zh", "zho", "chi", "nan"],
  },
  {
    aliases: [
      "hong kong",
      "hongkong",
      "kowloon",
      "central hong kong",
      "九龍",
      "구룡",
      "홍콩",
    ],
    names: ["chinese", "cantonese", "english"],
    codes: ["zh", "yue", "en", "eng"],
  },
  {
    aliases: [
      "japan",
      "japanese",
      "tokyo",
      "edo",
      "kyoto",
      "osaka",
      "yokohama",
      "sapporo",
      "nagoya",
      "fukuoka",
      "kobe",
      "hiroshima",
      "東京",
      "도쿄",
      "京都",
      "교토",
      "大阪",
      "오사카",
      "横浜",
      "요코하마",
    ],
    names: ["japanese"],
    codes: ["ja", "jpn"],
  },
  {
    aliases: [
      "south korea",
      "korea",
      "republic of korea",
      "rok",
      "korean",
      "seoul",
      "soul",
      "busan",
      "pusan",
      "incheon",
      "daegu",
      "daejeon",
      "gwangju",
      "ulsan",
      "jeju",
      "jeju island",
      "suwon",
      "서울",
      "부산",
      "인천",
      "대구",
      "대전",
      "광주",
      "울산",
      "제주",
      "수원",
    ],
    names: ["korean"],
    codes: ["ko", "kor"],
  },
  {
    aliases: [
      "north korea",
      "dprk",
      "democratic people's republic of korea",
      "pyongyang",
      "pyeongyang",
      "평양",
    ],
    names: ["korean"],
    codes: ["ko", "kor"],
  },
  {
    aliases: ["singapore", "singaporean"],
    names: ["english", "chinese", "mandarin", "malay", "tamil"],
    codes: ["en", "eng", "zh", "zho", "msa", "may", "ta", "tam"],
  },
  {
    aliases: [
      "brazil",
      "brazilian",
      "brasilia",
      "sao paulo",
      "rio de janeiro",
      "salvador",
    ],
    names: ["portuguese"],
    codes: ["pt", "por"],
  },
  {
    aliases: ["portugal", "portuguese country"],
    names: ["portuguese"],
    codes: ["pt", "por"],
  },
  {
    aliases: [
      "spain",
      "spanish country",
      "españa",
      "espana",
      "madrid",
      "barcelona",
      "valencia",
      "seville",
      "sevilla",
      "마드리드",
      "바르셀로나",
    ],
    names: ["spanish", "catalan", "basque", "galician"],
    codes: ["es", "spa", "ca", "cat", "eu", "baq", "gl", "glg"],
  },
  {
    aliases: [
      "mexico",
      "mexican",
      "méxico",
      "mexico city",
      "ciudad de mexico",
      "guadalajara",
      "monterrey",
    ],
    names: ["spanish"],
    codes: ["es", "spa"],
  },
  {
    aliases: [
      "france",
      "french country",
      "paris",
      "lyon",
      "marseille",
      "nice",
      "파리",
    ],
    names: ["french", "breton"],
    codes: ["fr", "fra", "fre", "br", "bre"],
  },
  {
    aliases: [
      "germany",
      "german country",
      "deutschland",
      "berlin",
      "munich",
      "münchen",
      "hamburg",
      "frankfurt",
      "베를린",
    ],
    names: ["german"],
    codes: ["de", "deu", "ger"],
  },
  {
    aliases: [
      "italy",
      "italian country",
      "italia",
      "rome",
      "roma",
      "milan",
      "milano",
      "naples",
      "venice",
      "로마",
      "밀라노",
    ],
    names: ["italian"],
    codes: ["it", "ita"],
  },
  {
    aliases: [
      "russia",
      "russian federation",
      "moscow",
      "saint petersburg",
      "st petersburg",
      "novosibirsk",
      "모스크바",
    ],
    names: ["russian"],
    codes: ["ru", "rus"],
  },
  {
    aliases: ["ukraine", "ukrainian country"],
    names: ["ukrainian", "russian"],
    codes: ["uk", "ukr", "ru", "rus"],
  },
  {
    aliases: ["poland", "polish country"],
    names: ["polish"],
    codes: ["pl", "pol"],
  },
  {
    aliases: ["netherlands", "holland", "dutch country"],
    names: ["dutch", "frisian"],
    codes: ["nl", "nld", "dut", "fy", "fry"],
  },
  {
    aliases: ["belgium", "belgian"],
    names: ["dutch", "french", "german"],
    codes: ["nl", "nld", "fr", "fra", "de", "deu"],
  },
  {
    aliases: ["switzerland", "swiss"],
    names: ["german", "french", "italian", "romansh"],
    codes: ["de", "deu", "fr", "fra", "it", "ita", "rm", "roh"],
  },
  {
    aliases: ["sweden", "swedish country"],
    names: ["swedish", "sami"],
    codes: ["sv", "swe", "se", "sme"],
  },
  {
    aliases: ["norway", "norwegian country"],
    names: ["norwegian", "sami"],
    codes: ["no", "nor", "se", "sme"],
  },
  {
    aliases: ["denmark", "danish country"],
    names: ["danish"],
    codes: ["da", "dan"],
  },
  {
    aliases: ["finland", "finnish country"],
    names: ["finnish", "swedish"],
    codes: ["fi", "fin", "sv", "swe"],
  },
  {
    aliases: ["ireland", "irish country", "eire", "éire"],
    names: ["irish", "english"],
    codes: ["ga", "gle", "en", "eng"],
  },
  {
    aliases: ["greece", "greek country", "hellas"],
    names: ["greek"],
    codes: ["el", "ell", "gre"],
  },
  {
    aliases: [
      "turkey",
      "türkiye",
      "turkiye",
      "turkish country",
      "istanbul",
      "ankara",
      "izmir",
      "이스탄불",
      "앙카라",
    ],
    names: ["turkish", "kurdish"],
    codes: ["tr", "tur", "ku", "kur"],
  },
  {
    aliases: [
      "israel",
      "israeli",
      "jerusalem",
      "tel aviv",
      "haifa",
      "예루살렘",
      "텔아비브",
    ],
    names: ["hebrew", "arabic"],
    codes: ["he", "heb", "ar", "ara"],
  },
  {
    aliases: ["saudi arabia", "saudi", "kingdom of saudi arabia"],
    names: ["arabic"],
    codes: ["ar", "ara"],
  },
  {
    aliases: ["egypt", "egyptian", "cairo", "alexandria", "카이로"],
    names: ["arabic", "coptic"],
    codes: ["ar", "ara", "cop"],
  },
  {
    aliases: ["united arab emirates", "uae", "emirates"],
    names: ["arabic", "english"],
    codes: ["ar", "ara", "en", "eng"],
  },
  {
    aliases: ["iran", "persia", "iranian"],
    names: ["persian", "farsi", "azerbaijani"],
    codes: ["fa", "fas", "per", "az", "aze"],
  },
  {
    aliases: ["iraq", "iraqi"],
    names: ["arabic", "kurdish"],
    codes: ["ar", "ara", "ku", "kur"],
  },
  {
    aliases: ["pakistan", "pakistani"],
    names: ["urdu", "punjabi", "pashto", "sindhi", "english"],
    codes: ["ur", "urd", "pa", "pan", "ps", "pus", "sd", "snd", "en", "eng"],
  },
  {
    aliases: ["bangladesh", "bangladeshi"],
    names: ["bengali", "bangla"],
    codes: ["bn", "ben"],
  },
  {
    aliases: ["sri lanka", "srilanka", "ceylon"],
    names: ["sinhala", "tamil"],
    codes: ["si", "sin", "ta", "tam"],
  },
  {
    aliases: ["nepal", "nepali country"],
    names: ["nepali", "nepalese"],
    codes: ["ne", "nep"],
  },
  {
    aliases: [
      "indonesia",
      "indonesian country",
      "jakarta",
      "surabaya",
      "bandung",
      "yogyakarta",
      "자카르타",
    ],
    names: ["indonesian", "javanese", "sundanese"],
    codes: ["id", "ind", "jv", "jav", "su", "sun"],
  },
  {
    aliases: ["malaysia", "malaysian"],
    names: ["malay", "english", "chinese", "tamil"],
    codes: ["ms", "msa", "may", "en", "eng", "zh", "zho", "ta", "tam"],
  },
  {
    aliases: [
      "philippines",
      "philippine",
      "filipino",
      "manila",
      "quezon city",
      "cebu city",
      "마닐라",
    ],
    names: ["filipino", "tagalog", "english", "cebuano", "ilocano"],
    codes: ["fil", "tl", "tgl", "en", "eng", "ceb", "ilo"],
  },
  {
    aliases: [
      "thailand",
      "thai country",
      "siam",
      "bangkok",
      "chiang mai",
      "방콕",
    ],
    names: ["thai"],
    codes: ["th", "tha"],
  },
  {
    aliases: [
      "vietnam",
      "viet nam",
      "vietnamese country",
      "hanoi",
      "ho chi minh city",
      "saigon",
      "da nang",
      "하노이",
      "호치민",
    ],
    names: ["vietnamese"],
    codes: ["vi", "vie"],
  },
  {
    aliases: ["cambodia", "kampuchea"],
    names: ["khmer", "cambodian"],
    codes: ["km", "khm"],
  },
  {
    aliases: ["myanmar", "burma", "burmese country"],
    names: ["burmese", "myanmar"],
    codes: ["my", "mya", "bur"],
  },
  {
    aliases: ["nigeria", "nigerian", "lagos", "abuja", "ibadan", "라고스"],
    names: ["english", "hausa", "yoruba", "igbo"],
    codes: ["en", "eng", "ha", "hau", "yo", "yor", "ig", "ibo"],
  },
  {
    aliases: ["south africa", "rsa", "republic of south africa"],
    names: ["english", "afrikaans", "zulu", "xhosa", "sesotho", "setswana"],
    codes: [
      "en",
      "eng",
      "af",
      "afr",
      "zu",
      "zul",
      "xh",
      "xho",
      "st",
      "sot",
      "tn",
      "tsn",
    ],
  },
  {
    aliases: ["kenya", "kenyan", "nairobi", "mombasa", "나이로비"],
    names: ["swahili", "kiswahili", "english", "kikuyu"],
    codes: ["sw", "swa", "en", "eng", "ki", "kik"],
  },
  {
    aliases: ["tanzania", "united republic of tanzania"],
    names: ["swahili", "kiswahili", "english"],
    codes: ["sw", "swa", "en", "eng"],
  },
  {
    aliases: ["uganda", "ugandan"],
    names: ["english", "swahili", "luganda"],
    codes: ["en", "eng", "sw", "swa", "lg", "lug"],
  },
  {
    aliases: ["ghana", "ghanaian"],
    names: ["english", "akan", "twi", "ewe"],
    codes: ["en", "eng", "ak", "aka", "ee", "ewe"],
  },
  {
    aliases: ["ethiopia", "ethiopian"],
    names: ["amharic", "oromo", "tigrinya"],
    codes: ["am", "amh", "om", "orm", "ti", "tir"],
  },
  {
    aliases: ["argentina", "argentinian"],
    names: ["spanish"],
    codes: ["es", "spa"],
  },
  { aliases: ["chile", "chilean"], names: ["spanish"], codes: ["es", "spa"] },
  {
    aliases: ["colombia", "colombian"],
    names: ["spanish"],
    codes: ["es", "spa"],
  },
  {
    aliases: ["peru", "peruvian"],
    names: ["spanish", "quechua", "aymara"],
    codes: ["es", "spa", "qu", "que", "ay", "aym"],
  },
  {
    aliases: ["guatemala", "guatemalan"],
    names: ["spanish", "quiche", "maya"],
    codes: ["es", "spa", "quc"],
  },
  { aliases: ["cuba", "cuban"], names: ["spanish"], codes: ["es", "spa"] },
  {
    aliases: ["dominican republic", "dominican"],
    names: ["spanish"],
    codes: ["es", "spa"],
  },
  {
    aliases: ["haiti", "haitian"],
    names: ["haitian creole", "french"],
    codes: ["ht", "hat", "fr", "fra"],
  },
  {
    aliases: ["jamaica", "jamaican"],
    names: ["english", "patois"],
    codes: ["en", "eng", "jam"],
  },
  {
    aliases: ["rwanda", "rwandan"],
    names: ["kinyarwanda", "swahili", "english", "french"],
    codes: ["rw", "kin", "sw", "swa", "en", "eng", "fr", "fra"],
  },
  {
    aliases: [
      "democratic republic of the congo",
      "dr congo",
      "drc",
      "congo kinshasa",
    ],
    names: ["french", "lingala", "swahili", "kikongo"],
    codes: ["fr", "fra", "ln", "lin", "sw", "swa", "kg", "kon"],
  },
  {
    aliases: ["papua new guinea", "png"],
    names: ["english", "tok pisin", "hiri motu"],
    codes: ["en", "eng", "tpi", "ho"],
  },
];

function languageMatchesCountryHint(language, country) {
  const rawCode = String(language.code || "")
    .trim()
    .toLowerCase();
  const normalizedCode = normalizeBibleLanguageSearch(rawCode);
  const codeParts = rawCode
    .split(/[-_]/)
    .map(normalizeBibleLanguageSearch)
    .filter(Boolean);
  const labels = [
    language.englishName,
    language.nativeName,
    languageLabelForSearch(language),
    language.name,
  ]
    .map(normalizeBibleLanguageSearch)
    .filter(Boolean);
  const countryCodes = (country.codes || [])
    .map(normalizeBibleLanguageSearch)
    .filter(Boolean);

  if (
    countryCodes.some(
      (code) => normalizedCode === code || codeParts.includes(code),
    )
  )
    return true;
  return (country.names || []).some((hint) => {
    const normalizedHint = normalizeBibleLanguageSearch(hint);
    return labels.some(
      (label) =>
        label === normalizedHint ||
        label.split(" ").includes(normalizedHint) ||
        (normalizedHint.length >= 3 && label.includes(normalizedHint)),
    );
  });
}

function languageLabelForSearch(language) {
  return language.nativeName && language.nativeName !== language.englishName
    ? `${language.nativeName} ${language.englishName || ""}`
    : language.nativeName || language.englishName || language.code || "";
}

function getBibleLanguageSearchText(language) {
  const terms = [
    languageLabelForSearch(language),
    language.code,
    language.englishName,
    language.nativeName,
    language.name,
  ];
  const rawCode = String(language.code || "").toLowerCase();
  const labelText = normalizeBibleLanguageSearch(
    terms.filter(Boolean).join(" "),
  );
  const baseCode = normalizeBibleLanguageSearch(rawCode.split(/[-_]/)[0] || "");
  const chineseCodes = new Set([
    "zh",
    "zho",
    "chi",
    "cmn",
    "yue",
    "nan",
    "hak",
  ]);
  if (
    chineseCodes.has(baseCode) ||
    /(?:^| )(?:chinese|mandarin|cantonese|中文|漢語|汉语|華語|华语)(?: |$)/iu.test(
      labelText,
    )
  ) {
    terms.push(
      "China",
      "Chinese",
      "mainland China",
      "PRC",
      "People's Republic of China",
      "Taiwan",
      "Taiwanese",
      "Hong Kong",
      "Mandarin",
      "Cantonese",
    );
  }
  for (const country of COUNTRY_LANGUAGE_HINTS) {
    if (languageMatchesCountryHint(language, country))
      terms.push(...country.aliases);
  }
  return normalizeBibleLanguageSearch(terms.filter(Boolean).join(" "));
}

function bibleLanguageSearchMatches(searchText, query) {
  const normalizedQuery = normalizeBibleLanguageSearch(query);
  if (!normalizedQuery) return true;
  const searchTokens = normalizeBibleLanguageSearch(searchText)
    .split(" ")
    .filter(Boolean);
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  return queryTokens.every((queryToken) =>
    searchTokens.some((searchToken) => {
      if (queryToken.length === 1) return searchToken.startsWith(queryToken);
      if (queryToken.length === 2) {
        return (
          searchToken === queryToken ||
          searchToken.startsWith(queryToken) ||
          (queryTokens.length > 1 &&
            queryTokens[queryTokens.length - 1] === queryToken &&
            searchToken.startsWith(queryToken))
        );
      }

      return searchToken === queryToken || searchToken.startsWith(queryToken);
    }),
  );
}

function openBibleLanguageStep(languages) {
  const buttons = languages
    .map((language) => {
      const languageLabel =
        language.nativeName && language.nativeName !== language.englishName
          ? `${language.nativeName} (${language.englishName})`
          : language.nativeName || language.englishName || language.code;
      const search = getBibleLanguageSearchText(language);
      return `<button type="button" class="book-select-btn bible-language-option" data-bible-language-code="${escapeBibleHtml(language.code)}" data-search="${escapeBibleHtml(search)}" style="padding:10px 12px; border-radius:10px; color:#fff; font-size:13px; cursor:pointer; text-align:left; display:flex; justify-content:space-between; gap:8px; align-items:center;"><span>${escapeBibleHtml(languageLabel)}</span><small>Bible.com translations</small></button>`;
    })
    .join("");
  openModal(
    "🌍 성경 언어 선택",
    `<div class="bible-translation-picker">
    <p class="bible-translation-help">Bible.com에서 언어를 선택한 다음, 해당 언어에 실제로 제공되는 역본을 고르세요.</p>
    <input id="bibleLanguageSearch" type="search" placeholder="언어 검색" aria-label="언어 검색" autocomplete="off" />
    ${buildVirtualKeyboardHtml("bibleLanguageSearch")}
    <div id="bibleLanguageScroll" class="bible-translation-list">${buttons}</div>
    <p class="bible-translation-footnote">성경 본문 파일을 다운로드하거나 앱에 저장하지 않습니다. 선택한 역본의 장만 필요할 때 Bible.com에서 조회합니다.</p>
    <p class="bible-translation-source">목록 출처: <a href="https://www.bible.com/languages" target="_blank" rel="noopener noreferrer">Bible.com 언어 목록</a>. Bible.com 웹사이트에서 제공하는 공개 웹 엔드포인트를 참조합니다.</p>
  </div>`,
  );
  const modalBody = document.getElementById("modalBody");
  const searchInput = document.getElementById("bibleLanguageSearch");
  wireVirtualKeyboard("bibleLanguageSearch");
  searchInput?.addEventListener("input", () => {
    const query = searchInput.value;
    modalBody?.querySelectorAll(".bible-language-option").forEach((button) => {
      button.hidden = !bibleLanguageSearchMatches(
        button.getAttribute("data-search") || "",
        query,
      );
    });
  });
  modalBody?.querySelectorAll(".bible-language-option").forEach((button) => {
    button.addEventListener("click", () => {
      const language = languages.find(
        (item) => item.code === button.getAttribute("data-bible-language-code"),
      );
      if (language) openBibleVersionStep(language, languages);
    });
  });
}

function normalizeBibleDownloadLanguagePrefix(value) {
  const code = String(value || "")
    .split(/[-_]/)[0]
    .replace(/[^A-Za-z]/g, "")
    .toLowerCase();

  const aliases = {
    en: "EN", eng: "EN",
    ko: "KO", kor: "KO",
    ja: "JA", jpn: "JA", jap: "JA",
    zh: "ZH", zho: "ZH", chi: "ZH", cmn: "ZH",
  };
  return aliases[code] || code.slice(0, 3).toUpperCase();
}

function getBibleDownloadFilename(translation, language, translations = []) {
  const rawLanguage =
    language?.code || translation?.languageCode || translation?.languageTag || translation?.language || "";
  const languagePrefix = normalizeBibleDownloadLanguagePrefix(rawLanguage);
  const abbreviation = String(
    translation?.shortName ||
      translation?.abbreviation ||
      translation?.local_abbreviation ||
      translation?.id ||
      "VERSION",
  )
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toUpperCase()
    .slice(0, 40) || String(translation?.id || "VERSION");

  let stem = `${languagePrefix}_${abbreviation}`;
  const collisions = translations.filter((item) => {
    if (String(item?.id) === String(translation?.id)) return false;
    const otherLanguage = normalizeBibleDownloadLanguagePrefix(
      language?.code || item?.languageCode || item?.languageTag || item?.language || "",
    );
    const otherAbbreviation = String(
      item?.shortName || item?.abbreviation || item?.local_abbreviation || item?.id || "VERSION",
    ).normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "").toUpperCase().slice(0, 40);
    return `${otherLanguage}_${otherAbbreviation}` === stem;
  });
  if (collisions.length) stem = `${stem}_${String(translation?.id || "ID")}`;
  return `${stem}.json`;
}

function mapDownloadedChapterVerses(chapterRecord, book, chapterNumber) {
  const bookUsfm = String(book?.usfm || book?.id || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3}$/.test(bookUsfm)) return {};
  const result = {};
  for (const [rawKey, rawText] of Object.entries(chapterRecord?.verses || {})) {
    const match = String(rawKey).match(/(\d+):(\d+)$/);
    if (!match || Number(match[1]) !== Number(chapterNumber)) continue;
    const verseNumber = Number(match[2]);
    const verseText = String(rawText || "").trim();
    if (Number.isInteger(verseNumber) && verseNumber > 0 && verseText) {
      result[`${bookUsfm}${chapterNumber}:${verseNumber}`] = verseText;
    }
  }
  return result;
}

let lastTaskbarAwareLayoutSignature = "";
function updateTaskbarAwareLayout() {
  const display = window.screen;
  const screenHeight = Number(display?.height) || 0;
  const availableHeight = Number(display?.availHeight) || screenHeight;
  const availableTop = Number(display?.availTop) || 0;
  const viewportHeight = Number(window.innerHeight) || availableHeight;
  const rawBottomGap = Math.max(0, screenHeight - (availableTop + availableHeight));
  const nearFullDisplayHeight = screenHeight > 0 &&
    viewportHeight >= screenHeight - Math.max(48, screenHeight * 0.05);
  const hostIncludesTaskbarArea = nearFullDisplayHeight && viewportHeight > availableHeight + 4;
  const viewportScale = screenHeight > 0 ? Math.min(1.15, viewportHeight / screenHeight) : 1;
  const taskbarBottomInset = hostIncludesTaskbarArea ? Math.ceil(rawBottomGap * viewportScale) : 0;
  const baseSafeBottom = viewportHeight <= 600 ? 52 : Math.max(52, Math.min(96, viewportHeight * 0.05));
  const safeBottom = Math.ceil(Math.max(baseSafeBottom, taskbarBottomInset + 16));
  const signature = `${screenHeight}|${availableHeight}|${availableTop}|${viewportHeight}|${taskbarBottomInset}|${safeBottom}`;
  if (signature === lastTaskbarAwareLayoutSignature) return;
  lastTaskbarAwareLayoutSignature = signature;
  const root = document.documentElement;
  root.style.setProperty("--taskbar-bottom-inset", `${taskbarBottomInset}px`);
  root.style.setProperty("--safe-bottom", `${safeBottom}px`);
}

function installTaskbarAwareLayout() {
  updateTaskbarAwareLayout();
  window.addEventListener("resize", updateTaskbarAwareLayout, { passive: true });
  window.addEventListener("focus", updateTaskbarAwareLayout, { passive: true });
  window.visualViewport?.addEventListener("resize", updateTaskbarAwareLayout, { passive: true });
  window.screen?.orientation?.addEventListener?.("change", updateTaskbarAwareLayout);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateTaskbarAwareLayout();
  });

  window.setInterval(updateTaskbarAwareLayout, 2000);
}

function translateBibleDownloadMessage(value) {
  const source = String(value ?? "");
  const direct = translateUIString(source);
  if (direct !== source || getUILanguage() === "ko") return direct;
  const language = getUILanguage();
  let match;

  if ((match = source.match(/^현재 처리:\s*(.+?)\s*·\s*새로 수집 (\d+)장 · 실패 (\d+)장 · 저장 배치 (\d+)$/))) {
    const currentItem = translateBibleDownloadMessage(`현재 처리: ${match[1]}`);
    const counters = language === "en"
      ? `New chapters ${match[2]} · Failed ${match[3]} · Save batches ${match[4]}`
      : language === "zh"
        ? `新获取 ${match[2]} 章 · 失败 ${match[3]} 章 · 保存批次 ${match[4]}`
        : `新規取得 ${match[2]}章 · 失敗 ${match[3]}章 · 保存バッチ ${match[4]}`;
    return `${currentItem} · ${counters}`;
  }

  if ((match = source.match(/^현재 처리:\s*(.+)$/))) {
    const item = match[1];
    const chapter = item.match(/^(.+?)\s+(\d+)장$/);
    const localizedItem = chapter
      ? (() => {
          const koreanBookName = chapter[1];

          const exactOrder = bibleBookOrder[koreanBookName];
          let normalizedOrder = exactOrder || Object.entries(bibleBookOrder).find(
            ([name]) => normalizeOfflineBookToken(name) === normalizeOfflineBookToken(koreanBookName),
          )?.[1];

          if (!normalizedOrder) {
            const aliasAbbr = getOfflineBookAliasMap().get(
              normalizeOfflineBookToken(koreanBookName),
            );
            if (aliasAbbr) normalizedOrder = getBookOrderByAbbr(aliasAbbr);
          }
          const bookIndex = Number(normalizedOrder) - 1;
          let localizedBookName = koreanBookName;
          if (bookIndex >= 0 && bookIndex < 66) {
            if (language === "en") localizedBookName = OFFLINE_ENGLISH_BOOK_NAMES[bookIndex] || koreanBookName;
            else if (language === "zh") localizedBookName = (OFFLINE_CHINESE_BOOK_NAMES[bookIndex] || "").split("|")[0] || koreanBookName;
            else if (language === "ja") localizedBookName = (OFFLINE_JAPANESE_BOOK_NAMES[bookIndex] || "").split("|")[0] || koreanBookName;
          }
          return language === "en" ? `${localizedBookName}, chapter ${chapter[2]}`
            : language === "zh" ? `${localizedBookName}第${chapter[2]}章` : `${localizedBookName} 第${chapter[2]}章`;
        })()
      : item;
    return language === "en" ? `Currently processing: ${localizedItem}`
      : language === "zh" ? `当前正在处理：${localizedItem}` : `処理中：${localizedItem}`;
  }
  if ((match = source.match(/^(\d+)\/(\d+)장 처리 · (\d+)%$/))) {
    return language === "en" ? `${match[1]}/${match[2]} chapters processed · ${match[3]}%`
      : language === "zh" ? `已处理 ${match[1]}/${match[2]} 章 · ${match[3]}%` : `${match[1]}/${match[2]}章処理済み · ${match[3]}%`;
  }
  if ((match = source.match(/^새로 수집 (\d+)장 · 실패 (\d+)장 · 저장 배치 (\d+)$/))) {
    return language === "en" ? `New chapters ${match[1]} · Failed ${match[2]} · Save batches ${match[3]}`
      : language === "zh" ? `新获取 ${match[1]} 章 · 失败 ${match[2]} 章 · 保存批次 ${match[3]}`
        : `新規取得 ${match[1]}章 · 失敗 ${match[2]}章 · 保存バッチ ${match[3]}`;
  }
  if ((match = source.match(/^수집 (\d+)\/(\d+)장 · 다운로드 데이터 전체 재정렬$/))) {
    return language === "en" ? `Collected ${match[1]}/${match[2]} chapters · Reordering all downloaded data`
      : language === "zh" ? `已获取 ${match[1]}/${match[2]} 章 · 正在重新排序全部下载数据`
        : `${match[1]}/${match[2]}章取得済み · ダウンロードデータ全体を並べ替え中`;
  }
  if ((match = source.match(/^부분 다운로드 완료 · (\d+)\/(\d+)장 · 실패 (\d+)장$/))) {
    return language === "en" ? `Partially downloaded · ${match[1]}/${match[2]} chapters · ${match[3]} failed`
      : language === "zh" ? `部分下载完成 · ${match[1]}/${match[2]} 章 · ${match[3]} 章失败`
        : `一部ダウンロード完了 · ${match[1]}/${match[2]}章 · ${match[3]}章失敗`;
  }
  if ((match = source.match(/^다운로드 완료 · (\d+)\/(\d+)장$/))) {
    return language === "en" ? `Download complete · ${match[1]}/${match[2]} chapters`
      : language === "zh" ? `下载完成 · ${match[1]}/${match[2]} 章` : `ダウンロード完了 · ${match[1]}/${match[2]}章`;
  }
  if ((match = source.match(/^이미 전체 저장됨 · (\d+)\/(\d+)장$/))) {
    return language === "en" ? `Already fully saved · ${match[1]}/${match[2]} chapters`
      : language === "zh" ? `已完整保存 · ${match[1]}/${match[2]} 章` : `全件保存済み · ${match[1]}/${match[2]}章`;
  }
  if ((match = source.match(/^전체 ([\d,]+)절 정경 순서 검사 통과 · 누락 장 (\d+) · data\/(.+)$/))) {
    return language === "en" ? `Canonical order check passed for ${match[1]} verses · Missing chapters ${match[2]} · data/${match[3]}`
      : language === "zh" ? `${match[1]} 节经文通过正典顺序检查 · 缺失章节 ${match[2]} · data/${match[3]}`
        : `${match[1]}節の正典順チェック合格 · 欠落章 ${match[2]} · data/${match[3]}`;
  }
  if ((match = source.match(/^전체 (.+?)절 정경 순서로 최종 저장 · data\/(.+)$/))) {
    return language === "en" ? `${match[1]} verses saved in canonical Bible order · data/${match[2]}`
      : language === "zh" ? `已按正典顺序最终保存全部 ${match[1]} 节 · data/${match[2]}`
        : `全${match[1]}節を正典順に最終保存 · data/${match[2]}`;
  }
  if ((match = source.match(/^(.+) 다운로드 진행 중 (\d+)%$/))) {
    return language === "en" ? `${match[1]} download in progress ${match[2]}%`
      : language === "zh" ? `${match[1]} 下载中 ${match[2]}%` : `${match[1]} ダウンロード中 ${match[2]}%`;
  }
  if ((match = source.match(/^(.+) 오프라인 저장 완료$/))) {
    return language === "en" ? `${match[1]} saved for offline use`
      : language === "zh" ? `${match[1]} 已保存供离线使用` : `${match[1]} をオフライン用に保存しました`;
  }
  if ((match = source.match(/^(.+) 저장됨 · 누락된 장 확인 및 이어받기$/))) {
    return language === "en" ? `${match[1]} saved · Check for missing chapters and resume`
      : language === "zh" ? `${match[1]} 已保存 · 检查缺失章节并续传`
        : `${match[1]} 保存済み · 不足している章を確認して再開`;
  }
  if ((match = source.match(/^(.+) 다운로드 진행률$/))) {
    return language === "en" ? `${match[1]} download progress`
      : language === "zh" ? `${match[1]} 下载进度` : `${match[1]} のダウンロード進捗`;
  }
  if ((match = source.match(/^(.+) 역본은 이미 다운로드 중입니다\.$/))) {
    return language === "en" ? `${match[1]} is already downloading. Other translations can download independently.`
      : language === "zh" ? `${match[1]} 已在下载中。其他译本仍可独立下载。`
        : `${match[1]} はダウンロード中です。他の聖書訳は独立してダウンロードできます。`;
  }
  if ((match = source.match(/^(.+) 다운로드 완료$/))) {
    return language === "en" ? `${match[1]} download complete`
      : language === "zh" ? `${match[1]} 下载完成` : `${match[1]} ダウンロード完了`;
  }
  if ((match = source.match(/^(.+) 부분 다운로드 완료$/))) {
    return language === "en" ? `${match[1]} partially downloaded`
      : language === "zh" ? `${match[1]} 部分下载完成` : `${match[1]} 一部ダウンロード完了`;
  }
  if ((match = source.match(/^(.+) 다운로드 실패$/))) {
    return language === "en" ? `${match[1]} download failed`
      : language === "zh" ? `${match[1]} 下载失败` : `${match[1]} ダウンロード失敗`;
  }
  if ((match = source.match(/^기존 (.+?) 파일을 읽을 수 없습니다\. 파일을 확인한 후 다시 시도하세요\.(?: (.*))?$/))) {
    const suffix = match[2] ? ` ${match[2]}` : "";
    return language === "en" ? `Cannot read the existing file ${match[1]}. Check the file and try again.${suffix}`
      : language === "zh" ? `无法读取现有文件 ${match[1]}。请检查文件后重试。${suffix}`
        : `既存ファイル ${match[1]} を読み込めません。ファイルを確認して再試行してください。${suffix}`;
  }
  if ((match = source.match(/^(.+?) · (.+) · 다시 다운로드하면 누락된 장부터 이어집니다\.$/))) {
    return language === "en" ? `${match[1]} · ${match[2]} · Re-download to resume from the missing chapters.`
      : language === "zh" ? `${match[1]} · ${match[2]} · 重新下载即可从缺失章节继续。`
        : `${match[1]} · ${match[2]} · 再ダウンロードすると不足している章から再開します。`;
  }
  if (source === "Bible.com translation was not found.") {
    return language === "en" ? source : language === "zh" ? "未找到 Bible.com 圣经译本。" : "Bible.com の聖書訳が見つかりませんでした。";
  }
  if ((match = source.match(/^(.+): 다운로드 실패: (.+)$/))) {
    const prefix = language === "en" ? `${match[1]}: Download failed: `
      : language === "zh" ? `${match[1]}：下载失败：` : `${match[1]}：ダウンロード失敗：`;
    return `${prefix}${match[2]}`;
  }
  return direct;
}

const OFFLINE_BIBLE_BOOK_CODES = ["GEN","EXO","LEV","NUM","DEU","JOS","JDG","RUT","1SA","2SA","1KI","2KI","1CH","2CH","EZR","NEH","EST","JOB","PSA","PRO","ECC","SNG","ISA","JER","LAM","EZK","DAN","HOS","JOL","AMO","OBA","JON","MIC","NAM","HAB","ZEP","HAG","ZEC","MAL","MAT","MRK","LUK","JHN","ACT","ROM","1CO","2CO","GAL","EPH","PHP","COL","1TH","2TH","1TI","2TI","TIT","PHM","HEB","JAS","1PE","2PE","1JN","2JN","3JN","JUD","REV"];
const OFFLINE_BIBLE_BOOK_ALIASES = {
  "창":"GEN","창세기":"GEN","출":"EXO","출애굽기":"EXO","레":"LEV","레위기":"LEV","민":"NUM","민수기":"NUM","신":"DEU","신명기":"DEU",
  "수":"JOS","여호수아":"JOS","삿":"JDG","사사기":"JDG","룻":"RUT","룻기":"RUT","삼상":"1SA","삼하":"2SA","왕상":"1KI","왕하":"2KI","대상":"1CH","대하":"2CH","스":"EZR","느":"NEH","에":"EST","욥":"JOB","시":"PSA","잠":"PRO","전":"ECC","아":"SNG","사":"ISA","렘":"JER","애":"LAM","겔":"EZK","단":"DAN","호":"HOS","욜":"JOL","암":"AMO","옵":"OBA","욘":"JON","미":"MIC","나":"NAM","합":"HAB","습":"ZEP","학":"HAG","슥":"ZEC","말":"MAL",
  "마":"MAT","막":"MRK","눅":"LUK","요":"JHN","행":"ACT","롬":"ROM","고전":"1CO","고후":"2CO","갈":"GAL","엡":"EPH","빌":"PHP","골":"COL","살전":"1TH","살후":"2TH","딤전":"1TI","딤후":"2TI","딛":"TIT","몬":"PHM","히":"HEB","약":"JAS","벧전":"1PE","벧후":"2PE","요일":"1JN","요이":"2JN","요삼":"3JN","유":"JUD","계":"REV"
};
function parseOfflineVerseKey(key) {
  const match = String(key).trim().match(/^(.+?)\s*(\d{1,3})\s*[:.]\s*(\d{1,3})$/);
  if (!match) return null;
  const rawBook = match[1].trim().toUpperCase();
  const book = OFFLINE_BIBLE_BOOK_CODES.includes(rawBook) ? rawBook : OFFLINE_BIBLE_BOOK_ALIASES[match[1].trim()];
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  if (!book || chapter < 1 || verse < 1) return null;
  return { book, chapter, verse, order: OFFLINE_BIBLE_BOOK_CODES.indexOf(book) };
}
function inspectOfflineBibleObject(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { validJsonObject: false, invalidKeys: ["JSON root is not an object"], emptyVerses: [], duplicateVerses: [], ordered: false, verseCount: 0, actualChapters: new Set() };
  }
  const entries = Object.entries(data);
  const parsed = entries.map(([key, value]) => ({ key, value, parsed: parseOfflineVerseKey(key) }));
  const invalidKeys = parsed.filter((item) => !item.parsed).map((item) => item.key);
  const emptyVerses = parsed.filter((item) => typeof item.value !== "string" || !item.value.trim()).map((item) => item.key);
  const valid = parsed.filter((item) => item.parsed);
  const identityByKey = new Map();
  const duplicateVerses = [];
  for (const item of valid) {
    const identity = `${item.parsed.book}|${item.parsed.chapter}|${item.parsed.verse}`;
    if (identityByKey.has(identity)) duplicateVerses.push(`${identityByKey.get(identity)} / ${item.key}`);
    else identityByKey.set(identity, item.key);
  }
  const orderedEntries = [...valid].sort((a, b) => a.parsed.order - b.parsed.order || a.parsed.chapter - b.parsed.chapter || a.parsed.verse - b.parsed.verse);
  const ordered = invalidKeys.length === 0 && entries.length === orderedEntries.length && entries.every((item, index) => item[0] === orderedEntries[index]?.key);
  const actualChapters = new Set(valid.map((item) => `${item.parsed.book}${item.parsed.chapter}`));
  return { validJsonObject: true, invalidKeys, emptyVerses, duplicateVerses, ordered, verseCount: entries.length, actualChapters, orderedKeys: orderedEntries.map((item) => item.key) };
}

function offlineBibleUiText(en, ko, zh, ja) {
  const language = getUILanguage();
  if (language === "ko") return ko;
  if (language === "zh") return zh;
  if (language === "ja") return ja;
  return en;
}

function isProtectedEmbeddedOfflineBiblePath(relativePath) {
  const normalized = String(relativePath || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return normalized.split("/")[0].toLocaleLowerCase() === "embedded";
}

function requestOfflineBibleDeleteConfirmation(message) {
  const modal = document.getElementById("offlineBibleConfirmModal");
  const title = document.getElementById("offlineBibleConfirmTitle");
  const text = document.getElementById("offlineBibleConfirmMessage");
  const accept = document.getElementById("offlineBibleConfirmAccept");
  const cancel = document.getElementById("offlineBibleConfirmCancel");
  if (!modal || !title || !text || !accept || !cancel) return Promise.resolve(false);
  title.textContent = offlineBibleUiText("Confirm deletion", "삭제 확인", "确认删除", "削除の確認");
  text.textContent = String(message || "");
  const previousFocus = document.activeElement;
  accept.textContent = offlineBibleUiText("Delete", "삭제", "删除", "削除");
  cancel.textContent = offlineBibleUiText("Cancel", "취소", "取消", "キャンセル");
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  return new Promise((resolve) => {
    let settled = false;
    const finish = (answer) => {
      if (settled) return;
      settled = true;
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
      accept.removeEventListener("click", onAccept);
      cancel.removeEventListener("click", onCancel);
      modal.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKeyDown, true);
      if (previousFocus && typeof previousFocus.focus === "function" && previousFocus.isConnected) previousFocus.focus();
      resolve(answer);
    };
    const onAccept = () => finish(true);
    const onCancel = () => finish(false);
    const onBackdrop = (event) => {
      if (event.target === modal) finish(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      }
    };
    accept.addEventListener("click", onAccept);
    cancel.addEventListener("click", onCancel);
    modal.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKeyDown, true);
    accept.focus();
  });
}

function requestOfflineBibleInlineConfirmation(host, message, options = {}) {
  if (!host || !host.isConnected) return Promise.resolve(false);
  const acceptLabel = options.acceptLabel || offlineBibleUiText("Continue", "계속", "继续", "続行");
  const cancelLabel = options.cancelLabel || offlineBibleUiText("Cancel", "취소", "取消", "キャンセル");
  host.replaceChildren();
  host.hidden = false;
  host.classList.toggle("is-danger", options.danger === true);

  const panel = document.createElement("div");
  panel.className = "biblecom-inline-confirm-panel";
  const text = document.createElement("p");
  text.className = "biblecom-inline-confirm-message";
  text.textContent = String(message || "");
  const actions = document.createElement("div");
  actions.className = "biblecom-inline-confirm-actions";
  const accept = document.createElement("button");
  accept.type = "button";
  accept.className = "biblecom-inline-confirm-accept";
  accept.textContent = acceptLabel;
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "biblecom-inline-confirm-cancel";
  cancel.textContent = cancelLabel;
  actions.append(accept, cancel);
  panel.append(text, actions);
  host.append(panel);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (answer) => {
      if (settled) return;
      settled = true;
      host.hidden = true;
      host.classList.remove("is-danger");
      host.replaceChildren();
      resolve(answer);
    };
    accept.addEventListener("click", () => finish(true), { once: true });
    cancel.addEventListener("click", () => finish(false), { once: true });
  });
}

function getOfflineBibleInlineConfirmHost(translationId = "") {
  const selector = translationId
    ? `.biblecom-integrity-prompt[data-integrity-prompt-for="${CSS.escape(String(translationId))}"]`
    : ".biblecom-integrity-prompt";
  return document.querySelector(selector);
}

async function inspectOfflineBibleFile(filename, translation, options = {}) {
  const { offerRepair = false, promptHost = null } = options;
  let raw;
  try {
    raw = await fetchOfflineBibleJson(filename);
  } catch (error) {
    return {
      ok: false,
      complete: false,
      structureOk: false,
      message: `${filename}: ${offlineBibleUiText(
        "The saved file could not be parsed as JSON; it was left unchanged.",
        "저장된 파일을 JSON으로 읽지 못했습니다. 기존 파일은 변경하지 않았습니다.",
        "无法将已保存文件解析为 JSON；未修改原文件。",
        "保存済みファイルを JSON として読み取れません。既存ファイルは変更していません。",
      )}`,
    };
  }

  let inspection = inspectOfflineBibleObject(raw);
  if (!inspection.validJsonObject) {
    return {
      ok: false,
      complete: false,
      structureOk: false,
      message: `${filename}: ${translateBibleDownloadMessage("잘못된 구절 키 또는 빈 본문이 있습니다.")}`,
      inspection,
    };
  }

  if (inspection.invalidKeys.length || inspection.emptyVerses.length || inspection.duplicateVerses.length) {
    const issueMessage = `${translateBibleDownloadMessage("무결성 검사 실패")}: ${inspection.invalidKeys.length} ${offlineBibleUiText("invalid keys", "잘못된 키", "个无效键", "無効なキー")}, ${inspection.emptyVerses.length} ${offlineBibleUiText("empty verses", "빈 본문", "节经文为空", "空の本文")}, ${inspection.duplicateVerses.length} ${offlineBibleUiText("duplicate references", "중복 구절 참조", "个重复引用", "重複参照")}.`;
    return {
      ok: false,
      complete: false,
      structureOk: false,
      message: `${filename}: ${issueMessage}`,
      inspection,
    };
  }

  if (!inspection.ordered) {
    const answer = offerRepair && await requestOfflineBibleInlineConfirmation(
      promptHost || getOfflineBibleInlineConfirmHost(translation?.id),
      `${filename}\n${translateBibleDownloadMessage("본문 순서가 올바르지 않습니다.")}\n${translateBibleDownloadMessage("본문 순서를 자동으로 바로잡을까요?")}`,
      { acceptLabel: offlineBibleUiText("Repair order", "순서 복구", "修复顺序", "順序を修復") },
    );
    if (answer) {
      await mutateOfflineBibleStorage("reorder", { file: filename });
      raw = await fetchOfflineBibleJson(filename);
      inspection = inspectOfflineBibleObject(raw);
    } else {
      return {
        ok: false,
        complete: false,
        structureOk: false,
        message: `${filename}: ${translateBibleDownloadMessage("본문 순서가 올바르지 않습니다.")}`,
        inspection,
      };
    }
  }

  return {
    ok: Boolean(inspection.validJsonObject && inspection.ordered),
    complete: false,
    structureOk: Boolean(inspection.validJsonObject && inspection.ordered),
    message: `${filename}: ${getUILanguage() === "en" ? "Local structure check passed" : getUILanguage() === "zh" ? "本地结构检查通过" : getUILanguage() === "ja" ? "ローカル構造チェックに合格しました" : "로컬 파일 구조 확인 완료"}: ${inspection.verseCount} · ${translateBibleDownloadMessage("본문 순서가 올바릅니다.")} · ${offlineBibleUiText("source text was not compared", "온라인 원문 본문과 대조하지 않았습니다", "未与在线原文比对", "オンラインの原文とは照合していません")}`,
    inspection,
    missingChapters: [],
  };
}

function isBibleDownloadJobActive(job) {
  return Boolean(job && ["running", "paused", "cancelling"].includes(job.status));
}

function isBibleTranslationDownloadRunning() {
  return [...activeBibleDownloadJobs.values()].some(isBibleDownloadJobActive);
}

async function waitForBibleDownloadJob(jobId) {
  while (true) {
    const job = activeBibleDownloadJobs.get(jobId);
    if (!job || job.cancelRequested || job.stopRequested || job.status === "cancelling" || job.status === "cancelled") return false;
    if (job.status !== "paused") return job.status === "running";
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

function controlBibleDownloadJob(jobId, action) {
  const job = activeBibleDownloadJobs.get(Number(jobId));
  if (!job) return;
  if (action === "pause" && job.status === "running") {
    job.status = "paused";
    job.phase = offlineBibleUiText("Download paused", "다운로드 일시정지", "下载已暂停", "ダウンロード一時停止");
    job.detail = offlineBibleUiText("Resume to continue after the current request.", "현재 요청이 끝난 뒤 재개할 수 있습니다.", "当前请求完成后可继续。", "現在のリクエスト完了後に再開できます。");
  } else if (action === "resume" && job.status === "paused") {
    job.status = "running";
    job.phase = offlineBibleUiText("Resuming download", "다운로드 재개 중", "正在继续下载", "ダウンロード再開中");
    job.detail = offlineBibleUiText("Already-saved chapters will be skipped.", "저장된 장은 건너뛰고 이어서 처리합니다.", "将跳过已保存的章节并继续。", "保存済みの章をスキップして続行します。");
  } else if (action === "cancel" && ["running", "paused"].includes(job.status)) {

    job.cancelRequested = true;
    job.status = "cancelled";
    job.phase = offlineBibleUiText("Download cancelled", "다운로드 취소됨", "下载已取消", "ダウンロードをキャンセルしました");
    job.detail = offlineBibleUiText("Saved chapters are kept.", "이미 저장된 장은 유지됩니다.", "已保存的章节会保留。", "保存済みの章は保持されます。");
    job.abortController?.abort();
    pendingCancelledBibleDownloadKeys.add(`id:${String(job.translationId)}`);
    pendingCancelledBibleDownloadKeys.add(`file:${String(job.filename || "").toLowerCase()}`);
    activeBibleDownloadJobs.delete(Number(jobId));

    document.querySelectorAll(".biblecom-version-download[data-bible-download-id]").forEach((downloadNode) => {
      if (String(downloadNode.getAttribute("data-bible-download-id")) !== String(job.translationId)) return;
      const progressRoot = downloadNode.closest(".biblecom-version-card")?.querySelector(".biblecom-download-progress");
      if (progressRoot) {
        progressRoot.hidden = true;
        const progress = progressRoot.querySelector("progress"); if (progress) progress.value = 0;
        const percent = progressRoot.querySelector("[data-download-percent]"); if (percent) percent.textContent = "0%";
        const phase = progressRoot.querySelector("[data-download-phase]"); if (phase) phase.textContent = "";
        const detail = progressRoot.querySelector("[data-download-detail]"); if (detail) detail.textContent = "";
      }
    });
    if (activeBibleDownloadJob?.id === job.id) {
      activeBibleDownloadJob = [...activeBibleDownloadJobs.values()].sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
    }
  } else {
    return;
  }
  job.updatedAt = Date.now();
  if (action !== "cancel") activeBibleDownloadJob = job;
  updateBibleDownloadFloatingWidget(action === "cancel" ? null : job);
  syncBibleDownloadControls();
  if (action === "cancel" && ![...activeBibleDownloadJobs.values()].some(isBibleDownloadJobActive)) {
    const globalStatus = document.getElementById("bibleDownloadStatus");
    if (globalStatus) globalStatus.textContent = "";
  }
}

function ensureBibleDownloadFloatingWidget() {
  let root = document.getElementById("bibleDownloadFloat");
  if (!root) {
    root = document.createElement("div");
    root.id = "bibleDownloadFloat";
    root.className = "bible-download-float";
    root.hidden = true;
    root.innerHTML = `
      <button type="button" id="bibleDownloadFloatButton" class="bible-download-float-button" aria-label="오프라인 성경 다운로드 진행 상황 보기" aria-expanded="false" aria-controls="bibleDownloadFloatPanel" title="오프라인 성경 다운로드 진행 상황">
        <span class="bible-download-float-disc"><span id="bibleDownloadFloatPercent">0%</span></span>
        <span id="bibleDownloadFloatBadge" class="bible-download-float-badge" aria-hidden="true">↓</span>
      </button>
      <section id="bibleDownloadFloatPanel" class="bible-download-float-panel" hidden role="status" aria-live="polite">
        <header class="bible-download-float-header"><strong>오프라인 성경 다운로드</strong><div class="bible-download-float-header-actions"><button type="button" id="bibleDownloadFloatClear" class="bible-download-float-clear" title="완료된 다운로드 내역 지우기" aria-label="완료된 다운로드 내역 지우기">Clear</button><button type="button" id="bibleDownloadFloatClose" class="bible-download-float-close" aria-label="진행 상황 패널 닫기" title="패널 닫기">×</button></div></header>
        <div id="bibleDownloadFloatJobs" class="bible-download-float-jobs"></div>
        <div class="bible-download-float-summary" hidden>
          <p id="bibleDownloadFloatFilename" class="bible-download-float-filename"></p>
          <div class="bible-download-float-progress-row"><progress id="bibleDownloadFloatProgress" max="100" value="0"></progress><strong id="bibleDownloadFloatPanelPercent">0%</strong></div>
          <p id="bibleDownloadFloatPhase" class="bible-download-float-phase">다운로드 준비 중</p>
          <p id="bibleDownloadFloatDetail" class="bible-download-float-detail"></p>
          <p id="bibleDownloadFloatFootnote" class="bible-download-float-footnote">패널을 닫아도 현재 페이지가 실행되는 동안 다운로드는 계속됩니다.</p>
        </div>
      </section>`;
    document.body.appendChild(root);
    localizeUITree(root);

    const trigger = root.querySelector("#bibleDownloadFloatButton");
    const panel = root.querySelector("#bibleDownloadFloatPanel");
    const close = root.querySelector("#bibleDownloadFloatClose");
    trigger?.addEventListener("click", () => {
      if (!panel) return;
      panel.hidden = !panel.hidden;
      trigger.setAttribute("aria-expanded", String(!panel.hidden));
    });
    close?.addEventListener("click", () => {
      if (panel) panel.hidden = true;
      trigger?.setAttribute("aria-expanded", "false");
    });
    const clear = root.querySelector("#bibleDownloadFloatClear");
    clear?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearCompletedBibleDownloadHistory();
    });
    const jobsNode = root.querySelector("#bibleDownloadFloatJobs");
    jobsNode?.addEventListener("click", (event) => {
      const actionButton = event.target?.closest?.("[data-download-job-action]");
      if (!actionButton || actionButton.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      controlBibleDownloadJob(
        actionButton.getAttribute("data-download-job-id"),
        actionButton.getAttribute("data-download-job-action"),
      );
    });
  }
  return root;
}

function updateBibleDownloadModalProgress(job) {
  if (!job?.translationId) return;
  document.querySelectorAll(".biblecom-version-download[data-bible-download-id]").forEach((button) => {
    if (String(button.getAttribute("data-bible-download-id")) !== String(job.translationId)) return;
    const card = button.closest(".biblecom-version-card");
    const root = card?.querySelector(".biblecom-download-progress");
    if (!root) return;
    root.hidden = false;
    const progress = root.querySelector("progress");
    const percent = root.querySelector("[data-download-percent]");
    const phase = root.querySelector("[data-download-phase]");
    const detail = root.querySelector("[data-download-detail]");
    if (progress) progress.value = Number(job.percent) || 0;
    if (percent) percent.textContent = `${Math.round(Number(job.percent) || 0)}%`;
    if (phase) phase.textContent = translateBibleDownloadMessage(job.phase || "다운로드 준비 중");
    if (detail) detail.textContent = translateBibleDownloadMessage(job.detail || "");
  });
}

function clearCompletedBibleDownloadHistory() {
  const completedStatuses = new Set(["complete", "partial", "failed"]);
  for (const [jobId, job] of activeBibleDownloadJobs.entries()) {
    if (completedStatuses.has(String(job.status))) activeBibleDownloadJobs.delete(jobId);
  }
  if (!activeBibleDownloadJobs.has(activeBibleDownloadJob?.id)) {
    activeBibleDownloadJob = [...activeBibleDownloadJobs.values()].sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
  }
  updateBibleDownloadFloatingWidget(null);
  syncBibleDownloadControls();
}

function updateBibleDownloadFloatingWidget(job = activeBibleDownloadJob) {
  if (job?.id) {
    activeBibleDownloadJobs.set(job.id, job);
    activeBibleDownloadJob = job;
  }
  const jobs = [...activeBibleDownloadJobs.values()].sort((a, b) => a.startedAt - b.startedAt);
  if (!jobs.length) {
    const emptyRoot = document.getElementById("bibleDownloadFloat");
    if (emptyRoot) {
      emptyRoot.hidden = true;
      const panel = emptyRoot.querySelector("#bibleDownloadFloatPanel");
      const trigger = emptyRoot.querySelector("#bibleDownloadFloatButton");
      const rows = emptyRoot.querySelector("#bibleDownloadFloatJobs");
      if (panel) panel.hidden = true;
      if (trigger) trigger.setAttribute("aria-expanded", "false");
      if (rows) rows.innerHTML = "";
      const percent = emptyRoot.querySelector("#bibleDownloadFloatPercent"); if (percent) percent.textContent = "0%";
      const badge = emptyRoot.querySelector("#bibleDownloadFloatBadge"); if (badge) badge.textContent = "↓";
      emptyRoot.classList.remove("is-running", "is-paused", "is-complete", "is-partial", "is-failed");
    }
    activeBibleDownloadJob = null;
    return;
  }
  const root = ensureBibleDownloadFloatingWidget();
  const button = root.querySelector("#bibleDownloadFloatButton");
  const percentNode = root.querySelector("#bibleDownloadFloatPercent");
  const badgeNode = root.querySelector("#bibleDownloadFloatBadge");
  const jobsNode = root.querySelector("#bibleDownloadFloatJobs");
  const running = jobs.filter((item) => ["running", "paused", "cancelling"].includes(item.status));

  const indicatorJob = running.length
    ? running[running.length - 1]
    : activeBibleDownloadJob || jobs[jobs.length - 1];
  const percent = Math.max(0, Math.min(100, Number(indicatorJob.percent) || 0));
  root.hidden = false;
  root.classList.toggle("is-running", running.some((item) => item.status === "running" || item.status === "cancelling"));
  root.classList.toggle("is-paused", running.some((item) => item.status === "paused"));
  root.classList.toggle("is-complete", !running.length && indicatorJob.status === "complete");
  root.classList.toggle("is-partial", !running.length && indicatorJob.status === "partial");
  root.classList.toggle("is-failed", !running.length && indicatorJob.status === "failed");
  if (button) button.style.setProperty("--download-progress", `${percent}%`);
  if (percentNode) percentNode.textContent = running.length > 1
    ? String(running.length)
    : `${Math.round(percent)}%`;
  if (badgeNode) badgeNode.textContent = running.length > 0 ? String(running.length) :
    indicatorJob.status === "complete" ? "✓" : indicatorJob.status === "partial" ? "!" : indicatorJob.status === "failed" ? "×" : "↓";
  if (button) {
    const label = running.length > 1
      ? `${translateBibleDownloadMessage("활성 다운로드")}: ${running.length}`
      : running.length === 1 && running[0].status === "paused"
        ? offlineBibleUiText(`${running[0].filename} paused ${Math.round(Number(running[0].percent) || 0)}%`, `${running[0].filename} 일시정지 ${Math.round(Number(running[0].percent) || 0)}%`, `${running[0].filename} 已暂停 ${Math.round(Number(running[0].percent) || 0)}%`, `${running[0].filename} 一時停止 ${Math.round(Number(running[0].percent) || 0)}%`)
        : running.length === 1 && running[0].status === "cancelling"
          ? offlineBibleUiText(`${running[0].filename} cancelling`, `${running[0].filename} 취소 중`, `${running[0].filename} 正在取消`, `${running[0].filename} キャンセル中`)
          : running.length === 1
            ? translateBibleDownloadMessage(`${running[0].filename} 다운로드 진행 중 ${Math.round(Number(running[0].percent) || 0)}%`)
            : translateBibleDownloadMessage(`${indicatorJob.filename} 다운로드 진행 중 ${Math.round(percent)}%`);
    button.setAttribute("aria-label", `${label} · ${translateBibleDownloadMessage("오프라인 성경 다운로드 진행 상황 보기")}`);
    button.title = label;
  }
  if (jobsNode) {
    jobsNode.innerHTML = jobs.slice().reverse().map((item) => {
      const itemPercent = Math.max(0, Math.min(100, Number(item.percent) || 0));
      const statusClass = `is-${String(item.status || "running").replace(/[^a-z-]/g, "")}`;
      const footnote = item.status === "running"
        ? offlineBibleUiText("Download continues while this page is running, even if the panel is closed.", "패널을 닫아도 현재 페이지가 실행되는 동안 다운로드는 계속됩니다.", "即使关闭面板，只要此页面仍在运行，下载就会继续。", "パネルを閉じても、このページが動作中ならダウンロードは続きます。")
        : item.status === "paused"
          ? offlineBibleUiText("Paused. Resume to continue from the saved progress.", "일시정지됨. 재개를 누르면 저장된 진행 위치부터 계속합니다.", "已暂停。点击继续即可从已保存的位置继续。", "一時停止中です。再開すると保存済みの位置から続行します。")
          : item.status === "cancelling"
            ? offlineBibleUiText("Stopping after the in-flight request finishes.", "진행 중인 요청이 끝나면 중지합니다.", "当前请求完成后将停止。", "処理中のリクエストが終了したら停止します。")
            : item.status === "cancelled"
              ? offlineBibleUiText("Cancelled. Saved chapters are kept; download again to resume.", "취소됨. 이미 저장된 장은 유지되며 다시 다운로드하면 이어받습니다.", "已取消。已保存的章节会保留，重新下载即可继续。", "キャンセルしました。保存済みの章は保持され、再ダウンロードで再開できます。")
              : item.status === "complete"
                ? offlineBibleUiText("Download and canonical reordering completed.", "다운로드와 전체 구절 재정렬이 완료되었습니다.", "下载和正典顺序整理已完成。", "ダウンロードと正典順への並べ替えが完了しました。")
                : item.status === "partial"
                  ? offlineBibleUiText("Some chapters are missing. Download again to resume.", "일부 장을 받지 못했습니다. 다시 시작하면 누락된 장을 이어받습니다.", "部分章节缺失。重新下载即可继续补齐。", "一部の章が不足しています。再ダウンロードで再開できます。")
                  : offlineBibleUiText("Download did not finish. Download again to resume.", "다운로드가 완료되지 않았습니다. 다시 시작하면 저장된 장을 건너뛰고 이어받습니다.", "下载未完成。重新下载即可跳过已保存章节并继续。", "ダウンロードが完了しませんでした。再ダウンロードで保存済みの章をスキップして再開します。");
      const controls = item.status === "running"
        ? `<div class="bible-download-job-actions"><button type="button" data-download-job-id="${Number(item.id)}" data-download-job-action="pause">${escapeBibleHtml(offlineBibleUiText("Pause", "일시정지", "暂停", "一時停止"))}</button><button type="button" data-download-job-id="${Number(item.id)}" data-download-job-action="cancel">${escapeBibleHtml(offlineBibleUiText("Cancel", "취소", "取消", "キャンセル"))}</button></div>`
        : item.status === "paused"
          ? `<div class="bible-download-job-actions"><button type="button" data-download-job-id="${Number(item.id)}" data-download-job-action="resume">${escapeBibleHtml(offlineBibleUiText("Resume", "재개", "继续", "再開"))}</button><button type="button" data-download-job-id="${Number(item.id)}" data-download-job-action="cancel">${escapeBibleHtml(offlineBibleUiText("Cancel", "취소", "取消", "キャンセル"))}</button></div>`
          : item.status === "cancelling"
            ? `<div class="bible-download-job-actions"><button type="button" disabled>${escapeBibleHtml(offlineBibleUiText("Cancelling…", "취소 중…", "正在取消…", "キャンセル中…"))}</button></div>`
            : "";
      return `<article class="bible-download-job ${statusClass}" data-download-job-card="${Number(item.id)}">
        <div class="bible-download-job-heading"><strong>${escapeBibleHtml(item.filename || "")}</strong><span>${Math.round(itemPercent)}%</span></div>
        <progress max="100" value="${itemPercent}" aria-label="${escapeBibleHtml(translateBibleDownloadMessage(`${item.filename} 다운로드 진행률`))}"></progress>
        <p class="bible-download-job-phase">${escapeBibleHtml(translateBibleDownloadMessage(item.phase || "다운로드 준비 중"))}</p>
        <p class="bible-download-job-detail">${escapeBibleHtml(translateBibleDownloadMessage(item.detail || ""))}</p>
        ${controls}
        <small>${escapeBibleHtml(footnote)}</small>
      </article>`;
    }).join("");
  }
  const clearButton = root.querySelector("#bibleDownloadFloatClear");
  const completedHistoryCount = jobs.filter((item) => ["complete", "partial", "failed"].includes(item.status)).length;
  if (clearButton) {
    clearButton.textContent = offlineBibleUiText("Clear", "내역 지우기", "清除记录", "履歴を消去");
    clearButton.disabled = completedHistoryCount === 0;
    clearButton.title = offlineBibleUiText(
      "Clear completed download history",
      "완료된 다운로드 내역 지우기",
      "清除已完成的下载记录",
      "完了したダウンロード履歴を消去",
    );
    clearButton.setAttribute("aria-label", clearButton.title);
  }

  const summaryFields = {
    "#bibleDownloadFloatPanelPercent": `${Math.round(percent)}%`,
    "#bibleDownloadFloatFilename": `data/${indicatorJob.filename || ""}`,
    "#bibleDownloadFloatPhase": translateBibleDownloadMessage(indicatorJob.phase || "다운로드 준비 중"),
    "#bibleDownloadFloatDetail": translateBibleDownloadMessage(indicatorJob.detail || ""),
  };
  Object.entries(summaryFields).forEach(([selector, value]) => {
    const node = root.querySelector(selector);
    if (node) node.textContent = value;
  });
  const progressNode = root.querySelector("#bibleDownloadFloatProgress");
  if (progressNode) progressNode.value = percent;
  jobs.forEach(updateBibleDownloadModalProgress);
}

function syncBibleDownloadControls() {
  const runningJobs = [...activeBibleDownloadJobs.values()].filter(isBibleDownloadJobActive);
  const runningTranslationIds = new Set(runningJobs.map((job) => String(job.translationId)));
  for (const key of pendingCancelledBibleDownloadKeys) {
    if (key.startsWith("id:")) runningTranslationIds.add(key.slice(3));
  }
  document.querySelectorAll(".biblecom-version-download").forEach((button) => {
    const id = String(button.getAttribute("data-bible-download-id") || "");
    const filename = button.getAttribute("data-download-file") || "역본";
    const duplicate = runningTranslationIds.has(id);
    button.disabled = duplicate;
    button.setAttribute("aria-disabled", String(duplicate));
    button.title = translateBibleDownloadMessage(duplicate
      ? `${filename} 역본은 이미 다운로드 중입니다.`
      : button.classList.contains("offline-saved")
        ? `${filename} 저장됨 · 누락된 장 확인 및 이어받기`
        : getUILanguage() === "en" ? `Save ${filename} for offline use`
          : getUILanguage() === "zh" ? `保存 ${filename} 以供离线使用`
            : getUILanguage() === "ja" ? `${filename} をオフライン用に保存`
              : `${filename} 파일로 브라우저 저장소에 다운로드`);
  });

  document.querySelectorAll(".bible-version-option").forEach((button) => {
    button.disabled = false;
    button.setAttribute("aria-disabled", "false");
  });
  const globalStatus = document.getElementById("bibleDownloadStatus");
  if (globalStatus && runningJobs.length) {
    globalStatus.textContent = `${translateBibleDownloadMessage("활성 다운로드")}: ${runningJobs.length} · ${runningJobs.map((job) => `${job.filename} ${Math.round(job.percent || 0)}%`).join(" · ")}`;
  }
}

async function downloadBibleComTranslation(translationId, translations, language, downloadButton, options = {}) {
  const translation = translations.find(
    (item) => String(item.id) === String(translationId),
  );
  if (!translation) throw new Error("Bible.com translation was not found.");
  const filename = getBibleDownloadFilename(translation, language, translations);
  const duplicateJob = [...activeBibleDownloadJobs.values()].find(
    (job) => isBibleDownloadJobActive(job) && (
      String(job.translationId) === String(translationId) ||
      String(job.filename || "").toLowerCase() === filename.toLowerCase()
    ),
  );
  if (pendingCancelledBibleDownloadKeys.has(`id:${String(translationId)}`) || pendingCancelledBibleDownloadKeys.has(`file:${filename.toLowerCase()}`)) {
    showToast(offlineBibleUiText("The previous download is stopping. Please wait a moment before restarting it.", "이전 다운로드를 완전히 중지하고 있습니다. 잠시 후 다시 시작하세요.", "上一个下载正在停止，请稍候再重新启动。", "前のダウンロードを停止中です。少し待ってから再開してください。"));
    return;
  }
  if (duplicateJob) {
    updateBibleDownloadFloatingWidget(duplicateJob);
    const panel = document.getElementById("bibleDownloadFloatPanel");
    const trigger = document.getElementById("bibleDownloadFloatButton");
    if (panel) panel.hidden = false;
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    showToast(translateBibleDownloadMessage(`${duplicateJob.filename} 역본은 이미 다운로드 중입니다.`));
    return;
  }
  const jobId = ++bibleDownloadJobSequence;
  const job = {
    id: jobId,
    translationId: String(translationId),
    filename,
    percent: 0,
    phase: "다운로드 준비 중",
    detail: "브라우저 저장소 및 기존 역본 확인 중",
    status: "running",
    cancelRequested: false,
    stopRequested: false,
    stopReason: "",
    abortController: new AbortController(),
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };
  activeBibleDownloadJobs.set(jobId, job);
  activeBibleDownloadJob = job;
  ensureBibleDownloadFloatingWidget();
  updateBibleDownloadFloatingWidget(job);
  syncBibleDownloadControls();

  const card = downloadButton?.closest(".biblecom-version-card");
  const progressRoot = card?.querySelector(".biblecom-download-progress");
  const progressBar = progressRoot?.querySelector("progress");
  const percentNode = progressRoot?.querySelector("[data-download-percent]");
  const phaseNode = progressRoot?.querySelector("[data-download-phase]");
  const detailNode = progressRoot?.querySelector("[data-download-detail]");

  const setProgress = (percent, phase, detail = "", finalStatus = null) => {

    if (job.cancelRequested || !activeBibleDownloadJobs.has(jobId)) return;
    const bounded = Math.max(0, Math.min(100, Number(percent) || 0));
    if (progressBar) progressBar.value = bounded;
    if (percentNode) percentNode.textContent = `${Math.round(bounded)}%`;
    if (phaseNode) phaseNode.textContent = translateBibleDownloadMessage(phase);
    if (detailNode) detailNode.textContent = translateBibleDownloadMessage(detail);
    const currentGlobalStatus = document.getElementById("bibleDownloadStatus");
    if (currentGlobalStatus) currentGlobalStatus.textContent = `${filename} · ${translateBibleDownloadMessage(phase)}${detail ? ` · ${translateBibleDownloadMessage(detail)}` : ""}`;
    const trackedJob = activeBibleDownloadJobs.get(jobId);
    if (trackedJob) {
      trackedJob.percent = bounded;
      if (trackedJob.status === "paused") {
        trackedJob.phase = offlineBibleUiText("Download paused", "다운로드 일시정지", "下载已暂停", "ダウンロード一時停止");
        trackedJob.detail = offlineBibleUiText("Resume to continue after the current request.", "현재 요청이 끝난 뒤 재개할 수 있습니다.", "当前请求完成后可继续。", "現在のリクエスト完了後に再開できます。");
      } else if (trackedJob.status === "cancelling") {
        trackedJob.phase = offlineBibleUiText("Cancelling download", "다운로드 취소 중", "正在取消下载", "ダウンロードをキャンセル中");
        trackedJob.detail = offlineBibleUiText("Stops after the current request. Saved chapters are kept.", "현재 요청이 끝나면 중지합니다. 이미 저장된 장은 유지됩니다.", "当前请求完成后停止，已保存的章节会保留。", "現在のリクエスト完了後に停止し、保存済みの章は保持します。");
      } else {
        trackedJob.phase = String(phase || "");
        trackedJob.detail = String(detail || "");
      }
      trackedJob.updatedAt = Date.now();
      if (finalStatus) trackedJob.status = finalStatus;
      activeBibleDownloadJob = trackedJob;
      updateBibleDownloadFloatingWidget(trackedJob);
      syncBibleDownloadControls();
    }
  };

  try {
    if (progressRoot) progressRoot.hidden = false;
    setProgress(0, "오프라인 파일 확인 중", "브라우저 저장소");
    const catalog = await getOfflineBibleCatalog();
    const files = Array.isArray(catalog?.files) ? catalog.files : [];
    const fileExists = files.some(
      (file) => String(file.relativePath || file.fileName || "").replace(/\\/g, "/").toLowerCase() === filename.toLowerCase(),
    );

    let existingData = {};
    let existingJsonReadError = null;
    if (fileExists) {
      try {
        const raw = await fetchOfflineBibleJson(filename);
        if (raw && typeof raw === "object" && !Array.isArray(raw)) existingData = raw;
        else existingJsonReadError = new Error("JSON root is not an object.");
      } catch (error) {
        existingJsonReadError = error;
      }
    }

    const books = await getOnlineTranslationBooks(translation.id);
    if (existingJsonReadError) {
      const answer = await requestOfflineBibleInlineConfirmation(
        options.promptHost || card?.querySelector(".biblecom-integrity-prompt") || getOfflineBibleInlineConfirmHost(translationId),
        `${filename}\n${offlineBibleUiText("The existing file cannot be read as a valid JSON object.", "기존 파일을 올바른 JSON 객체로 읽을 수 없습니다.", "现有文件无法作为有效的 JSON 对象读取。", "既存ファイルを有効な JSON オブジェクトとして読み取れません。")}\n${offlineBibleUiText("Replace it with a fresh copy from the selected source?", "선택한 원본의 새 파일로 교체할까요?", "是否使用所选来源的完整副本替换？", "選択したソースから新しくダウンロードして置き換えますか？")}`,
        { acceptLabel: offlineBibleUiText("Replace", "교체", "替换", "置き換え"), danger: true },
      );
      if (!answer) throw new Error(`${filename}: ${getUILanguage()==="en"?"The unreadable file was left unchanged. Run the integrity check to review repair options.":getUILanguage()==="zh"?"未更改无法读取的文件。请运行完整性检查查看修复选项。":"読み取れないファイルは変更していません。整合性チェックから修復方法を確認してください。"}`);
      await mutateOfflineBibleStorage("delete", { files: [filename] });
      existingData = {};
    }
    const existingInspection = inspectOfflineBibleObject(existingData);
    if (fileExists && (existingInspection.invalidKeys.length || existingInspection.emptyVerses.length || existingInspection.duplicateVerses.length)) {
      const issues = `${existingInspection.invalidKeys.length} ${getUILanguage()==="en"?"invalid keys":getUILanguage()==="zh"?"个无效键":"無効なキー"}, ${existingInspection.emptyVerses.length} ${getUILanguage()==="en"?"empty/non-text values":getUILanguage()==="zh"?"个空白或非文本值":"空・非テキスト値"}, ${existingInspection.duplicateVerses.length} ${getUILanguage()==="en"?"duplicate verse references":getUILanguage()==="zh"?"个重复经节引用":"重複した節参照"}`;
      const answer = await requestOfflineBibleInlineConfirmation(
        options.promptHost || card?.querySelector(".biblecom-integrity-prompt") || getOfflineBibleInlineConfirmHost(translationId),
        `${filename}\n${translateBibleDownloadMessage("무결성 검사 실패")}: ${issues}.\n${offlineBibleUiText("Replace this file with a fresh download? The current local copy will be deleted.", "새로 다운로드한 파일로 교체할까요? 현재 로컬 파일은 삭제됩니다.", "是否用完整的新下载替换此文件？当前本地副本将被删除。", "新しいダウンロードで置き換えますか？現在のローカルコピーは削除されます。")}`,
        { acceptLabel: offlineBibleUiText("Replace", "교체", "替换", "置き換え"), danger: true },
      );
      if (!answer) throw new Error(`${filename}: ${getUILanguage()==="en"?"The existing file has integrity errors. Run Check to repair it before continuing.":getUILanguage()==="zh"?"现有文件存在完整性问题。请先运行检查并修复。":"既存ファイルに整合性エラーがあります。続行前にチェックを実行して修復してください。"}`);
      await mutateOfflineBibleStorage("delete", { files: [filename] });
      existingData = {};
    }
    const chapters = books
      .filter((book) => book?.canonicalOrder > 0 && /^[A-Z0-9]{3}$/i.test(String(book.usfm || book.id || "")))
      .sort((a, b) => Number(a.canonicalOrder) - Number(b.canonicalOrder))
      .flatMap((book) => {
        const usfm = String(book.usfm || book.id).toUpperCase();
        const chapterNumbers = Array.isArray(book.chapterNumbers) && book.chapterNumbers.length
          ? book.chapterNumbers
          : Array.from({ length: Number(book.numberOfChapters) || 0 }, (_, index) => index + 1);
        return chapterNumbers.map((chapter) => ({ book, usfm, chapter: Number(chapter) }));
      })
      .filter((item) => Number.isInteger(item.chapter) && item.chapter > 0);
    const total = chapters.length;
    if (!total) throw new Error("Bible.com 역본의 책·장 정보를 찾지 못했습니다.");

    const isChapterAlreadySaved = (item) => Object.entries(existingData).some(([key, value]) => {
      const parsed = parseOfflineVerseKey(key);
      return parsed && parsed.book === item.usfm && parsed.chapter === item.chapter && typeof value === "string" && value.trim().length > 0;
    });
    const forcedChapters = options.forceChapters instanceof Set ? options.forceChapters : new Set();
    const pending = chapters.filter((item) => !isChapterAlreadySaved(item) || forcedChapters.has(`${item.usfm}${item.chapter}`));
    let complete = total - pending.length;
    let fetched = 0;
    let failed = 0;
    let savedBatchCount = 0;
    let saveError = null;
    let pendingChapterCount = 0;
    let pendingVerses = {};
    let saveChain = Promise.resolve();
    let currentItemLabel = "";

    const queueFlush = () => {
      if (!Object.keys(pendingVerses).length || saveError) return saveChain;
      const batch = pendingVerses;
      pendingVerses = {};
      pendingChapterCount = 0;
      saveChain = saveChain
        .then(async () => {
          if (saveError) return;
          await mutateOfflineBibleStorage("save", {
            file: filename,
            verses: batch,
          });
          savedBatchCount++;
        })
        .catch((error) => {
          saveError = error;
        });
      return saveChain;
    };

    const updateRunningProgress = () => {
      const percent = Math.round((complete / total) * 100);
      const detailParts = [];
      if (currentItemLabel) detailParts.push(`현재 처리: ${currentItemLabel}`);
      detailParts.push(`새로 수집 ${fetched}장 · 실패 ${failed}장 · 저장 배치 ${savedBatchCount}`);
      setProgress(
        percent,
        `${complete}/${total}장 처리 · ${percent}%`,
        detailParts.join(" · "),
      );
    };
    updateRunningProgress();

    if (pending.length) {
      let cursor = 0;
      const worker = async () => {
        while (cursor < pending.length && !saveError) {
          if (!(await waitForBibleDownloadJob(jobId))) return;
          if (cursor >= pending.length || saveError) return;
          const item = pending[cursor++];
          currentItemLabel = `${item.book.commonName || item.book.name || item.usfm} ${item.chapter}장`;
          updateRunningProgress();
          let verseMap = {};
          let lastError = null;
          for (let attempt = 0; attempt < 2; attempt++) {
            if (!(await waitForBibleDownloadJob(jobId))) return;
            try {
              const chapterRecord = await getOnlineChapter(
                translation,
                item.book,
                item.chapter,
                job.abortController?.signal || null,
              );
              if (!(await waitForBibleDownloadJob(jobId))) return;
              verseMap = mapDownloadedChapterVerses(
                chapterRecord,
                item.book,
                item.chapter,
              );
              if (!Object.keys(verseMap).length)
                throw new Error("장 본문에서 절 데이터를 찾지 못했습니다.");
              lastError = null;
              break;
            } catch (error) {
              if (job.cancelRequested || job.abortController?.signal?.aborted || error?.name === "AbortError") return;
              lastError = error;
              if (error?.noRetry || error?.status === 403 || error?.status === 429) {
                job.stopRequested = true;
                job.stopReason = error?.status === 429 ? "rate-limit" : "access-restriction";
                job.phase = offlineBibleUiText(
                  "Bible.com request paused", "Bible.com 요청 대기", "Bible.com 请求已暂停", "Bible.com リクエストを一時停止",
                );
                job.detail = offlineBibleUiText(
                  "The source returned HTTP 403/429. No further chapter requests will be sent for this job; try again later.",
                  `Bible.com이 HTTP ${error?.status || "403"} 응답을 반환했습니다. 추가 요청을 중지했습니다. 잠시 후 다시 시도하세요.`,
                  `Bible.com 返回 HTTP ${error?.status || "403"}。已停止此任务的后续章节请求，请稍后再试。`,
                  `Bible.com が HTTP ${error?.status || "403"} を返しました。このジョブの追加リクエストを停止しました。時間をおいて再試行してください。`,
                );
                updateBibleDownloadFloatingWidget(job);
                break;
              }
              if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 650));
            }
          }

          if (lastError) {
            failed++;
            console.warn(`Offline Bible download failed: ${filename} ${item.usfm}.${item.chapter}`, lastError);
          } else {
            Object.assign(pendingVerses, verseMap);
            pendingChapterCount++;
            fetched++;
            complete++;
          }
          updateRunningProgress();
          if (pendingChapterCount >= 8 || Object.keys(pendingVerses).length >= 1800) {
            await queueFlush();
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(4, pending.length) }, () => worker()));
      await queueFlush();
      await saveChain;
    }

    if (job.cancelRequested) {
      try {
        await mutateOfflineBibleStorage("reorder", { file: filename });
      } catch (reorderError) {
        console.warn("Could not normalize partial data after cancellation.", reorderError);
      }
      const cancelledPercent = Math.round((complete / Math.max(1, total)) * 100);
      setProgress(
        cancelledPercent,
        offlineBibleUiText("Download cancelled", "다운로드 취소됨", "下载已取消", "ダウンロードをキャンセルしました"),
        offlineBibleUiText(
          `Processed ${complete}/${total} chapters before cancellation. Saved chapters are kept; start again to resume missing chapters.`,
          `취소 시점까지 ${complete}/${total}장 처리 · 이미 저장된 장은 유지됩니다. 다시 다운로드하면 누락된 장부터 이어집니다.`,
          `取消前已处理 ${complete}/${total} 章。已保存的章节会保留，重新下载即可补齐缺失章节。`,
          `キャンセル時点で ${complete}/${total} 章を処理済みです。保存済みの章は保持され、不足分は再ダウンロードで続行できます。`,
        ),
        "cancelled",
      );
      return;
    }

    if (job.stopRequested) {
      try {
        await mutateOfflineBibleStorage("reorder", { file: filename });
      } catch (reorderError) {
        console.warn("Could not normalize partially downloaded chapters after an upstream restriction.", reorderError);
      }
      setProgress(
        Math.round((complete / Math.max(1, total)) * 100),
        job.phase || offlineBibleUiText("Bible.com request paused", "Bible.com 요청 대기", "Bible.com 请求已暂停", "Bible.com リクエストを一時停止"),
        job.detail || offlineBibleUiText("Try again later.", "잠시 후 다시 시도하세요.", "请稍后再试。", "時間をおいて再試行してください。"),
        "failed",
      );
      return;
    }

    if (saveError) {
      setProgress(
        Math.round((complete / total) * 100),
        "저장 중 오류",
        `${filename} · ${saveError.message || saveError} · 다시 다운로드하면 누락된 장부터 이어집니다.`,
      );
      throw saveError;
    }

    setProgress(
      Math.min(99, Math.round((complete / total) * 100)),
      "성경 순서 정렬 및 최종 저장 중",
      `수집 ${complete}/${total}장 · 다운로드 데이터 전체 재정렬`,
    );
    const reorderResult = await mutateOfflineBibleStorage("reorder", {
      file: filename,
    });

    const finalData = await fetchOfflineBibleJson(filename);
    const finalInspection = inspectOfflineBibleObject(finalData);
    if (!finalInspection.validJsonObject || finalInspection.invalidKeys.length || finalInspection.emptyVerses.length || finalInspection.duplicateVerses.length) {
      throw new Error(`${translateBibleDownloadMessage("무결성 검사 실패")}: ${finalInspection.invalidKeys.length} ${getUILanguage()==="en"?"invalid keys":getUILanguage()==="zh"?"个无效键":"無効なキー"}, ${finalInspection.emptyVerses.length} ${getUILanguage()==="en"?"empty verses":getUILanguage()==="zh"?"节经文为空":"空の本文"}, ${finalInspection.duplicateVerses.length} ${getUILanguage()==="en"?"duplicate references":getUILanguage()==="zh"?"个重复引用":"重複参照"}.`);
    }
    if (!finalInspection.ordered) throw new Error(translateBibleDownloadMessage("본문 순서가 올바르지 않습니다."));
    const missingAfterWrite = chapters.filter((item) => !finalInspection.actualChapters.has(`${item.usfm}${item.chapter}`));
    const unresolvedCount = Math.max(failed, missingAfterWrite.length);
    const finalPercent = Math.round((complete / total) * 100);
    const finishText = unresolvedCount
      ? `부분 다운로드 완료 · ${complete}/${total}장 · 실패 ${unresolvedCount}장`
      : pending.length
        ? `다운로드 완료 · ${total}/${total}장`
        : `이미 전체 저장됨 · ${total}/${total}장`;
    const finalDetail = `전체 ${Number(reorderResult?.totalVerseCount || 0).toLocaleString()}절 정경 순서 검사 통과 · 누락 장 ${missingAfterWrite.length} · data/${filename}`;
    setProgress(
      finalPercent,
      finishText,
      finalDetail,
      unresolvedCount ? "partial" : "complete",
    );
    const finalGlobalStatus = document.getElementById("bibleDownloadStatus");
    if (finalGlobalStatus) finalGlobalStatus.textContent = `${filename}: ${translateBibleDownloadMessage(finishText)} · ${translateBibleDownloadMessage("전체 성경 순서 정렬 후 브라우저 저장소에 저장됨")}`;
    if (!unresolvedCount) showToast(translateBibleDownloadMessage(`${filename} 오프라인 저장 완료`));

    document.querySelectorAll(".biblecom-version-download").forEach((item) => {
      if (String(item.getAttribute("data-download-file") || "").toLowerCase() === filename.toLowerCase()) {
        item.classList.add("offline-saved");
        item.textContent = "↻";
        item.title = translateBibleDownloadMessage(`${filename} 저장됨 · 누락된 장 확인 및 이어받기`);
        item.setAttribute("aria-label", translateBibleDownloadMessage(`${filename} 저장됨 · 누락된 장 확인 및 이어받기`));
      }
    });
  } catch (error) {
    if (job.cancelRequested) {
      setProgress(
        Number(activeBibleDownloadJobs.get(jobId)?.percent || 0),
        offlineBibleUiText("Download cancelled", "다운로드 취소됨", "下载已取消", "ダウンロードをキャンセルしました"),
        offlineBibleUiText(
          "Saved chapters are kept. Start again to resume missing chapters.",
          "취소 시점까지 저장된 장은 유지됩니다. 다시 다운로드하면 누락된 장부터 이어집니다.",
          "已保存的章节会保留，重新下载即可继续补齐缺失章节。",
          "保存済みの章は保持され、不足分は再ダウンロードで続行できます。",
        ),
        "cancelled",
      );
      return;
    }
    console.error("Bible.com 역본을 오프라인 파일로 저장하지 못했습니다.", error);
    const currentGlobalStatus = document.getElementById("bibleDownloadStatus");
    if (currentGlobalStatus && activeBibleDownloadJobs.get(jobId)?.phase !== "저장 중 오류") {
      currentGlobalStatus.textContent = translateBibleDownloadMessage(`${filename}: 다운로드 실패: ${error?.message || error}`);
    }
    const errorText = String(error?.message || error);
    if (progressRoot && phaseNode && !String(phaseNode.textContent || "").includes("저장 중 오류")) {
      phaseNode.textContent = translateBibleDownloadMessage("다운로드 실패");
      if (detailNode) detailNode.textContent = errorText;
    }
    setProgress(
      Number(activeBibleDownloadJobs.get(jobId)?.percent || 0),
      "다운로드 실패",
      errorText,
      "failed",
    );
  } finally {
    if (job.cancelRequested) {
      pendingCancelledBibleDownloadKeys.delete(`id:${String(job.translationId)}`);
      pendingCancelledBibleDownloadKeys.delete(`file:${String(job.filename || "").toLowerCase()}`);
    }
    const trackedJob = activeBibleDownloadJobs.get(jobId);
    if (trackedJob?.status === "running") {
      trackedJob.status = "failed";
      trackedJob.phase = "다운로드가 예기치 않게 끝났습니다.";
      trackedJob.detail = "다시 시작하면 이미 저장된 장을 건너뛰고 이어받습니다.";
      updateBibleDownloadFloatingWidget(trackedJob);
    }
    syncBibleDownloadControls();
  }
}

async function openBibleVersionStep(language, languages) {
  openModal(
    "🌍 성경 역본 선택",
    `<div class="bible-translation-loading">Loading ${escapeBibleHtml(language.englishName || language.nativeName || language.code)} translations and verifying publication years...</div>`,
  );
  let versions;
  try {
    versions = await getBibleComVersionsForLanguage(language);
  } catch (error) {
    console.error("Bible.com 역본 목록을 불러오지 못했습니다.", error);
    showBibleDirectConnectionGuide({
      reason: error?.message || String(error),
      onRetry: () => openBibleVersionStep(language, languages),
    });
    return;
  }

  const isKorean = language.code === "ko";
  const builtInOption = isKorean
    ? `<div class="biblecom-version-card" data-search="기본 한국어 본문 내장 기본 역본 korean built-in">
      <div class="biblecom-version-mainrow biblecom-version-mainrow--viewer-only">
        <div class="biblecom-version-option" data-search="기본 한국어 본문 내장 기본 역본 korean built-in" style="padding:12px; border-radius:10px; color:#fff; text-align:left; display:flex; gap:12px; align-items:center;">
          <span class="biblecom-version-abbr">LOCAL</span><span class="biblecom-version-copy"><strong>기본 한국어 본문 (내장)</strong><small>현재 프로젝트의 내장 본문 · 오프라인 폴백</small></span>
        </div>
        <button type="button" class="biblecom-version-viewer" data-bible-view-id="local-ko" title="뷰어 모드로 역본 적용" aria-label="뷰어 모드로 역본 적용">👁</button>
      </div></div>`
    : "";

  const sorted = [...versions].sort((a, b) => {
    const yearA = Number.isInteger(a.releaseYear)
      ? a.releaseYear
      : Number.NEGATIVE_INFINITY;
    const yearB = Number.isInteger(b.releaseYear)
      ? b.releaseYear
      : Number.NEGATIVE_INFINITY;
    if (yearA !== yearB) return yearB - yearA;
    return String(a.name || a.englishName || a.id).localeCompare(
      String(b.name || b.englishName || b.id),
      undefined,
      { sensitivity: "base" },
    );
  });
  const groups = new Map();
  for (const version of sorted) {
    const releaseYear = Number.isInteger(version.releaseYear)
      ? String(version.releaseYear)
      : "unknown";
    if (!groups.has(releaseYear)) groups.set(releaseYear, []);
    groups.get(releaseYear).push(version);
  }
  const versionGroupsHtml = [...groups.entries()]
    .map(([year, items]) => {
      const heading = year === "unknown" ? "Release year unavailable" : year;
      const cards = items
        .map((version) => {
          const id = String(version.id);
          const title =
            version.localTitle || version.name || version.englishName || id;
          const publisher = version.publisherName || "Bible.com / YouVersion";
          const releaseLabel = Number.isInteger(version.releaseYear)
            ? `Release year: ${version.releaseYear}${version.releaseYearSource ? ` · ${version.releaseYearSource}` : ""}`
            : "Release year unavailable";
          const search =
            `${title} ${version.englishName || ""} ${version.shortName || ""} ${publisher} ${version.releaseYear || ""} ${id}`.toLowerCase();
          const downloadFilename = getBibleDownloadFilename(version, language, versions);
          const infoLink = `<a class="bible-version-link" href="${escapeBibleHtml(version.website)}" target="_blank" rel="noopener noreferrer">View on Bible.com</a>`;
          const yearSourceLink = version.releaseYearUrl
            ? ` <a class="bible-version-link" href="${escapeBibleHtml(version.releaseYearUrl)}" target="_blank" rel="noopener noreferrer">Year source</a>`
            : "";
          return `<div class="biblecom-version-card" data-search="${escapeBibleHtml(search)}" data-download-file="${escapeBibleHtml(downloadFilename)}">
        <div class="biblecom-version-mainrow"><div class="biblecom-version-option" data-search="${escapeBibleHtml(search)}" style="padding:10px; border-radius:10px; color:#fff; text-align:left; display:flex; gap:12px; align-items:center;">
          <span class="biblecom-version-abbr">${escapeBibleHtml(version.shortName || id)}</span>
          <span class="biblecom-version-copy"><strong>${escapeBibleHtml(title)}</strong><small>${escapeBibleHtml(publisher)} · ${escapeBibleHtml(releaseLabel)}</small></span>
        </div><button type="button" class="biblecom-version-viewer" data-bible-view-id="${escapeBibleHtml(id)}" title="뷰어 모드로 역본 적용" aria-label="뷰어 모드로 역본 적용">👁</button><button type="button" class="biblecom-version-download" data-bible-download-id="${escapeBibleHtml(id)}" data-download-file="${escapeBibleHtml(downloadFilename)}" title="${escapeBibleHtml(`${downloadFilename} 이름으로 오프라인 저장`)}" aria-label="${escapeBibleHtml(`${title} 오프라인 저장`)}">⬇</button></div>
        <p class="biblecom-integrity-status" data-integrity-status-for="${escapeBibleHtml(id)}" aria-live="polite">${escapeBibleHtml(offlineBibleUiText("Saved offline files are automatically checked for structure and verse order.", "저장된 오프라인 파일의 구조와 본문 순서를 자동 확인합니다.", "自动检查已保存离线文件的结构和经文顺序。", "保存済みオフラインファイルの構造と節の順序を自動確認します。"))}</p>
        <div class="biblecom-integrity-prompt" data-integrity-prompt-for="${escapeBibleHtml(id)}" hidden></div>
        ${infoLink}${yearSourceLink}
        <div class="biblecom-download-progress" data-download-progress-for="${escapeBibleHtml(id)}" hidden><div class="biblecom-download-progress-heading"><span data-download-phase>다운로드 준비 중</span><strong data-download-percent>0%</strong></div><progress max="100" value="0" aria-label="${escapeBibleHtml(`${title} 다운로드 진행률`)}"></progress><small data-download-detail></small></div>
        </div>`;
        })
        .join("");
      return `<section class="biblecom-version-group"><div class="biblecom-version-group-heading"><strong>${escapeBibleHtml(heading)}</strong><span></span><small>${items.length}</small></div><div class="biblecom-version-grid">${cards}</div></section>`;
    })
    .join("");

  openModal(
    "🌍 성경 역본 선택",
    `<div class="bible-translation-picker">
    <button type="button" id="backToBibleLanguages" class="bible-translation-back">◀ 언어 목록으로 돌아가기</button>
    <p class="bible-translation-help">${escapeBibleHtml(language.nativeName || language.code)} (${escapeBibleHtml(language.englishName || language.code)})에서 제공되는 Bible.com 역본입니다. 사용할 역본을 선택하세요.</p>
    <input id="bibleVersionSearch" type="search" placeholder="역본 이름, 약칭 또는 제공처 검색" aria-label="역본 검색" autocomplete="off" />
    ${buildVirtualKeyboardHtml("bibleVersionSearch")}
    <div id="bibleVersionScroll" class="bible-translation-list biblecom-version-list">${builtInOption}${versionGroupsHtml || `<p class="bible-translation-empty">이 언어에서 사용 가능한 역본을 찾지 못했습니다.</p>`}</div>
    <p id="bibleTranslationStatus" class="bible-translation-status" aria-live="polite"></p>
    <p id="bibleDownloadStatus" class="bible-translation-status" aria-live="polite"></p>
    <p class="bible-translation-footnote">역본 이름 옆의 다운로드 버튼으로 전체 성경을 이 배경화면의 브라우저 저장소에 저장할 수 있습니다. 저장 데이터는 앱을 다시 실행해도 유지되며, 중단 후 재시작하면 저장된 장을 건너뛰고 이어받습니다. 저장된 역본은 JSON 구조·구절 키·빈 본문·본문 순서를 자동 확인합니다. 다른 기기나 이전 버전에서 받은 JSON은 오프라인 역본 관리에서 가져올 수 있습니다. 뷰어 모드에서 역본을 적용하려면 역본 왼쪽의 눈 아이콘을 누르세요.</p>
    <p class="bible-translation-source">출처: <a href="https://www.bible.com/languages/${escapeBibleHtml(getBibleComLanguageSlug(language))}" target="_blank" rel="noopener noreferrer">Bible.com 언어별 역본 페이지</a>. 본문 출처와 역본 상세 정보는 각 역본의 링크에서 확인하세요.</p>
  </div>`,
  );
  document
    .getElementById("backToBibleLanguages")
    ?.addEventListener("click", () => openBibleLanguageStep(languages));
  syncBibleDownloadControls();
  if (activeBibleDownloadJobs.size) {
    updateBibleDownloadFloatingWidget(activeBibleDownloadJob);
    syncBibleDownloadControls();
  }
  const searchInput = document.getElementById("bibleVersionSearch");
  const modalBody = document.getElementById("modalBody");
  wireVirtualKeyboard("bibleVersionSearch");
  searchInput?.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    modalBody?.querySelectorAll(".biblecom-version-card").forEach((card) => {
      card.hidden = !String(card.getAttribute("data-search") || "").toLowerCase().includes(query);
    });
    modalBody?.querySelectorAll(".biblecom-version-group").forEach((group) => {
      group.hidden = !group.querySelector(
        ".biblecom-version-card:not([hidden])",
      );
    });
  });
  modalBody?.querySelectorAll(".biblecom-version-viewer").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const translationId = button.getAttribute("data-bible-view-id");
      const status = document.getElementById("bibleTranslationStatus");
      if (status)
        status.textContent = translateUIString(
          "선택한 Bible.com 역본의 책 목록과 현재 장 본문을 확인하는 중입니다...",
        );
      modalBody.querySelectorAll(".biblecom-version-viewer").forEach((option) => {
        option.disabled = true;
      });
      try {
        await selectBibleTranslation(translationId, versions, {
          languageCode: language.code,
        });
      } catch (error) {
        console.error("Bible.com 역본을 적용하지 못했습니다.", error);
        if (status) {
          status.textContent = translateUIString(
            error?.isBibleComConnectionError
              ? "Bible.com 직접 연결에 실패했습니다. 네트워크를 확인해 주세요."
              : "역본 본문을 확인하지 못했습니다.",
          );
        }
        modalBody
          .querySelectorAll(".biblecom-version-viewer")
          .forEach((option) => {
            option.disabled = false;
          });
        showBibleDirectConnectionGuide({
          reason: error?.message || String(error),
          onRetry: () => openBibleVersionStep(language, languages),
        });
      }
    });
  });

  modalBody?.querySelectorAll(".biblecom-version-download").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      try {
        await downloadBibleComTranslation(
          button.getAttribute("data-bible-download-id"),
          versions,
          language,
          button,
        );
      } catch (error) {
        console.error("Offline Bible download could not start.", error);
        const status = document.getElementById("bibleDownloadStatus");
        if (status) status.textContent = String(error?.message || error);
      }
    });
  });

  (async () => {
    try {
      const catalog = await getOfflineBibleCatalog();
      const savedNames = new Set(
        (Array.isArray(catalog?.files) ? catalog.files : [])
          .filter((file) => Number(file.sizeBytes || 0) > 2)
          .map((file) => String(file.relativePath || file.fileName || "").replace(/\\/g, "/").toLowerCase()),
      );
      const savedButtons = [...(modalBody?.querySelectorAll(".biblecom-version-download") || [])];
      savedButtons.forEach((button) => {
        const filename = String(button.getAttribute("data-download-file") || "");
        if (!savedNames.has(filename.toLowerCase())) return;
        button.classList.add("offline-saved");
        button.textContent = "↻";
        button.title = translateBibleDownloadMessage(`${filename} 저장됨 · 누락된 장 확인 및 이어받기`);
        button.setAttribute("aria-label", translateBibleDownloadMessage(`${filename} 저장됨 · 누락된 장 확인 및 이어받기`));
      });

      for (const button of savedButtons) {
        const filename = String(button.getAttribute("data-download-file") || "");
        if (!savedNames.has(filename.toLowerCase())) continue;
        const id = String(button.getAttribute("data-bible-download-id") || "");
        const status = modalBody.querySelector(`[data-integrity-status-for="${CSS.escape(id)}"]`);
        const translation = versions.find((item) => String(item.id) === id);
        if (status) status.textContent = offlineBibleUiText("Automatically checking the saved file...", "저장된 파일을 자동 확인 중입니다...", "正在自动检查已保存文件…", "保存済みファイルを自動確認中です…");
        try {
          const quick = await inspectOfflineBibleFile(filename, translation, { offerRepair: true });
          if (status) status.textContent = translateBibleDownloadMessage(quick.message);
        } catch (error) {
          if (status) status.textContent = `${translateBibleDownloadMessage("파일 무결성을 검사하지 못했습니다.")} ${String(error?.message || error)}`;
        }
      }
    } catch (error) {

      console.debug("Could not inspect existing offline Bible files.", error);
    }
  })();
}

async function selectBibleTranslation(
  translationId,
  translations = null,
  options = {},
) {
  const isRestoring = options.restore === true;
  if (translationId === "local-ko") {
    if (!Object.keys(localBibleVerses).length)
      throw new Error("The built-in Bible text has not loaded.");
    activeOfflineBibleSource = "";
    try {
      localStorage.removeItem(OFFLINE_BIBLE_SOURCE_KEY);
    } catch {}
    currentBibleTranslation = {
      type: "local",
      id: "local-ko",
      language: "kor",
      name: "기본 한국어 본문 (내장)",
      shortName: "기본 역본",
    };
    activeTranslationBooks = [];
    activeOnlineChapter = null;
    bibleVerses = localBibleVerses;
    if (!currentKey || !bibleVerses[currentKey])
      currentKey = sortVerseKeys(Object.keys(bibleVerses))[0];
    try {
      localStorage.setItem(
        BIBLE_CONTENT_TRANSLATION_KEY,
        JSON.stringify({ type: "local", id: "local-ko" }),
      );
    } catch (error) {
      console.warn("역본 설정을 저장하지 못했습니다.", error);
    }
    if (!isRestoring) pausePlaybackForBibleChange();
    displayVerseByKey(currentKey);
    if (!isRestoring) {
      closeModal();
      showToast("역본이 변경되었습니다.");
    }
    return;
  }

  let translation = Array.isArray(translations)
    ? translations.find((item) => String(item.id) === String(translationId))
    : null;
  if (!translation && options.languageCode) {
    const languageInfo = {
      code: options.languageCode,
      nativeName: options.languageCode,
      englishName: options.languageCode,
    };
    const optionsForLanguage =
      await getBibleComVersionsForLanguage(languageInfo);
    translation = optionsForLanguage.find(
      (item) => String(item.id) === String(translationId),
    );
  }
  if (!translation && isRestoring && options.languageCode) {
    const optionsForLanguage = await getBibleComVersionsForLanguage(
      options.languageCode,
    );
    translation = optionsForLanguage.find(
      (item) => String(item.id) === String(translationId),
    );
  }
  if (!translation)
    throw new Error(
      "Bible.com translation was not found in the selected language catalog.",
    );

  const books = await getOnlineTranslationBooks(translation.id);
  const originKey = currentKey || Object.keys(localBibleVerses)[0] || "창1:1";
  const resolved = await findSupportedOnlinePassage(
    translation,
    books,
    originKey,
  );

  activeOfflineBibleSource = "";
  try {
    localStorage.removeItem(OFFLINE_BIBLE_SOURCE_KEY);
  } catch {}
  currentBibleTranslation = {
    ...translation,
    type: "api",
    id: String(translation.id),
    language:
      translation.languageTag ||
      translation.language ||
      options.languageCode ||
      "und",
    languageCode: translation.languageCode || options.languageCode || "",
    name:
      translation.localTitle ||
      translation.name ||
      translation.englishName ||
      translation.id,
    shortName:
      translation.shortName || translation.abbreviation || translation.id,
    source: "bible.com",
  };
  activeTranslationBooks = books;
  activateOnlineChapter(resolved.chapterRecord);
  currentKey = resolved.actualKey;
  try {
    localStorage.setItem(
      BIBLE_CONTENT_TRANSLATION_KEY,
      JSON.stringify({
        type: "api",
        id: String(translation.id),
        languageCode: currentBibleTranslation.languageCode,
        source: "bible.com",
      }),
    );
  } catch (error) {
    console.warn("역본 설정을 저장하지 못했습니다.", error);
  }
  if (!isRestoring) pausePlaybackForBibleChange();
  displayVerseByKey(currentKey);
  if (!isRestoring) {
    closeModal();
    if (resolved.moved)
      showToast(
        "현재 장절이 해당 역본에 없어 가장 가까운 지원 장절로 이동했습니다.",
      );
    else showToast("Bible.com 역본이 변경되었습니다.");
  }
}

function pausePlaybackForBibleChange() {
  isPaused = true;
  currentElapsed = 0;
  const button = document.getElementById("btnPause");
  if (button) {
    button.textContent = "▶";
    button.setAttribute("data-tip", "자동 넘김 재생");
  }
}

const OFFLINE_ENGLISH_BOOK_NAMES = [
  "Genesis",
  "Exodus",
  "Leviticus",
  "Numbers",
  "Deuteronomy",
  "Joshua",
  "Judges",
  "Ruth",
  "1 Samuel",
  "2 Samuel",
  "1 Kings",
  "2 Kings",
  "1 Chronicles",
  "2 Chronicles",
  "Ezra",
  "Nehemiah",
  "Esther",
  "Job",
  "Psalms",
  "Proverbs",
  "Ecclesiastes",
  "Song of Solomon",
  "Isaiah",
  "Jeremiah",
  "Lamentations",
  "Ezekiel",
  "Daniel",
  "Hosea",
  "Joel",
  "Amos",
  "Obadiah",
  "Jonah",
  "Micah",
  "Nahum",
  "Habakkuk",
  "Zephaniah",
  "Haggai",
  "Zechariah",
  "Malachi",
  "Matthew",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Romans",
  "1 Corinthians",
  "2 Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Titus",
  "Philemon",
  "Hebrews",
  "James",
  "1 Peter",
  "2 Peter",
  "1 John",
  "2 John",
  "3 John",
  "Jude",
  "Revelation",
];
const OFFLINE_ENGLISH_SHORT_NAMES = [
  "Gen,Gn",
  "Exod,Ex",
  "Lev,Le",
  "Num,Nm",
  "Deut,Dt",
  "Josh,Jos",
  "Judg,Jdg",
  "Ruth,Rut",
  "1Sam,1Sa",
  "2Sam,2Sa",
  "1Kgs,1Ki",
  "2Kgs,2Ki",
  "1Chr,1Ch",
  "2Chr,2Ch",
  "Ezra,Ezr",
  "Neh,Ne",
  "Esth,Est",
  "Job,Job",
  "Ps,Psa,Psalm",
  "Prov,Pro,Pr",
  "Eccl,Ecc",
  "Song,Sng,SongOfSongs",
  "Isa,Is",
  "Jer,Je",
  "Lam,La",
  "Ezek,Ezk,Eze",
  "Dan,Da",
  "Hos,Ho",
  "Joel,Jol",
  "Amos,Amo",
  "Obad,Oba",
  "Jonah,Jon",
  "Mic,Mi",
  "Nah,Nah",
  "Hab,Hab",
  "Zeph,Zep",
  "Hag,Hag",
  "Zech,Zec",
  "Mal,Mal",
  "Matt,Mat,Mt",
  "Mark,Mrk,Mk",
  "Luke,Luk,Lk",
  "John,Jhn,Jn",
  "Acts,Act",
  "Rom,Ro",
  "1Cor,1Co",
  "2Cor,2Co",
  "Gal,Ga",
  "Eph,Ephes",
  "Phil,Php",
  "Col,Co",
  "1Thess,1Th",
  "2Thess,2Th",
  "1Tim,1Ti",
  "2Tim,2Ti",
  "Titus,Tit",
  "Phlm,Phm",
  "Heb,He",
  "Jas,Jam",
  "1Pet,1Pe",
  "2Pet,2Pe",
  "1John,1Jn",
  "2John,2Jn",
  "3John,3Jn",
  "Jude,Jud",
  "Rev,Re",
];
const OFFLINE_CHINESE_BOOK_NAMES = [
  "创世记|創世記",
  "出埃及记|出埃及記",
  "利未记|利未記",
  "民数记|民數記",
  "申命记|申命記",
  "约书亚记|約書亞記",
  "士师记|士師記",
  "路得记|路得記",
  "撒母耳记上|撒母耳記上",
  "撒母耳记下|撒母耳記下",
  "列王纪上|列王紀上",
  "列王纪下|列王紀下",
  "历代志上|歷代志上",
  "历代志下|歷代志下",
  "以斯拉记|以斯拉記",
  "尼希米记|尼希米記",
  "以斯帖记|以斯帖記",
  "约伯记|約伯記",
  "诗篇|詩篇|诗篇",
  "箴言",
  "传道书|傳道書",
  "雅歌",
  "以赛亚书|以賽亞書",
  "耶利米书|耶利米書",
  "耶利米哀歌",
  "以西结书|以西結書",
  "但以理书|但以理書",
  "何西阿书|何西阿書",
  "约珥书|約珥書",
  "阿摩司书|阿摩司書",
  "俄巴底亚书|俄巴底亞書",
  "约拿书|約拿書",
  "弥迦书|彌迦書",
  "那鸿书|那鴻書",
  "哈巴谷书",
  "西番雅书|西番雅書",
  "哈该书|哈該書",
  "撒迦利亚书|撒迦利亞書",
  "玛拉基书|瑪拉基書",
  "马太福音|馬太福音",
  "马可福音|馬可福音",
  "路加福音",
  "约翰福音|約翰福音",
  "使徒行传|使徒行傳",
  "罗马书|羅馬書",
  "哥林多前书|哥林多前書",
  "哥林多后书|哥林多後書",
  "加拉太书",
  "以弗所书|以弗所書",
  "腓立比书",
  "歌罗西书|歌羅西書",
  "帖撒罗尼迦前书|帖撒羅尼迦前書",
  "帖撒罗尼迦后书|帖撒羅尼迦後書",
  "提摩太前书|提摩太前書",
  "提摩太后书|提摩太後書",
  "提多书|提多書",
  "腓利门书|腓利門書",
  "希伯来书|希伯來書",
  "雅各书|雅各書",
  "彼得前书|彼得前書",
  "彼得后书|彼得後書",
  "约翰一书|約翰一書",
  "约翰二书|約翰二書",
  "约翰三书|約翰三書",
  "犹大书|猶大書",
  "启示录|啟示錄",
];
const OFFLINE_JAPANESE_BOOK_NAMES = [
  "創世記",
  "出エジプト記",
  "レビ記",
  "民数記",
  "申命記",
  "ヨシュア記",
  "士師記",
  "ルツ記",
  "サムエル記上",
  "サムエル記下",
  "列王記上",
  "列王記下",
  "歴代誌上",
  "歴代誌下",
  "エズラ記",
  "ネヘミヤ記",
  "エステル記",
  "ヨブ記",
  "詩篇|詩編",
  "箴言",
  "伝道者の書|コヘレトの言葉",
  "雅歌",
  "イザヤ書",
  "エレミヤ書",
  "哀歌",
  "エゼキエル書",
  "ダニエル書",
  "ホセア書",
  "ヨエル書",
  "アモス書",
  "オバデヤ書",
  "ヨナ書",
  "ミカ書",
  "ナホム書",
  "ハバクク書",
  "ゼパニヤ書",
  "ハガイ書",
  "ゼカリヤ書",
  "マラキ書",
  "マタイによる福音書|マタイの福音書",
  "マルコによる福音書|マルコの福音書",
  "ルカによる福音書|ルカの福音書",
  "ヨハネによる福音書|ヨハネの福音書",
  "使徒言行録|使徒の働き",
  "ローマの信徒への手紙|ローマ人への手紙",
  "コリントの信徒への手紙一|コリント人への手紙第一",
  "コリントの信徒への手紙二|コリント人への手紙第二",
  "ガラテヤの信徒への手紙|ガラテヤ人への手紙",
  "エフェソの信徒への手紙|エペソ人への手紙",
  "フィリピの信徒への手紙|ピリピ人への手紙",
  "コロサイの信徒への手紙|コロサイ人への手紙",
  "テサロニケの信徒への手紙一|テサロニケ人への手紙第一",
  "テサロニケの信徒への手紙二|テサロニケ人への手紙第二",
  "テモテへの手紙一|テモテへの手紙第一",
  "テモテへの手紙二|テモテへの手紙第二",
  "テトスへの手紙",
  "フィレモンへの手紙|ピレモンへの手紙",
  "ヘブライ人への手紙|ヘブル人への手紙",
  "ヤコブの手紙",
  "ペトロの手紙一|ペテロの手紙第一",
  "ペトロの手紙二|ペテロの手紙第二",
  "ヨハネの手紙一|ヨハネの手紙第一",
  "ヨハネの手紙二|ヨハネの手紙第二",
  "ヨハネの手紙三|ヨハネの手紙第三",
  "ユダの手紙",
  "ヨハネの黙示録|ヨハネ黙示録",
];
let offlineBookAliasMap = null;
function normalizeOfflineBookToken(value) {
  return String(value || "")
    .toLocaleLowerCase()
    .replace(/[\s._-]+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}
function getOfflineBookAliasMap() {
  if (offlineBookAliasMap) return offlineBookAliasMap;
  offlineBookAliasMap = new Map();
  const koreanAbbreviationsByBook = new Map();
  for (const [abbr, fullName] of Object.entries(bibleBookMap)) {
    const order = bibleBookOrder[fullName];
    if (!koreanAbbreviationsByBook.has(order))
      koreanAbbreviationsByBook.set(order, []);
    koreanAbbreviationsByBook.get(order).push(abbr);
  }
  const orderedKoreanNames = Object.entries(bibleBookOrder).sort(
    (a, b) => a[1] - b[1],
  );
  const aliasesByOrder = OFFLINE_ENGLISH_SHORT_NAMES.map((names) =>
    names.split(","),
  );
  for (let index = 0; index < CANONICAL_API_BOOK_IDS.length; index++) {
    const order = index + 1;
    const englishName = OFFLINE_ENGLISH_BOOK_NAMES[index];
    const usfm = CANONICAL_API_BOOK_IDS[index];
    const koreanFullName = orderedKoreanNames[index]?.[0];
    const localizedAliases = [
      OFFLINE_CHINESE_BOOK_NAMES[index] || "",
      OFFLINE_JAPANESE_BOOK_NAMES[index] || "",
    ].flatMap((names) => names.split("|"));
    const candidates = [
      usfm,
      englishName,
      ...(aliasesByOrder[index] || []),
      ...localizedAliases,
      koreanFullName,
      ...(koreanAbbreviationsByBook.get(order) || []),
    ];
    for (const candidate of candidates) {
      const normalized = normalizeOfflineBookToken(candidate);
      if (normalized && !offlineBookAliasMap.has(normalized))
        offlineBookAliasMap.set(normalized, getBookAbbrByOrder(order));
    }
  }

  const extraAliases = {
    psalm: "시",
    psalms: "시",
    songofsongs: "아",
    canticles: "아",
    apoc: "계",
    apocalypse: "계",
    revelations: "계",
    acts: "행",
    numbers: "민",
    deuteronomy: "신",
    judges: "삿",
    ps: "시",
  };
  for (const [alias, abbr] of Object.entries(extraAliases))
    offlineBookAliasMap.set(normalizeOfflineBookToken(alias), abbr);
  return offlineBookAliasMap;
}
function normalizeOfflineBibleData(rawData) {
  let entries = [];
  if (rawData && typeof rawData === "object" && !Array.isArray(rawData)) {
    entries = Object.entries(rawData);
  } else if (Array.isArray(rawData)) {
    entries = rawData.map((item) => {
      if (!item || typeof item !== "object") return ["", null];
      const directKey = item.key || item.reference || item.ref || item.usfm;
      const constructedKey =
        item.book && item.chapter != null && item.verse != null
          ? `${item.book} ${item.chapter}:${item.verse}`
          : "";
      return [
        directKey || constructedKey,
        item.text ?? item.content ?? item.verseText ?? item.value,
      ];
    });
  }
  const aliases = getOfflineBookAliasMap();
  const normalized = {};
  for (const [rawKey, rawValue] of entries) {
    const key = String(rawKey || "").trim();
    let match = key.match(/^(.+?)\s*(\d+):(\d+)$/u);
    if (!match) match = key.match(/^([A-Za-z0-9]+)\.(\d+)\.(\d+)$/);
    if (!match) continue;
    const [, bookToken, chapterText, verseText] = match;
    const bookAbbr = aliases.get(normalizeOfflineBookToken(bookToken));
    const chapter = Number(chapterText);
    const verse = Number(verseText);
    if (
      !bookAbbr ||
      !Number.isInteger(chapter) ||
      chapter < 1 ||
      !Number.isInteger(verse) ||
      verse < 1
    )
      continue;
    const verseTextValue =
      typeof rawValue === "string" || typeof rawValue === "number"
        ? String(rawValue)
        : rawValue && typeof rawValue === "object"
          ? String(
              rawValue.text ??
                rawValue.content ??
                rawValue.verseText ??
                rawValue.value ??
                "",
            )
          : "";
    if (!verseTextValue.trim()) continue;
    const canonicalKey = `${bookAbbr}${chapter}:${verse}`;
    if (!Object.prototype.hasOwnProperty.call(normalized, canonicalKey))
      normalized[canonicalKey] = verseTextValue.trim();
  }
  if (!Object.keys(normalized).length)
    throw new Error("The selected file is not a supported Bible JSON format.");

  const orderedNormalized = {};
  for (const key of sortVerseKeys(Object.keys(normalized))) {
    orderedNormalized[key] = normalized[key];
  }
  return orderedNormalized;
}
function formatOfflineBibleFilename(filePath) {
  return (
    String(filePath || "")
      .replace(/\\/g, "/")
      .split("/")
      .pop() || String(filePath || "")
  );
}
function getOfflineBibleLanguageTag(filePath) {
  const stem = formatOfflineBibleFilename(filePath).replace(/\.json$/i, "");

  const match = stem.match(/^([a-z]{2,3})(?:[-_]([a-z]{2}))?(?:[-_].*)?$/i);
  if (!match) return "und";
  const rawLanguage = match[1].toLowerCase();
  const languageMap = {
    en: "en", eng: "en",
    ko: "ko", kor: "ko",
    ja: "ja", jpn: "ja",
    zh: "zh", zho: "zh", chi: "zh",
  };
  const language = languageMap[rawLanguage] || rawLanguage;
  const region = String(match[2] || "").toLowerCase();
  const knownRegions = {
    en: ["us", "gb", "ca", "au", "nz", "ie", "za", "in", "ph"],
    ko: ["kr"],
    ja: ["jp"],
    zh: ["cn", "sg", "tw", "hk", "mo"],
  };
  if (region && (knownRegions[language] || []).includes(region)) {
    return `${language}-${region}`;
  }
  return language;
}
function humanFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
function getOfflineBibleSourceName(entry) {
  const filename = formatOfflineBibleFilename(
    entry?.relativePath || entry?.fileName || "",
  );
  const stem = filename.replace(/\.json$/i, "");
  const localeMatch = stem.match(/^([a-z]{2,3})[-_]([a-z]{2,4})$/i);
  if (localeMatch) {
    const locale = `${localeMatch[1].toLowerCase()}-${localeMatch[2].toUpperCase()}`;
    const [languageCode, regionCode] = locale.split("-");
    const uiLocale =
      getUILanguage() === "ko"
        ? "ko"
        : getUILanguage() === "zh"
          ? "zh-CN"
          : getUILanguage() === "ja"
            ? "ja"
            : "en";
    try {
      const languageName =
        new Intl.DisplayNames([uiLocale], { type: "language" }).of(
          languageCode,
        ) || languageCode;
      const regionName =
        new Intl.DisplayNames([uiLocale], { type: "region" }).of(regionCode) ||
        regionCode;
      return `${languageName} (${regionName})`;
    } catch {}
  }
  if (stem.toLowerCase() === "bible") return "Built-in Bible";
  return stem.replace(/[_-]+/g, " ") || filename;
}
const OFFLINE_BIBLE_DB_NAME = "spotlight-wallpaper-bible-offline-v1";
const OFFLINE_BIBLE_DB_VERSION = 2;
const OFFLINE_BIBLE_STORE_NAME = "translations";
const OFFLINE_BIBLE_META_STORE_NAME = "translationCatalog";
const BUILTIN_OFFLINE_BIBLE_FILES = [
  { fileName: "ZH_CUV.json", sizeBytes: 4020089 },
  { fileName: "EN_KJV.json", sizeBytes: 4678671 },
  { fileName: "KO_RNKSV.json", sizeBytes: 5957832 },
  { fileName: "EN_NLT.json", sizeBytes: 4598151 },
  { fileName: "KO_KRV.json", sizeBytes: 4950109 },
  { fileName: "EN_ESV.json", sizeBytes: 4393144 },
  { fileName: "JA_NJB.json", sizeBytes: 5910956 },
  { fileName: "KO_KLVB.json", sizeBytes: 5112210 },
  { fileName: "EN_NIV.json", sizeBytes: 4415468 },
  { fileName: "KO_NKRV.json", sizeBytes: 5119699 },
];
const BUILTIN_OFFLINE_BIBLE_NAMES = new Set(
  BUILTIN_OFFLINE_BIBLE_FILES.map((item) => item.fileName.toLowerCase()),
);
let offlineBibleDbPromise = null;

function openOfflineBibleDatabase() {
  if (offlineBibleDbPromise) return offlineBibleDbPromise;
  offlineBibleDbPromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("This wallpaper runtime does not support persistent browser storage (IndexedDB)."));
      return;
    }
    const request = indexedDB.open(OFFLINE_BIBLE_DB_NAME, OFFLINE_BIBLE_DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const upgradeTx = request.transaction;
      let translationStore;
      if (!db.objectStoreNames.contains(OFFLINE_BIBLE_STORE_NAME)) {
        translationStore = db.createObjectStore(OFFLINE_BIBLE_STORE_NAME, { keyPath: "fileName" });
      } else {
        translationStore = upgradeTx.objectStore(OFFLINE_BIBLE_STORE_NAME);
      }
      const hadCatalog = db.objectStoreNames.contains(OFFLINE_BIBLE_META_STORE_NAME);
      const catalogStore = hadCatalog
        ? upgradeTx.objectStore(OFFLINE_BIBLE_META_STORE_NAME)
        : db.createObjectStore(OFFLINE_BIBLE_META_STORE_NAME, { keyPath: "fileName" });
      // If upgrading the first IndexedDB schema, migrate the small catalog fields
      // from existing translation records without changing the stored Bible data.
      if (event.oldVersion >= 1 && !hadCatalog) {
        const cursorRequest = translationStore.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const record = cursor.value || {};
          catalogStore.put({
            fileName: record.fileName,
            relativePath: record.relativePath || record.fileName,
            sizeBytes: Number(record.sizeBytes) || 0,
            updatedAt: record.updatedAt || 0,
          });
          cursor.continue();
        };
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      try { void navigator.storage?.persist?.().catch(() => false); } catch {}
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error("Could not open offline Bible storage."));
    request.onblocked = () => reject(new Error("Offline Bible storage upgrade is blocked by another open wallpaper instance. Restart the wallpaper and retry."));
  }).catch((error) => {
    offlineBibleDbPromise = null;
    throw error;
  });
  return offlineBibleDbPromise;
}

function normalizeDownloadedBibleFilename(value) {
  const basename = String(value || "").replace(/\\/g, "/").split("/").pop().trim();
  if (!basename || basename === "." || basename === ".." ||
      !/^[^<>:"/\\|?*\x00-\x1f]+\.json$/i.test(basename)) {
    throw new Error("Invalid offline Bible filename. A .json filename is required.");
  }
  return basename;
}

function isBuiltinOfflineBiblePath(value) {
  const normalized = String(value || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!/^embedded\//i.test(normalized)) return false;
  return BUILTIN_OFFLINE_BIBLE_NAMES.has(formatOfflineBibleFilename(normalized).toLowerCase());
}

async function readStoredOfflineBible(fileName) {
  const normalizedName = normalizeDownloadedBibleFilename(fileName);
  const db = await openOfflineBibleDatabase();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_BIBLE_STORE_NAME, "readonly");
    const request = tx.objectStore(OFFLINE_BIBLE_STORE_NAME).get(normalizedName);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error(`Could not read ${normalizedName} from offline storage.`));
    tx.onabort = () => reject(tx.error || new Error("Offline Bible storage read was aborted."));
  });
}

async function writeStoredOfflineBible(fileName, data) {
  const normalizedName = normalizeDownloadedBibleFilename(fileName);
  if (BUILTIN_OFFLINE_BIBLE_NAMES.has(normalizedName.toLowerCase())) {
    // Built-in files have their own protected embedded/ path; a downloaded
    // copy with the same filename is allowed as a separate IndexedDB record.
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Offline Bible data must be a JSON object keyed by verse reference.");
  }
  const serialized = JSON.stringify(data);
  const record = {
    fileName: normalizedName,
    relativePath: normalizedName,
    data,
    sizeBytes: new TextEncoder().encode(serialized).byteLength,
    updatedAt: Date.now(),
  };
  const db = await openOfflineBibleDatabase();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([OFFLINE_BIBLE_STORE_NAME, OFFLINE_BIBLE_META_STORE_NAME], "readwrite");
    tx.objectStore(OFFLINE_BIBLE_STORE_NAME).put(record);
    tx.objectStore(OFFLINE_BIBLE_META_STORE_NAME).put({
      fileName: normalizedName,
      relativePath: normalizedName,
      sizeBytes: record.sizeBytes,
      updatedAt: record.updatedAt,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error(`Could not save ${normalizedName} to offline storage.`));
    tx.onabort = () => reject(tx.error || new Error(`Saving ${normalizedName} to offline storage was aborted.`));
  });
  return record;
}

async function deleteStoredOfflineBible(fileName) {
  const normalizedName = normalizeDownloadedBibleFilename(fileName);
  const db = await openOfflineBibleDatabase();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([OFFLINE_BIBLE_STORE_NAME, OFFLINE_BIBLE_META_STORE_NAME], "readwrite");
    tx.objectStore(OFFLINE_BIBLE_STORE_NAME).delete(normalizedName);
    tx.objectStore(OFFLINE_BIBLE_META_STORE_NAME).delete(normalizedName);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error(`Could not delete ${normalizedName} from offline storage.`));
    tx.onabort = () => reject(tx.error || new Error(`Deleting ${normalizedName} from offline storage was aborted.`));
  });
}

async function listStoredOfflineBibles() {
  const db = await openOfflineBibleDatabase();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_BIBLE_META_STORE_NAME, "readonly");
    const request = tx.objectStore(OFFLINE_BIBLE_META_STORE_NAME).getAll();
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
    request.onerror = () => reject(request.error || new Error("Could not list stored offline Bibles."));
    tx.onabort = () => reject(tx.error || new Error("Listing offline Bible storage was aborted."));
  });
}

async function getOfflineBibleCatalog() {
  const builtins = BUILTIN_OFFLINE_BIBLE_FILES.map((item) => ({
    fileName: item.fileName,
    relativePath: `embedded/${item.fileName}`,
    sizeBytes: item.sizeBytes,
    builtIn: true,
  }));
  const saved = (await listStoredOfflineBibles()).map((record) => ({
    fileName: record.fileName,
    relativePath: record.fileName,
    sizeBytes: Number(record.sizeBytes) || 0,
    updatedAt: record.updatedAt || 0,
    builtIn: false,
  }));
  saved.sort((a, b) => a.fileName.localeCompare(b.fileName));
  return { ok: true, files: [...builtins, ...saved] };
}

async function mutateOfflineBibleStorage(operation, payload = {}) {
  if (operation === "save") {
    const fileName = normalizeDownloadedBibleFilename(payload.file);
    let existing = {};
    try {
      const saved = await readStoredOfflineBible(fileName);
      if (saved?.data && typeof saved.data === "object" && !Array.isArray(saved.data)) existing = saved.data;
    } catch (error) {
      if (!/not found/i.test(String(error?.message || error))) throw error;
    }
    const verses = payload.verses && typeof payload.verses === "object" && !Array.isArray(payload.verses) ? payload.verses : {};
    const merged = { ...existing, ...verses };
    const record = await writeStoredOfflineBible(fileName, merged);
    return { ok: true, file: fileName, savedVerses: Object.keys(verses).length, sizeBytes: record.sizeBytes };
  }
  if (operation === "delete") {
    const deleted = [];
    const missing = [];
    for (const value of Array.isArray(payload.files) ? payload.files : []) {
      const original = String(value || "").replace(/\\/g, "/");
      if (!original || isProtectedEmbeddedOfflineBiblePath(original)) {
        missing.push(original);
        continue;
      }
      const fileName = normalizeDownloadedBibleFilename(original);
      const existing = await readStoredOfflineBible(fileName);
      if (!existing) {
        missing.push(original);
        continue;
      }
      await deleteStoredOfflineBible(fileName);
      deleted.push(fileName);
    }
    return { ok: true, deleted, missing };
  }
  if (operation === "reorder") {
    const fileName = normalizeDownloadedBibleFilename(payload.file);
    const record = await readStoredOfflineBible(fileName);
    if (!record) throw new Error(`Offline Bible ${fileName} is not saved in browser storage.`);
    const ordered = {};
    for (const key of sortVerseKeys(Object.keys(record.data || {}))) ordered[key] = record.data[key];
    const updated = await writeStoredOfflineBible(fileName, ordered);
    return { ok: true, file: fileName, sizeBytes: updated.sizeBytes };
  }
  throw new Error("Unsupported browser offline-storage operation.");
}

async function fetchOfflineBibleJson(relativePath) {
  const safePath = String(relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!safePath || safePath.split("/").some((part) => part === "..") || !/\.json$/i.test(safePath)) {
    throw new Error("Invalid offline Bible JSON path.");
  }
  if (/^embedded\//i.test(safePath)) {
    const filename = formatOfflineBibleFilename(safePath);
    if (!isBuiltinOfflineBiblePath(safePath)) throw new Error("The requested embedded Bible is not part of this wallpaper package.");
    const response = await fetch(`./data/embedded/${encodeURIComponent(filename)}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load built-in Bible ${filename} (HTTP ${response.status}).`);
    return await response.json();
  }
  const filename = normalizeDownloadedBibleFilename(safePath);
  const record = await readStoredOfflineBible(filename);
  if (!record || !record.data) throw new Error(`Offline Bible ${filename} was not found in this wallpaper's browser storage.`);
  return record.data;
}

async function loadOfflineBibleSource(relativePath, options = {}) {
  const rawData =
    options.rawData || (await fetchOfflineBibleJson(relativePath));
  const verses = normalizeOfflineBibleData(rawData);
  const existingCurrentKey = currentKey;
  const orderedKeys = sortVerseKeys(Object.keys(verses));
  if (!orderedKeys.length)
    throw new Error("The selected file is not a supported Bible JSON format.");
  const filename = formatOfflineBibleFilename(relativePath);
  const sourceName = getOfflineBibleSourceName({
    relativePath,
    fileName: filename,
  });
  currentBibleTranslation = {
    type: "offline",
    id: `offline:${relativePath}`,
    fileName: relativePath,
    language: getOfflineBibleLanguageTag(filename),
    name: sourceName,
    shortName: filename.replace(/\.json$/i, ""),
    source: "browser-storage",
  };
  activeTranslationBooks = [];
  activeOnlineChapter = null;
  activeOfflineBibleSource = relativePath;
  bibleVerses = verses;
  if (existingCurrentKey && verses[existingCurrentKey])
    currentKey = existingCurrentKey;
  else
    currentKey = isShuffle
      ? orderedKeys[Math.floor(Math.random() * orderedKeys.length)]
      : orderedKeys[0];
  try {
    localStorage.setItem(OFFLINE_BIBLE_SOURCE_KEY, relativePath);
    localStorage.setItem(
      BIBLE_CONTENT_TRANSLATION_KEY,
      JSON.stringify({ type: "offline-file", fileName: relativePath }),
    );
  } catch (error) {
    console.warn("Could not persist the selected offline Bible source.", error);
  }
  if (!options.restoring) {
    pausePlaybackForBibleChange();
    displayVerseByKey(currentKey);
    closeModal();
    showToast("Offline Bible source applied.");
  }
  return { verses, sourceName, filename };
}
async function openOfflineBibleSourceSelector() {
  openModal(
    "Offline Bible sources",
    `<div class="offline-bible-picker"><p class="bible-translation-help">Built-in Bibles and saved offline translations</p><p class="bible-translation-footnote">Built-in translations are loaded from this wallpaper package. Translations downloaded in the online Bible selector are saved persistently in this wallpaper's browser storage. Use Import JSON to migrate files downloaded by older versions.</p><input id="offlineBibleSourceSearch" type="search" placeholder="Search offline Bible translations" aria-label="Search offline Bible translations" autocomplete="off" /><input type="file" id="importOfflineBibleFilesInput" accept=".json,application/json" multiple hidden /><div class="offline-bible-picker-actions"><button type="button" id="refreshOfflineBibleFiles" class="bible-translation-back">↻ Refresh list</button><button type="button" id="importOfflineBibleFilesButton" class="bible-translation-back">＋ Import JSON</button><button type="button" id="deleteSelectedOfflineBibleFiles" class="offline-bible-delete-selected" disabled>🗑 Delete selected</button></div>${buildVirtualKeyboardHtml("offlineBibleSourceSearch")}<div id="offlineBibleSourceList" class="offline-bible-source-list"><div class="bible-translation-loading">Loading offline storage...</div></div><p id="offlineBibleSourceStatus" class="bible-translation-status" aria-live="polite"></p></div>`,
  );
  const searchInput = document.getElementById("offlineBibleSourceSearch");
  localizeUITree(document.getElementById("modalBody"));
  wireVirtualKeyboard("offlineBibleSourceSearch");
  const renderCatalog = async () => {
    const list = document.getElementById("offlineBibleSourceList");
    const status = document.getElementById("offlineBibleSourceStatus");
    if (list)
      list.innerHTML = `<div class="bible-translation-loading">Loading offline storage...</div>`;
    if (status) status.textContent = "";
    try {
      const catalog = await getOfflineBibleCatalog();
      const files = Array.isArray(catalog?.files) ? catalog.files : [];
      if (!list) return;
      if (!files.length) {
        list.innerHTML = `<div class="bible-translation-empty">No saved offline translations were found.</div>`;
        localizeUITree(list);
        return;
      }
      const selectedPath =
        activeOfflineBibleSource ||
        localStorage.getItem(OFFLINE_BIBLE_SOURCE_KEY) ||
        "";
      list.innerHTML = files
        .map((file) => {
          const relativePath = String(file.relativePath || file.fileName || "");
          const filename = formatOfflineBibleFilename(relativePath);
          const label = getOfflineBibleSourceName(file);
          const hasNoData = Number(file.sizeBytes || file.bytes || 0) <= 2;
          const protectedFile = isProtectedEmbeddedOfflineBiblePath(relativePath);
          const active = !hasNoData && relativePath === selectedPath;
          const protectionLabel = offlineBibleUiText("Built-in resource · deletion protected", "내장 리소스 · 삭제 보호", "内置资源 · 禁止删除", "組み込みリソース · 削除保護");
          const detail = `${escapeBibleHtml(relativePath)} · ${humanFileSize(file.sizeBytes || file.bytes)}${hasNoData ? ` · ${offlineBibleUiText("Empty JSON (not selectable)", "빈 JSON (선택 불가)", "空 JSON（不可选择）", "空の JSON（選択不可）")}` : protectedFile ? ` · ${protectionLabel}` : ""}`;
          const search =
            `${label} ${relativePath} ${filename} ${hasNoData ? "empty json no verse data" : ""} ${protectedFile ? "protected built-in embedded" : ""}`.toLocaleLowerCase();
          return `<div class="offline-bible-source-row ${protectedFile ? "protected" : ""}" data-search="${escapeBibleHtml(search)}"><label class="offline-bible-source-check"><input type="checkbox" class="offline-bible-source-select" data-offline-delete-file="${escapeBibleHtml(relativePath)}" aria-label="${escapeBibleHtml(`Select ${filename} for deletion`)}" ${protectedFile ? "disabled aria-disabled=\"true\" title=\"Deletion protected\"" : ""}/><span></span></label><button type="button" class="offline-bible-source-card ${active ? "active" : ""}" data-offline-source="${escapeBibleHtml(relativePath)}" data-search="${escapeBibleHtml(search)}" aria-pressed="${active}" ${hasNoData ? "disabled aria-disabled=\"true\"" : ""}><span class="offline-bible-source-icon">${protectedFile ? "🔒" : "📄"}</span><span class="offline-bible-source-copy"><strong>${escapeBibleHtml(label)}</strong><small>${escapeBibleHtml(filename)}</small><small>${detail}</small></span><span class="offline-bible-source-action">${protectedFile ? offlineBibleUiText("Protected", "삭제 보호", "已保护", "保護中") : hasNoData ? "No verse data" : active ? "Current source" : "Apply source"}</span></button></div>`;
        })
        .join("");
      localizeUITree(list);
      list.querySelectorAll(".offline-bible-source-select").forEach((checkbox) => {
        checkbox.addEventListener("change", updateOfflineDeleteButton);
      });
      list.querySelectorAll(".offline-bible-source-card:not(:disabled)").forEach((button) => {
        button.addEventListener("click", async () => {
          const filePath = button.getAttribute("data-offline-source");
          const currentStatus = document.getElementById(
            "offlineBibleSourceStatus",
          );
          if (currentStatus)
            currentStatus.textContent = translateUIString(
              `Loading ${formatOfflineBibleFilename(filePath)}...`,
            );
          list
            .querySelectorAll(".offline-bible-source-card")
            .forEach((item) => {
              item.disabled = true;
            });
          try {
            await loadOfflineBibleSource(filePath);
          } catch (error) {
            console.error("Offline Bible source could not be applied.", error);
            const statusNode = document.getElementById(
              "offlineBibleSourceStatus",
            );
            if (statusNode)
              statusNode.textContent = `${translateUIString(
                "Could not load the selected offline Bible file.",
              )} ${String(error?.message || error || "")}`.trim();
            list
              .querySelectorAll(".offline-bible-source-card")
              .forEach((item) => {
                item.disabled = item.getAttribute("aria-disabled") === "true";
              });
          }
        });
      });
      const query = String(searchInput?.value || "")
        .trim()
        .toLocaleLowerCase();
      if (query) filterOfflineBibleCards(query);
    } catch (error) {
      console.error("Could not read browser offline Bible storage.", error);
      const diagnostic = String(error?.message || error || "Unknown error");
      if (list) {
        list.innerHTML = `<div class="bible-translation-error"><p>Offline Bible browser storage could not be read.</p><p class="offline-bible-diagnostic">${escapeBibleHtml(diagnostic)}</p><button type="button" class="book-select-btn" id="retryOfflineBibleCatalog">Retry scan</button></div>`;
        localizeUITree(list);
      }
      document
        .getElementById("retryOfflineBibleCatalog")
        ?.addEventListener("click", renderCatalog);
      if (status)
        status.textContent = `Offline catalog error: ${diagnostic}`;
    }
  };
  function updateOfflineDeleteButton() {
    const deleteButton = document.getElementById("deleteSelectedOfflineBibleFiles");
    const selectedCount = document.querySelectorAll(
      "#offlineBibleSourceList .offline-bible-source-select:checked",
    ).length;
    if (!deleteButton) return;
    deleteButton.disabled = selectedCount === 0;
    const language = getUILanguage();
    const deleteLabel = language === "ko"
      ? "🗑 선택 항목 삭제"
      : language === "zh"
        ? "🗑 删除所选项"
        : language === "ja"
          ? "🗑 選択項目を削除"
          : "🗑 Delete selected";
    deleteButton.textContent = selectedCount ? `${deleteLabel} (${selectedCount})` : deleteLabel;
  }
  function filterOfflineBibleCards(query) {
    document
      .querySelectorAll("#offlineBibleSourceList .offline-bible-source-row")
      .forEach((row) => {
        row.hidden = !String(row.getAttribute("data-search") || "").includes(
          query,
        );
      });
  }
  searchInput?.addEventListener("input", () =>
    filterOfflineBibleCards(
      String(searchInput.value || "")
        .trim()
        .toLocaleLowerCase(),
    ),
  );
  document
    .getElementById("refreshOfflineBibleFiles")
    ?.addEventListener("click", renderCatalog);
  document
    .getElementById("deleteSelectedOfflineBibleFiles")
    ?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const status = document.getElementById("offlineBibleSourceStatus");
      const selectedFiles = [
        ...document.querySelectorAll(
          "#offlineBibleSourceList .offline-bible-source-select:checked:not(:disabled)",
        ),
      ].map((checkbox) => String(checkbox.getAttribute("data-offline-delete-file") || "").replace(/\\/g, "/")).filter((file) => file && !isProtectedEmbeddedOfflineBiblePath(file));
      if (!selectedFiles.length) return;
      const confirmMessage = offlineBibleUiText(
        `Permanently delete ${selectedFiles.length} selected downloaded translation(s) from this wallpaper's browser storage? This cannot be undone.`,
        `선택한 다운로드 역본 ${selectedFiles.length}개를 이 배경화면의 브라우저 저장소에서 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.`,
        `确定要从此壁纸的浏览器存储中永久删除所选的 ${selectedFiles.length} 个下载译本吗？此操作无法撤销。`,
        `この壁紙のブラウザー保存領域から選択したダウンロード済み翻訳 ${selectedFiles.length} 個を完全に削除しますか？この操作は元に戻せません。`,
      );
      if (!(await requestOfflineBibleDeleteConfirmation(confirmMessage))) return;
      const sourceButtons = document.querySelectorAll(
        "#offlineBibleSourceList .offline-bible-source-card, #offlineBibleSourceList .offline-bible-source-select",
      );
      sourceButtons.forEach((item) => (item.disabled = true));
      button.disabled = true;
      button.textContent = "삭제 중...";
      if (status) status.textContent = "선택한 오프라인 역본을 브라우저 저장소에서 삭제하는 중입니다...";
      try {
        const result = await mutateOfflineBibleStorage("delete", {
          files: selectedFiles,
        });
        const deletedSet = new Set(
          (Array.isArray(result.deleted) ? result.deleted : []).map((item) => String(item).replace(/\\/g, "/").toLowerCase()),
        );
        const activePath = String(activeOfflineBibleSource || localStorage.getItem(OFFLINE_BIBLE_SOURCE_KEY) || "").replace(/\\/g, "/").toLowerCase();
        if (activePath && deletedSet.has(activePath)) {
          activeOfflineBibleSource = "";
          try {
            localStorage.removeItem(OFFLINE_BIBLE_SOURCE_KEY);
            localStorage.removeItem(BIBLE_CONTENT_TRANSLATION_KEY);
          } catch {}
          const remaining = await getOfflineBibleCatalog().catch(() => ({ files: [] }));
          const hasDefault = (Array.isArray(remaining.files) ? remaining.files : []).some(
            (file) => String(file.relativePath || file.fileName || "").replace(/\\/g, "/").toLowerCase() === "embedded/en_esv.json" && !deletedSet.has("embedded/en_esv.json"),
          );
          try {
            if (hasDefault) {
              await loadOfflineBibleSource("embedded/EN_ESV.json", { restoring: true });
              displayVerseByKey(currentKey);
            } else if (Object.keys(localBibleVerses || {}).length) {
              currentBibleTranslation = { type: "local", id: "local-ko", language: "kor", name: "기본 한국어 본문 (내장)", shortName: "기본 역본" };
              activeTranslationBooks = [];
              activeOnlineChapter = null;
              bibleVerses = localBibleVerses;
              if (!currentKey || !bibleVerses[currentKey]) currentKey = sortVerseKeys(Object.keys(bibleVerses))[0];
              displayVerseByKey(currentKey);
            }
          } catch (fallbackError) {
            console.warn("Could not switch away from a deleted active Bible file.", fallbackError);
          }
        }
        await renderCatalog();
        const deletedCount = Array.isArray(result.deleted) ? result.deleted.length : 0;
        if (status) status.textContent = `${deletedCount}개 다운로드 역본을 브라우저 저장소에서 삭제했습니다.${result.missing?.length ? ` 찾을 수 없는 항목 ${result.missing.length}개.` : ""}`;
        updateOfflineDeleteButton();
      } catch (error) {
        console.error("Could not delete selected offline Bible files.", error);
        if (status) status.textContent = `파일 삭제 실패: ${error?.message || error}`;
        sourceButtons.forEach((item) => {
          item.disabled = item.getAttribute("aria-disabled") === "true";
        });
      } finally {
        button.disabled = document.querySelectorAll(
          "#offlineBibleSourceList .offline-bible-source-select:checked",
        ).length === 0;
        button.textContent = translateUIString("🗑 Delete selected");
      }
    });
  const importButton = document.getElementById("importOfflineBibleFilesButton");
  const importInput = document.getElementById("importOfflineBibleFilesInput");
  importButton?.addEventListener("click", () => importInput?.click());
  importInput?.addEventListener("change", async () => {
    const selected = Array.from(importInput.files || []);
    if (!selected.length) return;
    const status = document.getElementById("offlineBibleSourceStatus");
    let imported = 0;
    let skipped = 0;
    for (const file of selected) {
      try {
        const fileName = normalizeDownloadedBibleFilename(file.name);
        const existing = await readStoredOfflineBible(fileName);
        if (existing && !window.confirm(`${fileName} is already saved. Replace it with the selected file?`)) {
          skipped++;
          continue;
        }
        const raw = JSON.parse(await file.text());
        const normalized = normalizeOfflineBibleData(raw);
        await writeStoredOfflineBible(fileName, normalized);
        imported++;
      } catch (error) {
        skipped++;
        console.warn(`Could not import offline Bible file ${file.name}.`, error);
      }
    }
    importInput.value = "";
    if (status) status.textContent = `Imported ${imported} translation(s) into browser storage${skipped ? `; skipped ${skipped} file(s)` : ""}.`;
    await renderCatalog();
  });
  await renderCatalog();
}

async function openBibleTranslationSelector() {
  openModal(
    "🌍 성경 언어 선택",
    `<div class="bible-translation-loading">Bible.com에서 언어 목록을 불러오는 중입니다...</div>`,
  );
  try {
    const languages = await getOnlineTranslationCatalog();
    openBibleLanguageStep(languages);
  } catch (error) {
    console.error("Bible.com 언어 목록을 불러오지 못했습니다.", error);
    showBibleDirectConnectionGuide({
      reason: error?.message || String(error),
      retrySelector: true,
    });
  }
}

async function restoreSavedBibleTranslation() {
  let saved;
  try {
    saved = JSON.parse(
      localStorage.getItem(BIBLE_CONTENT_TRANSLATION_KEY) || "null",
    );
  } catch {
    saved = null;
  }
  if (!saved || saved.type !== "api" || !saved.id) return;
  try {
    await selectBibleTranslation(saved.id, null, {
      restore: true,
      languageCode: saved.languageCode || "",
    });

    restoreCurrentKeyOnNextLoop = Boolean(currentKey);
  } catch (error) {
    console.warn(
      "저장된 온라인 역본을 복원하지 못했습니다. 내장 본문을 사용합니다.",
      error,
    );
    currentBibleTranslation = {
      type: "local",
      id: "local-ko",
      language: "kor",
      name: "기본 한국어 본문 (내장)",
      shortName: "기본 역본",
    };
    activeTranslationBooks = [];
    activeOnlineChapter = null;
    bibleVerses = localBibleVerses;
    try {
      localStorage.setItem(
        BIBLE_CONTENT_TRANSLATION_KEY,
        JSON.stringify({ type: "local", id: "local-ko" }),
      );
    } catch {}
  }
}

function parseVerseKey(key) {
  const match = key.match(/^([가-힣]+)(\d+):(\d+)$/);
  if (!match) return { bookIdx: 999, chapter: 0, verse: 0 };
  const [, bookAbbr, chapter, verse] = match;
  const fullName = bibleBookMap[bookAbbr] || bookAbbr;
  return {
    bookIdx: bibleBookOrder[fullName] || 999,
    chapter: parseInt(chapter, 10),
    verse: parseInt(verse, 10),
  };
}

function sortVerseKeys(keys) {
  return [...keys].sort((a, b) => {
    const pA = parseVerseKey(a);
    const pB = parseVerseKey(b);
    if (pA.bookIdx !== pB.bookIdx) return pA.bookIdx - pB.bookIdx;
    if (pA.chapter !== pB.chapter) return pA.chapter - pB.chapter;
    return pA.verse - pB.verse;
  });
}

function generateFormattedTextForKeys(keys) {
  if (!keys || keys.length === 0) return "";
  const sortedKeys = sortVerseKeys(keys);
  const groups = [];
  let currentGroup = [];

  sortedKeys.forEach((k) => {
    const parsed = parseVerseKey(k);
    const bookAbbr = k.match(/^([가-힣]+)/)[1];
    const fullName = bibleBookMap[bookAbbr] || bookAbbr;

    if (currentGroup.length === 0) {
      currentGroup.push({ key: k, ...parsed, fullName });
    } else {
      const last = currentGroup[currentGroup.length - 1];
      if (
        last.fullName === fullName &&
        last.chapter === parsed.chapter &&
        last.verse + 1 === parsed.verse
      ) {
        currentGroup.push({ key: k, ...parsed, fullName });
      } else {
        groups.push(currentGroup);
        currentGroup = [{ key: k, ...parsed, fullName }];
      }
    }
  });
  if (currentGroup.length > 0) groups.push(currentGroup);

  return groups
    .map((group) => {
      if (group.length === 1) {
        const item = group[0];
        const text = bibleVerses[item.key] || "";
        return `${text} (${item.fullName} ${item.chapter}:${item.verse})`;
      } else {
        const first = group[0];
        const last = group[group.length - 1];
        const texts = group
          .map((item) => bibleVerses[item.key] || "")
          .join(", ");
        return `${texts} (${first.fullName} ${first.chapter}:${first.verse}-${last.verse})`;
      }
    })
    .join("\n\n");
}

function getMainText() {
  return document.querySelector(".main-text");
}
function getTypingText() {
  return document.querySelector(".typing-text");
}

function getBibleFontOpticalScale(text = null) {
  const isHandwriting = document.documentElement.classList.contains(
    "font-choice-handwriting",
  );
  if (!isHandwriting) return 0.68;

  const sourceText = String(
    text ?? currentVerseText ?? getTypingText()?.textContent ?? "",
  );
  const hasHangul = /[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/.test(
    sourceText,
  );
  return hasHangul ? 1 : 0.68;
}

function getTextVisualUnits(value) {
  let units = 0;
  for (const char of String(value || "")) {
    if (/\s/.test(char)) units += 0.28;
    else if (
      /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3\u2E80-\uA4CF\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFFEF]/.test(
        char,
      )
    )
      units += 1;
    else if (/[.,;:!?，。；：！？…'’“”‘’()\[\]{}]/.test(char)) units += 0.42;
    else if (/[\p{L}\p{N}]/u.test(char)) units += 0.55;
    else units += 0.65;
  }
  return units;
}

function isDenseCjkText(text) {
  const value = String(text || "");
  const cjkCount = (
    value.match(/[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7A3]/g) || []
  ).length;
  const latinCount = (value.match(/[A-Za-z\p{N}]/gu) || []).length;
  return cjkCount > 0 && cjkCount >= latinCount;
}

function fitTextToRegion(element, baseVh, minPx = 16) {
  if (!element) return;
  const region = element.parentElement;
  if (!region) return;

  const maxWidth = region.clientWidth;
  const maxHeight = region.clientHeight;
  if (!maxWidth || !maxHeight) return;

  const opticalScale = getBibleFontOpticalScale(
    currentVerseText || getTypingText()?.textContent || "",
  );
  const initialSize =
    Math.min((window.innerHeight * baseVh) / 100, maxWidth * 0.075) *
    opticalScale;
  const minSize =
    Math.max(minPx, window.innerWidth < 700 ? 14 : 16) * opticalScale;
  const fits = () =>
    element.scrollHeight <= maxHeight + 1 &&
    element.scrollWidth <= maxWidth + 1;

  element.style.fontSize = `${initialSize}px`;
  if (fits()) return;

  element.style.fontSize = `${minSize}px`;
  if (!fits()) return;

  let low = minSize;
  let high = initialSize;
  let best = minSize;
  for (let attempt = 0; attempt < 8; attempt++) {
    const middle = (low + high) / 2;
    element.style.fontSize = `${middle}px`;
    if (fits()) {
      best = middle;
      low = middle;
    } else {
      high = middle;
    }
  }
  element.style.fontSize = `${Math.round(best * 10) / 10}px`;
}
function isPhraseEnding(word) {
  return (
    /[,.;!?。！？…，；：]$/.test(word) ||
    /(?:하며|하고|하여|하니|하므로|하나니|이니라|로다|니라|므로|지만|그러나|그러므로|그리하여|또한|이는|곧)$/.test(
      word,
    )
  );
}

function formatVerseForDisplay(rawText) {
  const typingText = getTypingText();
  const text = String(rawText || "")
    .replace(/[\t\r\n]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!text) return "";

  const region = typingText?.parentElement;
  const width = region?.clientWidth || window.innerWidth * 0.86;
  const opticalScale = getBibleFontOpticalScale(text);
  const estimatedFontSize =
    Math.min(window.innerHeight * 0.054, width * 0.085) * opticalScale;
  const visualLength = getTextVisualUnits(text);
  const targetUnits = Math.max(
    15,
    Math.min(
      55,
      Math.floor((width / Math.max(estimatedFontSize, 12)) * 0.82) +
        Math.floor(visualLength / 14),
    ),
  );

  const denseCjk = isDenseCjkText(text);
  const joiner = denseCjk ? "" : " ";
  const words = denseCjk ? Array.from(text) : text.split(" ");
  const lines = [];
  let remaining = words.slice();

  while (remaining.length) {
    let lineWords = [];
    let lineLength = 0;
    let bestPhraseBreak = -1;
    let bestPhraseLength = 0;
    let consumed = 0;

    while (consumed < remaining.length) {
      const word = remaining[consumed];
      const separatorUnits =
        lineWords.length && joiner ? getTextVisualUnits(joiner) : 0;
      const nextLength = lineLength + separatorUnits + getTextVisualUnits(word);
      if (nextLength > targetUnits && lineWords.length) break;
      lineWords.push(word);
      lineLength = nextLength;
      consumed++;
      if (isPhraseEnding(word) && lineLength >= targetUnits * 0.58) {
        bestPhraseBreak = consumed;
        bestPhraseLength = lineLength;
      }
      if (lineLength >= targetUnits) break;
    }

    if (
      consumed < remaining.length &&
      bestPhraseBreak > 0 &&
      bestPhraseLength >= targetUnits * 0.58
    ) {
      consumed = bestPhraseBreak;
      lineWords = remaining.slice(0, consumed);
    }

    if (!lineWords.length) {
      lineWords = [remaining[0]];
      consumed = 1;
    }

    const restLength = getTextVisualUnits(
      remaining.slice(consumed).join(joiner),
    );
    if (
      restLength > 0 &&
      restLength < targetUnits * 0.32 &&
      lineWords.length > 1
    ) {
      lineWords.pop();
      consumed--;
      const adjusted = lineWords.join(joiner);
      if (adjusted) lines.push(adjusted);
      remaining = remaining.slice(consumed);
      continue;
    }

    lines.push(lineWords.join(joiner));
    remaining = remaining.slice(consumed);
  }

  return lines.join("\n");
}

function fitLayoutText() {
  const mainText = getMainText();
  const typingText = getTypingText();
  const layout = document.querySelector(".verse-layout");
  const reference = (mainText?.textContent || "").trim();
  const verse = currentVerseText || (typingText?.textContent || "").trim();
  const usableHeight = layout?.clientHeight || window.innerHeight;

  if (typingText && currentVerseText)
    typingText.textContent = formatVerseForDisplay(currentVerseText);

  const verseHeight = Math.min(
    42,
    29 + Math.max(0, getTextVisualUnits(verse) - 100) / 55,
  );
  const referenceHeight = Math.min(
    20,
    13 + Math.max(0, reference.length - 14) * 0.28,
  );
  document.documentElement.style.setProperty(
    "--verse-region-height",
    `${verseHeight}%`,
  );
  document.documentElement.style.setProperty(
    "--reference-region-height",
    `${referenceHeight}%`,
  );

  requestAnimationFrame(() => {
    const scale = usableHeight / window.innerHeight;
    const fontMultiplier = parseFloat(
      localStorage.getItem("bible_font_size_multiplier") || "1.0",
    );
    fitTextToRegion(
      typingText,
      Math.max(3.0, scale * 5.4 * fontMultiplier),
      14,
    );
    fitTextToRegion(mainText, Math.max(2.4, scale * 3.8 * fontMultiplier), 12);

    if (typingText && mainText) {
      const typingFontSize =
        parseFloat(window.getComputedStyle(typingText).fontSize) || 16;
      const handwritingLayout = document.documentElement.classList.contains(
        "font-choice-handwriting",
      );
      const referenceFloor = handwritingLayout
        ? 12 * getBibleFontOpticalScale(verse)
        : 9;
      mainText.style.fontSize = `${Math.max(referenceFloor, typingFontSize * 0.72)}px`;
      mainText.style.fontWeight = "normal";
    }
    applyTextVisualEffects();
  });
}

window.addEventListener("resize", fitLayoutText);
window.addEventListener("orientationchange", fitLayoutText);

function formatBibleReference(key) {
  if (!key) return "";
  const match = key.match(/^([가-힣]+)(\d+:\d+)$/);
  if (!match) return key;
  const [, bookAbbr, chapterVerse] = match;
  const fullName = getBibleBookDisplayName(bookAbbr);
  const [chapter, verse] = chapterVerse.split(":");
  const reference = `${fullName} ${chapter}:${verse}`;
  if (isOnlineBibleTranslationActive()) {
    const versionLabel =
      currentBibleTranslation.shortName || currentBibleTranslation.id;
    return `${reference} · ${versionLabel}`;
  }
  return reference;
}

function showToast(message) {
  let toast = document.getElementById("bibleToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "bibleToast";
    document.body.appendChild(toast);
  }
  toast.textContent = translateUIString(message);
  toast.classList.add("show");
  if (toast.hideTimeout) clearTimeout(toast.hideTimeout);
  toast.hideTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

function addHistory(key) {
  readingHistory = readingHistory.filter((k) => k !== key);
  readingHistory.unshift(key);
  const maxHistory = storageLimits.history || 30;
  if (readingHistory.length > maxHistory)
    readingHistory = readingHistory.slice(0, maxHistory);
  localStorage.setItem("bible_history", JSON.stringify(readingHistory));
}

function displayVerseByKey(key, onImageChange) {
  const mainText = getMainText();
  const typingText = getTypingText();
  if (!bibleVerses[key]) return;
  currentKey = key;
  addHistory(key);
  savePlaybackState();

  const fullText = String(bibleVerses[key]);
  if (mainText) mainText.textContent = formatBibleReference(key);
  currentVerseText = fullText;
  if (typingText) typingText.textContent = formatVerseForDisplay(fullText);
  fitLayoutText();

  requestAnimationFrame(() => {
    const fontMultiplier = parseFloat(
      localStorage.getItem("bible_font_size_multiplier") || "1.0",
    );
    fitTextToRegion(typingText, 5.4 * fontMultiplier, 14);
    fitTextToRegion(mainText, 3.8 * fontMultiplier, 12);
    applyTextVisualEffects();
  });

  mainText?.classList.remove("fade-out");
  typingText?.classList.remove("fade-out");
  if (typeof onImageChange === "function") onImageChange();
}

function getAdjacentVerseKey(key, direction) {
  const keys = sortVerseKeys(Object.keys(bibleVerses));
  if (!keys.length) return key;
  let idx = keys.indexOf(key);
  if (idx === -1) idx = 0;
  idx += direction;
  if (idx < 0) idx = keys.length - 1;
  if (idx >= keys.length) idx = 0;
  return keys[idx];
}

function openModal(title, htmlContent) {
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");
  const modal = document.getElementById("bibleModal");
  const fontComparisonPanel = document.getElementById("fontComparisonPanel");
  const uiScaleSettingsPanel = document.getElementById("uiScaleSettingsPanel");
  if (fontComparisonPanel) fontComparisonPanel.hidden = true;
  if (uiScaleSettingsPanel) uiScaleSettingsPanel.hidden = true;
  if (modalTitle) modalTitle.textContent = title;
  if (modalBody) {
    modalBody.hidden = false;
    modalBody.innerHTML = htmlContent;
  }
  if (modal) modal.classList.remove("hidden");
  localizeUITree(modal);
}

function closeModal() {
  closeFontPreviewModal();
  const modal = document.getElementById("bibleModal");
  const fontComparisonPanel = document.getElementById("fontComparisonPanel");
  const uiScaleSettingsPanel = document.getElementById("uiScaleSettingsPanel");
  if (fontComparisonPanel) fontComparisonPanel.hidden = true;
  if (uiScaleSettingsPanel) uiScaleSettingsPanel.hidden = true;
  if (modal) modal.classList.add("hidden");
  const tooltip = document.getElementById("storageTooltip");
  if (tooltip) tooltip.style.display = "none";
}

function buildSearchModalHtml() {
  let html = `<div id="searchScrollContainer" style="max-height:360px; overflow-y:auto; padding-right:10px;">`;
  html += `<p style="color:#ffd700; font-size:14px; margin-bottom:12px; font-weight:bold; text-align:center;">📚 읽고 싶은 성경 책을 선택하세요</p><div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;">`;
  const books = isOnlineBibleTranslationActive()
    ? canonicalBooksForActiveTranslation()
        .map((book) => [
          getBookAbbrByOrder(book.canonicalOrder ?? book.order),
          book.commonName || book.name,
        ])
        .filter(([abbr]) => Boolean(abbr))
    : Object.keys(bibleBookMap).map((abbr) => [
        abbr,
        getBibleBookDisplayName(abbr),
      ]);
  books.forEach(([abbr, fullName]) => {
    const tooltip = getBibleBookSelectionTooltip(fullName);
    html += `<button class="book-select-btn" data-abbr="${escapeBibleHtml(abbr)}" style="padding:10px 4px; border-radius:12px; color:#fff; font-size:13px; cursor:pointer;" data-tip="${escapeBibleHtml(tooltip)}">${escapeBibleHtml(fullName)}</button>`;
  });
  html += "</div></div>";
  return html;
}

function openSearchModal(onImageChange) {
  openModal("📖 성경 목차 선택", buildSearchModalHtml());
  const searchScroll = document.getElementById("searchScrollContainer");
  searchScroll?.addEventListener(
    "wheel",
    (e) => {
      e.stopPropagation();
    },
    { passive: true },
  );

  document.querySelectorAll(".book-select-btn").forEach((el) => {
    el.addEventListener("click", (e) => {
      const abbr = e.currentTarget.getAttribute("data-abbr");
      renderChapterSelect(abbr, onImageChange);
    });
  });
}

function buildChapterSelectHtml(abbr) {
  const fullName = getBibleBookDisplayName(abbr);
  let chapters;
  if (isOnlineBibleTranslationActive()) {
    const order = getBookOrderByAbbr(abbr);
    const book = activeTranslationBooks.find(
      (item) => Number(item.canonicalOrder ?? item.order) === order,
    );
    const first = Math.max(1, Number(book?.firstChapterNumber) || 1);
    const last = Math.max(
      first,
      Number(book?.lastChapterNumber) ||
        Number(book?.numberOfChapters) ||
        first,
    );
    chapters = Array.from(
      { length: last - first + 1 },
      (_, index) => first + index,
    );
  } else {
    const keys = Object.keys(bibleVerses).filter((k) => k.startsWith(abbr));
    chapters = [
      ...new Set(
        keys.map((k) => {
          const m = k.match(/^[가-힣]+(\d+):\d+$/);
          return m ? parseInt(m[1]) : 1;
        }),
      ),
    ].sort((a, b) => a - b);
  }

  let html = `<div id="chapScrollContainer" style="max-height:360px; overflow-y:auto; padding-right:10px;">`;
  html += `<button id="backToSearch" style="background:transparent; color:#4a90e2; border:none; cursor:pointer; font-size:13px; margin-bottom:10px; border-radius:8px; padding:4px 8px;" data-tip="성경 책 목차로 돌아가기">◀ 성경 책 목록으로 돌아가기</button>`;
  html += `<h4 style="color:#ffd700; margin-bottom:10px; text-align:center;">${escapeBibleHtml(fullName)} 장 선택</h4><div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:8px;">`;
  chapters.forEach((ch) => {
    html += `<button class="chap-select-btn" data-abbr="${escapeBibleHtml(abbr)}" data-chap="${ch}" style="padding:10px; border-radius:12px; color:#fff; font-size:14px; cursor:pointer;" data-tip="${escapeBibleHtml(fullName)} ${ch}장 선택">${ch}장</button>`;
  });
  html += "</div></div>";
  return { fullName, html };
}

function renderChapterSelect(abbr, onImageChange) {
  const { fullName, html } = buildChapterSelectHtml(abbr);
  openModal(`📖 ${fullName} 장 선택`, html);
  const chapScroll = document.getElementById("chapScrollContainer");
  chapScroll?.addEventListener(
    "wheel",
    (e) => {
      e.stopPropagation();
    },
    { passive: true },
  );

  document.getElementById("backToSearch")?.addEventListener("click", () => {
    openSearchModal(onImageChange);
  });
  document.querySelectorAll(".chap-select-btn").forEach((el) => {
    el.addEventListener("click", (e) => {
      const ab = e.currentTarget.getAttribute("data-abbr");
      const ch = e.currentTarget.getAttribute("data-chap");
      renderVerseSelect(ab, ch, onImageChange);
    });
  });
}

function buildVerseSelectHtml(abbr, chapter, verseSource = bibleVerses) {
  const fullName = getBibleBookDisplayName(abbr);
  const keys = Object.keys(verseSource).filter((key) =>
    key.startsWith(`${abbr}${chapter}:`),
  );
  const verses = keys
    .map((key) => {
      const match = key.match(/^[가-힣]+\d+:(\d+)$/);
      return match ? parseInt(match[1], 10) : 1;
    })
    .sort((a, b) => a - b);

  let html = `<div id="verseScrollContainer" style="max-height:360px; overflow-y:auto; padding-right:10px;">`;
  html += `<button id="backToChapters" style="background:transparent; color:#4a90e2; border:none; cursor:pointer; font-size:13px; margin-bottom:10px; border-radius:8px; padding:4px 8px;" data-tip="장 목록으로 돌아가기">◀ 장 목록으로 돌아가기</button>`;
  html += `<h4 style="color:#ffd700; margin-bottom:10px; text-align:center;">${escapeBibleHtml(fullName)} ${escapeBibleHtml(chapter)}장 절 선택</h4><div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:8px;">`;
  verses.forEach((verse) => {
    html += `<button class="verse-select-btn" data-key="${escapeBibleHtml(abbr)}${escapeBibleHtml(chapter)}:${verse}" style="padding:10px; border-radius:12px; color:#fff; font-size:14px; cursor:pointer;" data-tip="${escapeBibleHtml(fullName)} ${escapeBibleHtml(chapter)}장 ${verse}절 선택">${verse}절</button>`;
  });
  html += "</div></div>";
  return { fullName, html };
}

async function renderVerseSelect(abbr, chapter, onImageChange) {
  if (isOnlineBibleTranslationActive()) {
    const requestedOrder = getBookOrderByAbbr(abbr);
    const requestedBook = activeTranslationBooks.find(
      (item) => Number(item.canonicalOrder ?? item.order) === requestedOrder,
    );
    if (!requestedBook) {
      showToast("해당 구절을 찾을 수 없습니다.");
      return;
    }
    openModal(
      "📖 본문 조회",
      `<div class="bible-translation-loading">선택한 장 본문을 불러오는 중입니다...</div>`,
    );
    try {
      const requestedKey = `${abbr}${Number(chapter)}:1`;
      const resolved = await findSupportedOnlinePassage(
        currentBibleTranslation,
        activeTranslationBooks,
        requestedKey,
      );
      const record = resolved.chapterRecord;
      const actualAbbr =
        getBookAbbrByOrder(record.book.canonicalOrder ?? record.book.order) ||
        abbr;
      const actualChapter = Number(record.chapterNumber) || Number(chapter);
      const { fullName, html } = buildVerseSelectHtml(
        actualAbbr,
        actualChapter,
        record.verses,
      );
      openModal(`📖 ${fullName} ${actualChapter}장 절 선택`, html);
      const verseScroll = document.getElementById("verseScrollContainer");
      verseScroll?.addEventListener(
        "wheel",
        (event) => event.stopPropagation(),
        { passive: true },
      );
      document
        .getElementById("backToChapters")
        ?.addEventListener("click", () =>
          renderChapterSelect(actualAbbr, onImageChange),
        );
      document.querySelectorAll(".verse-select-btn").forEach((element) => {
        element.addEventListener("click", (event) => {
          const targetKey = event.currentTarget.getAttribute("data-key");
          if (!targetKey || !record.verses[targetKey]) {
            showToast("해당 구절을 찾을 수 없습니다.");
            return;
          }
          activateOnlineChapter(record);
          currentKey = targetKey;
          pausePlaybackForBibleChange();
          displayVerseByKey(targetKey, onImageChange);
          closeModal();
          showToast(
            `[${formatBibleReference(targetKey)}] 구절로 이동했습니다.`,
          );
        });
      });
      if (resolved.moved) {
        showToast(
          "요청한 장절이 이 역본에 없어 가장 가까운 지원 장절을 표시했습니다.",
        );
      }
    } catch (error) {
      console.error("선택한 장 본문 조회 실패:", error);
      openModal(
        "📖 본문 조회 오류",
        `<div class="bible-translation-error"><p>역본 본문을 불러오지 못했습니다. 인터넷 연결과 Bible.com 접속 상태를 확인해 주세요.</p><button type="button" id="retryBibleChapter" class="book-select-btn">다시 시도</button><button type="button" id="openBibleDirectHelpFromChapter" class="book-select-btn">🌐 직접 연결 도움말 보기</button><button type="button" id="backToBibleChapters" class="bible-translation-back">◀ 장 목록으로 돌아가기</button></div>`,
      );
      document
        .getElementById("retryBibleChapter")
        ?.addEventListener("click", () =>
          renderVerseSelect(abbr, chapter, onImageChange),
        );
      document
        .getElementById("openBibleDirectHelpFromChapter")
        ?.addEventListener("click", () => showBibleDirectConnectionGuide());
      document
        .getElementById("backToBibleChapters")
        ?.addEventListener("click", () =>
          renderChapterSelect(abbr, onImageChange),
        );
    }
    return;
  }

  const { fullName, html } = buildVerseSelectHtml(abbr, chapter);
  openModal(`📖 ${fullName} ${chapter}장 절 선택`, html);
  const verseScroll = document.getElementById("verseScrollContainer");
  verseScroll?.addEventListener("wheel", (event) => event.stopPropagation(), {
    passive: true,
  });
  document
    .getElementById("backToChapters")
    ?.addEventListener("click", () => renderChapterSelect(abbr, onImageChange));
  document.querySelectorAll(".verse-select-btn").forEach((element) => {
    element.addEventListener("click", (event) => {
      const targetKey = event.currentTarget.getAttribute("data-key");
      if (targetKey && bibleVerses[targetKey]) {
        isPaused = true;
        const btnPause = document.getElementById("btnPause");
        if (btnPause) btnPause.textContent = "▶";
        displayVerseByKey(targetKey, onImageChange);
        closeModal();
        showToast(`[${formatBibleReference(targetKey)}] 구절로 이동했습니다.`);
      } else {
        showToast("해당 구절을 찾을 수 없습니다.");
      }
    });
  });
}

function buildSettingsModalHtml(
  currentMultiplier,
  currentSharpness,
  currentShadow,
  currentBlur,
  currentResolution,
) {
  return `<div id="settingsScrollContainer" style="max-height:min(360px, 44vh); overflow-y:auto; padding-right:10px;">
    <p style="color:#ffd700; font-size:14px; margin-bottom:12px; font-weight:bold; text-align:center;">🔤 폰트 및 시각 효과 설정</p>
    
    <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); padding:10px; border-radius:10px; margin-bottom:10px;">
      <label style="display:block; font-size:12px; color:rgba(255,255,255,0.8); margin-bottom:6px; text-align:center;">🖼️ 배경 이미지 해상도 지정</label>
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">
        <button class="font-ctrl-btn resolution-btn ${currentResolution === "1K" ? "active" : ""}" data-val="1K" style="padding:6px; font-size:11px; border-radius:8px;" data-tip="1K 해상도">1K</button>
        <button class="font-ctrl-btn resolution-btn ${currentResolution === "2K" ? "active" : ""}" data-val="2K" style="padding:6px; font-size:11px; border-radius:8px;" data-tip="2K 해상도">2K</button>
        <button class="font-ctrl-btn resolution-btn ${currentResolution === "4K" ? "active" : ""}" data-val="4K" style="padding:6px; font-size:11px; border-radius:8px;" data-tip="4K 해상도 (기본)">4K</button>
      </div>
    </div>

    <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); padding:10px; border-radius:10px; margin-bottom:10px; text-align:center;">
      <label style="display:block; font-size:12px; color:rgba(255,255,255,0.8); margin-bottom:6px;">글자 크기 조절</label>
      <div style="display:flex; justify-content:center; align-items:center; gap:10px;">
        <button class="font-ctrl-btn" id="decreaseFontBtn" style="padding:6px 14px; border-radius:8px; font-size:14px; font-weight:bold; cursor:pointer;" data-tip="크기 축소">A-</button>
        <span id="fontScaleDisplay" style="font-size:14px; color:#fff; font-weight:bold; min-width:50px;">${Math.round(currentMultiplier * 100)}%</span>
        <button class="font-ctrl-btn" id="increaseFontBtn" style="padding:6px 14px; border-radius:8px; font-size:14px; font-weight:bold; cursor:pointer;" data-tip="크기 확대">A+</button>
      </div>
    </div>

    <div style="margin-bottom:10px;">
      <label style="display:block; font-size:12px; color:rgba(255,255,255,0.8); margin-bottom:6px;">글자 선명도 처리</label>
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">
        <button class="font-ctrl-btn sharpness-btn ${currentSharpness === "subpixel-antialiased" ? "active" : ""}" data-val="subpixel-antialiased" style="padding:6px; font-size:11px; border-radius:8px;">기본 선명함</button>
        <button class="font-ctrl-btn sharpness-btn ${currentSharpness === "antialiased" ? "active" : ""}" data-val="antialiased" style="padding:6px; font-size:11px; border-radius:8px;">스무스</button>
        <button class="font-ctrl-btn sharpness-btn ${currentSharpness === "none" ? "active" : ""}" data-val="none" style="padding:6px; font-size:11px; border-radius:8px;">끔(픽셀)</button>
      </div>
    </div>

    <div style="margin-bottom:10px;">
      <label style="display:block; font-size:12px; color:rgba(255,255,255,0.8); margin-bottom:6px;">그림자 효과</label>
      <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px;">
        <button class="font-ctrl-btn shadow-btn ${currentShadow === "none" ? "active" : ""}" data-val="none" style="padding:6px; font-size:11px; border-radius:8px;">없음</button>
        <button class="font-ctrl-btn shadow-btn ${currentShadow === "light" ? "active" : ""}" data-val="light" style="padding:6px; font-size:11px; border-radius:8px;">은은함</button>
        <button class="font-ctrl-btn shadow-btn ${currentShadow === "medium" ? "active" : ""}" data-val="medium" style="padding:6px; font-size:11px; border-radius:8px;">보통</button>
        <button class="font-ctrl-btn shadow-btn ${currentShadow === "strong" ? "active" : ""}" data-val="strong" style="padding:6px; font-size:11px; border-radius:8px;">진함</button>
      </div>
    </div>

    <div style="margin-bottom:14px;">
      <label style="display:block; font-size:12px; color:rgba(255,255,255,0.8); margin-bottom:6px;">글자 필터 블러 효과</label>
      <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px;">
        <button class="font-ctrl-btn blur-btn ${currentBlur === "none" ? "active" : ""}" data-val="none" style="padding:6px; font-size:11px; border-radius:8px;">없음</button>
        <button class="font-ctrl-btn blur-btn ${currentBlur === "light" ? "active" : ""}" data-val="light" style="padding:6px; font-size:11px; border-radius:8px;">약한 블러</button>
      </div>
    </div>

    <div style="border-top:1px dashed rgba(255,85,85,0.3); padding-top:12px; text-align:center; margin-bottom:10px;">
      <button class="font-ctrl-btn" id="resetFontSettingsBtn" style="width:100%; padding:8px; border-radius:8px; font-size:12px; background:rgba(255,85,85,0.15) !important; color:#ff5555 !important; border-color:rgba(255,85,85,0.4) !important; cursor:pointer;" data-tip="모든 폰트 및 시각 효과 설정을 기본값으로 초기화합니다">🔄 폰트 설정 전체 초기화</button>
    </div>

    <div style="border-top:1px dashed rgba(255,255,255,0.18); padding-top:10px; text-align:center; margin-bottom:14px;">
      <button class="font-ctrl-btn" id="clearTempCacheBtn" style="width:100%; padding:8px; border-radius:8px; font-size:12px; background:rgba(255,170,60,0.12) !important; color:#ffc66d !important; border-color:rgba(255,190,90,0.35) !important; cursor:pointer;" data-tip="프로젝트 임시 저장소와 앱 캐시를 삭제합니다. 폰트 설정 및 보관함 데이터는 유지됩니다">🧹 임시 데이터 및 캐시 삭제</button>
    </div>


    <div style="border-top:1px solid rgba(255,255,255,0.15); padding-top:14px; text-align:center; font-size:11px; color:rgba(255,255,255,0.6); line-height:1.5;">
      <div style="background:rgba(0,0,0,0.25); padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,0.08); text-align:left; margin-top:8px;">
        <details class="bible-api-details" id="bibleSourceApiDetails">
          <summary>${translateUIString("View all Bible data APIs")}</summary>
          <div class="bible-api-details-body">
            <h4>${translateUIString("External data services")}</h4>
            <ul>
              <li><strong>Bible.com language/default-version catalog</strong><br><code>GET https://www.bible.com/api/bible/configuration</code><br>Provides default language and translation configuration.</li>
              <li><strong>Bible.com translation catalog</strong><br><code>GET https://www.bible.com/api/bible/versions?language_tag={languageTag}&amp;type=all</code><br>Lists translations for the selected language. <a href="https://www.bible.com/api/bible/versions?language_tag=en&amp;type=all" target="_blank" rel="noopener noreferrer">Open an English sample</a>.</li>
              <li><strong>Bible.com translation metadata and book/chapter index</strong><br><code>GET https://nodejs.bible.com/api/bible/version/3.3?id={versionId}</code></li>
              <li><strong>Bible.com rendered chapter text</strong><br><code>GET https://www.bible.com/{locale}/bible/{versionId}/{USFM}.{abbreviation}</code><br>Fallback page patterns omit the locale or translation abbreviation.</li>
              <li><strong>Bible.com legacy Next.js JSON fallback</strong><br><code>GET https://www.bible.com/_next/data/{buildId}/en/bible/{versionId}/{USFM}.{abbreviation}.json</code><br>The build ID is read from <a href="https://www.bible.com/" target="_blank" rel="noopener noreferrer">https://www.bible.com/</a>; a second request may append <code>?version={versionId}&amp;usfm={USFM}.{abbreviation}</code>. This is only a fallback when the chapter page parser cannot find text.</li>
              <li><strong>Bible.com translation information pages</strong><br><code>https://www.bible.com/versions/{versionId}</code> and <code>https://www.bible.com/languages/{languageSlug}</code> are shown as reference links in the selection UI; the language index is <a href="https://www.bible.com/languages" target="_blank" rel="noopener noreferrer">Bible.com/languages</a>.</li>
              <li><strong>Wikidata Query Service — publication-year metadata (P577)</strong><br><code>POST https://query.wikidata.org/sparql</code><br>Used to enrich translation release/publication years when Bible.com metadata does not provide one. <a href="https://query.wikidata.org/" target="_blank" rel="noopener noreferrer">Service home</a>.</li>
              <li><strong>Source repository</strong><br><a href="https://github.com/stranger828/bibleAPI" target="_blank" rel="noopener noreferrer">https://github.com/stranger828/bibleAPI</a></li>
              <li><strong>Not used</strong><br>API.Bible and Bible Brain / FCBH APIs are not called by this project.</li>
            </ul>
            <h4>${translateUIString("Additional visual data source")}</h4>
            <ul>
              <li><strong>Picsum Photos — wallpaper image source</strong><br><a href="https://picsum.photos/" target="_blank" rel="noopener noreferrer">https://picsum.photos/</a><br>Used as the image source for the rotating wallpaper background.</li>
            </ul>
            <h4>${translateUIString("Offline Bible storage")}</h4>
            <p>${translateUIString("Online Bible.com translations connect directly to Bible.com. Built-in translations are read from the wallpaper package, and translations downloaded from the online selector are stored persistently in this wallpaper's browser storage (IndexedDB). No localhost server or automatic-start task is used.")}</p>
            <button type="button" id="copyBibleApiListButton">${translateUIString("Copy Bible API list")}</button>
          </div>
        </details>
      </div>
    </div>
  </div>`;
}

async function clearProjectTemporaryDataAndCaches() {
  const result = {
    localStorageEntries: 0,
    sessionStorageEntries: 0,
    cacheEntries: 0,
    databases: 0,
    memoryCacheEntries: 0,
    failures: 0,
  };
  const temporaryKeyPattern = /(^|[_:.-])(temp|tmp|cache)([_:.-]|$)/i;
  const appCacheDatabasePattern =
    /(?:spotlight|bible).*(?:cache|temp|tmp)|(?:cache|temp|tmp).*(?:spotlight|bible)/i;

  try {
    const matchingKeys = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key && temporaryKeyPattern.test(key)) matchingKeys.push(key);
    }
    matchingKeys.forEach((key) => {
      localStorage.removeItem(key);
      result.localStorageEntries++;
    });
  } catch (error) {
    result.failures++;
    console.warn(
      "Could not remove explicitly temporary localStorage entries.",
      error,
    );
  }

  try {
    const matchingSessionKeys = [];
    for (let index = 0; index < sessionStorage.length; index++) {
      const key = sessionStorage.key(index);
      if (key && temporaryKeyPattern.test(key)) matchingSessionKeys.push(key);
    }
    matchingSessionKeys.forEach((key) => {
      sessionStorage.removeItem(key);
      result.sessionStorageEntries++;
    });
  } catch (error) {
    result.failures++;
    console.warn(
      "Could not remove explicitly temporary sessionStorage entries.",
      error,
    );
  }

  try {
    if (window.caches && typeof window.caches.keys === "function") {
      const cacheNames = await window.caches.keys();
      const appCacheNames = cacheNames.filter((name) =>
        appCacheDatabasePattern.test(name),
      );
      const deleteResults = await Promise.all(
        appCacheNames.map(async (cacheName) => {
          try {
            return await window.caches.delete(cacheName);
          } catch (error) {
            result.failures++;
            console.warn(
              `Could not remove temporary cache ${cacheName}.`,
              error,
            );
            return false;
          }
        }),
      );
      result.cacheEntries = deleteResults.filter(Boolean).length;
    }
  } catch (error) {
    result.failures++;
    console.warn("Could not inspect temporary Cache Storage entries.", error);
  }

  try {
    if (window.indexedDB && typeof window.indexedDB.databases === "function") {
      const databases = await window.indexedDB.databases();
      const temporaryDatabases = databases.filter(
        (database) =>
          database?.name &&
          appCacheDatabasePattern.test(database.name) &&
          temporaryKeyPattern.test(database.name),
      );
      const deleteResults = await Promise.all(
        temporaryDatabases.map(
          (database) =>
            new Promise((resolve) => {
              try {
                const request = window.indexedDB.deleteDatabase(database.name);
                request.onsuccess = () => resolve(true);
                request.onerror = () => {
                  result.failures++;
                  resolve(false);
                };
                request.onblocked = () => {
                  result.failures++;
                  resolve(false);
                };
              } catch (error) {
                result.failures++;
                console.warn(
                  `Could not remove temporary database ${database.name}.`,
                  error,
                );
                resolve(false);
              }
            }),
        ),
      );
      result.databases = deleteResults.filter(Boolean).length;
    }
  } catch (error) {
    result.failures++;
    console.warn("Could not inspect temporary IndexedDB databases.", error);
  }

  const runtimeCaches = [
    onlineTranslationBooksCache,
    onlineTranslationMetadataCache,
    onlineTranslationVersionsCache,
    onlineChapterCache,
  ];
  for (const cache of runtimeCaches) {
    result.memoryCacheEntries += cache.size;
    cache.clear();
  }
  if (onlineTranslationCatalog) result.memoryCacheEntries++;
  if (bibleComBuildId) result.memoryCacheEntries++;
  onlineTranslationCatalog = null;
  onlineTranslationCatalogPromise = null;
  bibleComBuildId = null;
  bibleComBuildIdPromise = null;

  return result;
}

const UI_SCALE_STORAGE_KEY = "spotlight_ui_scale_percent";
const UI_SCALE_SCHEMA_KEY = "spotlight_ui_scale_schema";
const UI_SCALE_PRESETS = [
  { value: 80, name: "Compact", factor: 80 / 120, display: "Compact · 67%" },
  {
    value: 100,
    name: "Comfortable",
    factor: 100 / 120,
    display: "Comfortable · 83%",
  },
  { value: 120, name: "Standard", factor: 1, display: "Standard · 100%" },
  { value: 140, name: "Large", factor: 140 / 120, display: "Large · 117%" },
  {
    value: 160,
    name: "Extra Large",
    factor: 160 / 120,
    display: "Extra Large · 133%",
  },
];

function getUIScalePresetIndex() {
  try {
    const savedText = localStorage.getItem(UI_SCALE_STORAGE_KEY);
    if (savedText === null) return 2;
    const saved = Number(savedText);
    if (!Number.isFinite(saved)) return 2;
    if (localStorage.getItem(UI_SCALE_SCHEMA_KEY) === "2") {
      const index = UI_SCALE_PRESETS.findIndex(
        (preset) => preset.value === saved,
      );
      return index >= 0 ? index : 2;
    }
    if (saved >= 80 && saved <= 120) {
      const oldFactor = saved / 100;
      let closestIndex = 2;
      let closestDistance = Infinity;
      UI_SCALE_PRESETS.forEach((preset, index) => {
        const distance = Math.abs(preset.factor - oldFactor);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      return closestIndex;
    }
  } catch {}
  return 2;
}

function getUIScaleFactor() {
  return UI_SCALE_PRESETS[getUIScalePresetIndex()]?.factor ?? 1;
}

function formatUIScaleDisplay(index) {
  const preset =
    UI_SCALE_PRESETS[
      Math.max(
        0,
        Math.min(UI_SCALE_PRESETS.length - 1, Math.round(Number(index) || 0)),
      )
    ];
  return translateUIString(preset.display);
}

function applyUIScale(value, persist = false) {
  const index = Math.max(
    0,
    Math.min(UI_SCALE_PRESETS.length - 1, Math.round(Number(value) || 0)),
  );
  const preset = UI_SCALE_PRESETS[index];
  document.documentElement.style.setProperty(
    "--spotlight-ui-scale",
    preset.factor.toFixed(3),
  );
  if (persist) {
    try {
      localStorage.setItem(UI_SCALE_STORAGE_KEY, String(preset.value));
      localStorage.setItem(UI_SCALE_SCHEMA_KEY, "2");
    } catch (error) {
      console.warn("Could not save the UI scale preference.", error);
    }
  }
  return index;
}

function openSettingsModal() {
  const currentMultiplier = parseFloat(
    localStorage.getItem("bible_font_size_multiplier") || "1.0",
  );
  const currentSharpness =
    localStorage.getItem("bible_text_sharpness") || "subpixel-antialiased";
  const currentShadow = localStorage.getItem("bible_text_shadow") || "medium";
  const currentBlur = localStorage.getItem("bible_text_blur") || "none";
  const currentResolution = getImageResolution();

  openModal(
    "⚙️ 환경 설정",
    buildSettingsModalHtml(
      currentMultiplier,
      currentSharpness,
      currentShadow,
      currentBlur,
      currentResolution,
    ),
  );

  const fontComparisonPanel = document.getElementById("fontComparisonPanel");
  if (fontComparisonPanel) fontComparisonPanel.hidden = false;
  const uiScaleSettingsPanel = document.getElementById("uiScaleSettingsPanel");
  if (uiScaleSettingsPanel) uiScaleSettingsPanel.hidden = false;
  const uiScaleSlider = document.getElementById("uiScaleSlider");
  const uiScaleDisplay = document.getElementById("uiScaleDisplay");
  const currentUIScale = getUIScalePresetIndex();
  if (uiScaleSlider) uiScaleSlider.value = String(currentUIScale);
  if (uiScaleDisplay)
    uiScaleDisplay.textContent = formatUIScaleDisplay(currentUIScale);
  localizeUITree(fontComparisonPanel);
  localizeUITree(uiScaleSettingsPanel);
  applyBibleFontMode();

  const settingsScroll = document.getElementById("settingsScrollContainer");
  localizeUITree(document.getElementById("modalBody"));
  settingsScroll?.addEventListener(
    "wheel",
    (e) => {
      e.stopPropagation();
    },
    { passive: true },
  );

  document.getElementById("copyEmailLink")?.addEventListener("click", () => {
    navigator.clipboard.writeText("voidbox473929@gmail.com").then(() => {
      showToast("이메일 주소가 클립보드에 복사되었습니다.");
    });
  });
  document
    .getElementById("copyBibleApiListButton")
    ?.addEventListener("click", async () => {
      const endpoints = [
        "Wallpaper image source: https://picsum.photos/",
        "Bible.com language/default-version catalog: GET https://www.bible.com/api/bible/configuration",
        "Bible.com translation catalog: GET https://www.bible.com/api/bible/versions?language_tag={languageTag}&type=all",
        "Bible.com translation metadata/books/chapters: GET https://nodejs.bible.com/api/bible/version/3.3?id={versionId}",
        "Bible.com rendered chapter HTML: GET https://www.bible.com/{locale}/bible/{versionId}/{USFM}.{abbreviation} (fallbacks without locale/abbreviation)",
        "Bible.com Next.js JSON fallback: GET https://www.bible.com/_next/data/{buildId}/en/bible/{versionId}/{USFM}.{abbreviation}.json (optional query: ?version={versionId}&usfm={USFM}.{abbreviation})",
        "Bible.com homepage build ID: GET https://www.bible.com/",
        "Bible.com translation info pages: https://www.bible.com/versions/{versionId}; language index/pages: https://www.bible.com/languages and https://www.bible.com/languages/{languageSlug}",
        "Wikidata publication-year metadata (P577): POST https://query.wikidata.org/sparql",
        "Offline Bible translations are loaded from the embedded package and browser storage; no remote fallback is required for offline mode.",
        "GitHub source repository: https://github.com/stranger828/bibleAPI",
        "Offline translations: built-in JSON files are read from ./data/embedded/; online translations saved for offline use are stored in browser IndexedDB.",
        "API.Bible and Bible Brain / FCBH are not used by this project.",
      ].join("\n");
      try {
        await navigator.clipboard.writeText(endpoints);
        showToast(translateUIString("Bible API endpoints copied."));
      } catch (error) {
        console.warn("Could not copy Bible API list.", error);
        showToast(
          "Could not copy the API list. Select the entries in the source panel manually.",
        );
      }
    });

  document.querySelectorAll(".resolution-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".resolution-btn")
        .forEach((b) => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      const selectedRes = e.currentTarget.getAttribute("data-val");
      setImageResolution(selectedRes);
      showToast(`배경 이미지 해상도가 [${selectedRes}] (으)로 설정되었습니다.`);
    });
  });

  let currentVal = currentMultiplier;
  document.getElementById("decreaseFontBtn")?.addEventListener("click", () => {
    currentVal = Math.max(0.7, parseFloat((currentVal - 0.1).toFixed(1)));
    localStorage.setItem("bible_font_size_multiplier", currentVal);
    const display = document.getElementById("fontScaleDisplay");
    if (display) display.textContent = `${Math.round(currentVal * 100)}%`;
    fitLayoutText();
  });
  document.getElementById("increaseFontBtn")?.addEventListener("click", () => {
    currentVal = Math.min(1.5, parseFloat((currentVal + 0.1).toFixed(1)));
    localStorage.setItem("bible_font_size_multiplier", currentVal);
    const display = document.getElementById("fontScaleDisplay");
    if (display) display.textContent = `${Math.round(currentVal * 100)}%`;
    fitLayoutText();
  });

  document.querySelectorAll(".sharpness-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".sharpness-btn")
        .forEach((b) => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      localStorage.setItem(
        "bible_text_sharpness",
        e.currentTarget.getAttribute("data-val"),
      );
      applyTextVisualEffects();
      showToast("선명도 설정이 적용되었습니다.");
    });
  });

  document.querySelectorAll(".shadow-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".shadow-btn")
        .forEach((b) => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      localStorage.setItem(
        "bible_text_shadow",
        e.currentTarget.getAttribute("data-val"),
      );
      applyTextVisualEffects();
      showToast("그림자 효과가 적용되었습니다.");
    });
  });

  document.querySelectorAll(".blur-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".blur-btn")
        .forEach((b) => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      localStorage.setItem(
        "bible_text_blur",
        e.currentTarget.getAttribute("data-val"),
      );
      applyTextVisualEffects();
      showToast("블러 효과가 적용되었습니다.");
    });
  });

  document
    .getElementById("resetFontSettingsBtn")
    ?.addEventListener("click", () => {
      localStorage.removeItem("bible_font_size_multiplier");
      localStorage.removeItem("bible_text_sharpness");
      localStorage.removeItem("bible_text_shadow");
      localStorage.removeItem("bible_text_blur");
      localStorage.removeItem(BIBLE_FONT_MODE_KEY);
      applyBibleFontMode("handwriting");
      showToast("모든 폰트 및 시각 효과가 초기화되었습니다.");
      closeModal();
      fitLayoutText();
      applyTextVisualEffects();
    });

  const clearTempCacheBtn = document.getElementById("clearTempCacheBtn");
  if (clearTempCacheBtn) {
    let confirmClearTempCache = false;
    let clearTempCacheTimeout = null;

    clearTempCacheBtn.addEventListener("click", async () => {
      if (!confirmClearTempCache) {
        confirmClearTempCache = true;
        clearTempCacheBtn.textContent = translateUIString(
          "⚠️ 삭제하려면 한 번 더 누르세요",
        );
        clearTempCacheBtn.style.background = "rgba(255,170,60,0.28)";
        if (clearTempCacheTimeout) clearTimeout(clearTempCacheTimeout);
        clearTempCacheTimeout = setTimeout(() => {
          confirmClearTempCache = false;
          if (clearTempCacheBtn.isConnected) {
            clearTempCacheBtn.textContent =
              translateUIString("🧹 임시 데이터 및 캐시 삭제");
            clearTempCacheBtn.style.background = "rgba(255,170,60,0.12)";
          }
        }, 4000);
        return;
      }

      confirmClearTempCache = false;
      if (clearTempCacheTimeout) clearTimeout(clearTempCacheTimeout);
      clearTempCacheBtn.disabled = true;
      clearTempCacheBtn.textContent = translateUIString(
        "⏳ 임시 데이터 및 캐시 삭제 중…",
      );

      try {
        const result = await clearProjectTemporaryDataAndCaches();
        clearTempCacheBtn.disabled = false;
        clearTempCacheBtn.textContent =
          translateUIString("🧹 임시 데이터 및 캐시 삭제");
        clearTempCacheBtn.style.background = "rgba(255,170,60,0.12)";

        const removedCount =
          result.localStorageEntries +
          result.sessionStorageEntries +
          result.cacheEntries +
          result.databases +
          result.memoryCacheEntries;
        if (result.failures > 0) {
          showToast(
            `일부 임시 저장소 정리에 실패했습니다. 삭제 완료 ${removedCount}개, 실패 ${result.failures}건.`,
          );
        } else {
          showToast(
            `Temporary caches cleared (${removedCount} entries). Preferences, bookmarks, notes, history, offline files and the visible verse were preserved.`,
          );
        }
      } catch (error) {
        console.error("임시 데이터 및 캐시 삭제에 실패했습니다.", error);
        clearTempCacheBtn.disabled = false;
        clearTempCacheBtn.textContent =
          translateUIString("🧹 임시 데이터 및 캐시 삭제");
        showToast("임시 데이터 및 캐시 삭제 중 오류가 발생했습니다.");
      }
    });

  }
}

function normalizeBibleFontMode(mode) {
  if (mode === "system") mode = "system-ui";
  if (
    Object.prototype.hasOwnProperty.call(
      LEGACY_BIBLE_FONT_MODE_MIGRATIONS,
      mode,
    )
  ) {
    mode = LEGACY_BIBLE_FONT_MODE_MIGRATIONS[mode];
  }
  return Object.prototype.hasOwnProperty.call(BIBLE_FONT_CHOICES, mode)
    ? mode
    : "handwriting";
}

function updateFontPreviewSelectionUI(selectedMode = null) {
  let mode = selectedMode;
  if (!mode) {
    try {
      mode = localStorage.getItem(BIBLE_FONT_MODE_KEY);
    } catch {
      mode = "handwriting";
    }
  }
  mode = normalizeBibleFontMode(mode);

  document
    .querySelectorAll("#fontPreviewModal [data-font-choice]")
    .forEach((option) => {
      const active = option.getAttribute("data-font-choice") === mode;
      option.classList.toggle("active", active);
      option.setAttribute("aria-pressed", String(active));
    });

  const labelText = translateUIString(BIBLE_FONT_CHOICES[mode].label);
  const currentLabel = document.getElementById("currentBibleFontName");
  if (currentLabel) currentLabel.textContent = labelText;
  const selectedLabel = document.getElementById("fontPreviewSelectedLabel");
  if (selectedLabel)
    selectedLabel.textContent = `${translateUIString("현재 선택:")} ${labelText}`;
  return mode;
}

function applyBibleFontMode(mode = null) {
  let requestedMode = mode;
  if (!requestedMode) {
    try {
      requestedMode = localStorage.getItem(BIBLE_FONT_MODE_KEY);
    } catch {
      requestedMode = "handwriting";
    }
  }
  const selectedMode = normalizeBibleFontMode(requestedMode);
  if (requestedMode !== selectedMode) {
    try {
      localStorage.setItem(BIBLE_FONT_MODE_KEY, selectedMode);
    } catch {}
  }

  const staleFontClasses = Array.from(
    document.documentElement.classList,
  ).filter((className) => className.startsWith("font-choice-"));
  document.documentElement.classList.remove("system-font", ...staleFontClasses);
  document.documentElement.classList.add(
    BIBLE_FONT_CHOICES[selectedMode].legacyClass,
  );
  updateFontPreviewSelectionUI(selectedMode);
  return selectedMode;
}

function openFontPreviewModal() {
  const preview = document.getElementById("fontPreviewModal");
  if (!preview) return;
  localizeUITree(preview);
  applyBibleFontMode();
  preview.hidden = false;
  preview.setAttribute("aria-hidden", "false");
  document
    .getElementById("closeFontPreviewButton")
    ?.focus({ preventScroll: true });
}

function closeFontPreviewModal() {
  const preview = document.getElementById("fontPreviewModal");
  if (!preview) return;
  preview.hidden = true;
  preview.setAttribute("aria-hidden", "true");
  document
    .getElementById("openFontPreviewButton")
    ?.focus({ preventScroll: true });
}

function applyTextVisualEffects() {
  const typingText = getTypingText();
  const mainText = getMainText();
  const sharpness =
    localStorage.getItem("bible_text_sharpness") || "subpixel-antialiased";
  const shadowType = localStorage.getItem("bible_text_shadow") || "medium";
  const blurType = localStorage.getItem("bible_text_blur") || "none";

  let shadowVal = "0 2px 10px rgba(0,0,0,0.5)";
  if (shadowType === "none") shadowVal = "none";
  else if (shadowType === "light") shadowVal = "0 1px 4px rgba(0,0,0,0.3)";
  else if (shadowType === "strong") shadowVal = "0 4px 20px rgba(0,0,0,0.9)";

  let blurVal = "none";
  if (blurType === "light") blurVal = "blur(0.6px)";

  [typingText, mainText].forEach((el) => {
    if (!el) return;
    if (sharpness === "none") {
      el.style.webkitFontSmoothing = "auto";
      el.style.fontSmooth = "auto";
    } else if (sharpness === "antialiased") {
      el.style.webkitFontSmoothing = "antialiased";
      el.style.fontSmooth = "always";
    } else {
      el.style.webkitFontSmoothing = "subpixel-antialiased";
      el.style.fontSmooth = "auto";
    }
    el.style.textShadow = shadowVal;
    el.style.filter = blurVal;
  });
}

window.addEventListener("DOMContentLoaded", () => {
  applyBibleFontMode();
  fitLayoutText();
  applyTextVisualEffects();
});

const STATE_MEMORY_ACTIVE_STYLE_ID = "stateMemoryShuffleActiveStyleMirror";

const STATE_MEMORY_VISUAL_PROPERTIES = [
  "background",
  "background-color",
  "background-image",
  "background-position",
  "background-size",
  "background-repeat",
  "background-origin",
  "background-clip",
  "color",
  "border",
  "border-color",
  "border-style",
  "border-width",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-top-style",
  "border-right-style",
  "border-bottom-style",
  "border-left-style",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-radius",
  "border-image-source",
  "border-image-slice",
  "border-image-width",
  "border-image-outset",
  "border-image-repeat",
  "box-shadow",
  "text-shadow",
  "outline",
  "outline-color",
  "outline-style",
  "outline-width",
  "outline-offset",
  "filter",
  "-webkit-filter",
  "backdrop-filter",
  "-webkit-backdrop-filter",
  "opacity",
  "transform",
  "transform-origin",
  "scale",
  "rotate",
  "translate",
  "clip-path",
  "mask-image",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-color",
  "-webkit-text-fill-color",
  "-webkit-text-stroke-color",
  "appearance",
  "-webkit-appearance",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "animation-name",
  "animation-duration",
  "animation-timing-function",
  "animation-iteration-count",
  "animation-direction",
  "animation-fill-mode",
  "animation-play-state",
  "transition-property",
  "transition-duration",
  "transition-timing-function",
  "transition-delay",
];

const STATE_MEMORY_PSEUDO_PROPERTIES = [
  "content",
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "inset",
  "width",
  "height",
  "background",
  "background-color",
  "background-image",
  "background-position",
  "background-size",
  "background-repeat",
  "color",
  "border",
  "border-color",
  "border-style",
  "border-width",
  "border-radius",
  "box-shadow",
  "outline",
  "outline-color",
  "outline-style",
  "outline-width",
  "opacity",
  "filter",
  "-webkit-filter",
  "backdrop-filter",
  "-webkit-backdrop-filter",
  "transform",
  "transform-origin",
  "clip-path",
  "mask-image",
  "z-index",
  "pointer-events",
  "animation-name",
  "animation-duration",
  "animation-timing-function",
  "animation-iteration-count",
  "animation-direction",
  "animation-fill-mode",
  "animation-play-state",
];

function captureStyleProperties(element, pseudo, propertyNames) {
  const computed = window.getComputedStyle(element, pseudo || null);
  const snapshot = {};
  for (const property of propertyNames) {
    snapshot[property] = computed.getPropertyValue(property).trim();
  }
  return snapshot;
}

function styleDeltaRule(selector, offStyle, onStyle, propertyNames) {
  const declarations = [];
  for (const property of propertyNames) {
    const offValue = offStyle[property] || "";
    const onValue = onStyle[property] || "";
    if (onValue && onValue !== offValue) {
      declarations.push(`${property}: ${onValue} !important;`);
    }
  }
  return declarations.length ? `${selector} { ${declarations.join(" ")} }` : "";
}

function captureShuffleActiveStyleFallback(shuffleButton) {
  if (
    !shuffleButton ||
    !document.body ||
    !document.head ||
    typeof window.getComputedStyle !== "function"
  ) {
    return "";
  }

  const sourceBar =
    shuffleButton.closest("#bibleControlBar") || shuffleButton.parentElement;
  if (!sourceBar) return "";

  let probeBar = null;
  let probeTransitionStyle = null;
  try {
    probeBar = sourceBar.cloneNode(true);
    probeBar.classList.add("state-memory-style-probe");
    probeBar.style.setProperty("position", "fixed", "important");
    probeBar.style.setProperty("left", "-100000px", "important");
    probeBar.style.setProperty("top", "-100000px", "important");
    probeBar.style.setProperty("visibility", "hidden", "important");
    probeBar.style.setProperty("pointer-events", "none", "important");
    probeBar.style.setProperty("z-index", "-999999", "important");

    probeTransitionStyle = document.createElement("style");
    probeTransitionStyle.id = "stateMemoryStyleProbeTransitionReset";
    probeTransitionStyle.textContent = `
      #bibleControlBar.state-memory-style-probe,
      #bibleControlBar.state-memory-style-probe *,
      #bibleControlBar.state-memory-style-probe::before,
      #bibleControlBar.state-memory-style-probe::after,
      #bibleControlBar.state-memory-style-probe *::before,
      #bibleControlBar.state-memory-style-probe *::after {
        transition-property: none !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `;
    document.head.appendChild(probeTransitionStyle);
    document.body.appendChild(probeBar);

    const probeButton = probeBar.querySelector(`#${shuffleButton.id}`);
    if (!probeButton) return "";
    probeButton.style.setProperty("transition", "none", "important");

    probeButton.classList.remove("active");
    probeButton.setAttribute("aria-pressed", "false");
    void probeButton.getBoundingClientRect();
    const offStyle = captureStyleProperties(
      probeButton,
      null,
      STATE_MEMORY_VISUAL_PROPERTIES,
    );
    const offBefore = captureStyleProperties(
      probeButton,
      "::before",
      STATE_MEMORY_PSEUDO_PROPERTIES,
    );
    const offAfter = captureStyleProperties(
      probeButton,
      "::after",
      STATE_MEMORY_PSEUDO_PROPERTIES,
    );

    probeButton.classList.add("active");
    probeButton.setAttribute("aria-pressed", "true");
    void probeButton.getBoundingClientRect();
    const onStyle = captureStyleProperties(
      probeButton,
      null,
      STATE_MEMORY_VISUAL_PROPERTIES,
    );
    const onBefore = captureStyleProperties(
      probeButton,
      "::before",
      STATE_MEMORY_PSEUDO_PROPERTIES,
    );
    const onAfter = captureStyleProperties(
      probeButton,
      "::after",
      STATE_MEMORY_PSEUDO_PROPERTIES,
    );

    return [
      styleDeltaRule(
        "#btnStateMemory.active",
        offStyle,
        onStyle,
        STATE_MEMORY_VISUAL_PROPERTIES,
      ),
      styleDeltaRule(
        "#btnStateMemory.active::before",
        offBefore,
        onBefore,
        STATE_MEMORY_PSEUDO_PROPERTIES,
      ),
      styleDeltaRule(
        "#btnStateMemory.active::after",
        offAfter,
        onAfter,
        STATE_MEMORY_PSEUDO_PROPERTIES,
      ),
    ]
      .filter(Boolean)
      .join("\n");
  } catch (error) {
    console.warn("셔플 활성화 스타일을 읽지 못했습니다.", error);
    return "";
  } finally {
    if (probeBar && probeBar.parentNode) probeBar.remove();
    if (probeTransitionStyle && probeTransitionStyle.parentNode)
      probeTransitionStyle.remove();
  }
}

function mirrorShuffleActiveCssRules(shuffleButton) {
  if (!shuffleButton || !shuffleButton.id || !document.head) return;

  let mirrorStyle = document.getElementById(STATE_MEMORY_ACTIVE_STYLE_ID);
  if (!mirrorStyle) {
    mirrorStyle = document.createElement("style");
    mirrorStyle.id = STATE_MEMORY_ACTIVE_STYLE_ID;
    document.head.appendChild(mirrorStyle);
  }

  const sourceSelector = `#${shuffleButton.id}`;
  const targetSelector = "#btnStateMemory";
  const mirroredRules = [];
  const seenRules = new Set();

  function scanRules(rules, wrappers = []) {
    for (const rule of Array.from(rules || [])) {
      if (rule.cssRules) {
        let wrapper = null;
        const ruleHeader = String(rule.cssText || "")
          .split("{")[0]
          .trim();
        if (/^@(media|supports|container|layer)\b/i.test(ruleHeader))
          wrapper = ruleHeader;
        scanRules(rule.cssRules, wrapper ? [...wrappers, wrapper] : wrappers);
        continue;
      }
      if (!rule.selectorText || !rule.style) continue;

      const selectors = rule.selectorText.split(",").map((item) => item.trim());
      for (const selector of selectors) {
        if (!selector.includes(sourceSelector)) continue;

        if (!/(?:\.active\b|\[aria-pressed\s*=\s*["']?true)/i.test(selector))
          continue;

        const mirroredSelector = selector
          .split(sourceSelector)
          .join(targetSelector);
        let cssText = `${mirroredSelector} { ${rule.style.cssText} }`;
        for (let i = wrappers.length - 1; i >= 0; i -= 1)
          cssText = `${wrappers[i]} { ${cssText} }`;
        if (!seenRules.has(cssText)) {
          seenRules.add(cssText);
          mirroredRules.push(cssText);
        }
      }
    }
  }

  for (const styleSheet of Array.from(document.styleSheets || [])) {
    try {
      scanRules(styleSheet.cssRules);
    } catch (error) {}
  }

  const computedFallback = captureShuffleActiveStyleFallback(shuffleButton);
  mirrorStyle.textContent = [...mirroredRules, computedFallback]
    .filter(Boolean)
    .join("\n");
}

function updateStateMemoryButtonStyle(button, shuffleButton) {
  if (!button) return;
  mirrorShuffleActiveCssRules(shuffleButton);
  const active = Boolean(isStateMemoryEnabled);
  button.classList.toggle("active", active);
  button.setAttribute("aria-pressed", String(active));
}

function initUIControls(onImageChange) {
  let hintHandle = document.getElementById("uiHintHandle");
  if (!hintHandle) {
    hintHandle = document.createElement("div");
    hintHandle.id = "uiHintHandle";
    hintHandle.className = "ui-hint-handle";
    document.body.appendChild(hintHandle);
  }

  let globalTooltip = document.getElementById("globalUiTooltip");
  if (!globalTooltip) {
    globalTooltip = document.createElement("div");
    globalTooltip.id = "globalUiTooltip";
    globalTooltip.style.cssText =
      "position: fixed; padding: 6px 12px; font-size: 11px; pointer-events: none; z-index: 10010; display: none; white-space: nowrap;";
    document.body.appendChild(globalTooltip);
  }

  const btnPause = document.getElementById("btnPause");
  const btnNext = document.getElementById("btnNext");
  const btnPrev = document.getElementById("btnPrev");
  const btnBookmark = document.getElementById("btnBookmark");
  const btnSearch = document.getElementById("btnSearch");
  const btnNote = document.getElementById("btnNote");
  const btnList = document.getElementById("btnList");
  const btnBibleTranslation = document.getElementById("btnBibleTranslation");
  const btnOfflineBibleSource = document.getElementById(
    "btnOfflineBibleSource",
  );
  const controlBar = document.getElementById("bibleControlBar");

  const fontComparisonPanel = document.getElementById("fontComparisonPanel");
  const uiScaleSettingsPanel = document.getElementById("uiScaleSettingsPanel");
  const uiScaleSlider = document.getElementById("uiScaleSlider");
  const uiScaleDisplay = document.getElementById("uiScaleDisplay");
  const resetUiScaleButton = document.getElementById("resetUiScaleButton");
  applyUIScale(getUIScalePresetIndex(), false);
  uiScaleSlider?.addEventListener("input", () => {
    const selectedIndex = Math.max(
      0,
      Math.min(4, Math.round(Number(uiScaleSlider.value) || 0)),
    );
    if (uiScaleDisplay)
      uiScaleDisplay.textContent = formatUIScaleDisplay(selectedIndex);
  });
  uiScaleSlider?.addEventListener("change", () => {
    const selectedIndex = applyUIScale(uiScaleSlider.value, true);
    if (uiScaleDisplay)
      uiScaleDisplay.textContent = formatUIScaleDisplay(selectedIndex);
  });
  resetUiScaleButton?.addEventListener("click", () => {
    const selectedIndex = applyUIScale(2, true);
    if (uiScaleSlider) uiScaleSlider.value = String(selectedIndex);
    if (uiScaleDisplay)
      uiScaleDisplay.textContent = formatUIScaleDisplay(selectedIndex);
    showToast(translateUIString("Interface scale reset to Standard"));
  });

  const fontPreviewModal = document.getElementById("fontPreviewModal");
  document
    .getElementById("openFontPreviewButton")
    ?.addEventListener("click", openFontPreviewModal);
  document
    .getElementById("closeFontPreviewButton")
    ?.addEventListener("click", closeFontPreviewModal);
  document
    .getElementById("doneFontPreviewButton")
    ?.addEventListener("click", closeFontPreviewModal);
  fontPreviewModal?.addEventListener("click", (event) => {
    if (event.target === fontPreviewModal) closeFontPreviewModal();
  });
  fontPreviewModal?.querySelectorAll("[data-font-choice]").forEach((option) => {
    option.addEventListener("click", () => {
      const selectedMode = option.getAttribute("data-font-choice");
      if (
        !Object.prototype.hasOwnProperty.call(BIBLE_FONT_CHOICES, selectedMode)
      )
        return;
      try {
        localStorage.setItem(BIBLE_FONT_MODE_KEY, selectedMode);
      } catch (error) {
        console.warn("Could not save the Bible font choice.", error);
      }
      applyBibleFontMode(selectedMode);

      fitLayoutText();
      applyTextVisualEffects();
    });
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      fontPreviewModal &&
      !fontPreviewModal.hidden
    ) {
      event.preventDefault();
      closeFontPreviewModal();
    }
  });
  applyBibleFontMode();

  let btnSettings = document.getElementById("btnSettings");
  if (!btnSettings && controlBar) {
    btnSettings = document.createElement("button");
    btnSettings.id = "btnSettings";
    btnSettings.innerHTML = "⚙️";
    btnSettings.style.cssText =
      "background:rgba(255, 255, 255, 0.08); border:1px solid rgba(255, 255, 255, 0.2); color:#fff; cursor:pointer; font-size:16px; padding:6px 10px; border-radius:10px;";
    controlBar.appendChild(btnSettings);
  }

  const btnUILanguage = document.getElementById("btnUILanguage");
  const uiLanguagePopover = document.getElementById("uiLanguagePopover");
  const uiLanguageOptions = uiLanguagePopover
    ? uiLanguagePopover.querySelectorAll("[data-ui-language]")
    : [];

  const updateUILanguageSelection = () => {
    const selectedLanguage = getUILanguagePreference();
    uiLanguageOptions.forEach((option) => {
      const selected =
        option.getAttribute("data-ui-language") === selectedLanguage;
      option.classList.toggle("active", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
  };
  updateUILanguageSelection();

  let btnRandom = document.getElementById("btnRandom");
  if (!btnRandom && controlBar) {
    btnRandom = document.createElement("button");
    btnRandom.id = "btnRandom";
    btnRandom.innerHTML = "🔀";
    btnRandom.style.cssText =
      "background:rgba(255, 255, 255, 0.08); border:1px solid rgba(255, 255, 255, 0.2); color:#fff; cursor:pointer; font-size:16px; padding:6px 10px; border-radius:10px;";
    if (btnNext && btnNext.parentNode) {
      btnNext.parentNode.insertBefore(btnRandom, btnNext.nextSibling);
    } else {
      controlBar.appendChild(btnRandom);
    }
  }

  let btnSpeed = document.getElementById("btnSpeed");
  if (!btnSpeed && controlBar) {
    btnSpeed = document.createElement("button");
    btnSpeed.id = "btnSpeed";
    btnSpeed.innerHTML = "1.0x";
    btnSpeed.style.cssText =
      "background:rgba(255, 255, 255, 0.08); border:1px solid rgba(255, 255, 255, 0.2); color:#fff; cursor:pointer; font-size:13px; padding:6px 10px; border-radius:10px; font-weight:bold;";
    if (btnRandom && btnRandom.parentNode) {
      btnRandom.parentNode.insertBefore(btnSpeed, btnRandom.nextSibling);
    } else {
      controlBar.appendChild(btnSpeed);
    }
  }

  let btnStateMemory = document.getElementById("btnStateMemory");
  if (!btnStateMemory && controlBar) {
    btnStateMemory = document.createElement("button");
    btnStateMemory.id = "btnStateMemory";
    btnStateMemory.innerHTML = "💾";
    btnStateMemory.style.cssText =
      "background:rgba(255, 255, 255, 0.08); border:1px solid rgba(255, 255, 255, 0.2); color:#fff; cursor:pointer; font-size:16px; padding:6px 10px; border-radius:10px;";
    if (btnSpeed && btnSpeed.parentNode) {
      btnSpeed.parentNode.insertBefore(btnStateMemory, btnSpeed.nextSibling);
    } else {
      controlBar.appendChild(btnStateMemory);
    }
  }

  let btnCopyCurrent = document.getElementById("btnCopyCurrent");
  if (!btnCopyCurrent && controlBar) {
    btnCopyCurrent = document.createElement("button");
    btnCopyCurrent.id = "btnCopyCurrent";
    btnCopyCurrent.innerHTML = "📋";
    btnCopyCurrent.style.cssText =
      "background:rgba(255, 255, 255, 0.08); border:1px solid rgba(255, 255, 255, 0.2); color:#fff; cursor:pointer; font-size:16px; padding:6px 10px; border-radius:10px;";
    if (btnSearch && btnSearch.parentNode) {
      btnSearch.parentNode.insertBefore(btnCopyCurrent, btnBookmark);
    } else {
      controlBar.appendChild(btnCopyCurrent);
    }
  }

  const modal = document.getElementById("bibleModal");
  const modalClose = document.getElementById("modalClose");

  if (btnPause) btnPause.setAttribute("data-tip", "자동 넘김 재생 / 일시정지");
  if (btnPrev) btnPrev.setAttribute("data-tip", "이전 구절 (1절씩 순차 이동)");
  if (btnNext) btnNext.setAttribute("data-tip", "다음 구절 (순차 또는 셔플)");
  if (btnSettings)
    btnSettings.setAttribute("data-tip", "환경 설정 및 폰트 효과 제어");
  if (btnUILanguage) btnUILanguage.setAttribute("data-tip", "UI 언어 변경");
  if (btnRandom)
    btnRandom.setAttribute("data-tip", "랜덤 셔플 모드 토글 (ON/OFF)");
  if (btnSpeed)
    btnSpeed.setAttribute("data-tip", "구절 전환 재생 속도 조절 (0.5x ~ 4.0x)");
  if (btnStateMemory) {
    updateStateMemoryButtonStyle(btnStateMemory, btnRandom);
    btnStateMemory.setAttribute(
      "data-tip",
      isStateMemoryEnabled
        ? "상태 기억: 켜짐 (마지막 구절과 셔플 상태 저장)"
        : "상태 기억: 꺼짐 (재시작 시 위치 복원 안 함)",
    );
  }
  if (btnRandom) {
    btnRandom.classList.toggle("active", isShuffle);
    btnRandom.setAttribute("aria-pressed", String(isShuffle));
  }
  if (btnSearch) btnSearch.setAttribute("data-tip", "성경 목차 선택 열기");
  if (btnBibleTranslation)
    btnBibleTranslation.setAttribute("data-tip", "성경 언어 및 역본 선택");
  if (btnOfflineBibleSource)
    btnOfflineBibleSource.setAttribute(
      "data-tip",
      "Choose an offline Bible source",
    );
  if (btnCopyCurrent)
    btnCopyCurrent.setAttribute("data-tip", "현재 성경 본문을 클립보드에 복사");
  if (btnBookmark)
    btnBookmark.setAttribute("data-tip", "현재 구절 북마크에 추가");
  if (btnNote) btnNote.setAttribute("data-tip", "이모지 묵상 태그 남기기");
  if (btnList) btnList.setAttribute("data-tip", "나의 성경 보관함 열기");
  if (modalClose) modalClose.setAttribute("data-tip", "닫기");
  if (controlBar) {
    controlBar.querySelectorAll("button").forEach((button) => {
      const tip =
        button.getAttribute("data-tip") || button.getAttribute("title");
      if (tip) button.setAttribute("aria-label", tip);
    });
  }
  installTaskbarAwareLayout();
  applyUILanguage();

  document.addEventListener("mouseover", (e) => {
    const target = e.target.closest("[data-tip]");
    if (target) {
      const tipText = target.getAttribute("data-tip");
      if (tipText) {
        globalTooltip.textContent = translateUIString(tipText);
        globalTooltip.style.display = "block";
      }
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (globalTooltip.style.display === "block") {
      const tooltipScale = getUIScaleFactor();
      const tooltipLeft = Math.min(
        e.clientX + 12 * tooltipScale,
        window.innerWidth - globalTooltip.offsetWidth - 6,
      );
      const tooltipTop = Math.min(
        e.clientY + 18 * tooltipScale,
        window.innerHeight - globalTooltip.offsetHeight - 6,
      );
      globalTooltip.style.left = `${Math.max(6, tooltipLeft)}px`;
      globalTooltip.style.top = `${Math.max(6, tooltipTop)}px`;
    }
  });

  document.addEventListener("mouseout", (e) => {
    const target = e.target.closest("[data-tip]");
    if (target) globalTooltip.style.display = "none";
  });

  function showControlBar() {
    if (controlBar) controlBar.classList.add("visible");
    if (hintHandle) hintHandle.classList.add("hidden");
  }

  function isUILanguagePopoverOpen() {
    return Boolean(uiLanguagePopover && !uiLanguagePopover.hidden);
  }

  function hideControlBar() {
    if (isUILanguagePopoverOpen()) {
      showControlBar();
      return;
    }
    if (modal && !modal.classList.contains("hidden")) return;
    if (controlBar) controlBar.classList.remove("visible");
    if (hintHandle) hintHandle.classList.remove("hidden");
  }

  window.addEventListener("mousemove", (e) => {
    if (isUILanguagePopoverOpen()) {
      showControlBar();
      return;
    }
    const distanceFromBottom = window.innerHeight - e.clientY;
    if (distanceFromBottom <= 150) showControlBar();
    else hideControlBar();
  });

  controlBar?.addEventListener("mouseenter", showControlBar);
  controlBar?.addEventListener("mouseleave", hideControlBar);

  btnPause?.addEventListener("click", () => {
    isPaused = !isPaused;
    btnPause.textContent = isPaused ? "▶" : "⏸";
    btnPause.setAttribute(
      "data-tip",
      isPaused ? "자동 넘김 재생" : "자동 넘김 일시정지",
    );
    showToast(isPaused ? "자동 넘김 일시정지" : "자동 넘김 재생 (이어하기)");
  });

  btnNext?.addEventListener("click", async () => {
    const keys = sortVerseKeys(Object.keys(bibleVerses));
    if (!keys.length) return;
    let targetKey = "";
    try {
      targetKey = isShuffle
        ? await getRandomNavigationVerseKey()
        : isOnlineBibleTranslationActive()
          ? await getOnlineAdjacentVerseKey(currentKey || keys[0], 1)
          : getAdjacentVerseKey(currentKey || keys[0], 1);
    } catch (error) {
      console.error("Could not load the next Bible verse.", error);
      showToast(
        "Could not load the Bible verse. Check the internet connection and try again.",
      );
      return;
    }
    if (!targetKey || !bibleVerses[targetKey]) return;
    if (isShuffle) recordShuffleNavigation(targetKey);
    currentElapsed = 0;
    displayVerseByKey(targetKey, onImageChange);
    showToast(
      `[${formatBibleReference(targetKey)}] ${isShuffle ? "Random verse" : "Next verse"}`,
    );
  });

  btnPrev?.addEventListener("click", async () => {
    const keys = sortVerseKeys(Object.keys(bibleVerses));
    if (!keys.length) return;
    let targetKey = "";
    try {
      targetKey = isShuffle
        ? await getRandomNavigationVerseKey()
        : isOnlineBibleTranslationActive()
          ? await getOnlineAdjacentVerseKey(currentKey || keys[0], -1)
          : getAdjacentVerseKey(currentKey || keys[0], -1);
    } catch (error) {
      console.error("Could not load the previous Bible verse.", error);
      showToast(
        "Could not load the Bible verse. Check the internet connection and try again.",
      );
      return;
    }
    if (targetKey && bibleVerses[targetKey]) {
      if (isShuffle) recordShuffleNavigation(targetKey);
      currentElapsed = 0;
      displayVerseByKey(targetKey, onImageChange);
      showToast(
        `[${formatBibleReference(targetKey)}] ${isShuffle ? "Random verse" : "Previous verse"}`,
      );
    }
  });

  const closeUILanguagePopover = () => {
    if (uiLanguagePopover) uiLanguagePopover.hidden = true;
    btnUILanguage?.setAttribute("aria-expanded", "false");
    controlBar?.classList.remove("language-picker-open");
  };

  btnUILanguage?.addEventListener("click", () => {
    if (!uiLanguagePopover) return;
    const shouldOpen = uiLanguagePopover.hidden;
    uiLanguagePopover.hidden = !shouldOpen;
    btnUILanguage.setAttribute("aria-expanded", String(shouldOpen));
    controlBar?.classList.toggle("language-picker-open", shouldOpen);
    if (shouldOpen) showControlBar();
  });

  document.addEventListener("pointerdown", (event) => {
    if (!isUILanguagePopoverOpen()) return;
    if (
      uiLanguagePopover?.contains(event.target) ||
      btnUILanguage?.contains(event.target)
    )
      return;

    closeUILanguagePopover();
    const distanceFromBottom = window.innerHeight - event.clientY;
    if (distanceFromBottom > 150) hideControlBar();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isUILanguagePopoverOpen()) {
      closeUILanguagePopover();
      btnUILanguage?.focus();
    }
  });

  uiLanguageOptions.forEach((option) => {
    option.addEventListener("click", () => {
      const nextLanguage = option.getAttribute("data-ui-language");
      if (!["system", "en", "ko", "zh", "ja"].includes(nextLanguage)) return;
      saveUILanguagePreference(nextLanguage);
      applyUILanguage();
      updateUILanguageSelection();
      closeUILanguagePopover();
      showToast("UI 언어 설정이 저장되었습니다.");
    });
  });

  uiLanguagePopover?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeUILanguagePopover();
      btnUILanguage?.focus();
    }
  });

  btnSettings?.addEventListener("click", () => {
    closeUILanguagePopover();
    openSettingsModal();
  });

  btnRandom?.addEventListener("click", () => {
    isShuffle = !isShuffle;
    shuffleHistory = currentKey ? [currentKey] : [];
    shuffleHistoryIndex = shuffleHistory.length - 1;
    savePlaybackState();
    if (btnRandom) {
      btnRandom.classList.toggle("active", isShuffle);
      btnRandom.setAttribute("aria-pressed", String(isShuffle));
      btnRandom.setAttribute(
        "data-tip",
        isShuffle ? "랜덤 셔플 모드: 켜짐" : "랜덤 셔플 모드: 꺼짐",
      );

      updateStateMemoryButtonStyle(btnStateMemory, btnRandom);
    }
    showToast(
      isShuffle
        ? "🔀 셔플 모드 켜짐 (다음 곡부터 무작위 재생)"
        : "▶ 순차 재생 모드 켜짐 (1절씩 순서대로)",
    );
  });

  if (btnStateMemory) {
    btnStateMemory.onclick = () => {
      isStateMemoryEnabled = !isStateMemoryEnabled;
      localStorage.setItem(STATE_MEMORY_KEY, String(isStateMemoryEnabled));
      updateStateMemoryButtonStyle(btnStateMemory, btnRandom);
      btnStateMemory.setAttribute(
        "data-tip",
        isStateMemoryEnabled
          ? "상태 기억: 켜짐 (마지막 구절과 셔플 상태 저장)"
          : "상태 기억: 꺼짐 (재시작 시 위치 복원 안 함)",
      );
      if (isStateMemoryEnabled) {
        savePlaybackState();
        showToast("💾 상태 기억 켜짐: 현재 구절과 셔플 상태를 저장합니다.");
      } else {
        showToast("상태 기억 꺼짐: 재시작 시 마지막 위치를 복원하지 않습니다.");
      }

      btnStateMemory.blur();
    };
  }

  btnSpeed?.addEventListener("click", () => {
    const oldFinalDelay = currentFinalDelay || 5000;
    const progressRatio =
      oldFinalDelay > 0 ? Math.min(1, currentElapsed / oldFinalDelay) : 0;

    if (readTime === 5) {
      readTime = 2.5;
      btnSpeed.innerHTML = "2.0x";
      btnSpeed.classList.add("active");
      showToast("⚡ 재생 속도: 2.0배속 (빠름)");
    } else if (readTime === 2.5) {
      readTime = 1.25;
      btnSpeed.innerHTML = "4.0x";
      btnSpeed.classList.add("active");
      showToast("🚀 재생 속도: 4.0배속 (매우 빠름)");
    } else if (readTime === 1.25) {
      readTime = 10;
      btnSpeed.innerHTML = "0.5x";
      btnSpeed.classList.add("active");
      showToast("🐢 재생 속도: 0.5배속 (느림)");
    } else {
      readTime = 5;
      btnSpeed.innerHTML = "1.0x";
      btnSpeed.classList.remove("active");
      showToast("▶ 재생 속도: 1.0배속 (기본)");
    }

    if (currentVerseText) {
      const calculatedDelay =
        3000 * readTime + currentVerseText.length * (100 * readTime);
      currentFinalDelay = Math.min(
        Math.max(calculatedDelay, 2000 * readTime),
        15000 * readTime,
      );
      currentElapsed = Math.floor(currentFinalDelay * progressRatio);
    }
    btnSpeed.setAttribute(
      "data-tip",
      `구절 전환 재생 속도: ${btnSpeed.innerHTML}`,
    );
  });

  btnSearch?.addEventListener("click", () => {
    openSearchModal(onImageChange);
  });

  btnBibleTranslation?.addEventListener("click", () => {
    closeUILanguagePopover();
    openBibleTranslationSelector();
  });

  btnOfflineBibleSource?.addEventListener("click", () => {
    closeUILanguagePopover();
    openOfflineBibleSourceSelector();
  });

  btnCopyCurrent?.addEventListener("click", () => {
    if (!currentKey || !bibleVerses[currentKey]) {
      showToast("복사할 현재 성경 본문이 없습니다.");
      return;
    }
    const text = bibleVerses[currentKey];
    const ref = formatBibleReference(currentKey);
    const copyString = `${text} (${ref})`;
    navigator.clipboard
      .writeText(copyString)
      .then(() => {
        showToast(`[${ref}] 본문이 클립보드에 복사되었습니다.`);
      })
      .catch(() => {
        showToast("클립보드 복사에 실패했습니다.");
      });
  });

  btnBookmark?.addEventListener("click", () => {
    if (currentKey) {
      if (!bookmarks.includes(currentKey)) {
        bookmarks.push(currentKey);
        const maxBookmark = storageLimits.bookmark || 50;
        if (bookmarks.length > maxBookmark)
          bookmarks = bookmarks.slice(bookmarks.length - maxBookmark);
        localStorage.setItem("bible_bookmarks", JSON.stringify(bookmarks));
        showToast(
          `[${formatBibleReference(currentKey)}] 북마크에 추가되었습니다.`,
        );
      } else {
        showToast("이미 북마크에 등록된 구절입니다.");
      }
    }
  });

  btnNote?.addEventListener("click", () => {
    if (!currentKey) return;
    const verseTextSnippet = String(bibleVerses[currentKey] || "");
    let emojiGrid =
      '<div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-top:10px;">';
    Object.entries(emojiTagMap).forEach(([em, label]) => {
      emojiGrid += `<button class="emoji-select-btn" data-emoji="${em}" style="font-size:22px; padding:10px; border-radius:12px; cursor:pointer;" data-tip="${em} ${label}">${em}</button>`;
    });
    emojiGrid += "</div>";

    openModal(
      "✨ 이모지 태그 선택",
      `
        <div style="text-align:center; margin-bottom:12px; background:rgba(255,255,255,0.06); padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,0.15); backdrop-filter:blur(10px);">
            <p style="color:#ffd700; font-weight:bold; font-size:14px; margin-bottom:4px;">${formatBibleReference(currentKey)}</p>
            <p style="color:rgba(255,255,255,0.85); font-size:12px; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">"${verseTextSnippet}"</p>
        </div>
        <p style="margin-bottom:6px; color:rgba(255,255,255,0.6); font-size:12px; text-align:center;">이 구절에 어울리는 묵상 태그를 선택하세요.</p>
        ${emojiGrid}
    `,
    );

    document.querySelectorAll(".emoji-select-btn").forEach((el) => {
      el.addEventListener("click", (e) => {
        const emoji = e.currentTarget.getAttribute("data-emoji");
        userNotes[currentKey] = emoji;
        const maxNote = storageLimits.note || 50;
        const noteKeysArr = Object.keys(userNotes);
        if (noteKeysArr.length > maxNote) delete userNotes[noteKeysArr[0]];
        localStorage.setItem("bible_notes", JSON.stringify(userNotes));
        showToast(
          `태그 [${emoji} ${emojiTagMap[emoji] || "태그"}]가 저장되었습니다.`,
        );
        closeModal();
      });
    });
  });

  btnList?.addEventListener("click", () => {
    renderStorageList(onImageChange);
  });
  modalClose?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
}

function exportCategoryToTempFile(categoryName, keys) {
  if (!keys || keys.length === 0) {
    showToast("내보낼 항목이 없습니다.");
    return;
  }
  const formattedContent = generateFormattedTextForKeys(keys);
  const blob = new Blob([formattedContent], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `temp_bible_${categoryName}_${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`%temp% 임시 저장소에 [${categoryName}] 파일이 저장되었습니다.`);
}

function copyCategoryToClipboard(keys) {
  if (!keys || keys.length === 0) {
    showToast("복사할 항목이 없습니다.");
    return;
  }
  const formattedContent = generateFormattedTextForKeys(keys);
  navigator.clipboard
    .writeText(formattedContent)
    .then(() => {
      showToast("정렬 및 그룹화된 내용이 클립보드에 복사되었습니다.");
    })
    .catch(() => {
      showToast("클립보드 복사에 실패했습니다.");
    });
}

function buildStorageListHtml() {
  const sortedBookmarks = sortVerseKeys(bookmarks);
  const rawNoteKeys = Object.keys(userNotes).filter(
    (k) => userNotes[k].trim() !== "",
  );
  const sortedNoteKeys = sortVerseKeys(rawNoteKeys);
  const sortedHistory = sortVerseKeys(readingHistory);

  let html = `<div id="storageScrollContainer" style="max-height:360px; overflow-y:auto; padding-right:10px;">`;
  html += `<div style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); padding:10px; border-radius:14px; margin-bottom:14px; display:flex; justify-content:space-around; text-align:center; backdrop-filter:blur(10px);">
        <div><div style="font-size:12px; color:rgba(255,255,255,0.7);">북마크</div><div style="font-size:16px; font-weight:bold; color:#ffd700;">${bookmarks.length}개</div></div>
        <div><div style="font-size:12px; color:rgba(255,255,255,0.7);">이모지 태그</div><div style="font-size:16px; font-weight:bold; color:#4a90e2;">${Object.keys(userNotes).length}개</div></div>
        <div><div style="font-size:12px; color:rgba(255,255,255,0.7);">히스토리</div><div style="font-size:16px; font-weight:bold; color:#2ecc71;">${readingHistory.length}개</div></div>
    </div>`;

  html += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
        <div style="display:flex; align-items:center; gap:6px;"><input type="checkbox" id="selectAllBookmark" style="cursor:pointer;" data-tip="전체 선택/해제"><h4 style="color:#ffd700; margin:0;">⭐ 북마크</h4></div>
        <div style="display:flex; gap:4px;"><button class="export-cat-btn" data-cat="bookmark" style="padding:2px 6px; font-size:11px; border-radius:6px; cursor:pointer;" data-tip="선택 항목 내보내기"> 공유(📤)</button><button class="copy-cat-btn" data-cat="bookmark" style="padding:2px 6px; font-size:11px; border-radius:6px; cursor:pointer;" data-tip="선택 항목 복사"> 복사(📋)</button></div>
    </div>`;
  if (sortedBookmarks.length === 0) {
    html +=
      '<p style="color:rgba(255,255,255,0.5); font-size:13px; margin-bottom:12px;">저장된 북마크가 없습니다.</p>';
  } else {
    sortedBookmarks.forEach((k) => {
      html += `<div class="storage-row-item" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; padding:6px 10px;">
                <input type="checkbox" class="cat-chk-bookmark" value="${k}" style="margin-right:8px; cursor:pointer;" data-tip="항목 선택">
                <span class="storage-item" data-key="${k}" style="font-size:13px; cursor:pointer; color:#fff; flex-grow:1;">📌 ${formatBibleReference(k)}</span>
                <button class="del-bookmark-btn" data-key="${k}" style="background:transparent; color:#ff5555; border:none; cursor:pointer; padding:2px 6px; border-radius:6px;" data-tip="북마크 삭제">✕</button>
            </div>`;
    });
  }

  html += `<div style="display:flex; justify-content:space-between; align-items:center; margin:16px 0 8px 0; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
        <div style="display:flex; align-items:center; gap:6px;"><input type="checkbox" id="selectAllNote" style="cursor:pointer;" data-tip="전체 선택/해제"><h4 style="color:#4a90e2; margin:0;">🏷️ 이모지 태그</h4></div>
        <div style="display:flex; gap:4px;"><button class="export-cat-btn" data-cat="note" style="padding:2px 6px; font-size:11px; border-radius:6px; cursor:pointer;" data-tip="선택 항목 내보내기"> 공유(📤)</button><button class="copy-cat-btn" data-cat="note" style="padding:2px 6px; font-size:11px; border-radius:6px; cursor:pointer;" data-tip="선택 항목 복사"> 복사(📋)</button></div>
    </div>`;
  if (sortedNoteKeys.length === 0) {
    html +=
      '<p style="color:rgba(255,255,255,0.5); font-size:13px; margin-bottom:12px;">저장된 태그가 없습니다.</p>';
  } else {
    sortedNoteKeys.forEach((k) => {
      const emojiStr = userNotes[k];
      const tagText = emojiTagMap[emojiStr]
        ? `${emojiStr} ${emojiTagMap[emojiStr]}`
        : `${emojiStr} 묵상 태그`;
      html += `<div class="storage-row-item" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; padding:6px 10px;">
                <input type="checkbox" class="cat-chk-note" value="${k}" style="margin-right:8px; cursor:pointer;" data-tip="항목 선택">
                <span class="storage-item" data-key="${k}" style="font-size:13px; cursor:pointer; color:#fff; flex-grow:1;">📌 ${formatBibleReference(k)}</span>
                <span style="font-size:16px; margin:0 8px; cursor:default;" data-tip="${tagText}">${emojiStr}</span>
                <button class="del-note-btn" data-key="${k}" style="background:transparent; color:#ff5555; border:none; cursor:pointer; padding:2px 6px; border-radius:6px;" data-tip="태그 삭제">✕</button>
            </div>`;
    });
  }

  html += `<div style="display:flex; justify-content:space-between; align-items:center; margin:16px 0 8px 0; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
        <div style="display:flex; align-items:center; gap:6px;"><input type="checkbox" id="selectAllHistory" style="cursor:pointer;" data-tip="전체 선택/해제"><h4 style="color:#2ecc71; margin:0;">📜 최근 히스토리</h4></div>
        <div style="display:flex; gap:4px;">
            <button class="export-cat-btn" data-cat="history" style="padding:2px 6px; font-size:11px; border-radius:6px; cursor:pointer;" data-tip="선택 항목 내보내기"> 공유(📤)</button>
            <button class="copy-cat-btn" data-cat="history" style="padding:2px 6px; font-size:11px; border-radius:6px; cursor:pointer;" data-tip="선택 항목 복사"> 복사(📋)</button>
            ${sortedHistory.length > 0 ? '<button id="clearHistoryBtn" style="background:rgba(255,85,85,0.2); color:#ff5555; border:1px solid #ff5555; border-radius:6px; font-size:11px; padding:3px 8px; cursor:pointer;" data-tip="전체 삭제">전체 삭제</button>' : ""}
        </div>
    </div>`;

  if (sortedHistory.length === 0) {
    html +=
      '<p style="color:rgba(255,255,255,0.5); font-size:13px;">히스토리가 없습니다.</p>';
  } else {
    sortedHistory.forEach((k) => {
      html += `<div class="storage-row-item" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; padding:6px 10px;">
                <input type="checkbox" class="cat-chk-history" value="${k}" style="margin-right:8px; cursor:pointer;" data-tip="항목 선택">
                <span class="storage-item" data-key="${k}" style="font-size:13px; cursor:pointer; color:#fff; flex-grow:1;">📌 ${formatBibleReference(k)}</span>
                <button class="del-history-item-btn" data-key="${k}" style="background:transparent; color:#ff5555; border:none; cursor:pointer; padding:2px 6px; border-radius:6px;" data-tip="삭제">✕</button>
            </div>`;
    });
  }

  html += `<div style="margin-top:20px; padding:12px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); border-radius:12px; backdrop-filter:blur(10px);">
        <p style="color:#ffd700; font-size:13px; font-weight:bold; margin-bottom:8px; text-align:center;">⚙️ 보관함 최대 저장 개수 설정</p>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; text-align:center; font-size:12px; color:rgba(255,255,255,0.8);">
            <div><label style="display:block; margin-bottom:3px;">북마크</label><input type="number" id="limitBookmark" value="${storageLimits.bookmark}" min="5" max="500" style="width:100%; padding:6px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:8px; color:#fff; text-align:center;"></div>
            <div><label style="display:block; margin-bottom:3px;">이모지태그</label><input type="number" id="limitNote" value="${storageLimits.note}" min="5" max="500" style="width:100%; padding:6px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:8px; color:#fff; text-align:center;"></div>
            <div><label style="display:block; margin-bottom:3px;">히스토리</label><input type="number" id="limitHistory" value="${storageLimits.history}" min="5" max="500" style="width:100%; padding:6px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:8px; color:#fff; text-align:center;"></div>
        </div>
        <button id="saveLimitsBtn" style="width:100%; margin-top:10px; background:rgba(74,144,226,0.25); color:#fff; border:1px solid rgba(74,144,226,0.5); border-radius:8px; padding:6px; font-size:12px; cursor:pointer;">설정 저장하기</button>
    </div>`;

  html += `<div style="margin-top:20px; padding-top:14px; border-top:1px dashed rgba(255,85,85,0.3); text-align:center;">
        <button id="resetAllDataBtn" style="background:rgba(255,85,85,0.15); color:#ff5555; border:1px solid #ff5555; border-radius:10px; font-size:12px; padding:10px 18px; cursor:pointer; backdrop-filter:blur(10px);" data-tip="모든 저장 데이터 초기화">⚠️ 데이터 전체 초기화 (캐시 삭제)</button>
    </div></div>`;

  return html;
}

function renderStorageList(onImageChange) {
  openModal("📖 나의 성경 보관함", buildStorageListHtml());
  const storageScroll = document.getElementById("storageScrollContainer");
  storageScroll?.addEventListener(
    "wheel",
    (e) => {
      e.stopPropagation();
    },
    { passive: true },
  );

  let tooltip = document.getElementById("storageTooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "storageTooltip";
    tooltip.style.cssText =
      "position: fixed; padding: 10px 14px; font-size: 12px; pointer-events: none; z-index: 10005; display: none; max-width: 300px; line-height: 1.4;";
    document.body.appendChild(tooltip);
  }

  ["bookmark", "note", "history"].forEach((cat) => {
    const selectAllEl = document.getElementById(
      `selectAll${cat.charAt(0).toUpperCase() + cat.slice(1)}`,
    );
    selectAllEl?.addEventListener("change", (e) => {
      const checked = e.currentTarget.checked;
      document.querySelectorAll(`.cat-chk-${cat}`).forEach((chk) => {
        chk.checked = checked;
      });
    });
  });

  document.querySelectorAll(".export-cat-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const cat = e.currentTarget.getAttribute("data-cat");
      const keys = Array.from(
        document.querySelectorAll(`.cat-chk-${cat}:checked`),
      ).map((cb) => cb.value);
      if (keys.length === 0) {
        showToast("공유할 항목을 체크해 주세요.");
        return;
      }
      exportCategoryToTempFile(cat, keys);
    });
  });

  document.querySelectorAll(".copy-cat-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const cat = e.currentTarget.getAttribute("data-cat");
      const selectedKeys = Array.from(
        document.querySelectorAll(`.cat-chk-${cat}:checked`),
      ).map((cb) => cb.value);

      let liveKeys = [];
      try {
        if (cat === "bookmark") {
          liveKeys = JSON.parse(
            localStorage.getItem("bible_bookmarks") || "[]",
          );
          bookmarks = Array.isArray(liveKeys) ? liveKeys : [];
        } else if (cat === "note") {
          const liveNotes = JSON.parse(
            localStorage.getItem("bible_notes") || "{}",
          );
          userNotes =
            liveNotes &&
            typeof liveNotes === "object" &&
            !Array.isArray(liveNotes)
              ? liveNotes
              : {};
          liveKeys = Object.keys(userNotes).filter(
            (key) =>
              typeof userNotes[key] === "string" &&
              userNotes[key].trim() !== "",
          );
        } else if (cat === "history") {
          liveKeys = JSON.parse(localStorage.getItem("bible_history") || "[]");
          readingHistory = Array.isArray(liveKeys) ? liveKeys : [];
        }
      } catch (error) {
        console.warn("보관함 복사 데이터를 읽지 못했습니다.", error);
        liveKeys = [];
      }
      const validKeys = new Set(liveKeys);
      const keys = selectedKeys.filter(
        (key) => validKeys.has(key) && Boolean(bibleVerses[key]),
      );
      if (keys.length === 0) {
        showToast(
          liveKeys.length === 0
            ? "저장된 항목이 없어 복사할 내용이 없습니다."
            : "복사할 항목을 체크해 주세요.",
        );
        return;
      }
      copyCategoryToClipboard(keys);
    });
  });

  document.querySelectorAll(".storage-item").forEach((el) => {
    el.addEventListener("mouseenter", (e) => {
      const key = e.currentTarget.getAttribute("data-key");
      if (bibleVerses[key]) {
        tooltip.innerHTML = `<span style="color:#b8860b; font-weight:bold; display:block; margin-bottom:3px;">[${formatBibleReference(key)}]</span>"${bibleVerses[key]}"`;
        tooltip.style.display = "block";
      }
    });
    el.addEventListener("mousemove", (e) => {
      const tooltipScale = getUIScaleFactor();
      const tooltipLeft = Math.min(
        e.clientX + 15 * tooltipScale,
        window.innerWidth - tooltip.offsetWidth - 6,
      );
      const tooltipTop = Math.min(
        e.clientY + 15 * tooltipScale,
        window.innerHeight - tooltip.offsetHeight - 6,
      );
      tooltip.style.left = `${Math.max(6, tooltipLeft)}px`;
      tooltip.style.top = `${Math.max(6, tooltipTop)}px`;
    });
    el.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
    });
    el.addEventListener("click", (e) => {
      const key = e.currentTarget.getAttribute("data-key");
      if (key) {
        tooltip.style.display = "none";
        isPaused = true;
        const btnPause = document.getElementById("btnPause");
        if (btnPause) btnPause.textContent = "▶";
        displayVerseByKey(key, onImageChange);
        closeModal();
        showToast(`[${formatBibleReference(key)}] 구절로 이동 (일시정지)`);
      }
    });
  });

  document.querySelectorAll(".del-bookmark-btn").forEach((el) => {
    el.addEventListener("click", (e) => {
      bookmarks = bookmarks.filter(
        (b) => b !== e.currentTarget.getAttribute("data-key"),
      );
      localStorage.setItem("bible_bookmarks", JSON.stringify(bookmarks));
      renderStorageList(onImageChange);
    });
  });

  document.querySelectorAll(".del-note-btn").forEach((el) => {
    el.addEventListener("click", (e) => {
      delete userNotes[e.currentTarget.getAttribute("data-key")];
      localStorage.setItem("bible_notes", JSON.stringify(userNotes));
      renderStorageList(onImageChange);
    });
  });

  document.querySelectorAll(".del-history-item-btn").forEach((el) => {
    el.addEventListener("click", (e) => {
      readingHistory = readingHistory.filter(
        (h) => h !== e.currentTarget.getAttribute("data-key"),
      );
      localStorage.setItem("bible_history", JSON.stringify(readingHistory));
      renderStorageList(onImageChange);
    });
  });

  document.getElementById("clearHistoryBtn")?.addEventListener("click", () => {
    readingHistory = [];
    localStorage.removeItem("bible_history");
    renderStorageList(onImageChange);
    showToast("히스토리가 모두 삭제되었습니다.");
  });

  document.getElementById("saveLimitsBtn")?.addEventListener("click", () => {
    storageLimits = {
      bookmark: parseInt(document.getElementById("limitBookmark").value) || 50,
      note: parseInt(document.getElementById("limitNote").value) || 50,
      history: parseInt(document.getElementById("limitHistory").value) || 30,
    };
    localStorage.setItem("bible_storage_limits", JSON.stringify(storageLimits));
    showToast("저장 개수 제한이 설정되었습니다.");
    renderStorageList(onImageChange);
  });

  let resetStep = 0;
  document.getElementById("resetAllDataBtn")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    if (resetStep === 0) {
      resetStep = 1;
      btn.textContent = translateUIString(
        "❗ 정말 초기화하시겠습니까? (한번 더 누르세요)",
      );
      btn.style.background = "rgba(255,85,85,0.4)";
      setTimeout(() => {
        if (resetStep === 1) {
          resetStep = 0;
          btn.textContent = translateUIString(
            "⚠️ 데이터 전체 초기화 (캐시 삭제)",
          );
          btn.style.background = "rgba(255,85,85,0.15)";
        }
      }, 4000);
    } else {
      localStorage.removeItem("bible_bookmarks");
      localStorage.removeItem("bible_notes");
      localStorage.removeItem("bible_history");
      localStorage.removeItem("bible_storage_limits");
      bookmarks = [];
      userNotes = {};
      readingHistory = [];
      storageLimits = { bookmark: 50, note: 50, history: 30 };
      showToast("모든 저장 데이터와 캐시가 초기화되었습니다.");
      renderStorageList(onImageChange);
    }
  });
}

async function runBibleVerseCycle(onImageChange) {
  if (isRunning) {
    isRunning = false;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  isRunning = true;

  if (Object.keys(bibleVerses).length === 0) {

    isPaused = false;
    const mainText = getMainText();
    const typingText = getTypingText();
    if (mainText) mainText.textContent = "";
    currentVerseText = "";
    if (typingText)
      typingText.textContent = translateUIString("Loading Bible text...");
    fitLayoutText();

    let restoredOfflineSource = false;
    const savedOfflineSource = (() => {
      try {
        return localStorage.getItem(OFFLINE_BIBLE_SOURCE_KEY) || "";
      } catch {
        return "";
      }
    })();

    if (savedOfflineSource) {
      try {
        await loadOfflineBibleSource(savedOfflineSource, { restoring: true });
        restoredOfflineSource = true;
        const normalizedSavedSource = String(savedOfflineSource)
          .replace(/\\/g, "/")
          .toLowerCase();
        if (
          normalizedSavedSource === "embedded/en_esv.json" ||
          normalizedSavedSource.endsWith("/embedded/en_esv.json")
        ) {
          localBibleVerses = bibleVerses;
        } else {
          try {
            localBibleVerses = normalizeOfflineBibleData(
              await fetchOfflineBibleJson("embedded/EN_ESV.json"),
            );
          } catch (fallbackError) {
            console.warn(
              "The default data/embedded/EN_ESV.json fallback is not available.",
              fallbackError,
            );
          }
        }
      } catch (offlineRestoreError) {
        console.warn(
          "Saved offline Bible source could not be restored; trying data/embedded/EN_ESV.json.",
          offlineRestoreError,
        );
      }
    }

    if (!Object.keys(bibleVerses).length) {
      try {
        if (typingText)
          typingText.textContent = translateUIString(
            "Loading local Bible data...",
          );
        let localData;
        try {
          const localController = new AbortController();
          const localFetchTimer = setTimeout(
            () => localController.abort(),
            8000,
          );
          try {
            const localResponse = await fetch("./data/embedded/EN_ESV.json", {
              cache: "no-store",
              signal: localController.signal,
            });
            if (!localResponse.ok)
              throw new Error(
                `Local file request failed with HTTP ${localResponse.status}.`,
              );
            localData = await localResponse.json();
          } finally {
            clearTimeout(localFetchTimer);
          }
        } catch (directFileError) {
          localData = await fetchOfflineBibleJson("embedded/EN_ESV.json");
        }
        await loadOfflineBibleSource("embedded/EN_ESV.json", {
          restoring: true,
          rawData: localData,
        });
        localBibleVerses = bibleVerses;
        restoredOfflineSource = true;
      } catch (localError) {
        console.error("Could not load the packaged default offline Bible.", localError);
        if (mainText) mainText.textContent = "";
        if (typingText) typingText.textContent = translateUIString(
          "Built-in Bible text could not be loaded. Please verify the wallpaper package files.",
        );
        fitLayoutText();
        isRunning = false;
        return;
      }
    }

    if (!Object.keys(localBibleVerses).length) {
      if (!restoredOfflineSource) {
        try {
          localBibleVerses = normalizeOfflineBibleData(bibleVerses);
        } catch {
          localBibleVerses = bibleVerses;
        }
      }
    }
    if (!restoredOfflineSource) {
      bibleVerses = localBibleVerses;
      currentBibleTranslation = {
        type: "local",
        id: "local-ko",
        language: "kor",
        name: "Built-in Bible",
        shortName: "Built-in",
      };
      activeTranslationBooks = [];
      activeOnlineChapter = null;
      activeOfflineBibleSource = "";
    }
    if (isStateMemoryEnabled) {
      try {
        const savedState = JSON.parse(
          localStorage.getItem(PLAYBACK_STATE_KEY) || "null",
        );
        if (
          savedState &&
          savedState.currentKey &&
          bibleVerses[savedState.currentKey]
        ) {
          currentKey = savedState.currentKey;
          isShuffle = savedState.isShuffle === true;
          restoreCurrentKeyOnNextLoop = true;
        }
      } catch (error) {
        console.warn("저장된 재생 상태를 읽지 못했습니다.", error);
      }
    }
    if (!restoredOfflineSource) await restoreSavedBibleTranslation();
    initUIControls(onImageChange);

    isPaused = false;
    const startupPauseButton = document.getElementById("btnPause");
    if (startupPauseButton) {
      startupPauseButton.textContent = "⏸";
      startupPauseButton.setAttribute("data-tip", "자동 넘김 일시정지");
      startupPauseButton.setAttribute("aria-label", "자동 넘김 일시정지");
    }
    if (offlineRestoreFailed)
      showToast(
        "Saved offline source could not be loaded; the default source is being used.",
      );

    setTimeout(() => {
    }, 1200);
  }

  while (isRunning) {
    const mainText = getMainText();
    const typingText = getTypingText();

    if (!mainText || !typingText) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      continue;
    }
    const keys = sortVerseKeys(Object.keys(bibleVerses));
    if (!keys.length) {
      mainText.textContent = "";
      typingText.textContent = translateUIString(
        "Bible text could not be loaded. Check the selected Bible source or network connection.",
      );
      fitLayoutText();
      isRunning = false;
      return;
    }

    if (isPaused) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      continue;
    }

    if (
      restoreCurrentKeyOnNextLoop &&
      currentKey &&
      keys.includes(currentKey)
    ) {
      restoreCurrentKeyOnNextLoop = false;
    } else if (isOnlineBibleTranslationActive()) {
      try {
        if (!currentKey || !keys.includes(currentKey)) {
          currentKey = isShuffle
            ? await getRandomOnlineVerseKey()
            : keys[0] || "";
        } else if (isShuffle) {
          currentKey = await getRandomOnlineVerseKey();
        } else {
          currentKey = await getOnlineAdjacentVerseKey(currentKey, 1);
        }
      } catch (error) {
        console.error("온라인 성경 다음 본문을 불러오지 못했습니다.", error);
        currentKey = keys[Math.floor(Math.random() * keys.length)] || "";
      }
    } else if (!currentKey || !keys.includes(currentKey)) {
      currentKey = isShuffle
        ? keys[Math.floor(Math.random() * keys.length)]
        : keys[0];
    } else {
      if (isShuffle) {
        currentKey = keys[Math.floor(Math.random() * keys.length)];
      } else {
        currentKey = getAdjacentVerseKey(currentKey, 1);
      }
    }

    if (!currentKey || !bibleVerses[currentKey]) {
      currentKey = isShuffle
        ? keys[Math.floor(Math.random() * keys.length)]
        : keys[0];
    }
    if (!currentKey || !bibleVerses[currentKey]) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      continue;
    }

    const fullText = String(bibleVerses[currentKey]);
    try {
      displayVerseByKey(currentKey, onImageChange);
    } catch (displayError) {

      console.error("Verse display helper failed; using safe text rendering.", displayError);
      currentVerseText = fullText;
      mainText.textContent = formatBibleReference(currentKey);
      typingText.textContent = formatVerseForDisplay(fullText);
      mainText.classList.remove("fade-out");
      typingText.classList.remove("fade-out");
      try { onImageChange?.(); } catch {}
    }

    try {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      const fontMultiplier = parseFloat(
        localStorage.getItem("bible_font_size_multiplier") || "1.0",
      );
      fitTextToRegion(typingText, 5.4 * fontMultiplier, 14);
      fitTextToRegion(mainText, 3.8 * fontMultiplier, 12);
      applyTextVisualEffects();
    } catch (layoutError) {
      console.warn("Bible text layout adjustment failed; autoplay will continue.", layoutError);
    }

    const speedFactor = Number.isFinite(readTime) && readTime > 0 ? readTime : 1;
    const calculatedDelay =
      3000 * speedFactor + fullText.length * (100 * speedFactor);
    currentFinalDelay = Math.min(
      Math.max(calculatedDelay, 2000 * speedFactor),
      15000 * speedFactor,
    );

    currentElapsed = 0;
    while (currentElapsed < currentFinalDelay) {
      if (!isRunning) break;
      if (isPaused) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
      currentElapsed += 200;
    }

    if (!isRunning) break;
    if (isPaused) continue;

    mainText.classList.add("fade-out");
    typingText.classList.add("fade-out");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (!isRunning) break;
    playbackRecoveryAttempts = 0;
  }
}

export async function startBibleVerseCycle(onImageChange) {
  try {
    await runBibleVerseCycle(onImageChange);
  } catch (error) {
    console.error("Bible playback stopped unexpectedly; attempting recovery.", error);
    isRunning = false;
    isPaused = false;

    const mainText = getMainText();
    const typingText = getTypingText();
    const keys = sortVerseKeys(Object.keys(bibleVerses));
    const fallbackKey = currentKey && bibleVerses[currentKey]
      ? currentKey
      : keys[0] || "";

    if (fallbackKey) {
      currentKey = fallbackKey;
      const fullText = String(bibleVerses[fallbackKey] || "");
      currentVerseText = fullText;
      try {
        if (mainText) mainText.textContent = formatBibleReference(fallbackKey);
        if (typingText) typingText.textContent = formatVerseForDisplay(fullText);
        mainText?.classList.remove("fade-out");
        typingText?.classList.remove("fade-out");
        if (typeof onImageChange === "function") onImageChange();
        fitLayoutText();
      } catch (renderError) {
        console.warn("Fallback verse rendering was only partially successful.", renderError);
      }
    } else if (typingText) {
      typingText.textContent = translateUIString(
        "Bible text could not be loaded. Check the selected Bible source or network connection.",
      );
      if (mainText) mainText.textContent = "";
      try { fitLayoutText(); } catch {}
    }

    if (playbackRecoveryAttempts < 2) {
      playbackRecoveryAttempts += 1;
      setTimeout(() => {
        void startBibleVerseCycle(onImageChange);
      }, 750);
    } else {
      playbackRecoveryAttempts = 0;
    }
  }
}

