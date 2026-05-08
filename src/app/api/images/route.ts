import crypto from 'crypto';
import fs from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import path from 'path';

// Streaming event types
type StreamingEvent = {
    type: 'partial_image' | 'completed' | 'error' | 'done';
    error_code?: 'stream_interrupted';
    index?: number;
    partial_image_index?: number;
    b64_json?: string;
    filename?: string;
    path?: string;
    output_format?: string;
    usage?: OpenAI.Images.ImagesResponse['usage'];
    revised_prompt?: string;
    images?: Array<{
        filename: string;
        b64_json?: string;
        path?: string;
        output_format: string;
        revised_prompt?: string;
    }>;
    error?: string;
};

type StreamingImageResult = NonNullable<StreamingEvent['images']>[number];
type ImageStorageMode = 'fs' | 'indexeddb';

const outputDir = path.resolve(process.cwd(), 'generated-images');
const DEFAULT_IMAGE_REQUEST_TIMEOUT_MS = 20 * 60 * 1000;

function enqueueStreamingEvent(
    controller: ReadableStreamDefaultController<Uint8Array>,
    encoder: TextEncoder,
    event: StreamingEvent
): boolean {
    try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        return true;
    } catch (error) {
        console.warn('Unable to enqueue streaming event:', error);
        return false;
    }
}

function closeStreamingController(controller: ReadableStreamDefaultController<Uint8Array>) {
    try {
        controller.close();
    } catch (error) {
        console.warn('Unable to close streaming response:', error);
    }
}

function getErrorDetailText(error: unknown): string {
    const details: string[] = [];
    const seen = new Set<object>();
    const add = (value: unknown) => {
        if (value === undefined || value === null) return;
        const text = String(value).trim();
        if (text) details.push(text);
    };
    const visit = (value: unknown) => {
        if (value === undefined || value === null) return;
        if (typeof value !== 'object') {
            add(value);
            return;
        }
        if (seen.has(value)) return;
        seen.add(value);

        const record = value as Record<string, unknown>;
        if (value instanceof Error) {
            add(value.name);
            add(value.message);
        }

        for (const key of ['code', 'type', 'name', 'message', 'status', 'status_code', 'statusCode']) {
            add(record[key]);
        }

        if ('cause' in record) {
            visit(record.cause);
        }
        if ('error' in record) {
            visit(record.error);
        }
        if ('response' in record) {
            visit(record.response);
        }
    };

    visit(error);
    return [...new Set(details)].join(' ');
}

function getErrorStatusCode(error: unknown): number | undefined {
    const seen = new Set<object>();
    const visit = (value: unknown): number | undefined => {
        if (!value || typeof value !== 'object') return undefined;
        if (seen.has(value)) return undefined;
        seen.add(value);

        const record = value as Record<string, unknown>;
        for (const key of ['status', 'status_code', 'statusCode']) {
            const status = record[key];
            if (typeof status === 'number' && Number.isFinite(status)) {
                return status;
            }
            if (typeof status === 'string') {
                const parsedStatus = Number.parseInt(status, 10);
                if (Number.isFinite(parsedStatus)) {
                    return parsedStatus;
                }
            }
        }

        return visit(record.cause) ?? visit(record.error) ?? visit(record.response);
    };

    return visit(error);
}

function isInterruptedStreamingError(error: unknown): boolean {
    const errorText = getErrorDetailText(error).toLowerCase();
    const interruptedSignals = [
        'terminated',
        'und_err_socket',
        'other side closed',
        'stream disconnected before completion',
        'socket hang up',
        'econnreset',
        'connection reset',
        'aborted',
        'failed to fetch',
        'fetch failed',
        'failed fetch',
        'body timeout'
    ];

    return interruptedSignals.some((signal) => errorText.includes(signal));
}

function isUpstreamConnectivityError(error: unknown): boolean {
    const statusCode = getErrorStatusCode(error);
    const errorText = getErrorDetailText(error).toLowerCase();

    return (
        statusCode === 502 ||
        isInterruptedStreamingError(error) ||
        errorText.includes('bad gateway') ||
        errorText.includes('status_code=502') ||
        errorText.includes('status_code: 502') ||
        errorText.includes('status code 502') ||
        /(^|[^0-9])502([^0-9]|$)/.test(errorText)
    );
}

function getUpstreamConnectivityErrorMessage(responseLanguage: FormDataEntryValue | null): string {
    return responseLanguage === 'en'
        ? 'The upstream image service is temporarily unavailable or the connection was interrupted. Please retry later.'
        : '上游图片服务暂时不可用，或连接中途断开了。请稍后重试。';
}

