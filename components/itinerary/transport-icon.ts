import {
  Bike,
  Bus,
  Car,
  CarTaxiFront,
  Footprints,
  Navigation,
  Plane,
  Ship,
  TrainFront,
  TrainFrontTunnel,
  TramFront,
  type LucideIcon,
} from "lucide-react";

import type { TransportMode } from "@/lib/itinerary/types";

/** 지도 구간 라벨과 장소 리스트가 같은 아이콘을 쓰도록 한곳에 둔다. */
export const TRANSPORT_ICON: Record<TransportMode, LucideIcon> = {
  walk: Footprints,
  subway: TrainFrontTunnel,
  tram: TramFront,
  bus: Bus,
  train: TrainFront,
  car: Car,
  taxi: CarTaxiFront,
  bike: Bike,
  ferry: Ship,
  flight: Plane,
  other: Navigation,
};
