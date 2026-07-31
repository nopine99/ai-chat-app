"use client";

import { useState, type ReactNode } from "react";
import {
  BookOpen,
  Clock,
  Coffee,
  Map as MapIcon,
  MapPin,
  Navigation,
  StickyNote,
  Utensils,
} from "lucide-react";

import { CATEGORY_ICON } from "@/components/itinerary/category-icon";
import { ItineraryPickList } from "@/components/itinerary/itinerary-pick-list";
import { TRANSPORT_ICON } from "@/components/itinerary/transport-icon";
import { Button } from "@/components/ui/button";
import { CATEGORY_META } from "@/lib/itinerary/categories";
import { TRANSPORT_LABEL } from "@/lib/itinerary/transport";
import type {
  ItineraryPick,
  ItineraryStop,
  ItineraryTransport,
  StopCategory,
} from "@/lib/itinerary/types";

interface ItineraryStopDetailProps {
  stop: ItineraryStop;
  order: number;
  onOpenMap: () => void;
  onClose?: () => void;
}

/** 선택한 일정의 상세. 관광지·맛집 소개와 지역 맛집 추천을 보여준다. */
export function ItineraryStopDetail({
  stop,
  order,
  onOpenMap,
  onClose,
}: ItineraryStopDetailProps) {
  const meta = CATEGORY_META[stop.category];
  const Icon = CATEGORY_ICON[stop.category];
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const picks = stop.picks ?? [];
  const areaRecommend = stop.category === "sight" || stop.category === "activity";
  const descriptionTitle = descriptionLabel(stop.category);
  const picksTitle = picksSectionTitle(stop.category, picks.length);

  const selectPick = (pick: ItineraryPick) => {
    setSelectedName((prev) => (prev === pick.name ? null : pick.name));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-start gap-3 border-b border-border/70 px-3 py-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${meta.chipClass}`}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {order}번째
            </span>
            <span
              className={`rounded px-1.5 py-px text-[10px] font-medium ${meta.chipClass}`}
            >
              {meta.label}
            </span>
            {stop.note && (
              <span className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
                {stop.note}
              </span>
            )}
          </div>
          <h3 className="mt-0.5 truncate text-sm font-semibold">{stop.name}</h3>
          {stop.time && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="size-3" />
              {stop.time}
            </p>
          )}
        </div>
        {onClose && (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={onClose}
            className="shrink-0 sm:hidden"
          >
            닫기
          </Button>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {(stop.description || isDetailCategory(stop.category)) && (
          <DetailSection
            icon={<BookOpen className="size-3.5" />}
            title={descriptionTitle}
          >
            {stop.description ? (
              <p className="rounded-xl border border-border/70 bg-muted/30 px-2.5 py-2 text-[12px] leading-relaxed text-foreground/90">
                {stop.description}
              </p>
            ) : (
              <p className="rounded-xl border border-dashed border-border px-2.5 py-2 text-[11px] text-muted-foreground">
                {emptyDescriptionHint(stop.category)}
              </p>
            )}
          </DetailSection>
        )}

        {stop.note && stop.description && (
          <DetailSection
            icon={<StickyNote className="size-3.5" />}
            title="메모"
          >
            <p className="text-[12px] text-muted-foreground">{stop.note}</p>
          </DetailSection>
        )}

        {stop.transport && (
          <DetailSection
            icon={<Navigation className="size-3.5" />}
            title="이전 장소에서 이동"
          >
            <TransportDetail transport={stop.transport} />
          </DetailSection>
        )}

        {picks.length > 0 ? (
          <DetailSection
            icon={
              areaRecommend ? (
                <Utensils className="size-3.5" />
              ) : stop.category === "cafe" ? (
                <Coffee className="size-3.5" />
              ) : (
                <Utensils className="size-3.5" />
              )
            }
            title={picksTitle}
          >
            <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
              {areaRecommend
                ? "이 지역 근처에서 들르기 좋은 맛집·카페예요. 마음에 드는 곳을 골라보세요."
                : "같은 시간대에 대신 고를 수 있는 근처 후보예요."}
            </p>
            <ItineraryPickList
              picks={picks}
              hostCategory={stop.category}
              areaRecommend={areaRecommend}
              selectedName={selectedName}
              onSelect={selectPick}
            />
            {selectedName && (
              <p className="mt-2 rounded-lg bg-accent/70 px-2.5 py-1.5 text-[11px] text-accent-foreground">
                «{selectedName}» 을(를) 이 일정의 추천 맛집으로 골랐어요.
              </p>
            )}
          </DetailSection>
        ) : (
          areaRecommend && (
            <DetailSection
              icon={<Utensils className="size-3.5" />}
              title="이 지역 맛집 추천"
            >
              <p className="rounded-xl border border-dashed border-border px-2.5 py-3 text-[11px] leading-relaxed text-muted-foreground">
                아직 추천 맛집이 없어요. 채팅에서 «{stop.name} 근처 맛집
                추천해줘»처럼 물어보면 일정을 다시 받을 수 있어요.
              </p>
            </DetailSection>
          )
        )}

        <DetailSection icon={<MapPin className="size-3.5" />} title="위치">
          <p className="font-mono text-[11px] text-muted-foreground">
            {stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}
          </p>
        </DetailSection>

        <MapLaunchButton onClick={onOpenMap} stopName={stop.name} />
      </div>
    </div>
  );
}

export function ItineraryDetailEmpty() {
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <MapPin className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">일정을 선택하세요</p>
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          관광지 소개와 그 지역 맛집 추천이
          <br />
          여기에 표시돼요.
        </p>
      </div>
    </div>
  );
}

function isDetailCategory(category: StopCategory): boolean {
  return category === "sight" || category === "food" || category === "cafe";
}

function descriptionLabel(category: StopCategory): string {
  switch (category) {
    case "sight":
      return "관광지 소개";
    case "food":
      return "맛집 소개";
    case "cafe":
      return "카페 소개";
    case "activity":
      return "체험 소개";
    default:
      return "상세 설명";
  }
}

function emptyDescriptionHint(category: StopCategory): string {
  switch (category) {
    case "sight":
      return "관광지 설명이 아직 없어요. 새로 일정을 요청하면 소개가 채워질 수 있어요.";
    case "food":
      return "맛집 상세 설명이 아직 없어요.";
    case "cafe":
      return "카페 상세 설명이 아직 없어요.";
    default:
      return "상세 설명이 아직 없어요.";
  }
}

function picksSectionTitle(category: StopCategory, count: number): string {
  const suffix = count > 0 ? ` (${count})` : "";
  if (category === "sight" || category === "activity") {
    return `이 지역 맛집 추천${suffix}`;
  }
  if (category === "cafe") return `추천 카페${suffix}`;
  if (category === "food") return `추천 맛집${suffix}`;
  return `근처 추천${suffix}`;
}

function DetailSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <h4 className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        {icon}
        {title}
      </h4>
      {children}
    </section>
  );
}

function TransportDetail({ transport }: { transport: ItineraryTransport }) {
  return (
    <div className="rounded-xl border border-border/80 bg-muted/40 px-2.5 py-2">
      <ul className="flex flex-col gap-1.5">
        {transport.legs.map((leg, index) => {
          const Icon = TRANSPORT_ICON[leg.mode];
          return (
            <li
              key={`${index}-${leg.mode}`}
              className="flex items-center gap-1.5 text-[12px]"
            >
              <Icon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="font-medium">{TRANSPORT_LABEL[leg.mode]}</span>
              {leg.line && (
                <span className="rounded border border-border bg-background px-1 text-[10px]">
                  {leg.line}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        {transport.duration && <span>소요 {transport.duration}</span>}
        {transport.fare && (
          <span className="font-medium text-foreground">
            요금 {transport.fare}
          </span>
        )}
        {transport.detail && <span>{transport.detail}</span>}
      </div>
    </div>
  );
}

function MapLaunchButton({
  onClick,
  stopName,
}: {
  onClick: () => void;
  stopName: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${stopName} 전체 지도 보기`}
      className="group relative mt-1 w-full overflow-hidden rounded-xl border border-border text-left outline-none transition-all hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,color-mix(in_oklch,var(--stop-sight)_35%,transparent),transparent_45%),radial-gradient(circle_at_70%_65%,color-mix(in_oklch,var(--stop-food)_30%,transparent),transparent_40%),linear-gradient(160deg,color-mix(in_oklch,var(--muted)_90%,var(--brand)),var(--muted))]"
      />
      <span
        aria-hidden
        className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,color-mix(in_oklch,var(--border)_80%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--border)_80%,transparent)_1px,transparent_1px)] [background-size:18px_18px]"
      />
      <span
        aria-hidden
        className="absolute left-[28%] top-[38%] size-2.5 rounded-full bg-stop-sight shadow-sm ring-2 ring-background"
      />
      <span
        aria-hidden
        className="absolute left-[58%] top-[52%] size-2 rounded-full bg-stop-food shadow-sm ring-2 ring-background"
      />
      <span
        aria-hidden
        className="absolute left-[72%] top-[30%] size-2 rounded-full bg-stop-cafe shadow-sm ring-2 ring-background"
      />

      <span className="relative flex h-[96px] items-end p-3">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/90 px-2.5 py-1.5 text-[12px] font-medium shadow-sm backdrop-blur-sm transition-transform group-hover:translate-y-[-1px]">
          <MapIcon className="size-3.5 text-primary" />
          지도
          <span className="text-muted-foreground">전체 보기</span>
        </span>
      </span>
    </button>
  );
}