function getStreamingErrorMessage(error: unknown, responseLanguage: FormDataEntryValue | null): string {
    const isEnglish = responseLanguage === 'en';

    if (isUpstreamConnectivityError(error)) {
        return isEnglish
            ? 'The upstream streaming connection was interrupted before a final image was returned. Please retry, or turn off streaming preview.'
            : '上游流式连接在返回最终图片前中断了。请重试，或关闭流式预览后再生成。';
    }

    const message = error instanceof Error && error.message ? error.message : getErrorDetailText(error);

    return message || (isEnglish ? 'Streaming error occurred' : '流式生成出错');
}

function getImageApiErrorMessage(error: unknown, responseLanguage: FormDataEntryValue | null): string {
    if (isUpstreamConnectivityError(error)) {
        return getUpstreamConnectivityErrorMessage(responseLanguage);
    }

    const isEnglish = responseLanguage === 'en';
    const message = error instanceof Error && error.message ? error.message : getErrorDetailText(error);

    return message || (isEnglish ? 'An unexpected error occurred.' : '发生未知错误。');
}

async function emitLastPartialImageAsCompleted({
    controller,
    encoder,
    completedImages,
    lastPartialB64Json,
    timestamp,
    fileExtension,
    shouldInlineImageData,
    effectiveStorageMode,
    logPrefix
}: {
    controller: ReadableStreamDefaultController<Uint8Array>;
    encoder: TextEncoder;
    completedImages: StreamingImageResult[];
    lastPartialB64Json: string | undefined;
    timestamp: number;
    fileExtension: string;
    shouldInlineImageData: boolean;
    effectiveStorageMode: ImageStorageMode;
    logPrefix: string;
}): Promise<boolean> {
    if (completedImages.length > 0 || !lastPartialB64Json) {
        return false;
    }

    const filename = `${timestamp}-0.${fileExtension}`;
    if (effectiveStorageMode === 'fs') {
        const buffer = Buffer.from(lastPartialB64Json, 'base64');
        const filepath = path.join(outputDir, filename);
        await fs.writeFile(filepath, buffer);
    }

    const savedPath = effectiveStorageMode === 'fs' ? `/api/image/${filename}` : undefined;
    completedImages.push({
        filename,
        output_format: fileExtension,
        ...(shouldInlineImageData ? { b64_json: lastPartialB64Json } : {}),
        ...(savedPath ? { path: savedPath } : {})
    });
    console.warn(`${logPrefix}: No completed event received; using the last partial image.`);

    const fallbackEvent: StreamingEvent = {
        type: 'completed',
        index: 0,
        filename,
        b64_json: shouldInlineImageData ? lastPartialB64Json : undefined,
        path: savedPath,
        output_format: fileExtension
    };
    enqueueStreamingEvent(controller, encoder, fallbackEvent);

    return true;
}

function enqueueStreamingDone(
    controller: ReadableStreamDefaultController<Uint8Array>,
    encoder: TextEncoder,
    completedImages: StreamingImageResult[],
    finalUsage: OpenAI.Images.ImagesResponse['usage'] | undefined
) {
    const doneEvent: StreamingEvent = {
        type: 'done',
        images: completedImages,
        revised_prompt: completedImages.find((image) => image.revised_prompt)?.revised_prompt,
        usage: finalUsage
    };
    enqueueStreamingEvent(controller, encoder, doneEvent);
}

function getImageRequestTimeoutMs() {
    const configuredTimeout = Number.parseInt(process.env.OPENAI_IMAGE_TIMEOUT_MS || '', 10);

    if (Number.isFinite(configuredTimeout) && configuredTimeout > 0) {
        return configuredTimeout;
    }

    return DEFAULT_IMAGE_REQUEST_TIMEOUT_MS;
}

function getPreferredAcceptLanguage(responseLanguage: FormDataEntryValue | null, request: NextRequest): string {
    if (responseLanguage === 'zh') {
        return 'zh-CN,zh;q=0.9,en;q=0.8';
    }

    if (responseLanguage === 'en') {
        return 'en-US,en;q=0.9,zh-CN;q=0.6';
    }

    return request.headers.get('accept-language') || 'zh-CN,zh;q=0.9,en;q=0.8';
}

