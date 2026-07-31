"use client";

import { Check, Coffee, MapPin, Utensils } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CATEGORY_META } from "@/lib/itinerary/categories";
import { resolvePickKind } from "@/lib/itinerary/picks";
import { cn } from "@/lib/utils";
import type {
  ItineraryPick,
  StopCategory,
} from "@/lib/itinerary/types";

interface ItineraryPickListProps {
  picks: ItineraryPick[];
  hostCategory: StopCategory;
  /** 관광지 근처 추천이면 true. 헤더 문구를 바꾼다. */
  areaRecommend?: boolean;
  /** 사용자가 고른 추천 가게 이름. */
  selectedName?: string | null;
  onSelect?: (pick: ItineraryPick) => void;
}

/** 지역·끼니별 맛집/카페 추천 카드 목록. */
export function ItineraryPickList({
  picks,
  hostCategory,
  areaRecommend = false,
  selectedName = null,
  onSelect,
}: ItineraryPickListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {picks.map((pick) => {
        const kind = resolvePickKind(pick, hostCategory);
        const meta = CATEGORY_META[kind];
        const Icon = kind === "cafe" ? Coffee : Utensils;
        const selected = selectedName === pick.name;

        return (
          <li key={pick.name}>
            <article
              className={cn(
                "rounded-xl border px-2.5 py-2.5 transition-colors",
                selected
                  ? "border-primary/40 bg-accent/60"
                  : "border-border/80 bg-card"
              )}
            >
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                    meta.chipClass
                  )}
                >
                  <Icon className="size-3.5" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h5 className="truncate text-[12px] font-semibold">
                      {pick.name}
                    </h5>
                    <span
                      className={cn(
                        "rounded px-1 py-px text-[10px]",
                        meta.chipClass
                      )}
                    >
                      {kind === "cafe" ? "카페" : "맛집"}
                    </span>
                    {selected && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary">
                        <Check className="size-3" />
                        선택됨
                      </span>
                    )}
                  </div>

                  {pick.note && (
                    <p className="mt-0.5 text-[11px] font-medium text-foreground/85">
                      {pick.note}
                      {pick.price ? (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {pick.price}
                        </span>
                      ) : null}
                    </p>
                  )}

                  {(pick.description || (!pick.note && areaRecommend)) && (
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {pick.description ?? "이 지역에서 함께 들르기 좋은 곳이에요."}
                    </p>
                  )}

                  {pick.lat !== undefined && pick.lng !== undefined && (
                    <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-muted-foreground/80">
                      <MapPin className="size-2.5" />
                      {pick.lat.toFixed(4)}, {pick.lng.toFixed(4)}
                    </p>
                  )}
                </div>
              </div>

              {onSelect && (
                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    size="xs"
                    variant={selected ? "secondary" : "outline"}
                    className="gap-1"
                    onClick={() => onSelect(pick)}
                  >
                    {selected ? (
                      <>
                        <Check className="size-3" />
                        추천 선택됨
                      </>
                    ) : (
                      "이 맛집 선택"
                    )}
                  </Button>
                </div>
              )}
            </article>
          </li>
        );
      })}
    </ul>
  );
}
