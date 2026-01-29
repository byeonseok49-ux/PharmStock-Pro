
import { GoogleGenAI, Type } from "@google/genai";
import { Patient } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function getPharmacistInsight(urgentPatients: Patient[]) {
  const patientSummary = urgentPatients.map(p => `${p.name}(${p.keyMedication})`).join(', ');
  const prompt = `현재 복약 종료가 3일 이내로 다가온 환자들이 있습니다: ${patientSummary}. 이 환자들이 복약 중단 없이 지속적으로 관리될 수 있도록 약국장에게 짧고 명확한 조언을 3줄 이내로 한국어로 하세요.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "재고 확인 및 환자 상담이 필요합니다.";
  }
}

export async function getSafetyStockRecommendation(
  medicationStats: Record<string, { totalPatients: number, totalDosesPerDay: number }>,
  totalActiveCount: number
) {
  const statsString = Object.entries(medicationStats)
    .map(([name, stat]) => `- ${name}: 활성 ${stat.totalPatients}명, 일 소모 ${stat.totalDosesPerDay}정`)
    .join('\n');

  const prompt = `
당신은 약국 재고관리 전문가입니다. 아래 데이터를 분석하여 '약국장용 핵심 요약 리포트'를 작성하세요.
인사말, 서론, '산출 근거', 그리고 '권장 재고량(안전재고 정수)'은 모두 배제하세요. 오직 약물별 환자 현황과 상태 조언만 출력하세요.

[분석 데이터]
전체 활성 환자: ${totalActiveCount}명
${statsString}

[분석 기준]
1. 집중 관리: 씬지로이드, 당뇨약
2. 비중 관리: 처방 환자 수가 많은 약물

[출력 형식 - 가독성을 위해 반드시 엄수]
약물명과 환자수를 헤더로 하여 가장 눈에 띄게 표시하세요.

■ [약물명] ┃ 활성 환자: ○명
----------------------------------
• 현재 상태: [적정 / 부족 / 주의 중 선택]
• 전문가 조언: (재고 주문 시기 및 환자 관리 전략 한 줄 요약)

(다음 항목과의 간격 확보)
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Safety Stock Error:", error);
    return "데이터 분석 중 오류가 발생했습니다. 명단을 확인해 주세요.";
  }
}

export async function parsePatientImage(base64Image: string, mimeType: string) {
  const prompt = `
이 이미지에서 환자 정보를 추출해서 정확히 아래 예시 형식으로만 리스트를 만들어줘.
예시: 이름(성별, 나이) | 연락처: 010-0000-0000 | 복용시간: 8:00, 13:00, 19:00 | 핵심약물: 약이름 (질환명) | 종료일: YYYY-MM-DD
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          inlineData: {
            data: base64Image,
            mimeType: mimeType
          }
        },
        { text: prompt }
      ]
    });
    return response.text;
  } catch (error) {
    console.error("Gemini OCR Error:", error);
    return null;
  }
}
