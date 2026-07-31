import { normalizeCategory } from "@/lib/itinerary/categories";
import { matchTransportMode } from "@/lib/itinerary/transport";
import type {
  ItineraryDay,
  ItineraryPick,
  ItineraryPlan,
  ItineraryStop,
  ItineraryTransport,
  MessageSegment,
  PickKind,
  StopCategory,
  TransportLeg,
} from "@/lib/itinerary/types";

const OPEN_FENCE = /^\s*```\s*itinerary\s*$/i;
const CLOSE_FENCE = /^\s*```/;

const MAX_DAYS = 14;
const MAX_STOPS_PER_DAY = 30;
const MAX_TEXT = 120;
/** 관광지·맛집 소개문. 목록 태그(note)보다 길게 허용한다. */
const MAX_DESCRIPTION = 280;
/** 지도 구간 라벨에 얹히는 값이라 본문보다 짧게 자른다. */
const MAX_DURATION = 24;
const MAX_LINE = 16;
const MAX_FARE = 16;
const MAX_PRICE = 24;
const MAX_PICKS = 4;
/** 환승 구간 수. 이보다 많으면 최적 경로로 보기 어렵고 라벨도 넘친다. */
const MAX_LEGS = 4;

/** 근처 맛집·카페 추천을 붙일 수 있는 카테고리. */
const PICK_HOST_CATEGORIES: ReadonlySet<StopCategory> = new Set([
  "sight",
  "food",
  "cafe",
  "activity",
  "shopping",
]);

/**
 * 지도 카드가 들어갈 메시지인지 값싸게 판별한다.
 * 말풍선 폭을 넓힐지 결정하는 용도라 파싱까지 하지 않는다.
 */
export function hasItineraryBlock(content: string): boolean {
  return content.includes("```itinerary");
}

/**
 * 어시스턴트 본문을 마크다운 구간과 일정 구간으로 분리한다.
 * 스트리밍 중에는 닫는 펜스가 아직 안 왔을 수 있으므로 그 경우를 `itinerary-pending`으로 구분한다.
 */
export function splitMessageSegments(content: string): MessageSegment[] {
  if (!content.includes("```")) {
    return [{ kind: "markdown", text: content }];
  }

  const segments: MessageSegment[] = [];
  const lines = content.split("\n");

  let markdownBuffer: string[] = [];
  let jsonBuffer: string[] | null = null;

  const flushMarkdown = () => {
    if (markdownBuffer.length === 0) return;
    const text = markdownBuffer.join("\n");
    if (text.trim().length > 0) {
      segments.push({ kind: "markdown", text });
    }
    markdownBuffer = [];
  };

  for (const line of lines) {
    if (jsonBuffer === null) {
      if (OPEN_FENCE.test(line)) {
        flushMarkdown();
        jsonBuffer = [];
      } else {
        markdownBuffer.push(line);
      }
      continue;
    }

    if (CLOSE_FENCE.test(line)) {
      const plan = parseItineraryPlan(jsonBuffer.join("\n"));
      segments.push(plan ? { kind: "itinerary", plan } : { kind: "itinerary-invalid" });
      jsonBuffer = null;
      continue;
    }

    jsonBuffer.push(line);
  }

  if (jsonBuffer !== null) {
    // 아직 스트리밍 중인 블록. 완성된 JSON이면 미리 보여주고, 아니면 자리표시자를 낸다.
    const plan = parseItineraryPlan(jsonBuffer.join("\n"));
    segments.push(plan ? { kind: "itinerary", plan } : { kind: "itinerary-pending" });
  } else {
    flushMarkdown();
  }

  return segments;
}

/** 검증을 통과하지 못하면 null. 호출부에서 예외 없이 대체 UI를 그리도록 한다. */
export function parseItineraryPlan(raw: string): ItineraryPlan | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;

  const days = readDays(parsed);
  if (days.length === 0) return null;

  return {
    title: readText(parsed.title),
    days,
  };
}

function readDays(plan: Record<string, unknown>): ItineraryDay[] {
  // 하루짜리 일정을 days 없이 stops만 보내는 경우도 받아준다.
  const source = Array.isArray(plan.days)
    ? plan.days
    : Array.isArray(plan.stops)
      ? [{ stops: plan.stops }]
      : [];

  const days: ItineraryDay[] = [];

  for (const entry of source.slice(0, MAX_DAYS)) {
    if (!isRecord(entry) || !Array.isArray(entry.stops)) continue;

    const stops = readStops(entry.stops);
    if (stops.length === 0) continue;

    days.push({
      label: readText(entry.label) ?? `${days.length + 1}일차`,
      stops,
    });
  }

  return days;
}

function readStops(source: unknown[]): ItineraryStop[] {
  const stops: ItineraryStop[] = [];

  for (const entry of source.slice(0, MAX_STOPS_PER_DAY)) {
    if (!isRecord(entry)) continue;

    const name = readText(entry.name);
    const lat = readCoord(entry.lat, 90);
    const lng = readCoord(entry.lng, 180);

    if (name === undefined || lat === undefined || lng === undefined) continue;

    const category = normalizeCategory(entry.category);

    stops.push({
      name,
      category,
      lat,
      lng,
      time: readText(entry.time),
      note: readText(entry.note),
      description: readDescription(
        entry.description ?? entry.summary ?? entry.about
      ),
      // 그날의 첫 장소는 출발 지점이라 들어오는 이동 구간이 없다.
      transport:
        stops.length === 0 ? undefined : readTransport(entry.transport ?? entry.travel),
      // 관광지·식사·카페 등에는 근처 맛집/대안 후보를 붙일 수 있다.
      picks: PICK_HOST_CATEGORIES.has(category)
        ? readPicks(entry.picks ?? entry.options ?? entry.restaurants, category)
        : undefined,
    });
  }

  return stops;
}

