import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Tool } from '@google/generative-ai';
import { verifySession } from '@/lib/dal/authDal';

async function chooseWithGemini(
  projectType?: string | null,
  site?: string | null,
  projectName?: string | null,
  projectDescription?: string | null
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const prompt = [
    'You are an expert at finding representative images for projects. Your task is to find one high-quality image URL.',
    '',
    'Project details:',
    projectName ? `- Name: ${projectName}` : '',
    projectType ? `- Type: ${projectType}` : '',
    projectDescription ? `- Description: ${projectDescription}` : '',
    site ? `- Website: ${site}` : '',
    '',
    'Instructions:',
    '1. If a website is provided, first search that website for relevant images',
    '2. If no suitable image is found on the website, use Google Search to find an image that matches the project type and description',
    '3. Choose images that are high quality and clearly represent the project type',
    '4. For prefab homes, look for modern prefab houses, cabins, or modular homes',
    '',
    'IMPORTANT: Return ONLY a JSON object with the image URL:',
    '{"url": "https://example.com/image.jpg"}',
    'The urls should end in a know image type extention (jpg, png, webp, jpeg etc.) .',
    'The urls should be accessible from the internet.  - Check that you do not get an access denied error',
    'Do not include any other text or explanation.',
  ].filter(Boolean).join('\n');
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const genAI = new GoogleGenerativeAI(apiKey);
  const tools = [{ google_search: {} }] as unknown as Tool[];
  const model = genAI.getGenerativeModel({
    model: modelName,
    tools,
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2, topP: 0.8 },
  });

  try {
    const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
    const text = result.response.text();

    // Try to parse JSON first
    try {
      const data = JSON.parse(text) as { url?: unknown };
      if (typeof data.url === 'string') return data.url;
    } catch {
      // If JSON parsing fails, try to extract URL with regex
      const urlMatch = text.match(/https?:\/\/[^\s"'}]+/);
      if (urlMatch?.[0]) return urlMatch[0];
    }

    return null;
  } catch (error) {
    console.log('Gemini failed', error);
    return null;
  }
}

async function isImageReachable(chosen: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    let res = await fetch(chosen, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), 4000);
      res = await fetch(chosen, { method: 'GET', redirect: 'follow', signal: controller2.signal });
      clearTimeout(timer2);
    }

    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    // Verify authentication using DAL pattern
    await verifySession();
    
    const req = await request.json().catch(() => ({}));
    const url = typeof req?.url === 'string' ? req.url : '';
    const projectType = typeof req?.type === 'string' ? req.type : null;
    const projectName = typeof req?.name === 'string' ? req.name : null;
    const projectDescription = typeof req?.description === 'string' ? req.description : null;
    const fallback = '/sample_prefab.webp';
    if (!url) return NextResponse.json({ url: fallback });
    const chosen = await chooseWithGemini(projectType, url, projectName, projectDescription);
    console.log('chosen', chosen);
    if (typeof chosen === 'string') {
      const ok = await isImageReachable(chosen);
      if (ok) {
        return NextResponse.json({ url: chosen });
      }
    }
    return NextResponse.json({ url: fallback });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    // Handle auth errors
    if (message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized - Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json({ url: '/sample_prefab.webp' });
  }
}
