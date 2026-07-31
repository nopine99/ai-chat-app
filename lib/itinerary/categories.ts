import type { StopCategory } from "@/lib/itinerary/types";

/**
 * 카테고리별 표시 메타. 색상은 globals.css의 `--stop-*` 토큰을 가리키는
 * Tailwind 클래스로 고정해 둔다(문자열을 조립하면 Tailwind 스캐너가 못 줍는다).
 */
interface CategoryMeta {
  label: string;
  /** 지도 마커 원의 채움색(SVG). */
  fillClass: string;
  /** 범례의 단색 점. */
  dotClass: string;
  /** 리스트 배지(연한 배경 + 같은 계열 글자색). */
  chipClass: string;
}

export const CATEGORY_ORDER: StopCategory[] = [
  "sight",
  "food",
  "cafe",
  "stay",
  "shopping",
  "activity",
];

export const CATEGORY_META: Record<StopCategory, CategoryMeta> = {
  sight: {
    label: "관광지",
    fillClass: "fill-stop-sight",
    dotClass: "bg-stop-sight",
    chipClass: "bg-stop-sight/15 text-stop-sight",
  },
  food: {
    label: "식사",
    fillClass: "fill-stop-food",
    dotClass: "bg-stop-food",
    chipClass: "bg-stop-food/15 text-stop-food",
  },
  cafe: {
    label: "카페",
    fillClass: "fill-stop-cafe",
    dotClass: "bg-stop-cafe",
    chipClass: "bg-stop-cafe/15 text-stop-cafe",
  },
  stay: {
    label: "숙소",
    fillClass: "fill-stop-stay",
    dotClass: "bg-stop-stay",
    chipClass: "bg-stop-stay/15 text-stop-stay",
  },
  shopping: {
    label: "쇼핑",
    fillClass: "fill-stop-shopping",
    dotClass: "bg-stop-shopping",
    chipClass: "bg-stop-shopping/15 text-stop-shopping",
  },
  activity: {
    label: "체험",
    fillClass: "fill-stop-activity",
    dotClass: "bg-stop-activity",
    chipClass: "bg-stop-activity/15 text-stop-activity",
  },
};

/** LLM이 한국어/유사어를 보낼 수 있으므로 관대하게 매핑하고, 모르면 관광지로 떨어뜨린다. */
const CATEGORY_ALIASES: Record<string, StopCategory> = {
  sight: "sight",
  sightseeing: "sight",
  attraction: "sight",
  관광: "sight",
  관광지: "sight",
  명소: "sight",
  food: "food",
  meal: "food",
  restaurant: "food",
  lunch: "food",
  dinner: "food",
  식사: "food",
  맛집: "food",
  점심: "food",
  저녁: "food",
  cafe: "cafe",
  dessert: "cafe",
  카페: "cafe",
  디저트: "cafe",
  stay: "stay",
  hotel: "stay",
  lodging: "stay",
  숙소: "stay",
  호텔: "stay",
  shopping: "shopping",
  market: "shopping",
  쇼핑: "shopping",
  시장: "shopping",
  activity: "activity",
  experience: "activity",
  체험: "activity",
  액티비티: "activity",
};

export function normalizeCategory(value: unknown): StopCategory {
  if (typeof value !== "string") return "sight";
  return CATEGORY_ALIASES[value.trim().toLowerCase()] ?? "sight";
}
