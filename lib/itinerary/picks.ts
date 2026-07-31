import type {
  ItineraryPick,
  ItineraryStop,
  PickKind,
  StopCategory,
} from "@/lib/itinerary/types";

/** 지도에 찍을 수 있는(좌표가 있는) 추천 후보. */
export interface PickMarker {
  name: string;
  lat: number;
  lng: number;
  /** 마커 색·아이콘에 쓰는 업종. 관광지에 붙은 맛집이면 food/cafe. */
  category: StopCategory;
  /** 후보를 달고 있는 장소의 순번(0부터). 그 장소가 활성일 때 함께 강조한다. */
  stopIndex: number;
}

export function resolvePickKind(
  pick: ItineraryPick,
  hostCategory: StopCategory
): PickKind {
  if (pick.kind) return pick.kind;
  return hostCategory === "cafe" ? "cafe" : "food";
}

export function collectPickMarkers(stops: ItineraryStop[]): PickMarker[] {
  return stops.flatMap((stop, stopIndex) =>
    (stop.picks ?? []).flatMap((pick) =>
      pick.lat === undefined || pick.lng === undefined
        ? []
        : [
            {
              name: pick.name,
              lat: pick.lat,
              lng: pick.lng,
              category: resolvePickKind(pick, stop.category),
              stopIndex,
            },
          ]
    )
  );
}