function withAspectInstruction(
    prompt: string,
    size: string | null | undefined,
    responseLanguage: FormDataEntryValue | null
) {
    if (!size || !size.includes('x')) {
        return prompt;
    }

    const [width, height] = size.split('x').map((value) => Number.parseInt(value, 10));

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return prompt;
    }

    const isChinese = responseLanguage === 'zh';
    const ratioText =
        width === height
            ? '1:1'
            : width > height
              ? `${Math.round(width / gcd(width, height))}:${Math.round(height / gcd(width, height))}`
              : `${Math.round(width / gcd(width, height))}:${Math.round(height / gcd(width, height))}`;

    if (width > height) {
        const instruction = isChinese
            ? `重要构图要求：必须严格使用 ${size} 的横向宽屏画布（${ratioText}），完整利用整个横向画面；不要改写成手机壁纸、竖屏壁纸、竖版海报或只在中间放一个竖向主体。`
            : `Important composition requirement: strictly use a ${size} landscape widescreen canvas (${ratioText}); use the full horizontal frame; do not reinterpret it as a phone wallpaper, vertical wallpaper, vertical poster, or a narrow centered subject.`;

        return `${prompt}\n\n${instruction}`;
    }

    if (height > width) {
        const instruction = isChinese
            ? `重要构图要求：必须严格使用 ${size} 的竖向画布（${ratioText}），按竖图构图，不要改写成横向宽屏画面。`
            : `Important composition requirement: strictly use a ${size} portrait canvas (${ratioText}); compose vertically and do not reinterpret it as a landscape widescreen image.`;

        return `${prompt}\n\n${instruction}`;
    }

    const instruction = isChinese
        ? `重要构图要求：必须严格使用 ${size} 的方形画布（1:1），不要改写成横向或竖向壁纸。`
        : `Important composition requirement: strictly use a ${size} square canvas (1:1); do not reinterpret it as a landscape or portrait wallpaper.`;

    return `${prompt}\n\n${instruction}`;
}

function gcd(left: number, right: number): number {
    let a = Math.abs(left);
    let b = Math.abs(right);

    while (b) {
        const remainder = a % b;
        a = b;
        b = remainder;
    }

    return a || 1;
}

// Define valid output formats for type safety
const VALID_OUTPUT_FORMATS = ['png', 'jpeg', 'webp'] as const;
type ValidOutputFormat = (typeof VALID_OUTPUT_FORMATS)[number];

// Validate and normalize output format
function validateOutputFormat(format: unknown): ValidOutputFormat {
    const normalized = String(format || 'png').toLowerCase();

    // Handle jpg -> jpeg normalization
    const mapped = normalized === 'jpg' ? 'jpeg' : normalized;

    if (VALID_OUTPUT_FORMATS.includes(mapped as ValidOutputFormat)) {
        return mapped as ValidOutputFormat;
    }

    return 'png'; // default fallback
}

function getRevisedPrompt(source: unknown): string | undefined {
    if (!source || typeof source !== 'object' || !('revised_prompt' in source)) {
        return undefined;
    }

    const revisedPrompt = source.revised_prompt;

    return typeof revisedPrompt === 'string' && revisedPrompt.trim() ? revisedPrompt : undefined;
}

function mergeNumericUsageValue(left: unknown, right: unknown): unknown {
    if (typeof left === 'number' && typeof right === 'number') {
        return left + right;
    }

    if (left && right && typeof left === 'object' && typeof right === 'object') {
        const merged: Record<string, unknown> = { ...(left as Record<string, unknown>) };

        for (const [key, value] of Object.entries(right as Record<string, unknown>)) {
            merged[key] = mergeNumericUsageValue(merged[key], value);
        }

        return merged;
    }

    return right ?? left;
}

function mergeImageUsage(
    base: OpenAI.Images.ImagesResponse['usage'] | undefined,
    addition: OpenAI.Images.ImagesResponse['usage'] | undefined
): OpenAI.Images.ImagesResponse['usage'] | undefined {
    return mergeNumericUsageValue(base, addition) as OpenAI.Images.ImagesResponse['usage'] | undefined;
}

type ImageStreamEventLike = {
    type?: unknown;
    b64_json?: unknown;
    partial_image_index?: unknown;
    usage?: unknown;
    revised_prompt?: unknown;
};

function getStreamEventType(event: unknown): string {
    if (!event || typeof event !== 'object' || !('type' in event)) {
        return '';
    }

    return typeof event.type === 'string' ? event.type : '';
}

function getStreamEventKeys(event: unknown): string[] {
    return event && typeof event === 'object' ? Object.keys(event) : [];
}

function getStreamEventB64Json(event: unknown): string | undefined {
    if (!event || typeof event !== 'object' || !('b64_json' in event)) {
        return undefined;
    }

    const b64Json = (event as ImageStreamEventLike).b64_json;

    return typeof b64Json === 'string' && b64Json ? b64Json : undefined;
}

