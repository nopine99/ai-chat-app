/** 채팅 본문에 섞인 base64 이미지를 data URL로 해석한다. */

const IMAGE_LANGS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "svg+xml",
  "image",
  "base64",
]);

const MIME_BY_LANG: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  "svg+xml": "image/svg+xml",
  image: "image/png",
  base64: "image/png",
};

const DATA_URL_RE =
  /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/i;

/** 마크다운 이미지 문법 밖에 홀로 있는 data URL. 공백은 페이로드 끝이므로 포함하지 않는다. */
const BARE_DATA_URL_RE =
  /(?<!]\()data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/]+=*/gi;

const MIN_BASE64_LENGTH = 32;

function sniffMime(base64: string): string | null {
  const head = base64.slice(0, 16);
  if (head.startsWith("/9j/")) return "image/jpeg";
  if (head.startsWith("iVBOR")) return "image/png";
  if (head.startsWith("R0lGOD")) return "image/gif";
  if (head.startsWith("UklGR")) return "image/webp";
  if (head.startsWith("PHN2Zy") || head.startsWith("PD94bW")) {
    return "image/svg+xml";
  }
  return null;
}

function isBase64Alphabet(value: string): boolean {
  return /^[A-Za-z0-9+/]+=*$/.test(value);
}

/** 원문(data URL 또는 raw base64)을 렌더 가능한 data URL로 만든다. */
export function resolveImageSrc(
  raw: string,
  language?: string
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const dataUrl = trimmed.match(DATA_URL_RE);
  if (dataUrl) {
    const mime = dataUrl[1].toLowerCase();
    const payload = dataUrl[2].replace(/\s/g, "");
    if (payload.length < MIN_BASE64_LENGTH || !isBase64Alphabet(payload)) {
      return null;
    }
    return `data:${mime};base64,${payload}`;
  }

  const compact = trimmed.replace(/\s/g, "");
  if (compact.length < MIN_BASE64_LENGTH || !isBase64Alphabet(compact)) {
    return null;
  }

  const lang = language?.replace(/^language-/i, "").toLowerCase();
  const mime =
    (lang ? MIME_BY_LANG[lang] : undefined) ??
    sniffMime(compact) ??
    null;

  if (!mime) return null;
  if (!sniffMime(compact) && lang && !IMAGE_LANGS.has(lang)) return null;

  return `data:${mime};base64,${compact}`;
}

/**
 * 본문에 홀로 있는 `data:image/...;base64,...`를 마크다운 이미지로 바꿔
 * react-markdown이 파싱할 수 있게 한다.
 * 코드 펜스 안은 ```png 등 전용 렌더러가 처리하므로 건드리지 않는다.
 */
export function promoteBareDataImages(text: string): string {
  const lines = text.split("\n");
  let inFence = false;
  const out: string[] = [];

  for (const line of lines) {
    const fence = /^\s*```/.test(line);
    if (fence) {
      inFence = !inFence;
      out.push(line);
      continue;
    }

    if (inFence) {
      out.push(line);
      continue;
    }

    out.push(
      line.replace(BARE_DATA_URL_RE, (match) => {
        const src = resolveImageSrc(match);
        if (!src) return match;
        return `\n\n![image](${src})\n\n`;
      })
    );
  }

  return out.join("\n");
}

/** react-markdown urlTransform용: data:image 만 허용하고 나머지는 기본 규칙을 따른다. */
export function allowDataImageUrl(
  url: string,
  defaultTransform: (value: string) => string
): string {
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(url)) {
    return resolveImageSrc(url) ?? "";
  }
  return defaultTransform(url);
}
