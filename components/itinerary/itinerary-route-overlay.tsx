"use client";

import { useMemo } from "react";

import { CATEGORY_ICON } from "@/components/itinerary/category-icon";
import { TRANSPORT_ICON } from "@/components/itinerary/transport-icon";
import { CATEGORY_META } from "@/lib/itinerary/categories";
import { buildArrow, spreadPoints, type Point } from "@/lib/itinerary/geometry";
import type { PickMarker } from "@/lib/itinerary/picks";
import { formatTransportLabel } from "@/lib/itinerary/transport";
import type { ItineraryStop, ItineraryTransport } from "@/lib/itinerary/types";

/**
 * 지도 위에 순번 마커와 방향 화살표를 그리는 SVG 레이어.
 * 지도 팬/줌은 아래 Leaflet 컨테이너가 처리하도록 기본적으로 포인터 이벤트를 통과시키고,
 * 마커만 예외로 hover를 받는다. 키보드·스크린리더 대응은 아래 장소 리스트가 담당한다.
 */

const MARKER_RADIUS = 13;
const ACTIVE_MARKER_RADIUS = 16;
/** 마커 안 카테고리 아이콘. 지름(26)보다 작게 잡아 원 안에 여백을 남긴다. */
const MARKER_ICON_SIZE = 14;
/** 아이콘이 가운데를 차지하므로 순번은 원 테두리에 붙는 작은 배지로 옮긴다. */
const ORDER_BADGE_RADIUS = 7.5;

/** 마커 사이 최소 간격. 화살표가 들어갈 여유를 두고 잡는다. */
const MIN_MARKER_GAP = 40;

/** 추천 후보 점. 일정에 든 장소와 헷갈리지 않게 순번 없이 작게 찍는다. */
const PICK_RADIUS = 5;
const ACTIVE_PICK_RADIUS = 7;

const ARROW_OPTIONS = {
  gap: MARKER_RADIUS + 4,
  headLength: 9,
  headWidth: 8,
  curvature: 0.14,
};

const LABEL_HEIGHT = 16;
const LABEL_PADDING_X = 5;
const LABEL_ICON_SIZE = 11;
const LABEL_ICON_GAP = 3;
/** 라벨 양끝이 마커에 닿지 않도록 남겨 둘 여백. */
const LABEL_CLEARANCE = 6;

interface ItineraryRouteOverlayProps {
  stops: ItineraryStop[];
  points: Point[];
  picks: PickMarker[];
  pickPoints: Point[];
  activeIndex: number | null;
  onActivate: (index: number | null) => void;
}

