/**
 * 어시스턴트가 ```itinerary 코드블록으로 내보내는 여행 일정 스키마.
 * 파싱은 lib/itinerary/parse.ts가 담당하며, 이 타입은 검증을 통과한 값만 나타낸다.
 */

export type StopCategory =
  | "sight"
  | "food"
  | "cafe"
  | "stay"
  | "shopping"
  | "activity";

export type TransportMode =
  | "walk"
  | "subway"
  | "tram"
  | "bus"
  | "train"
  | "car"
  | "taxi"
  | "bike"
  | "ferry"
  | "flight"
  /** 수단을 특정할 수 없을 때. 소요 시간만 있는 경우도 여기로 떨어진다. */
  | "other";

/** 추천 후보의 업종. 관광지(sight)에 붙은 근처 맛집/카페 구분에 쓴다. */
export type PickKind = "food" | "cafe";

/** 환승 없이 한 번에 타는 구간. */
export interface TransportLeg {
  mode: TransportMode;
  /** 노선 번호. "1011번"(버스), "T1"(트램), "2호선", "KTX 101". 노선이 없는 수단이면 undefined. */
  line?: string;
}

/** 직전 장소에서 이 장소까지의 이동. 환승하면 legs가 2개 이상이 된다. */
export interface ItineraryTransport {
  /** 타는 순서대로. 최소 1개, 최대 4개. */
  legs: TransportLeg[];
  /** 환승 대기까지 포함한 전체 소요. "15분", "약 1시간". */
  duration?: string;
  /** 전체 요금. "1,650원" 처럼 표시용 문자열. */
  fare?: string;
  /** "서면역에서 환승" 같은 짧은 보충 설명. */
  detail?: string;
}

/**
 * 같은 시간대·같은 지역에서 고를 수 있는 후보.
 * 식사·카페 스톱의 대안, 또는 관광지 근처 맛집 추천에 쓴다.
 */
export interface ItineraryPick {
  name: string;
  /** "돼지국밥", "디저트 맛집" 같은 한 줄 특징. */
  note?: string;
  /** 가게·메뉴에 대한 조금 긴 설명. */
  description?: string;
  /** 관광지에 붙인 추천의 업종. 없으면 부모 카테고리로 추정한다. */
  kind?: PickKind;
  /** "1만원대" 같은 가격대 힌트. */
  price?: string;
  /** 둘 다 있을 때만 지도에 보조 마커로 찍는다. */
  lat?: number;
  lng?: number;
}

export interface ItineraryStop {
  name: string;
  category: StopCategory;
  lat: number;
  lng: number;
  /** "10:30", "오전" 처럼 자유 형식. 없으면 undefined. */
  time?: string;
  /** "점심", "포토스팟" 같은 짧은 태그. */
  note?: string;
  /** 관광지·맛집·카페 소개문. */
  description?: string;
  /** 하루의 첫 장소에는 없다(출발 지점이라 이전 구간이 없다). */
  transport?: ItineraryTransport;
  /**
   * 근처 추천.
   * food/cafe: 같은 끼니 대안. sight: 그 지역 맛집·카페. 최대 4곳.
   */
  picks?: ItineraryPick[];
}

export interface ItineraryDay {
  label: string;
  stops: ItineraryStop[];
}

export interface ItineraryPlan {
  title?: string;
  days: ItineraryDay[];
}

/**
 * 어시스턴트 메시지를 마크다운 구간과 일정 구간으로 쪼갠 결과.
 * `pending`은 스트리밍 중 아직 닫히지 않은 블록으로, 자리표시자를 보여주기 위해 구분한다.
 */
export type MessageSegment =
  | { kind: "markdown"; text: string }
  | { kind: "itinerary"; plan: ItineraryPlan }
  | { kind: "itinerary-pending" }
  | { kind: "itinerary-invalid" };
