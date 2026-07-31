import { GoogleGenAI, type Content } from "@google/genai";

import { extractInlineImage } from "@/lib/chat/tool-result-media";
import { ChatError } from "@/lib/llm/errors";
import type { ChatStreamEvent, ChatTurn } from "@/lib/llm/types";

/** 서버 전용 모듈. 클라이언트 컴포넌트에서 import 하지 마라. */

const DEFAULT_MODEL = "gemini-2.5-flash";

/**
 * 여행 일정 요청일 때만 붙이는 구조화 출력 계약.
 * 이 블록은 클라이언트에서 지도 카드(components/itinerary)로 렌더링된다.
 * 형식을 바꿀 때는 lib/itinerary/parse.ts의 검증도 함께 수정하라.
 */
const ITINERARY_CONTRACT = [
  "사용자가 여행 일정·코스·동선을 요청하면, 짧은 설명 뒤에 ```itinerary 코드블록을 정확히 하나 덧붙입니다.",
  "블록 안에는 주석 없는 JSON만 넣습니다.",
  "days와 stops는 모두 실제 방문 순서대로 정렬합니다. 지도에 이 순서대로 화살표가 그려집니다.",
  'category는 "sight"(관광지), "food"(식사), "cafe"(카페), "stay"(숙소), "shopping"(쇼핑), "activity"(체험) 중 하나만 씁니다.',
  "lat과 lng는 실제 위경도 숫자입니다. 좌표를 확신할 수 없는 장소는 일정에서 빼고, 잘 아는 장소로 대체합니다.",
  "하루는 관광지(sight) 3~4곳으로 채우고, 그 사이에 점심 식사를 time \"12:00\", 저녁 식사를 time \"18:00\"으로 넣습니다.",
  "식사는 앞뒤 관광지 사이에 끼워 실제로 이동하기 쉬운 위치로 고릅니다.",
  "각 장소에는 transport로 직전 장소에서 그곳까지의 교통편을 넣습니다. 그날 첫 장소는 출발 지점이라 넣지 않습니다.",
  "교통편은 가장 빠르고 환승이 적은 최적 경로를 기준으로 씁니다.",
  'transport.legs에는 타는 순서대로 구간을 넣습니다. 환승하면 구간이 2개 이상이 되고, 각 구간은 {"mode":수단,"line":노선} 형식입니다.',
  'mode는 "walk"(도보), "subway"(지하철), "tram"(트램), "bus"(버스), "train"(기차), "car"(자동차), "taxi"(택시), "bike"(자전거), "ferry"(배), "flight"(비행기) 중 하나만 씁니다.',
  '노선이 있는 수단이면 line에 몇 번을 타는지 반드시 적습니다. 예: 버스 "1011번", 트램 "T1", 지하철 "2호선", 기차 "KTX 101". 환승하는 버스도 각각 자기 구간에 적습니다.',
  "노선 번호가 확실하지 않으면 지어내지 말고 line을 생략합니다. 도보·택시·자동차처럼 노선이 없는 수단도 line을 생략합니다.",
  'transport.duration은 환승 대기까지 포함한 전체 소요를 "45분"처럼 씁니다. transport.fare에는 전체 요금을 "1,650원"처럼 씁니다. 도보·자전거는 fare를 생략합니다.',
  'transport.detail에는 "서면역에서 환승"처럼 환승 지점이나 승하차 정류장을 20자 이내로 씁니다.',
  'sight·food·cafe 장소에는 description에 2~3문장 소개를 넣습니다. 관광지는 볼거리·분위기, 식사·카페는 대표 메뉴·특징을 씁니다.',
  'note는 "점심", "포토스팟"처럼 짧은 태그만 쓰고, 긴 설명은 description에 넣습니다.',
  'category가 "sight"인 장소에는 picks로 그 지역 근처 맛집·카페를 2~3곳 추천합니다.',
  'category가 "food"나 "cafe"인 장소에는 picks로 같은 시간대 대안 가게를 2~3곳 넣습니다. 지도에 찍은 장소와 겹치지 않게 합니다.',
  'picks 항목 형식: {"name":"가게","kind":"food"|"cafe","note":"대표 메뉴","description":"한두 문장 설명","price":"1만원대","lat":위도,"lng":경도}.',
  "note는 20자 이내, description은 120자 이내로 씁니다. 좌표를 넣으면 지도에 함께 표시됩니다.",
  "실제로 아는 가게만 picks에 넣고, 확신이 없으면 picks를 생략합니다.",
  "블록을 붙일 때 본문에는 같은 일정을 길게 반복하지 말고 한두 문장 요약만 씁니다.",
  "예시:",
  "```itinerary",
  '{"title":"부산 1박 2일","days":[{"label":"1일차","stops":[' +
    '{"name":"해운대 해수욕장","category":"sight","lat":35.1587,"lng":129.1604,"time":"10:00",' +
    '"description":"부산 대표 해변으로 산책과 사진 찍기 좋습니다. 아침에는 한산한 편입니다.",' +
    '"picks":[{"name":"할매국밥","kind":"food","note":"돼지국밥","price":"1만원대",' +
    '"description":"해운대 시장 근처 로컬 국밥집. 든든한 한 끼로 인기입니다.",' +
    '"lat":35.1633,"lng":129.1628},' +
    '{"name":"카페드펄","kind":"cafe","note":"오션뷰 카페",' +
    '"description":"해변 쪽 창가 자리가 있어 쉬는 코스로 좋습니다.","lat":35.1591,"lng":129.1609}]},' +
    '{"name":"해운대 시장","category":"food","lat":35.1631,"lng":129.1636,"time":"12:00","note":"점심",' +
    '"description":"시장 골목에서 국밥·분식을 고르기 좋은 점심 스폿입니다.",' +
    '"transport":{"legs":[{"mode":"walk"}],"duration":"10분"},' +
    '"picks":[{"name":"해운대 암소갈비집","kind":"food","note":"한우 갈비","lat":35.1638,"lng":129.1618}]},' +
    '{"name":"감천문화마을","category":"sight","lat":35.0975,"lng":129.0106,"time":"14:30",' +
    '"description":"알록달록한 골목과 벽화가 이어지는 마을입니다. 경사로가 많아 편한 신발을 권합니다.",' +
    '"transport":{"legs":[{"mode":"subway","line":"2호선"},{"mode":"bus","line":"1-1번"}],' +
    '"duration":"1시간 10분","fare":"1,850원","detail":"토성역에서 환승"},' +
    '"picks":[{"name":"감자바우","kind":"food","note":"감자채전",' +
    '"description":"마을 입구 근처에서 간단히 먹기 좋습니다."}]}' +
    "]}]}",
  "```",
  "여행 일정과 무관한 대화에서는 이 블록을 쓰지 않습니다.",
].join("\n");