function getStreamEventPartialImageIndex(event: unknown): number | undefined {
    if (!event || typeof event !== 'object' || !('partial_image_index' in event)) {
        return undefined;
    }

    const partialImageIndex = (event as ImageStreamEventLike).partial_image_index;

    return typeof partialImageIndex === 'number' ? partialImageIndex : undefined;
}

function isPartialImageStreamEvent(event: unknown): boolean {
    const eventType = getStreamEventType(event);

    return eventType.includes('partial_image') || getStreamEventPartialImageIndex(event) !== undefined;
}

function isCompletedImageStreamEvent(event: unknown): boolean {
    const eventType = getStreamEventType(event);

    return eventType.includes('completed') || Boolean(getStreamEventB64Json(event) && !isPartialImageStreamEvent(event));
}

async function fillMissingImages(
    result: OpenAI.Images.ImagesResponse,
    requestedCount: number,
    requestSingleImage: (() => Promise<OpenAI.Images.ImagesResponse>) | null
): Promise<OpenAI.Images.ImagesResponse> {
    const initialData = result.data ?? [];

    if (!requestSingleImage || requestedCount <= 1 || initialData.length >= requestedCount) {
        return result;
    }

    const nextData = [...initialData];
    let nextUsage = result.usage;

    while (nextData.length < requestedCount) {
        console.warn(`Image API returned ${nextData.length}/${requestedCount}; requesting one supplemental image.`);

        const supplementalResult = await requestSingleImage();
        const supplementalImages = supplementalResult.data ?? [];

        if (supplementalImages.length === 0) {
            break;
        }

        nextData.push(...supplementalImages);
        nextUsage = mergeImageUsage(nextUsage, supplementalResult.usage);
    }

    return {
        ...result,
        data: nextData.slice(0, requestedCount),
        usage: nextUsage
    };
}

