"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";

import type { Point } from "@/lib/itinerary/geometry";

import "leaflet/dist/leaflet.css";

/**
 * 브라우저 전용 훅. Leaflet은 모듈 로드 시 `window`를 참조하므로
 * 이 훅을 쓰는 컴포넌트는 반드시 `ssr: false`로 지연 로딩해야 한다.
 */

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** 좌표가 없을 때의 기본 시점(서울). */
const FALLBACK_CENTER: L.LatLngTuple = [37.5665, 126.978];

interface Coordinate {
  lat: number;
  lng: number;
}

interface UseLeafletMapResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** `coordinates`와 같은 순서·길이의 컨테이너 픽셀 좌표. 지도 준비 전에는 빈 배열. */
  points: Point[];
}

export function useLeafletMap(coordinates: Coordinate[]): UseLeafletMapResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const coordinatesRef = useRef(coordinates);
  const [points, setPoints] = useState<Point[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, {
      zoomControl: true,
      scrollWheelZoom: false, // 채팅 스크롤을 가로채지 않도록 휠 줌은 끈다.
      zoomAnimation: false, // 애니메이션 중에는 오버레이 픽셀 좌표가 어긋난다.
      doubleClickZoom: true,
    }).setView(FALLBACK_CENTER, 11);

    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map);

    const projectPoints = () => {
      setPoints(
        coordinatesRef.current.map((coordinate) => {
          const point = map.latLngToContainerPoint([
            coordinate.lat,
            coordinate.lng,
          ]);
          return { x: point.x, y: point.y };
        })
      );
    };

    const syncView = () => {
      fitMapToCoordinates(map, coordinatesRef.current);
      projectPoints();
    };

    map.on("move zoom moveend zoomend resize", projectPoints);

    // 상세→지도 전환처럼 컨테이너가 뒤늦게 크기를 얻는 경우,
    // 0×0 상태에서 돌린 fitBounds는 마커/화살표를 화면 밖에 둔다.
    // 크기가 처음 생기는 시점에만 시야를 다시 맞춘다.
    let wasVisible = false;
    const observer = new ResizeObserver(() => {
      const visible = container.clientWidth > 0 && container.clientHeight > 0;
      map.invalidateSize({ animate: false });

      if (visible && !wasVisible) {
        wasVisible = true;
        syncView();
        return;
      }

      if (!visible) {
        wasVisible = false;
        return;
      }

      projectPoints();
    });
    observer.observe(container);

    mapRef.current = map;
    // 레이아웃이 끝난 뒤 한 번 더 맞춰, 첫 페인트에서 크기가 늦는 경우를 흡수한다.
    requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
      syncView();
    });

    return () => {
      observer.disconnect();
      map.off();
      map.remove();
      mapRef.current = null;
      setPoints([]);
    };
  }, []);

  useEffect(() => {
    coordinatesRef.current = coordinates;

    const map = mapRef.current;
    if (!map) return;

    fitMapToCoordinates(map, coordinates);
    setPoints(
      coordinates.map((coordinate) => {
        const point = map.latLngToContainerPoint([
          coordinate.lat,
          coordinate.lng,
        ]);
        return { x: point.x, y: point.y };
      })
    );
  }, [coordinates]);

  return { containerRef, points };
}

function fitMapToCoordinates(map: L.Map, coordinates: Coordinate[]) {
  if (coordinates.length === 0) {
    map.setView(FALLBACK_CENTER, 11);
    return;
  }

  if (coordinates.length === 1) {
    map.setView([coordinates[0].lat, coordinates[0].lng], 14);
    return;
  }

  const bounds = L.latLngBounds(
    coordinates.map((coordinate) => [coordinate.lat, coordinate.lng])
  );
  map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: false });
}
