import type { ItineraryTransport, TransportMode } from "@/lib/itinerary/types";

/** 구간 라벨과 리스트 배지에 함께 쓰는 이동 수단 표기. */
export const TRANSPORT_LABEL: Record<TransportMode, string> = {
  walk: "도보",
  subway: "지하철",
  tram: "트램",
  bus: "버스",
  train: "기차",
  car: "자동차",
  taxi: "택시",
  bike: "자전거",
  ferry: "배",
  flight: "비행기",
  other: "이동",
};

/** 카테고리와 마찬가지로 LLM이 한국어/유사어를 보낼 수 있어 관대하게 매핑한다. */
const TRANSPORT_ALIASES: Record<string, TransportMode> = {
  walk: "walk",
  walking: "walk",
  foot: "walk",
  도보: "walk",
  걷기: "walk",
  걸어서: "walk",
  subway: "subway",
  metro: "subway",
  underground: "subway",
  지하철: "subway",
  전철: "subway",
  tram: "tram",
  streetcar: "tram",
  트램: "tram",
  노면전차: "tram",
  bus: "bus",
  버스: "bus",
  시내버스: "bus",
  광역버스: "bus",
  고속버스: "bus",
  train: "train",
  rail: "train",
  ktx: "train",
  srt: "train",
  기차: "train",
  열차: "train",
  car: "car",
  drive: "car",
  driving: "car",
  자동차: "car",
  차량: "car",
  렌터카: "car",
  자차: "car",
  운전: "car",
  taxi: "taxi",
  cab: "taxi",
  택시: "taxi",
  bike: "bike",
  bicycle: "bike",
  cycling: "bike",
  자전거: "bike",
  ferry: "ferry",
  boat: "ferry",
  ship: "ferry",
  배: "ferry",
  페리: "ferry",
  여객선: "ferry",
  flight: "flight",
  plane: "flight",
  airplane: "flight",
  비행기: "flight",
  항공: "flight",
  항공편: "flight",
  other: "other",
  transit: "other",
  대중교통: "other",
  이동: "other",
};

/** 아는 수단일 때만 값을 돌려준다. 모르면 호출부가 "other"로 떨어뜨릴지 판단한다. */
export function matchTransportMode(value: unknown): TransportMode | undefined {
  if (typeof value !== "string") return undefined;
  return TRANSPORT_ALIASES[value.trim().toLowerCase()];
}

/**
 * 지도 구간 라벨용 한 줄 표기: "2호선›1011번 45분", 노선이 없으면 "도보 15분".
 * 수단은 라벨 옆 아이콘이 보여주므로 자리를 노선 번호에 내준다.
 * 요금·환승 지점은 폭을 많이 잡아먹어 리스트에서만 보여준다.
 */
export function formatTransportLabel(transport: ItineraryTransport): string {
  const route = transport.legs
    .map((leg) => leg.line ?? TRANSPORT_LABEL[leg.mode])
    .join("›");

  return transport.duration ? `${route} ${transport.duration}` : route;
}
