import {
  BedDouble,
  Coffee,
  FerrisWheel,
  Landmark,
  ShoppingBag,
  Utensils,
  type LucideIcon,
} from "lucide-react";

import type { StopCategory } from "@/lib/itinerary/types";

/** 지도 마커와 장소 리스트가 같은 아이콘을 쓰도록 한곳에 둔다. */
export const CATEGORY_ICON: Record<StopCategory, LucideIcon> = {
  sight: Landmark,
  food: Utensils,
  cafe: Coffee,
  stay: BedDouble,
  shopping: ShoppingBag,
  activity: FerrisWheel,
};