function readPicks(
  value: unknown,
  hostCategory: StopCategory
): ItineraryPick[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const picks: ItineraryPick[] = [];

  for (const entry of value.slice(0, MAX_PICKS)) {
    // 이름만 문자열 배열로 보내는 경우도 받아준다.
    if (typeof entry === "string") {
      const name = readText(entry);
      if (name !== undefined) {
        picks.push({
          name,
          kind: defaultPickKind(hostCategory),
        });
      }
      continue;
    }

    if (!isRecord(entry)) continue;

    const name = readText(entry.name);
    if (name === undefined) continue;

    picks.push({
      name,
      note: readText(entry.note ?? entry.menu ?? entry.specialty),
      description: readDescription(
        entry.description ?? entry.summary ?? entry.about
      ),
      kind: readPickKind(entry.kind ?? entry.type ?? entry.category) ??
        defaultPickKind(hostCategory),
      price: readText(entry.price ?? entry.budget)?.slice(0, MAX_PRICE),
      lat: readCoord(entry.lat, 90),
      lng: readCoord(entry.lng, 180),
    });
  }

  return picks.length > 0 ? picks : undefined;
}

function defaultPickKind(hostCategory: StopCategory): PickKind {
  return hostCategory === "cafe" ? "cafe" : "food";
}

function readPickKind(value: unknown): PickKind | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "food" ||
    normalized === "restaurant" ||
    normalized === "meal" ||
    normalized === "맛집" ||
    normalized === "식사"
  ) {
    return "food";
  }
  if (
    normalized === "cafe" ||
    normalized === "coffee" ||
    normalized === "dessert" ||
    normalized === "카페" ||
    normalized === "디저트"
  ) {
    return "cafe";
  }
  return undefined;
}

function readDescription(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.slice(0, MAX_DESCRIPTION);
}

function readTransport(value: unknown): ItineraryTransport | undefined {
  if (typeof value === "string") return readTransportText(value);
  if (!isRecord(value)) return undefined;

  const legs = readLegs(value);
  const duration = readDuration(value.duration);
  const fare = readFare(value.fare ?? value.cost ?? value.price);
  const detail = readText(value.detail);

  if (legs.length === 0) {
    // 수단을 못 읽어도 시간·요금이 있으면 "이동"으로라도 보여준다.
    if (duration === undefined && fare === undefined && detail === undefined) {
      return undefined;
    }
    return { legs: [{ mode: "other" }], duration, fare, detail };
  }

  return { legs, duration, fare, detail };
}

/** 환승은 legs 배열로 받되, 수단 하나만 평평하게 보내는 형태도 계속 받아준다. */
function readLegs(value: Record<string, unknown>): TransportLeg[] {
  const source = Array.isArray(value.legs)
    ? value.legs
    : Array.isArray(value.transfers)
      ? [value, ...value.transfers]
      : [value];

  const legs: TransportLeg[] = [];

  for (const entry of source.slice(0, MAX_LEGS)) {
    if (typeof entry === "string") {
      const mode = matchTransportMode(entry);
      if (mode !== undefined) legs.push({ mode });
      continue;
    }

    if (!isRecord(entry)) continue;

    const mode = matchTransportMode(entry.mode);
    const line = readLine(entry.line ?? entry.route ?? entry.number);

    if (mode === undefined && line === undefined) continue;

    legs.push({ mode: mode ?? "other", line });
  }

  return legs;
}

/** 요금은 "1,650원" 형태로 보여준다. 숫자로 오면 천 단위 구분을 직접 넣는다. */
function readFare(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return `${Math.round(value)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}원`;
  }
  return readText(value)?.slice(0, MAX_FARE);
}

/** 노선 번호는 라벨 앞자리를 차지하므로 짧게 자른다. 숫자만 오면 "번"을 붙인다. */
function readLine(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}번`;
  }
  return readText(value)?.slice(0, MAX_LINE);
}

/** 객체 대신 "지하철 15분" 같은 한 줄 문자열로 보내는 경우도 받아준다. */
function readTransportText(value: string): ItineraryTransport | undefined {
  const text = readText(value);
  if (text === undefined) return undefined;

  const [head, ...rest] = text.split(/\s+/);
  const mode = matchTransportMode(head);
  if (mode === undefined) {
    return { legs: [{ mode: "other" }], duration: text.slice(0, MAX_DURATION) };
  }

  const duration = rest.join(" ");
  return {
    legs: [{ mode }],
    duration: duration.length > 0 ? duration.slice(0, MAX_DURATION) : undefined,
  };
}

function readDuration(value: unknown): string | undefined {
  // 분 단위 숫자로 보내는 경우가 있어 사람이 읽는 형태로 맞춘다.
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return `${Math.round(value)}분`;
  }
  return readText(value)?.slice(0, MAX_DURATION);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.slice(0, MAX_TEXT);
}

function readCoord(value: unknown, limit: number): number | undefined {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) return undefined;
  if (Math.abs(parsed) > limit) return undefined;
  return parsed;
}
