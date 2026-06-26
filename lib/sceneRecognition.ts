export type Scene = '海边' | '街道' | '公园' | '咖啡厅' | '山景' | '室内';

export const SCENES: Scene[] = ['海边', '街道', '公园', '咖啡厅', '山景', '室内'];

interface QwenResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

/**
 * Analyze a video frame to detect the scene
 */
export async function analyzeScene(
  imageData: string,
  apiKey: string,
  model: string,
  baseUrl: string
): Promise<Scene | null> {
  const prompt = `分析这张图片的场景，从以下选项中选择最匹配的一个：[海边、街道、公园、咖啡厅、山景、室内]。

请直接回答场景名称，不要其他内容。例如：海边`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: imageData,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
        max_tokens: 50,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Qwen API error:', response.status, errorText);
      return null;
    }

    const data: QwenResponse = await response.json();

    if (data.error) {
      console.error('Qwen API error:', data.error.message);
      return null;
    }

    const content = data.choices?.[0]?.message?.content?.trim() || '';

    // Match against known scenes
    for (const scene of SCENES) {
      if (content.includes(scene)) {
        return scene;
      }
    }

    // Try to parse the response more flexibly
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('beach') || lowerContent.includes('海边')) return '海边';
    if (lowerContent.includes('street') || lowerContent.includes('街道')) return '街道';
    if (lowerContent.includes('park') || lowerContent.includes('公园')) return '公园';
    if (lowerContent.includes('cafe') || lowerContent.includes('咖啡')) return '咖啡厅';
    if (lowerContent.includes('mountain') || lowerContent.includes('山')) return '山景';
    if (lowerContent.includes('indoor') || lowerContent.includes('室内') || lowerContent.includes('房间')) return '室内';

    console.warn('Could not parse scene from response:', content);
    return null;
  } catch (error) {
    console.error('Scene analysis error:', error);
    return null;
  }
}

/**
 * Capture a frame from video element as base64
 */
export function captureFrame(video: HTMLVideoElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Mirror the image (same as video display)
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);

  ctx.drawImage(video, 0, 0);

  // Return as JPEG data URL (lower quality for smaller payload)
  return canvas.toDataURL('image/jpeg', 0.6);
}