export const SYSTEM_INSTRUCTION = [
  "당신은 한국어로 답하는 AI 메모 앱의 어시스턴트입니다.",
  "짧고 명확한 문장으로 답하고, 결론을 먼저 제시한 뒤 필요한 근거를 덧붙입니다.",
  "확실하지 않은 내용은 추측하지 말고 모른다고 말합니다.",
  "연결된 MCP 도구가 있으면 필요할 때 도구를 호출하고, 도구 결과를 근거로 답합니다.",
  "도구가 실패하면 사용자에게 짧게 설명하고, 가능하면 다른 도구로 재시도합니다.",
  "",
  ITINERARY_CONTRACT,
].join("\n");

interface StreamChatOptions {
  messages: ChatTurn[];
  signal: AbortSignal;
}

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (client) return client;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ChatError(
      "AUTH_ERROR",
      "GEMINI_API_KEY가 설정되지 않았습니다. .env.local을 확인하세요."
    );
  }

  client = new GoogleGenAI({ apiKey });
  return client;
}

export function getGeminiModel(): string {
  return process.env.GEMINI_LLM_MODEL || DEFAULT_MODEL;
}

export function toGeminiContents(messages: ChatTurn[]): Content[] {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

/**
 * Gemini 응답을 스트리밍한다.
 * 텍스트는 delta로 바로 보내고, 이미지는 스트림이 끝난 뒤 한 번씩만 보내
 * 중간 파싱 비용을 줄인다.
 */
export async function* streamGeminiChat({
  messages,
  signal,
}: StreamChatOptions): AsyncGenerator<ChatStreamEvent> {
  const ai = getGeminiClient();

  const stream = await ai.models.generateContentStream({
    model: getGeminiModel(),
    contents: toGeminiContents(messages),
    config: {
      abortSignal: signal,
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });

  const inlineParts: Array<{ inlineData?: { data?: string; mimeType?: string } }> =
    [];

  for await (const chunk of stream) {
    if (signal.aborted) return;

    const text = chunk.text;
    if (text) {
      yield { type: "delta", text };
    }

    const parts = chunk.candidates?.[0]?.content?.parts;
    if (!parts?.length) continue;
    for (const part of parts) {
      if (part.inlineData?.data) inlineParts.push(part);
    }
  }

  const seenImageKeys = new Set<string>();
  for (const part of inlineParts) {
    const image = extractInlineImage(part);
    if (!image) continue;
    const key = `${image.mimeType}:${image.data.length}:${image.data.slice(0, 48)}`;
    if (seenImageKeys.has(key)) continue;
    seenImageKeys.add(key);
    yield {
      type: "image",
      id: image.id,
      mimeType: image.mimeType,
      data: image.data,
      alt: image.alt,
    };
  }
}
