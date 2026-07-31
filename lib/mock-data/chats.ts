import type { ChatSession } from "@/lib/types/chat";

/** 지도 카드 렌더링을 API 키 없이도 확인할 수 있게 목업에 실제 계약 형식을 넣어둔다. */
const busanItineraryBlock = `\`\`\`itinerary
{
  "title": "부산 1박 2일",
  "days": [
    {
      "label": "1일차",
      "stops": [
        { "name": "해운대 해수욕장", "category": "sight", "lat": 35.1587, "lng": 129.1604, "time": "10:00" },
        { "name": "해운대시장", "category": "food", "lat": 35.1631, "lng": 129.1636, "time": "12:00", "note": "점심", "transport": { "legs": [{ "mode": "walk" }], "duration": "10분" }, "picks": [{ "name": "할매국밥", "note": "돼지국밥", "lat": 35.1633, "lng": 129.1628 }, { "name": "상국이네", "note": "떡볶이", "lat": 35.1627, "lng": 129.1641 }] },
        { "name": "감천문화마을", "category": "sight", "lat": 35.0975, "lng": 129.0106, "time": "14:30", "transport": { "legs": [{ "mode": "subway", "line": "2호선" }, { "mode": "bus", "line": "1-1번" }], "duration": "1시간 10분", "fare": "1,850원", "detail": "토성역에서 환승" } },
        { "name": "송도해상케이블카", "category": "sight", "lat": 35.0757, "lng": 129.0175, "time": "16:30", "transport": { "legs": [{ "mode": "bus", "line": "6번" }, { "mode": "walk" }], "duration": "25분", "fare": "1,550원" } },
        { "name": "자갈치시장", "category": "food", "lat": 35.0966, "lng": 129.0306, "time": "18:00", "note": "저녁", "transport": { "legs": [{ "mode": "bus", "line": "26번" }], "duration": "20분", "fare": "1,550원" }, "picks": [{ "name": "부산어묵 본점", "note": "어묵 고로케", "lat": 35.0971, "lng": 129.031 }, { "name": "충무동 회센터", "note": "모둠회", "lat": 35.0955, "lng": 129.0288 }] },
        { "name": "광안리 게스트하우스", "category": "stay", "lat": 35.1531, "lng": 129.1187, "time": "21:00", "transport": { "legs": [{ "mode": "subway", "line": "1호선" }, { "mode": "subway", "line": "2호선" }], "duration": "45분", "fare": "1,700원", "detail": "서면역에서 환승" } }
      ]
    },
    {
      "label": "2일차",
      "stops": [
        { "name": "태종대", "category": "sight", "lat": 35.0517, "lng": 129.0876, "time": "09:30" },
        { "name": "남포동 돼지국밥", "category": "food", "lat": 35.0989, "lng": 129.0323, "time": "12:00", "note": "점심", "transport": { "legs": [{ "mode": "bus", "line": "8번" }], "duration": "35분", "fare": "1,550원", "detail": "태종대 정류장 승차" }, "picks": [{ "name": "쌍둥이돼지국밥", "note": "수육백반", "lat": 35.0994, "lng": 129.0281 }, { "name": "18번완당집", "note": "완당면", "lat": 35.0987, "lng": 129.0334 }] },
        { "name": "용두산공원", "category": "sight", "lat": 35.1006, "lng": 129.0324, "time": "14:00", "transport": { "legs": [{ "mode": "walk" }], "duration": "8분" } },
        { "name": "부산근현대역사관", "category": "sight", "lat": 35.1017, "lng": 129.0343, "time": "15:30", "transport": { "legs": [{ "mode": "walk" }], "duration": "12분" } },
        { "name": "국제시장 먹자골목", "category": "food", "lat": 35.1013, "lng": 129.0295, "time": "18:00", "note": "저녁", "transport": { "legs": [{ "mode": "walk" }], "duration": "6분" }, "picks": [{ "name": "이가네 씨앗호떡", "note": "씨앗호떡", "lat": 35.1016, "lng": 129.03 }, { "name": "국제시장 유부전골", "note": "유부전골", "lat": 35.101, "lng": 129.0292 }] },
        { "name": "부산역", "category": "shopping", "lat": 35.1151, "lng": 129.0415, "time": "20:00", "note": "기념품", "transport": { "legs": [{ "mode": "subway", "line": "1호선" }], "duration": "10분", "fare": "1,450원" } }
      ]
    }
  ]
}
\`\`\``;

