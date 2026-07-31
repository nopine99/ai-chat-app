/** 지도 오버레이용 순수 기하 계산. Leaflet에 의존하지 않는다. */

export interface Point {
  x: number;
  y: number;
}

export interface ArrowShape {
  /** 곡선 화살대의 SVG path `d`. */
  shaft: string;
  /** 화살촉 삼각형의 SVG `points`. */
  head: string;
  /** 곡선 중앙(구간 라벨을 놓기 좋은 지점). */
  midpoint: Point;
}

interface ArrowOptions {
  /** 마커 원 반지름 + 여유. 화살표가 원에 파묻히지 않게 양끝을 잘라낸다. */
  gap: number;
  headLength: number;
  headWidth: number;
  /** 0이면 직선. 0.12 정도면 완만한 곡선. */
  curvature: number;
}

/** 이 길이 미만이면 화살표를 그려도 알아볼 수 없어 생략한다. */
const MIN_ARROW_LENGTH = 10;

/**
 * 두 지점을 잇는 완만한 곡선 화살표를 만든다.
 * 구간이 짧으면 여백과 화살촉을 비례해서 줄여 항상 화살대가 남게 한다.
 * 그려도 알아볼 수 없을 만큼 가까우면 null.
 */
export function buildArrow(
  from: Point,
  to: Point,
  options: ArrowOptions
): ArrowShape | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);

  if (!Number.isFinite(length) || length < MIN_ARROW_LENGTH) return null;

  const { headWidth, curvature } = options;
  const gap = Math.min(options.gap, length * 0.28);
  const headLength = Math.min(options.headLength, length * 0.25);
  const consumed = gap * 2 + headLength;

  const ux = dx / length;
  const uy = dy / length;

  const start: Point = { x: from.x + ux * gap, y: from.y + uy * gap };
  const shaftEnd: Point = {
    x: to.x - ux * (gap + headLength),
    y: to.y - uy * (gap + headLength),
  };

  // 제어점을 진행 방향의 법선 쪽으로 밀어 곡선을 만든다.
  const bend = (length - consumed) * curvature;
  const control: Point = {
    x: (start.x + shaftEnd.x) / 2 - uy * bend,
    y: (start.y + shaftEnd.y) / 2 + ux * bend,
  };

  // 2차 베지어의 t=1 접선 방향으로 화살촉을 정렬한다.
  const tangentX = shaftEnd.x - control.x;
  const tangentY = shaftEnd.y - control.y;
  const tangentLength = Math.hypot(tangentX, tangentY) || 1;
  const tx = tangentX / tangentLength;
  const ty = tangentY / tangentLength;

  const tip: Point = {
    x: shaftEnd.x + tx * headLength,
    y: shaftEnd.y + ty * headLength,
  };
  const half = headWidth / 2;
  const left: Point = { x: shaftEnd.x - ty * half, y: shaftEnd.y + tx * half };
  const right: Point = { x: shaftEnd.x + ty * half, y: shaftEnd.y - tx * half };

  return {
    shaft: `M ${round(start.x)} ${round(start.y)} Q ${round(control.x)} ${round(
      control.y
    )} ${round(shaftEnd.x)} ${round(shaftEnd.y)}`,
    head: `${round(tip.x)},${round(tip.y)} ${round(left.x)},${round(
      left.y
    )} ${round(right.x)},${round(right.y)}`,
    midpoint: {
      x: 0.25 * start.x + 0.5 * control.x + 0.25 * shaftEnd.x,
      y: 0.25 * start.y + 0.5 * control.y + 0.25 * shaftEnd.y,
    },
  };
}

/**
 * 실제로 붙어 있는 장소(예: 카페 옆 숙소)는 마커가 완전히 겹쳐 순서를 읽을 수 없다.
 * 겹치는 마커만 최소 간격까지 밀어내 방문 순서가 보이게 한다.
 * 순서에 따라 결정적으로 계산하므로 렌더마다 위치가 흔들리지 않는다.
 */
export function spreadPoints(points: Point[], minDistance: number): Point[] {
  const placed: Point[] = [];

  points.forEach((point, index) => {
    let candidate = point;

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const collision = placed.find(
        (other) => Math.hypot(other.x - candidate.x, other.y - candidate.y) < minDistance
      );
      if (!collision) break;

      const dx = candidate.x - collision.x;
      const dy = candidate.y - collision.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 0.01) {
        // 좌표가 사실상 같으면 황금각으로 흩어 뭉치지 않게 한다.
        const angle = index * 2.39996;
        candidate = {
          x: collision.x + Math.cos(angle) * minDistance,
          y: collision.y + Math.sin(angle) * minDistance,
        };
      } else {
        const scale = minDistance / distance;
        candidate = { x: collision.x + dx * scale, y: collision.y + dy * scale };
      }
    }

    placed.push(candidate);
  });

  return placed;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
