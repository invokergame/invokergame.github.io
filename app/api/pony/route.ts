import { NextResponse } from 'next/server';

type ChatMessage = { role: 'user' | 'model'; text: string };

export async function POST(request: Request) {
  try {
    const { history = [], message, systemPrompt } = await request.json();
    const apiKey = process.env.PONY_ALPHA_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Отсутствует PONY_ALPHA_API_KEY. Добавьте ключ в .env.local и перезапустите сервер.' },
        { status: 500 }
      );
    }

    const baseUrl = process.env.PONY_ALPHA_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.PONY_ALPHA_MODEL || 'pony-alpha';

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history as ChatMessage[]).map((m) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
      { role: 'user', content: message }
    ];

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        messages
      })
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data?.error?.message || 'Pony Alpha request failed', raw: data }, { status: res.status });
    }

    const text = data?.choices?.[0]?.message?.content?.trim() || '[SYSTEM: ПУСТОЙ ОТВЕТ]';
    return NextResponse.json({ text });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}