export const mockChatSessions: ChatSession[] = [
  {
    id: "chat-1",
    title: "여행 일정 짜기",
    updatedAt: "2026-07-31T09:12:00.000Z",
    messages: [
      {
        id: "msg-1",
        role: "user",
        content: "다음 주말에 부산으로 1박 2일 여행을 가려고 하는데 일정 좀 짜줄 수 있어?",
        createdAt: "2026-07-31T09:10:00.000Z",
      },
      {
        id: "msg-2",
        role: "assistant",
        content: `좋아요! 해운대에서 시작해 서쪽으로 이동하는 동선으로 짰어요. 지도에서 순서를 확인해보세요.\n\n${busanItineraryBlock}\n\n특별히 가고 싶은 테마(맛집, 자연, 사진 명소)가 있으면 알려주세요.`,
        createdAt: "2026-07-31T09:12:00.000Z",
      },
    ],
  },
  {
    id: "chat-2",
    title: "React 19 새 기능 정리",
    updatedAt: "2026-07-30T14:40:00.000Z",
    messages: [
      {
        id: "msg-3",
        role: "user",
        content: "React 19에서 추가된 주요 기능들 요약해줘.",
        createdAt: "2026-07-30T14:38:00.000Z",
      },
      {
        id: "msg-4",
        role: "assistant",
        content:
          "React 19의 주요 변화는 다음과 같아요.\n\n1. Actions와 `useActionState`\n2. `use()` 훅으로 Promise/Context 처리\n3. `useOptimistic`을 통한 낙관적 업데이트\n4. 서버 컴포넌트 안정화\n5. ref를 prop처럼 전달 가능\n\n더 자세히 알고 싶은 항목이 있나요?",
        createdAt: "2026-07-30T14:40:00.000Z",
      },
    ],
  },
  {
    id: "chat-3",
    title: "이메일 초안 작성",
    updatedAt: "2026-07-29T18:05:00.000Z",
    messages: [
      {
        id: "msg-5",
        role: "user",
        content: "팀 회의 일정을 다음 주 화요일로 변경하자는 이메일 초안 써줘.",
        createdAt: "2026-07-29T18:04:00.000Z",
      },
      {
        id: "msg-6",
        role: "assistant",
        content:
          "안녕하세요,\n\n다음 주 정기 회의 일정을 화요일 오후 2시로 변경하고자 합니다. 참석 가능 여부를 회신해 주시면 감사하겠습니다.\n\n감사합니다.",
        createdAt: "2026-07-29T18:05:00.000Z",
      },
    ],
  },
  {
    id: "chat-4",
    title: "운동 루틴 추천",
    updatedAt: "2026-07-28T08:20:00.000Z",
    messages: [
      {
        id: "msg-7",
        role: "user",
        content: "주 3회, 홈트레이닝으로 할 수 있는 루틴 추천해줘.",
        createdAt: "2026-07-28T08:18:00.000Z",
      },
      {
        id: "msg-8",
        role: "assistant",
        content:
          "주 3회 홈트 루틴을 추천해요.\n\n- 월: 상체(푸시업, 딥스, 플랭크)\n- 수: 하체(스쿼트, 런지, 카프레이즈)\n- 금: 전신 서킷(버피, 마운틴클라이머, 점핑잭)\n\n각 세트 3~4회, 세트당 12~15회를 기준으로 시작해보세요.",
        createdAt: "2026-07-28T08:20:00.000Z",
      },
    ],
  },
];
