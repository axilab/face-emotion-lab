import { NextRequest, NextResponse } from "next/server";
import { proxyFetch } from "@/lib/fetch";

const MODEL = "gemini-2.5-flash-image";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export async function POST(req: NextRequest) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  let body: { prompt?: string; aspectRatio?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const { prompt, aspectRatio = "1:1" } = body;
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Промпт не может быть пустым" }, { status: 400 });
  }

  try {
    const res = await proxyFetch(`${GEMINI_URL}?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt.trim() }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { aspectRatio },
        },
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      const code = res.status;
      const msg =
        errorData?.error?.message || errorData?.error || `HTTP ${code}`;

      if (code === 403) {
        return NextResponse.json(
          { error: `Контент заблокирован политикой безопасности: ${msg}` },
          { status: 403 }
        );
      }
      if (code === 429) {
        return NextResponse.json(
          { error: "Превышен лимит запросов. Подождите и попробуйте снова." },
          { status: 429 }
        );
      }
      if (code === 400) {
        return NextResponse.json(
          { error: `Некорректный запрос: ${msg}` },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: msg }, { status: code });
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts;
    const imagePart = parts?.find((p: { inlineData?: unknown }) => p.inlineData);
    if (!imagePart?.inlineData?.data) {
      return NextResponse.json(
        { error: "Gemini не вернул изображение. Попробуйте другой промпт." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      base64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || "image/png",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ошибка соединения с Gemini API";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
