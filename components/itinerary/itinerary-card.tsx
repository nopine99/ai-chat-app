"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Map as MapIcon } from "lucide-react";

import {
  ItineraryDetailEmpty,
  ItineraryStopDetail,
} from "@/components/itinerary/itinerary-stop-detail";
import { ItineraryStopList } from "@/components/itinerary/itinerary-stop-list";
import { Button } from "@/components/ui/button";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/itinerary/categories";
import { cn } from "@/lib/utils";
import type { ItineraryPlan, StopCategory } from "@/lib/itinerary/types";

/** Leaflet은 `window`에 의존하므로 서버 렌더링에서 제외한다. */
const ItineraryMap = dynamic(
  () => import("@/components/itinerary/itinerary-map").then((m) => m.ItineraryMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[360px] w-full animate-pulse rounded-lg border border-border bg-muted" />
    ),
  }
);

type CardView = "browse" | "map";

interface ItineraryCardProps {
  plan: ItineraryPlan;
}

export function ItineraryCard({ plan }: ItineraryCardProps) {
  const [requestedDay, setRequestedDay] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [view, setView] = useState<CardView>("browse");

  // 스트리밍 중 일차 수가 늘거나 줄 수 있어 인덱스를 매 렌더에서 범위 안으로 좁힌다.
  const dayIndex = Math.min(requestedDay, plan.days.length - 1);
  const day = plan.days[dayIndex];
  const selectedStop =
    selectedIndex !== null ? (day.stops[selectedIndex] ?? null) : null;

  const usedCategories = CATEGORY_ORDER.filter((category) =>
    day.stops.some((stop) => stop.category === category)
  );
  const hasPickMarkers = day.stops.some((stop) =>
    stop.picks?.some((pick) => pick.lat !== undefined && pick.lng !== undefined)
  );

  const selectDay = (index: number) => {
    setRequestedDay(index);
    setSelectedIndex(null);
    setView("browse");
  };

  const openMap = () => setView("map");

  return (
    <section className="my-2 w-full min-w-0 overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
      <header className="flex items-center gap-1.5 border-b border-border/70 px-3 py-2.5">
        {view === "map" ? (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => setView("browse")}
            className="gap-1"
          >
            <ArrowLeft className="size-3.5" />
            상세로
          </Button>
        ) : (
          <MapIcon className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <h4 className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          {view === "map" ? "전체 지도" : (plan.title ?? "여행 일정")}
        </h4>
        {view === "browse" && (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={openMap}
            className="gap-1"
          >
            <MapIcon className="size-3" />
            지도
          </Button>
        )}
      </header>

      {plan.days.length > 1 && (
        <div className="flex flex-wrap gap-1 border-b border-border/60 px-3 py-2">
          {plan.days.map((entry, index) => (
            <Button
              key={`${entry.label}-${index}`}
              size="xs"
              variant={index === dayIndex ? "default" : "outline"}
              aria-current={index === dayIndex}
              onClick={() => selectDay(index)}
            >
              {entry.label}
            </Button>
          ))}
        </div>
      )}

      {view === "map" ? (
        <div className="p-2.5">
          <ItineraryMap
            stops={day.stops}
            activeIndex={selectedIndex}
            onActivate={(index) => {
              // hover leave로 null이 와도 상세에서 고른 선택을 유지한다.
              if (index !== null) setSelectedIndex(index);
            }}
            className="h-[min(52vh,420px)]"
          />
          <CategoryLegend
            categories={usedCategories}
            hasPickMarkers={hasPickMarkers}
          />
          {selectedStop && (
            <p className="mt-2 truncate text-[11px] text-muted-foreground">
              선택: {selectedIndex! + 1}. {selectedStop.name}
              {selectedStop.time ? ` · ${selectedStop.time}` : ""}
            </p>
          )}
        </div>
      ) : (
        <div className="relative grid min-h-[280px] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="min-h-0 overflow-y-auto border-border/70 p-2.5 sm:border-r sm:max-h-[420px]">
            <ItineraryStopList
              stops={day.stops}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
            />
          </div>

          {/* 모바일: 선택 시 오른쪽에서 상세 오버레이. 데스크톱: 고정 사이드. */}
          <aside
            className={cn(
              "min-h-0 bg-card",
              selectedStop
                ? "absolute inset-0 z-10 sm:static sm:max-h-[420px]"
                : "hidden sm:block sm:max-h-[420px]"
            )}
          >
            {selectedStop ? (
              <ItineraryStopDetail
                key={`${dayIndex}-${selectedIndex}-${selectedStop.name}`}
                stop={selectedStop}
                order={(selectedIndex ?? 0) + 1}
                onOpenMap={openMap}
                onClose={() => setSelectedIndex(null)}
              />
            ) : (
              <ItineraryDetailEmpty />
            )}
          </aside>
        </div>
      )}

      <p className="border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
        위치와 추천 가게는 AI가 추정한 정보예요. 출발 전에 실제 주소와 영업 여부를
        확인해주세요.
      </p>
    </section>
  );
}

interface CategoryLegendProps {
  categories: StopCategory[];
  hasPickMarkers: boolean;
}

function CategoryLegend({ categories, hasPickMarkers }: CategoryLegendProps) {
  if (categories.length === 0) return null;

  return (
    <ul className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
      {categories.map((category) => (
        <li key={category} className="flex items-center gap-1 text-[11px]">
          <span
            aria-hidden
            className={`size-2 rounded-full ${CATEGORY_META[category].dotClass}`}
          />
          <span className="text-muted-foreground">
            {CATEGORY_META[category].label}
          </span>
        </li>
      ))}

      {hasPickMarkers && (
        <li className="flex items-center gap-1 text-[11px]">
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-muted-foreground/60"
          />
          <span className="text-muted-foreground">추천 후보(순번 없음)</span>
        </li>
      )}
    </ul>
  );
}