async function ensureOutputDirExists() {
    try {
        await fs.access(outputDir);
    } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
            try {
                await fs.mkdir(outputDir, { recursive: true });
                console.log(`Created output directory: ${outputDir}`);
            } catch (mkdirError) {
                console.error(`Error creating output directory ${outputDir}:`, mkdirError);
                throw new Error('Failed to create image output directory.');
            }
        } else {
            console.error(`Error accessing output directory ${outputDir}:`, error);
            throw new Error(
                `Failed to access or ensure image output directory exists. Original error: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}

function sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

export async function POST(request: NextRequest) {
    console.log('Received POST request to /api/images');
    let responseLanguageForError: FormDataEntryValue | null = null;

    try {
        let effectiveStorageMode: ImageStorageMode;
        const explicitMode = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;
        const isOnVercel = process.env.VERCEL === '1';

        if (explicitMode === 'fs') {
            effectiveStorageMode = 'fs';
        } else if (explicitMode === 'indexeddb') {
            effectiveStorageMode = 'indexeddb';
        } else if (isOnVercel) {
            effectiveStorageMode = 'indexeddb';
        } else {
            effectiveStorageMode = 'fs';
        }
        console.log(
            `Effective Image Storage Mode: ${effectiveStorageMode} (Explicit: ${explicitMode || 'unset'}, Vercel: ${isOnVercel})`
        );

        if (effectiveStorageMode === 'fs') {
            await ensureOutputDirExists();
        }

        const formData = await request.formData();

        if (process.env.APP_PASSWORD) {
            const clientPasswordHash = formData.get('passwordHash') as string | null;
            if (!clientPasswordHash) {
                console.error('Missing password hash.');
                return NextResponse.json({ error: 'Unauthorized: Missing password hash.' }, { status: 401 });
            }
            const serverPasswordHash = sha256(process.env.APP_PASSWORD);
            if (clientPasswordHash !== serverPasswordHash) {
                console.error('Invalid password hash.');
                return NextResponse.json({ error: 'Unauthorized: Invalid password.' }, { status: 401 });
            }
        }

        const localApiKey = (formData.get('apiKey') as string | null)?.trim();
        const localBaseUrl = (formData.get('baseUrl') as string | null)?.trim();
        const responseLanguage = formData.get('responseLanguage');
        responseLanguageForError = responseLanguage;
        const acceptLanguage = getPreferredAcceptLanguage(responseLanguage, request);
        const apiKey = localApiKey || process.env.OPENAI_API_KEY;
        const baseURL = localBaseUrl || process.env.OPENAI_API_BASE_URL?.trim();

        if (!apiKey) {
            console.error('No API key was provided by local settings or OPENAI_API_KEY.');
            return NextResponse.json(
                { error: 'API key not found. Add one in Settings or configure OPENAI_API_KEY.' },
                { status: 500 }
            );
        }

        const imageRequestTimeoutMs = getImageRequestTimeoutMs();
        const openai = new OpenAI({
            apiKey,
            baseURL: baseURL || undefined,
            timeout: imageRequestTimeoutMs,
            defaultHeaders: {
                'Accept-Language': acceptLanguage
            }
        });
        console.log(`OpenAI image request timeout: ${imageRequestTimeoutMs}ms`);
        console.log(`OpenAI image request language: ${acceptLanguage}`);

        const mode = formData.get('mode') as 'generate' | 'edit' | null;
        const prompt = formData.get('prompt') as string | null;
        const model = ((formData.get('model') as string | null)?.trim() || 'gpt-image-2') as
            | OpenAI.Images.ImageGenerateParams['model']
            | OpenAI.Images.ImageEditParams['model'];

        console.log(`Mode: ${mode}, Model: ${model}, Prompt: ${prompt ? prompt.substring(0, 50) + '...' : 'N/A'}`);

        if (!mode || !prompt) {
            return NextResponse.json({ error: 'Missing required parameters: mode and prompt' }, { status: 400 });
        }

        // Check for streaming mode
        const streamEnabled = formData.get('stream') === 'true';
        const partialImagesCount = parseInt((formData.get('partial_images') as string) || '2', 10);

        let result: OpenAI.Images.ImagesResponse;
        let requestedImageCount = 1;
        let requestSingleImage: (() => Promise<OpenAI.Images.ImagesResponse>) | null = null;

        if (mode === 'generate') {
            const n = parseInt((formData.get('n') as string) || '1', 10);
            requestedImageCount = Math.max(1, Math.min(n || 1, 10));
            // gpt-image-2 accepts arbitrary WxH strings that the SDK's narrow literal union doesn't express.
            const size = ((formData.get('size') as string) || '1024x1024') as OpenAI.Images.ImageGenerateParams['size'];
            const quality = (formData.get('quality') as OpenAI.Images.ImageGenerateParams['quality']) || 'auto';
            const output_format =
                (formData.get('output_format') as OpenAI.Images.ImageGenerateParams['output_format']) || 'png';
            const output_compression_str = formData.get('output_compression') as string | null;
            const background =
                (formData.get('background') as OpenAI.Images.ImageGenerateParams['background']) || 'auto';
            const moderation =
                (formData.get('moderation') as OpenAI.Images.ImageGenerateParams['moderation']) || 'auto';
            const promptWithAspectInstruction = withAspectInstruction(prompt, size, responseLanguage);

            const baseParams = {
                model,
                prompt: promptWithAspectInstruction,
                n: requestedImageCount,
                size,
                quality,
                output_format,
                background,
                moderation
            };

            if ((output_format === 'jpeg' || output_format === 'webp') && output_compression_str) {
                const compression = parseInt(output_compression_str, 10);
                if (!isNaN(compression) && compression >= 0 && compression <= 100) {
                    (baseParams as OpenAI.Images.ImageGenerateParams).output_compression = compression;
                }
            }

            // Handle streaming mode for generation
            if (streamEnabled) {
                const actualPartialImages = Math.max(1, Math.min(partialImagesCount, 3)) as 1 | 2 | 3;

                const streamParams = {
                    ...baseParams,
                    stream: true as const,
                    partial_images: actualPartialImages
                };

                console.log('Calling OpenAI generate with streaming, params:', streamParams);
                const stream = await openai.images.generate(streamParams);

                // Create SSE response
                const encoder = new TextEncoder();
                const timestamp = Date.now();
                const fileExtension = validateOutputFormat(output_format);
                const shouldInlineImageData = effectiveStorageMode !== 'fs';

                const readableStream = new ReadableStream<Uint8Array>({
                    async start(controller) {
                        const completedImages: StreamingImageResult[] = [];
                        let finalUsage: OpenAI.Images.ImagesResponse['usage'] | undefined;
                        let imageIndex = 0;
                        let lastPartialB64Json: string | undefined;

                        try {
                            for await (const event of stream) {
                                const eventType = getStreamEventType(event);
                                const b64Json = getStreamEventB64Json(event);
                                const partialImageIndex = getStreamEventPartialImageIndex(event);

                                if (isPartialImageStreamEvent(event)) {
                                    if (b64Json) {
                                        lastPartialB64Json = b64Json;
                                    }
                                    const partialEvent: StreamingEvent = {
                                        type: 'partial_image',
                                        index: imageIndex,
                                        partial_image_index: partialImageIndex,
                                        b64_json: b64Json
                                    };
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(partialEvent)}\n\n`));
                                } else if (isCompletedImageStreamEvent(event)) {
                                    const currentIndex = imageIndex;
                                    const filename = `${timestamp}-${currentIndex}.${fileExtension}`;
                                    const revisedPrompt = getRevisedPrompt(event);

                                    // Save to filesystem if in fs mode
                                    if (effectiveStorageMode === 'fs' && b64Json) {
                                        const buffer = Buffer.from(b64Json, 'base64');
                                        const filepath = path.join(outputDir, filename);
                                        await fs.writeFile(filepath, buffer);
                                        console.log(`Streaming: Saved image ${filename}`);
                                    }

                                    const savedPath =
                                        effectiveStorageMode === 'fs' && b64Json
                                            ? `/api/image/${filename}`
                                            : undefined;
                                    const imageData = {
                                        filename,
                                        output_format: fileExtension,
                                        ...(shouldInlineImageData && b64Json ? { b64_json: b64Json } : {}),
                                        ...(revisedPrompt ? { revised_prompt: revisedPrompt } : {}),
                                        ...(savedPath ? { path: savedPath } : {})
                                    };
                                    completedImages.push(imageData);

                                    const completedEvent: StreamingEvent = {
                                        type: 'completed',
                                        index: currentIndex,
                                        filename,
                                        b64_json: shouldInlineImageData ? b64Json : undefined,
                                        path: savedPath,
                                        output_format: fileExtension,
                                        revised_prompt: revisedPrompt
                                    };
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(completedEvent)}\n\n`));

                                    imageIndex++;

                                    // Capture usage from completed event if available
                                    if ('usage' in event && event.usage) {
                                        finalUsage = event.usage as OpenAI.Images.ImagesResponse['usage'];
                                    }
                                } else {
                                    console.log('Streaming: Ignored image generation event:', {
                                        type: eventType || 'unknown',
                                        keys: getStreamEventKeys(event)
                                    });
                                }
                            }

                            await emitLastPartialImageAsCompleted({
                                controller,
                                encoder,
                                completedImages,
                                lastPartialB64Json,
                                timestamp,
                                fileExtension,
                                shouldInlineImageData,
                                effectiveStorageMode,
                                logPrefix: 'Streaming'
                            });

                            // Send final done event with all images and usage
                            enqueueStreamingDone(controller, encoder, completedImages, finalUsage);
                            closeStreamingController(controller);
                        } catch (error) {
                            console.error('Streaming error:', error);
                            try {
                                await emitLastPartialImageAsCompleted({
                                    controller,
                                    encoder,
                                    completedImages,
                                    lastPartialB64Json,
                                    timestamp,
                                    fileExtension,
                                    shouldInlineImageData,
                                    effectiveStorageMode,
                                    logPrefix: 'Streaming interrupted'
                                });
                            } catch (fallbackError) {
                                console.error('Streaming fallback image save failed:', fallbackError);
                            }

                            if (completedImages.length > 0) {
                                console.warn('Streaming: Upstream interrupted after image data was received; finishing with available images.');
                                enqueueStreamingDone(controller, encoder, completedImages, finalUsage);
                                closeStreamingController(controller);
                                return;
                            }

                            const interrupted = isUpstreamConnectivityError(error);
                            const errorEvent: StreamingEvent = {
                                type: 'error',
                                ...(interrupted ? { error_code: 'stream_interrupted' as const } : {}),
                                error: getStreamingErrorMessage(error, responseLanguage)
                            };
                            enqueueStreamingEvent(controller, encoder, errorEvent);
                            closeStreamingController(controller);
                        }
                    }
                });

                return new Response(readableStream, {
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        Connection: 'keep-alive'
                    }
                });
            }

            const params: OpenAI.Images.ImageGenerateParams = baseParams;
            requestSingleImage = () => openai.images.generate({ ...params, n: 1 });
            console.log('Calling OpenAI generate with params:', params);
            result = await openai.images.generate(params);
        } else if (mode === 'edit') {
            const n = parseInt((formData.get('n') as string) || '1', 10);
            requestedImageCount = Math.max(1, Math.min(n || 1, 10));
            // gpt-image-2 accepts arbitrary WxH strings that the SDK's narrow literal union doesn't express.
            const size = ((formData.get('size') as string) || 'auto') as OpenAI.Images.ImageEditParams['size'];
            const quality = (formData.get('quality') as OpenAI.Images.ImageEditParams['quality']) || 'auto';

            const imageFiles: File[] = [];
            for (const [key, value] of formData.entries()) {
                if (key.startsWith('image_') && value instanceof File) {
                    imageFiles.push(value);
                }
            }

            if (imageFiles.length === 0) {
                return NextResponse.json({ error: 'No image file provided for editing.' }, { status: 400 });
            }

            const maskFile = formData.get('mask') as File | null;

            const baseEditParams = {
                model,
                prompt: withAspectInstruction(prompt, size === 'auto' ? undefined : size, responseLanguage),
                image: imageFiles,
                n: requestedImageCount,
                size: size === 'auto' ? undefined : size,
                quality: quality === 'auto' ? undefined : quality
            };

            // Handle streaming mode for editing
            if (streamEnabled) {
                console.log('Calling OpenAI edit with streaming, params:', {
                    ...baseEditParams,
                    stream: true,
                    partial_images: partialImagesCount,
                    image: `[${imageFiles.map((f) => f.name).join(', ')}]`,
                    mask: maskFile ? maskFile.name : 'N/A'
                });

                const streamEditParams = {
                    ...baseEditParams,
                    stream: true as const,
                    partial_images: Math.max(1, Math.min(partialImagesCount, 3)) as 1 | 2 | 3,
                    ...(maskFile ? { mask: maskFile } : {})
                };

                const stream = await openai.images.edit(streamEditParams);

                // Create SSE response for edit
                const encoder = new TextEncoder();
                const timestamp = Date.now();
                const fileExtension = 'png'; // Edit mode always outputs PNG
                const shouldInlineImageData = effectiveStorageMode !== 'fs';

                const readableStream = new ReadableStream<Uint8Array>({
                    async start(controller) {
                        const completedImages: StreamingImageResult[] = [];
                        let finalUsage: OpenAI.Images.ImagesResponse['usage'] | undefined;
                        let imageIndex = 0;
                        let lastPartialB64Json: string | undefined;

                        try {
                            for await (const event of stream) {
                                const eventType = getStreamEventType(event);
                                const b64Json = getStreamEventB64Json(event);
                                const partialImageIndex = getStreamEventPartialImageIndex(event);

                                if (isPartialImageStreamEvent(event)) {
                                    if (b64Json) {
                                        lastPartialB64Json = b64Json;
                                    }
                                    const partialEvent: StreamingEvent = {
                                        type: 'partial_image',
                                        index: imageIndex,
                                        partial_image_index: partialImageIndex,
                                        b64_json: b64Json
                                    };
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(partialEvent)}\n\n`));
                                } else if (isCompletedImageStreamEvent(event)) {
                                    const currentIndex = imageIndex;
                                    const filename = `${timestamp}-${currentIndex}.${fileExtension}`;
                                    const revisedPrompt = getRevisedPrompt(event);

                                    // Save to filesystem if in fs mode
                                    if (effectiveStorageMode === 'fs' && b64Json) {
                                        const buffer = Buffer.from(b64Json, 'base64');
                                        const filepath = path.join(outputDir, filename);
                                        await fs.writeFile(filepath, buffer);
                                        console.log(`Streaming edit: Saved image ${filename}`);
                                    }

                                    const savedPath =
                                        effectiveStorageMode === 'fs' && b64Json
                                            ? `/api/image/${filename}`
                                            : undefined;
                                    const imageData = {
                                        filename,
                                        output_format: fileExtension,
                                        ...(shouldInlineImageData && b64Json ? { b64_json: b64Json } : {}),
                                        ...(revisedPrompt ? { revised_prompt: revisedPrompt } : {}),
                                        ...(savedPath ? { path: savedPath } : {})
                                    };
                                    completedImages.push(imageData);

                                    const completedEvent: StreamingEvent = {
                                        type: 'completed',
                                        index: currentIndex,
                                        filename,
                                        b64_json: shouldInlineImageData ? b64Json : undefined,
                                        path: savedPath,
                                        output_format: fileExtension,
                                        revised_prompt: revisedPrompt
                                    };
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(completedEvent)}\n\n`));

                                    imageIndex++;

                                    // Capture usage from completed event if available
                                    if ('usage' in event && event.usage) {
                                        finalUsage = event.usage as OpenAI.Images.ImagesResponse['usage'];
                                    }
                                } else {
                                    console.log('Streaming edit: Ignored image event:', {
                                        type: eventType || 'unknown',
                                        keys: getStreamEventKeys(event)
                                    });
                                }
                            }

                            await emitLastPartialImageAsCompleted({
                                controller,
                                encoder,
                                completedImages,
                                lastPartialB64Json,
                                timestamp,
                                fileExtension,
                                shouldInlineImageData,
                                effectiveStorageMode,
                                logPrefix: 'Streaming edit'
                            });

                            // Send final done event with all images and usage
                            enqueueStreamingDone(controller, encoder, completedImages, finalUsage);
                            closeStreamingController(controller);
                        } catch (error) {
                            console.error('Streaming edit error:', error);
                            try {
                                await emitLastPartialImageAsCompleted({
                                    controller,
                                    encoder,
                                    completedImages,
                                    lastPartialB64Json,
                                    timestamp,
                                    fileExtension,
                                    shouldInlineImageData,
                                    effectiveStorageMode,
                                    logPrefix: 'Streaming edit interrupted'
                                });
                            } catch (fallbackError) {
                                console.error('Streaming edit fallback image save failed:', fallbackError);
                            }

                            if (completedImages.length > 0) {
                                console.warn('Streaming edit: Upstream interrupted after image data was received; finishing with available images.');
                                enqueueStreamingDone(controller, encoder, completedImages, finalUsage);
                                closeStreamingController(controller);
                                return;
                            }

                            const interrupted = isUpstreamConnectivityError(error);
                            const errorEvent: StreamingEvent = {
                                type: 'error',
                                ...(interrupted ? { error_code: 'stream_interrupted' as const } : {}),
                                error: getStreamingErrorMessage(error, responseLanguage)
                            };
                            enqueueStreamingEvent(controller, encoder, errorEvent);
                            closeStreamingController(controller);
                        }
                    }
                });

                return new Response(readableStream, {
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        Connection: 'keep-alive'
                    }
                });
            }

            const params: OpenAI.Images.ImageEditParams = {
                ...baseEditParams,
                ...(maskFile ? { mask: maskFile } : {})
            };
            requestSingleImage = () => openai.images.edit({ ...params, n: 1 });

            console.log('Calling OpenAI edit with params:', {
                ...params,
                image: `[${imageFiles.map((f) => f.name).join(', ')}]`,
                mask: maskFile ? maskFile.name : 'N/A'
            });
            result = await openai.images.edit(params);
        } else {
            return NextResponse.json({ error: 'Invalid mode specified' }, { status: 400 });
        }

        console.log('OpenAI API call successful.');

        result = await fillMissingImages(result, requestedImageCount, requestSingleImage);

        if (!result || !Array.isArray(result.data) || result.data.length === 0) {
            console.error('Invalid or empty data received from OpenAI API:', result);
            return NextResponse.json({ error: 'Failed to retrieve image data from API.' }, { status: 500 });
        }

        const savedImagesData = await Promise.all(
            result.data.map(async (imageData, index) => {
                if (!imageData.b64_json) {
                    console.error(`Image data ${index} is missing b64_json.`);
                    throw new Error(`Image data at index ${index} is missing base64 data.`);
                }
                const buffer = Buffer.from(imageData.b64_json, 'base64');
                const timestamp = Date.now();

                const fileExtension = validateOutputFormat(formData.get('output_format'));
                const filename = `${timestamp}-${index}.${fileExtension}`;

                if (effectiveStorageMode === 'fs') {
                    const filepath = path.join(outputDir, filename);
                    console.log(`Attempting to save image to: ${filepath}`);
                    await fs.writeFile(filepath, buffer);
                    console.log(`Successfully saved image: ${filename}`);
                } else {
                }

                const revisedPrompt = getRevisedPrompt(imageData);
                const imageResult: {
                    filename: string;
                    b64_json: string;
                    path?: string;
                    output_format: string;
                    revised_prompt?: string;
                } = {
                    filename: filename,
                    b64_json: imageData.b64_json,
                    output_format: fileExtension,
                    ...(revisedPrompt ? { revised_prompt: revisedPrompt } : {})
                };

                if (effectiveStorageMode === 'fs') {
                    imageResult.path = `/api/image/${filename}`;
                }

                return imageResult;
            })
        );

        console.log(`All images processed. Mode: ${effectiveStorageMode}`);

        return NextResponse.json({
            images: savedImagesData,
            revised_prompt: savedImagesData.find((image) => image.revised_prompt)?.revised_prompt,
            usage: result.usage
        });
    } catch (error: unknown) {
        console.error('Error in /api/images:', error);

        const errorMessage = getImageApiErrorMessage(error, responseLanguageForError);
        const status = getErrorStatusCode(error) ?? 500;

        return NextResponse.json({ error: errorMessage }, { status });
    }
}
