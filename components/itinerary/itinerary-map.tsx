"use client";

import { useMemo } from "react";

import { ItineraryRouteOverlay } from "@/components/itinerary/itinerary-route-overlay";
import { useLeafletMap } from "@/hooks/use-leaflet-map";
import { collectPickMarkers } from "@/lib/itinerary/picks";
import { cn } from "@/lib/utils";
import type { ItineraryStop } from "@/lib/itinerary/types";

interface ItineraryMapProps {
  stops: ItineraryStop[];
  activeIndex: number | null;
  onActivate: (index: number | null) => void;
  className?: string;
}

export function ItineraryMap({
  stops,
  activeIndex,
  onActivate,
  className,
}: ItineraryMapProps) {
  // 스트리밍 중에는 본문이 바뀔 때마다 stops 배열이 새로 만들어진다.
  // 좌표가 실제로 달라졌을 때만 지도를 다시 맞추도록 값 기준으로 메모한다.
  const picks = useMemo(() => collectPickMarkers(stops), [stops]);
  const signature = [...stops, ...picks]
    .map((entry) => `${entry.lat},${entry.lng}`)
    .join("|");

  // 후보 좌표까지 함께 넘겨 지도 범위(fitBounds)에 포함시킨다.
  const coordinates = useMemo(
    () => [...stops, ...picks].map((entry) => ({ lat: entry.lat, lng: entry.lng })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature]
  );

  const { containerRef, points } = useLeafletMap(coordinates);

  const stopPoints = points.slice(0, stops.length);
  const pickPoints = points.slice(stops.length);

  return (
    <div
      className={cn(
        "relative z-0 isolate h-[300px] w-full overflow-hidden rounded-lg border border-border",
        className
      )}
    >
      <div ref={containerRef} className="absolute inset-0 z-0 h-full w-full" />
      <ItineraryRouteOverlay
        stops={stops}
        points={stopPoints}
        picks={picks}
        pickPoints={pickPoints}
        activeIndex={activeIndex}
        onActivate={onActivate}
      />
    </div>
  );
}