export function ItineraryRouteOverlay({
  stops,
  points,
  picks,
  pickPoints,
  activeIndex,
  onActivate,
}: ItineraryRouteOverlayProps) {
  const spread = useMemo(() => spreadPoints(points, MIN_MARKER_GAP), [points]);

  // 지도 픽셀 좌표가 아직 안 왔거나 길이가 어긋나면 그리지 않는다.
  // (상세→지도 전환 직후 한 프레임은 비어 있을 수 있다.)
  if (spread.length === 0 || spread.length !== stops.length) return null;

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible"
    >
      {/* 후보 점을 가장 아래에 깔아 일정 마커와 화살표가 늘 위에 오게 한다. */}
      {picks.map((pick, index) => {
        const point = pickPoints[index];
        if (!point) return null;

        const isActive = activeIndex === pick.stopIndex;

        return (
          <circle
            key={`pick-${pick.stopIndex}-${pick.name}`}
            cx={point.x}
            cy={point.y}
            r={isActive ? ACTIVE_PICK_RADIUS : PICK_RADIUS}
            className={`${CATEGORY_META[pick.category].fillClass} stroke-background ${
              isActive ? "opacity-100" : "opacity-70"
            }`}
            strokeWidth={2}
          />
        );
      })}

      {spread.slice(0, -1).map((from, index) => {
        const to = spread[index + 1];
        const arrow = buildArrow(from, to, ARROW_OPTIONS);
        if (!arrow) return null;

        const transport = stops[index + 1]?.transport;

        return (
          <g key={`arrow-${index}`}>
            {/* 지도 타일 위에서도 선이 보이도록 배경색 테두리를 먼저 깐다. */}
            <path
              d={arrow.shaft}
              className="stroke-background/80"
              strokeWidth={6}
              strokeLinecap="round"
              fill="none"
            />
            <path
              d={arrow.shaft}
              className="stroke-route"
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="none"
            />
            <polygon
              points={arrow.head}
              className="fill-route stroke-background/80"
              strokeWidth={1}
            />
            {transport && (
              <TransportLabel
                transport={transport}
                at={arrow.midpoint}
                span={Math.hypot(to.x - from.x, to.y - from.y)}
                markers={spread}
              />
            )}
          </g>
        );
      })}

      {stops.map((stop, index) => {
        const point = spread[index];
        const isActive = activeIndex === index;
        const radius = isActive ? ACTIVE_MARKER_RADIUS : MARKER_RADIUS;
        const Icon = CATEGORY_ICON[stop.category];

        // 배지를 원 오른쪽 위 테두리에 걸친다(45도 방향이라 두 축 모두 0.7배).
        const badgeX = point.x + radius * 0.7;
        const badgeY = point.y - radius * 0.7;

        return (
          <g
            key={`${stop.name}-${index}`}
            className="pointer-events-auto cursor-pointer"
            onMouseEnter={() => onActivate(index)}
            onMouseLeave={() => onActivate(null)}
          >
            {isActive && (
              <circle
                cx={point.x}
                cy={point.y}
                r={radius + 4}
                className={`${CATEGORY_META[stop.category].fillClass} opacity-25`}
              />
            )}
            <circle
              cx={point.x}
              cy={point.y}
              r={radius}
              className={`${CATEGORY_META[stop.category].fillClass} stroke-background`}
              strokeWidth={2.5}
            />
            <Icon
              x={point.x - MARKER_ICON_SIZE / 2}
              y={point.y - MARKER_ICON_SIZE / 2}
              width={MARKER_ICON_SIZE}
              height={MARKER_ICON_SIZE}
              strokeWidth={2.4}
              className="text-background"
            />
            <circle
              cx={badgeX}
              cy={badgeY}
              r={ORDER_BADGE_RADIUS}
              className="fill-background stroke-border"
              strokeWidth={1}
            />
            <text
              x={badgeX}
              y={badgeY}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-foreground text-[9px] font-bold"
            >
              {index + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

interface TransportLabelProps {
  transport: ItineraryTransport;
  at: Point;
  /** 두 마커 사이 거리. 라벨이 마커를 덮을 만큼 짧으면 생략한다. */
  span: number;
  /** 라벨 위에 그려지는 마커들. 겹치면 글자가 가려지므로 라벨을 접는다. */
  markers: Point[];
}

/** 구간 화살표 위에 얹는 "[버스] 1011번 15분" 알약. */
function TransportLabel({ transport, at, span, markers }: TransportLabelProps) {
  // 환승 구간까지 아이콘을 늘어놓으면 알약이 넓어져 잘 접히므로 첫 수단만 그린다.
  const Icon = TRANSPORT_ICON[transport.legs[0].mode];
  const text = formatTransportLabel(transport);
  const width =
    LABEL_PADDING_X * 2 + LABEL_ICON_SIZE + LABEL_ICON_GAP + estimateTextWidth(text);

  if (span < width + (MARKER_RADIUS + LABEL_CLEARANCE) * 2) return null;
  if (markers.some((marker) => touchesLabel(marker, at, width))) return null;

  const left = at.x - width / 2;

  return (
    <>
      <rect
        x={left}
        y={at.y - LABEL_HEIGHT / 2}
        width={width}
        height={LABEL_HEIGHT}
        rx={LABEL_HEIGHT / 2}
        className="fill-background stroke-border"
        strokeWidth={1}
      />
      <Icon
        x={left + LABEL_PADDING_X}
        y={at.y - LABEL_ICON_SIZE / 2}
        width={LABEL_ICON_SIZE}
        height={LABEL_ICON_SIZE}
        strokeWidth={2.4}
        className="text-muted-foreground"
      />
      <text
        x={left + LABEL_PADDING_X + LABEL_ICON_SIZE + LABEL_ICON_GAP}
        y={at.y}
        dominantBaseline="central"
        className="fill-foreground text-[10px] font-medium"
      >
        {text}
      </text>
    </>
  );
}

/** 마커 원(순번 배지까지 포함)이 `at`을 중심으로 놓인 라벨 알약과 닿는지 본다. */
function touchesLabel(marker: Point, at: Point, width: number): boolean {
  const gapX = Math.abs(marker.x - at.x) - width / 2;
  const gapY = Math.abs(marker.y - at.y) - LABEL_HEIGHT / 2;

  return Math.hypot(Math.max(gapX, 0), Math.max(gapY, 0)) < MARKER_RADIUS + LABEL_CLEARANCE;
}

/** SVG는 렌더 전에 텍스트 폭을 알 수 없어 글자 종류로 근사한다(한글은 폭이 거의 두 배). */
function estimateTextWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    width += char.charCodeAt(0) > 0x2e80 ? 10 : 5.4;
  }
  return Math.ceil(width);
}
