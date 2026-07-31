"use client";

import { ChevronRight } from "lucide-react";

import { CATEGORY_ICON } from "@/components/itinerary/category-icon";
import { TRANSPORT_ICON } from "@/components/itinerary/transport-icon";
import { CATEGORY_META } from "@/lib/itinerary/categories";
import { TRANSPORT_LABEL } from "@/lib/itinerary/transport";
import { cn } from "@/lib/utils";
import type {
  ItineraryStop,
  ItineraryTransport,
} from "@/lib/itinerary/types";

interface ItineraryStopListProps {
  stops: ItineraryStop[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

/** 일정 목록. 클릭하면 오른쪽 상세 패널이 열린다. */
export function ItineraryStopList({
  stops,
  selectedIndex,
  onSelect,
}: ItineraryStopListProps) {
  return (
    <ol className="flex flex-col">
      {stops.map((stop, index) => {
        const meta = CATEGORY_META[stop.category];
        const Icon = CATEGORY_ICON[stop.category];
        const isSelected = selectedIndex === index;
        const isLast = index === stops.length - 1;
        const pickCount = stop.picks?.length ?? 0;

        return (
          <li key={`${stop.name}-${index}`} className="flex flex-col">
            {stop.transport && <TransportRow transport={stop.transport} />}

            <div className="flex gap-2">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    meta.chipClass
                  )}
                >
                  {index + 1}
                </span>
                {!isLast && <span className="w-px flex-1 bg-border" />}
              </div>

              <div className="flex min-w-0 flex-1 flex-col pb-1">
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  aria-pressed={isSelected}
                  className={cn(
                    "group mb-0.5 flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted/70"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-3.5 shrink-0",
                      isSelected ? "text-accent-foreground" : "text-muted-foreground"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                    {stop.name}
                  </span>
                  {stop.time && (
                    <span
                      className={cn(
                        "shrink-0 text-[11px]",
                        isSelected
                          ? "text-accent-foreground/80"
                          : "text-muted-foreground"
                      )}
                    >
                      {stop.time}
                    </span>
                  )}
                  <ChevronRight
                    className={cn(
                      "size-3.5 shrink-0 transition-transform",
                      isSelected
                        ? "translate-x-0.5 text-accent-foreground"
                        : "text-muted-foreground/50"
                    )}
                  />
                </button>

                <div className="flex flex-wrap items-center gap-1 px-2 pb-0.5">
                  <span
                    className={cn(
                      "rounded px-1 py-px text-[10px]",
                      meta.chipClass
                    )}
                  >
                    {meta.label}
                  </span>
                  {stop.description && (
                    <span className="text-[10px] text-muted-foreground">소개</span>
                  )}
                  {pickCount > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {stop.category === "sight" || stop.category === "activity"
                        ? `맛집 ${pickCount}`
                        : `추천 ${pickCount}`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function TransportRow({ transport }: { transport: ItineraryTransport }) {
  return (
    <div className="flex gap-2">
      <div className="flex w-5 shrink-0 justify-center">
        <span className="w-px bg-border" />
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 py-0.5 pl-1.5 text-[11px] text-muted-foreground">
        {transport.legs.map((leg, index) => {
          const Icon = TRANSPORT_ICON[leg.mode];

          return (
            <span key={`${index}-${leg.mode}`} className="flex items-center gap-1">
              {index > 0 && <ChevronRight aria-hidden className="size-3 opacity-50" />}
              <Icon className="size-3 shrink-0" />
              {TRANSPORT_LABEL[leg.mode]}
              {leg.line && (
                <span className="rounded border border-border px-1 font-medium text-foreground">
                  {leg.line}
                </span>
              )}
            </span>
          );
        })}

        {transport.duration && <span>· {transport.duration}</span>}
        {transport.fare && (
          <span className="font-medium text-foreground">· {transport.fare}</span>
        )}
      </div>
    </div>
  );
}
