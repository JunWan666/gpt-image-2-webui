'use client';

import { EditingForm, type EditingFormData } from '@/components/editing-form';
import { GenerationForm, type GenerationFormData } from '@/components/generation-form';
import { HistoryPanel } from '@/components/history-panel';
import { ImageOutput } from '@/components/image-output';
import { PasswordDialog } from '@/components/password-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppSettings } from '@/lib/app-settings';
import { calculateApiCost, formatUsdCny, type CostDetails, type GptImageModel } from '@/lib/cost-utils';
import { db, type ImageRecord } from '@/lib/db';
import { useI18n, type LanguagePreference } from '@/lib/i18n';
import { getPresetDimensions } from '@/lib/size-utils';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    CheckCircle2,
    ChevronDown,
    Cpu,
    ExternalLink,
    Eye,
    EyeOff,
    Globe2,
    KeyRound,
    Languages,
    Loader2,
    Moon,
    Sun
} from 'lucide-react';
import { useTheme } from 'next-themes';
import * as React from 'react';

type HistoryImage = {
    filename: string;
    revisedPrompt?: string;
};

export type HistoryMetadata = {
    timestamp: number;
    images: HistoryImage[];
    storageModeUsed?: 'fs' | 'indexeddb';
    durationMs: number;
    quality: GenerationFormData['quality'];
    background: GenerationFormData['background'];
    moderation: GenerationFormData['moderation'];
    prompt: string;
    revisedPrompt?: string;
    mode: 'generate' | 'edit';
    costDetails: CostDetails | null;
    size?: string;
    output_compression?: number;
    streaming?: boolean;
    partialImages?: number;
    sourceImageCount?: number;
    hasMask?: boolean;
    output_format?: GenerationFormData['output_format'];
    model?: GptImageModel;
};

type DrawnPoint = {
    x: number;
    y: number;
    size: number;
};

const MAX_EDIT_IMAGES = 10;

const explicitModeClient = process.env.NEXT_PUBLIC_IMAGE_STORAGE_MODE;

const vercelEnvClient = process.env.NEXT_PUBLIC_VERCEL_ENV;
const isOnVercelClient = vercelEnvClient === 'production' || vercelEnvClient === 'preview';

let effectiveStorageModeClient: 'fs' | 'indexeddb';

if (explicitModeClient === 'fs') {
    effectiveStorageModeClient = 'fs';
} else if (explicitModeClient === 'indexeddb') {
    effectiveStorageModeClient = 'indexeddb';
} else if (isOnVercelClient) {
    effectiveStorageModeClient = 'indexeddb';
} else {
    effectiveStorageModeClient = 'fs';
}
console.log(
    `Client Effective Storage Mode: ${effectiveStorageModeClient} (Explicit: ${explicitModeClient || 'unset'}, Vercel Env: ${vercelEnvClient || 'N/A'})`
);

type ApiImageResponseItem = {
    filename: string;
    b64_json?: string;
    output_format: string;
    path?: string;
    revised_prompt?: string;
};

type ImageBatchItem = {
    path: string;
    filename: string;
    revisedPrompt?: string;
    isStreamingPreview?: boolean;
};

type ApiUsageForCost = Parameters<typeof calculateApiCost>[0];

type ImageApiResult = {
    images?: ApiImageResponseItem[];
    revised_prompt?: string;
    usage?: ApiUsageForCost;
    error?: string;
};

type ModelsApiResult = {
    models?: string[];
    error?: string;
};

type ApiResponseInfo = {
    status: 'loading' | 'success' | 'error';
    endpoint: string;
    method: string;
    startedAt: number;
    durationMs?: number;
    httpStatus?: number;
    contentType?: string | null;
    responseKind?: 'event-stream' | 'json';
    mode: 'generate' | 'edit';
    model: string;
    size: string;
    n: number;
    stream: boolean;
    partialImages?: number;
    storageMode: 'fs' | 'indexeddb';
    imageCount?: number;
    filenames?: string[];
    costUsd?: number;
    error?: string;
    streamingStats?: {
        partialImages: number;
        completedImages: number;
        doneReceived: boolean;
    };
};

function getTokenConsoleUrl(baseUrl: string): string | null {
    const trimmedBaseUrl = baseUrl.trim();
    if (!trimmedBaseUrl) return null;

    try {
        const parsedBaseUrl = new URL(trimmedBaseUrl);
        return new URL('/console/token', parsedBaseUrl.origin).toString();
    } catch {
        return null;
    }
}

function normalizeModelOptions(model: string, existingModels: string[]): string[] {
    const seen = new Set<string>();
    const nextModels: string[] = [];

    for (const rawModel of [model, ...existingModels]) {
        const trimmedModel = rawModel.trim();
        if (!trimmedModel || seen.has(trimmedModel)) continue;

        seen.add(trimmedModel);
        nextModels.push(trimmedModel);
    }

    const withoutIncompletePrefixes = removeIncompletePrefixModels(nextModels);

    return withoutIncompletePrefixes.length > 0 ? withoutIncompletePrefixes : ['gpt-image-2'];
}

function removeIncompletePrefixModels(models: string[]): string[] {
    return models.filter((model) => {
        const looksIncomplete = model.endsWith('-') || !/\d/.test(model);
        if (!looksIncomplete) return true;

        return !models.some((otherModel) => otherModel !== model && otherModel.startsWith(model));
    });
}

function mergeModelOptions(groups: string[][]): string[] {
    const seen = new Set<string>();
    const options: string[] = [];

    for (const group of groups) {
        for (const rawModel of removeIncompletePrefixModels(group)) {
            const model = rawModel.trim();
            if (!model || seen.has(model)) continue;

            seen.add(model);
            options.push(model);
        }
    }

    return options.length > 0 ? options : ['gpt-image-2'];
}

function formatApiDuration(durationMs?: number): string {
    if (durationMs === undefined) return '-';
    if (durationMs < 1000) return `${durationMs}ms`;

    return `${(durationMs / 1000).toFixed(1)}s`;
}

function formatContentType(contentType?: string | null): string {
    return contentType?.split(';')[0] || '-';
}

function getServerImagePath(filename: string): string {
    return `/api/image/${encodeURIComponent(filename)}`;
}

function isUpstreamConnectionErrorMessage(message: string): boolean {
    const normalizedMessage = message.toLowerCase();
    const signals = [
        'status_code=502',
        'status code 502',
        '502',
        'bad gateway',
        'stream disconnected before completion',
        'failed to fetch',
        'failed fetch',
        'fetch failed',
        'terminated',
        'und_err_socket',
        'other side closed',
        'socket hang up',
        'econnreset',
        'connection reset'
    ];

    return signals.some((signal) => normalizedMessage.includes(signal));
}

export default function HomePage() {
    const { language, languagePreference, setLanguagePreference, t } = useI18n();
    const { settings, modelOptions, saveSettings } = useAppSettings();
    const { resolvedTheme, setTheme } = useTheme();
    const [isThemeMounted, setIsThemeMounted] = React.useState(false);
    const [mode, setMode] = React.useState<'generate' | 'edit'>('generate');
    const [isPasswordRequiredByBackend, setIsPasswordRequiredByBackend] = React.useState<boolean | null>(null);
    const [clientPasswordHash, setClientPasswordHash] = React.useState<string | null>(null);
    const [baseUrlDraft, setBaseUrlDraft] = React.useState(settings.baseUrl);
    const [apiKeyDraft, setApiKeyDraft] = React.useState(settings.apiKey);
    const [modelDraft, setModelDraft] = React.useState(settings.models[0] ?? 'gpt-image-2');
    const [remoteModelOptions, setRemoteModelOptions] = React.useState<string[]>([]);
    const [isModelMenuOpen, setIsModelMenuOpen] = React.useState(false);
    const [isFetchingModels, setIsFetchingModels] = React.useState(false);
    const [modelFetchError, setModelFetchError] = React.useState<string | null>(null);
    const [showApiKey, setShowApiKey] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isSendingToEdit, setIsSendingToEdit] = React.useState(false);
    const [activeRequestStartedAt, setActiveRequestStartedAt] = React.useState<number | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
    const [error, setError] = React.useState<string | null>(null);
    const [showApiResponseInfo, setShowApiResponseInfo] = React.useState(false);
    const [apiResponseInfo, setApiResponseInfo] = React.useState<ApiResponseInfo | null>(null);
    const [latestImageBatch, setLatestImageBatch] = React.useState<ImageBatchItem[] | null>(null);
    const [latestBatchPrompt, setLatestBatchPrompt] = React.useState('');
    const [imageOutputView, setImageOutputView] = React.useState<'grid' | number>('grid');
    const [history, setHistory] = React.useState<HistoryMetadata[]>([]);
    const [imageSrcByFilename, setImageSrcByFilename] = React.useState<Record<string, string>>({});
    const [isInitialLoad, setIsInitialLoad] = React.useState(true);
    const blobUrlCacheRef = React.useRef<Map<string, string>>(new Map());
    const modelMenuRef = React.useRef<HTMLDivElement>(null);
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = React.useState(false);
    const [passwordDialogContext, setPasswordDialogContext] = React.useState<'initial' | 'retry'>('initial');
    const [lastApiCallArgs, setLastApiCallArgs] = React.useState<[GenerationFormData | EditingFormData] | null>(null);
    const [skipDeleteConfirmation, setSkipDeleteConfirmation] = React.useState<boolean>(false);
    const [itemToDeleteConfirm, setItemToDeleteConfirm] = React.useState<HistoryMetadata | null>(null);
    const [dialogCheckboxStateSkipConfirm, setDialogCheckboxStateSkipConfirm] = React.useState<boolean>(false);

    const allDbImages = useLiveQuery<ImageRecord[] | undefined>(() => db.images.toArray(), []);

    const [editImageFiles, setEditImageFiles] = React.useState<File[]>([]);
    const [editSourceImagePreviewUrls, setEditSourceImagePreviewUrls] = React.useState<string[]>([]);
    const [editPrompt, setEditPrompt] = React.useState('');
    const [editN, setEditN] = React.useState([1]);
    const [editSize, setEditSize] = React.useState<EditingFormData['size']>('square');
    const [editCustomWidth, setEditCustomWidth] = React.useState<number>(1024);
    const [editCustomHeight, setEditCustomHeight] = React.useState<number>(1024);
    const [editQuality, setEditQuality] = React.useState<EditingFormData['quality']>('auto');
    const [editBrushSize, setEditBrushSize] = React.useState([20]);
    const [editShowMaskEditor, setEditShowMaskEditor] = React.useState(false);
    const [editGeneratedMaskFile, setEditGeneratedMaskFile] = React.useState<File | null>(null);
    const [editIsMaskSaved, setEditIsMaskSaved] = React.useState(false);
    const [editOriginalImageSize, setEditOriginalImageSize] = React.useState<{ width: number; height: number } | null>(
        null
    );
    const [editDrawnPoints, setEditDrawnPoints] = React.useState<DrawnPoint[]>([]);
    const [editMaskPreviewUrl, setEditMaskPreviewUrl] = React.useState<string | null>(null);

    const selectedModel = (modelDraft.trim() || settings.models[0] || 'gpt-image-2') as GptImageModel;
    const combinedModelOptions = React.useMemo(
        () => mergeModelOptions([remoteModelOptions, modelOptions]),
        [modelOptions, remoteModelOptions]
    );
    const filteredModelOptions = React.useMemo(() => {
        const query = modelDraft.trim().toLowerCase();
        const filteredOptions = query
            ? combinedModelOptions.filter((model) => model.toLowerCase().includes(query))
            : combinedModelOptions;

        return filteredOptions.slice(0, 50);
    }, [combinedModelOptions, modelDraft]);
    const [genPrompt, setGenPrompt] = React.useState('');
    const [genN, setGenN] = React.useState([1]);
    const [genSize, setGenSize] = React.useState<GenerationFormData['size']>('square');
    const [genCustomWidth, setGenCustomWidth] = React.useState<number>(1024);
    const [genCustomHeight, setGenCustomHeight] = React.useState<number>(1024);
    const [genQuality, setGenQuality] = React.useState<GenerationFormData['quality']>('auto');
    const [genOutputFormat, setGenOutputFormat] = React.useState<GenerationFormData['output_format']>('png');
    const [genCompression, setGenCompression] = React.useState([100]);
    const [genBackground, setGenBackground] = React.useState<GenerationFormData['background']>('auto');
    const [genModeration, setGenModeration] = React.useState<GenerationFormData['moderation']>('auto');

    const normalizeRevisedPrompt = React.useCallback((value: unknown): string | undefined => {
        return typeof value === 'string' && value.trim() ? value : undefined;
    }, []);

    const getBatchRevisedPrompt = React.useCallback(
        (images: ApiImageResponseItem[], fallback?: unknown): string | undefined =>
            normalizeRevisedPrompt(fallback) ??
            images.map((image) => normalizeRevisedPrompt(image.revised_prompt)).find(Boolean),
        [normalizeRevisedPrompt]
    );

    React.useEffect(() => {
        setIsThemeMounted(true);
    }, []);

    React.useEffect(() => {
        setBaseUrlDraft(settings.baseUrl);
        setApiKeyDraft(settings.apiKey);
        setModelDraft(settings.models[0] ?? 'gpt-image-2');
    }, [settings.baseUrl, settings.apiKey, settings.models]);

    const currentTheme = isThemeMounted ? (resolvedTheme ?? 'dark') : 'dark';

    const handleThemeToggle = () => {
        setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    };

    const handleBaseUrlChange = (value: string) => {
        setBaseUrlDraft(value);
        saveSettings({
            ...settings,
            baseUrl: value,
            apiKey: apiKeyDraft,
            models: settings.models
        });
    };

    const handleApiKeyChange = (value: string) => {
        setApiKeyDraft(value);
        saveSettings({
            ...settings,
            baseUrl: baseUrlDraft,
            apiKey: value,
            models: settings.models
        });
    };

    const handleModelChange = (value: string) => {
        setModelDraft(value);
    };

    const saveModelChoice = React.useCallback(
        (value: string) => {
            if (!value.trim()) return;

            saveSettings({
                ...settings,
                baseUrl: baseUrlDraft,
                apiKey: apiKeyDraft,
                models: normalizeModelOptions(value, settings.models)
            });
        },
        [apiKeyDraft, baseUrlDraft, saveSettings, settings]
    );

    const handleModelSelect = (value: string) => {
        setModelDraft(value);
        saveSettings({
            ...settings,
            baseUrl: baseUrlDraft,
            apiKey: apiKeyDraft,
            models: normalizeModelOptions(value, settings.models)
        });
    };

    const tokenConsoleUrl = React.useMemo(
        () => getTokenConsoleUrl(baseUrlDraft || settings.baseUrl),
        [baseUrlDraft, settings.baseUrl]
    );

    const fetchModelOptions = React.useCallback(async () => {
        if (isPasswordRequiredByBackend && !clientPasswordHash) {
            setModelFetchError(t('page.passwordMissing'));
            return;
        }

        setIsFetchingModels(true);
        setModelFetchError(null);

        try {
            const response = await fetch('/api/models', {
                method: 'POST',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: apiKeyDraft.trim() || undefined,
                    baseUrl: baseUrlDraft.trim() || undefined,
                    ...(isPasswordRequiredByBackend && clientPasswordHash ? { passwordHash: clientPasswordHash } : {})
                })
            });
            const result: ModelsApiResult = await response.json();

            if (!response.ok) {
                throw new Error(result.error || t('page.apiRequestFailed', { status: response.status }));
            }

            setRemoteModelOptions(Array.isArray(result.models) ? result.models : []);
        } catch (error) {
            setRemoteModelOptions([]);
            setModelFetchError(error instanceof Error ? error.message : t('settings.modelsFetchFailed'));
        } finally {
            setIsFetchingModels(false);
        }
    }, [apiKeyDraft, baseUrlDraft, clientPasswordHash, isPasswordRequiredByBackend, t]);

    React.useEffect(() => {
        if (isPasswordRequiredByBackend === null) return;

        const timeoutId = window.setTimeout(() => {
            fetchModelOptions();
        }, 600);

        return () => window.clearTimeout(timeoutId);
    }, [fetchModelOptions, isPasswordRequiredByBackend]);

    React.useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            if (!modelMenuRef.current?.contains(event.target as Node)) {
                setIsModelMenuOpen(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, []);

    React.useEffect(() => {
        if (!isLoading || activeRequestStartedAt === null) {
            return;
        }

        const updateElapsedSeconds = () => {
            setElapsedSeconds(Math.floor((Date.now() - activeRequestStartedAt) / 1000));
        };

        updateElapsedSeconds();
        const intervalId = window.setInterval(updateElapsedSeconds, 1000);

        return () => window.clearInterval(intervalId);
    }, [activeRequestStartedAt, isLoading]);

    const getImageSrc = React.useCallback(
        (filename: string): string | undefined => imageSrcByFilename[filename],
        [imageSrcByFilename]
    );

    const getStoredImageSrc = React.useCallback(
        (filename: string, storageMode: 'fs' | 'indexeddb'): string | undefined =>
            getImageSrc(filename) ?? (storageMode === 'fs' ? getServerImagePath(filename) : undefined),
        [getImageSrc]
    );

    React.useEffect(() => {
        if (allDbImages === undefined) {
            setImageSrcByFilename({});
            return;
        }

        const previousCache = blobUrlCacheRef.current;
        const nextCache = new Map<string, string>();
        const nextSrcByFilename: Record<string, string> = {};

        allDbImages.forEach((record) => {
            if (!record.blob) return;

            const cachedUrl = previousCache.get(record.filename);
            if (cachedUrl) {
                nextCache.set(record.filename, cachedUrl);
                nextSrcByFilename[record.filename] = cachedUrl;
                return;
            }

            const url = URL.createObjectURL(record.blob);
            nextCache.set(record.filename, url);
            nextSrcByFilename[record.filename] = url;
        });

        previousCache.forEach((url, filename) => {
            if (!nextCache.has(filename)) {
                URL.revokeObjectURL(url);
            }
        });

        blobUrlCacheRef.current = nextCache;
        setImageSrcByFilename(nextSrcByFilename);
    }, [allDbImages]);

    React.useEffect(() => {
        return () => {
            blobUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
            blobUrlCacheRef.current.clear();
        };
    }, []);

    React.useEffect(() => {
        return () => {
            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [editSourceImagePreviewUrls]);

    const readHistoryFromStorage = React.useCallback((): HistoryMetadata[] => {
        try {
            const storedHistory = localStorage.getItem('openaiImageHistory');
            if (storedHistory) {
                const parsedHistory: HistoryMetadata[] = JSON.parse(storedHistory);
                if (Array.isArray(parsedHistory)) {
                    return parsedHistory;
                }

                console.warn('Invalid history data found in localStorage.');
                localStorage.removeItem('openaiImageHistory');
            }
        } catch (e) {
            console.error('Failed to load or parse history from localStorage:', e);
            localStorage.removeItem('openaiImageHistory');
        }

        return [];
    }, []);

    React.useEffect(() => {
        setHistory(readHistoryFromStorage());
        setIsInitialLoad(false);
    }, [readHistoryFromStorage]);

    React.useEffect(() => {
        const refreshHistory = () => {
            setHistory(readHistoryFromStorage());
        };

        const refreshWhenVisible = () => {
            if (!document.hidden) {
                refreshHistory();
            }
        };

        window.addEventListener('pageshow', refreshHistory);
        window.addEventListener('focus', refreshHistory);
        document.addEventListener('visibilitychange', refreshWhenVisible);

        return () => {
            window.removeEventListener('pageshow', refreshHistory);
            window.removeEventListener('focus', refreshHistory);
            document.removeEventListener('visibilitychange', refreshWhenVisible);
        };
    }, [readHistoryFromStorage]);

    React.useEffect(() => {
        const fetchAuthStatus = async () => {
            try {
                const response = await fetch('/api/auth-status');
                if (!response.ok) {
                    throw new Error('Failed to fetch auth status');
                }
                const data = await response.json();
                setIsPasswordRequiredByBackend(data.passwordRequired);
            } catch (error) {
                console.error('Error fetching auth status:', error);
                setIsPasswordRequiredByBackend(false);
            }
        };

        fetchAuthStatus();
        const storedHash = localStorage.getItem('clientPasswordHash');
        if (storedHash) {
            setClientPasswordHash(storedHash);
        }
    }, []);

    React.useEffect(() => {
        if (!isInitialLoad) {
            try {
                localStorage.setItem('openaiImageHistory', JSON.stringify(history));
            } catch (e) {
                console.error('Failed to save history to localStorage:', e);
            }
        }
    }, [history, isInitialLoad]);

    React.useEffect(() => {
        return () => {
            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [editSourceImagePreviewUrls]);

    React.useEffect(() => {
        const storedPref = localStorage.getItem('imageGenSkipDeleteConfirm');
        if (storedPref === 'true') {
            setSkipDeleteConfirmation(true);
        } else if (storedPref === 'false') {
            setSkipDeleteConfirmation(false);
        }
    }, []);

    React.useEffect(() => {
        localStorage.setItem('imageGenSkipDeleteConfirm', String(skipDeleteConfirmation));
    }, [skipDeleteConfirmation]);

    React.useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            if (mode !== 'edit' || !event.clipboardData) {
                return;
            }

            if (editImageFiles.length >= MAX_EDIT_IMAGES) {
                alert(t('form.invalidMaxFiles', { maxImages: MAX_EDIT_IMAGES }));
                return;
            }

            const items = event.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        event.preventDefault();

                        const previewUrl = URL.createObjectURL(file);

                        setEditImageFiles((prevFiles) => [...prevFiles, file]);
                        setEditSourceImagePreviewUrls((prevUrls) => [...prevUrls, previewUrl]);

                        break;
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);

        return () => {
            window.removeEventListener('paste', handlePaste);
        };
    }, [mode, editImageFiles.length, t]);

    async function sha256Client(text: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    const handleSavePassword = async (password: string) => {
        if (!password.trim()) {
            setError(t('page.passwordEmpty'));
            return;
        }
        try {
            const hash = await sha256Client(password);
            localStorage.setItem('clientPasswordHash', hash);
            setClientPasswordHash(hash);
            setError(null);
            setIsPasswordDialogOpen(false);
            if (passwordDialogContext === 'retry' && lastApiCallArgs) {
                await handleApiCall(...lastApiCallArgs);
            }
        } catch (e) {
            console.error('Error hashing password:', e);
            setError(t('page.passwordHashError'));
        }
    };

    const handleOpenPasswordDialog = () => {
        setPasswordDialogContext('initial');
        setIsPasswordDialogOpen(true);
    };

    const getMimeTypeFromFormat = (format: string): string => {
        if (format === 'jpeg') return 'image/jpeg';
        if (format === 'webp') return 'image/webp';

        return 'image/png';
    };

    const cacheApiImageForDisplay = async (img: ApiImageResponseItem): Promise<ImageBatchItem | null> => {
        if (img.b64_json) {
            try {
                const byteCharacters = atob(img.b64_json);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);

                const actualMimeType = getMimeTypeFromFormat(img.output_format);
                const blob = new Blob([byteArray], { type: actualMimeType });

                await db.images.put({ filename: img.filename, blob });

                const previousBlobUrl = blobUrlCacheRef.current.get(img.filename);
                if (previousBlobUrl) {
                    URL.revokeObjectURL(previousBlobUrl);
                }

                const blobUrl = URL.createObjectURL(blob);
                blobUrlCacheRef.current.set(img.filename, blobUrl);
                setImageSrcByFilename((current) => ({
                    ...current,
                    [img.filename]: blobUrl
                }));

                return {
                    filename: img.filename,
                    path: blobUrl,
                    revisedPrompt: normalizeRevisedPrompt(img.revised_prompt)
                };
            } catch (dbError) {
                console.error(`Error caching blob ${img.filename} to IndexedDB:`, dbError);
                if (effectiveStorageModeClient === 'indexeddb') {
                    setError(t('page.saveIndexedDbError', { filename: img.filename }));
                    return null;
                }
            }
        } else {
            console.warn(`Image ${img.filename} missing b64_json; falling back to server path when available.`);
        }

        if (img.path) {
            return {
                filename: img.filename,
                path: img.path,
                revisedPrompt: normalizeRevisedPrompt(img.revised_prompt)
            };
        }

        return null;
    };

    const handleApiCall = async (formData: GenerationFormData | EditingFormData) => {
        const startTime = Date.now();
        let durationMs = 0;

        setIsLoading(true);
        setActiveRequestStartedAt(startTime);
        setElapsedSeconds(0);
        setError(null);
        setLatestImageBatch(null);
        setLatestBatchPrompt('');
        setImageOutputView('grid');

        const apiFormData = new FormData();
        const apiKey = apiKeyDraft.trim() || settings.apiKey.trim();
        const baseUrl = baseUrlDraft.trim() || settings.baseUrl.trim();

        if (apiKey) {
            apiFormData.append('apiKey', apiKey);
        }
        if (baseUrl) {
            apiFormData.append('baseUrl', baseUrl);
        }
        apiFormData.append('responseLanguage', language);

        if (isPasswordRequiredByBackend && clientPasswordHash) {
            apiFormData.append('passwordHash', clientPasswordHash);
        } else if (isPasswordRequiredByBackend && !clientPasswordHash) {
            setError(t('page.passwordMissing'));
            setPasswordDialogContext('initial');
            setIsPasswordDialogOpen(true);
            setIsLoading(false);
            return;
        }
        apiFormData.append('mode', mode);

        let requestSize = '';
        let requestOutputCompression: number | undefined;
        let requestSourceImageCount = 0;
        let requestHasMask = false;
        let requestStreaming = false;
        let requestPartialImages: number | undefined;
        let requestModel: GptImageModel = selectedModel;
        let requestImageCount = 1;

        if (mode === 'generate') {
            const genData = formData as GenerationFormData;
            requestModel = genData.model;
            requestImageCount = genData.n;
            apiFormData.append('model', requestModel);
            apiFormData.append('prompt', genData.prompt);
            apiFormData.append('n', genData.n.toString());
            const genSizeToSend =
                genData.size === 'custom'
                    ? `${genData.customWidth}x${genData.customHeight}`
                    : (getPresetDimensions(genData.size, requestModel) ?? genData.size);
            requestSize = genSizeToSend;
            apiFormData.append('size', genSizeToSend);
            apiFormData.append('quality', genData.quality);
            apiFormData.append('output_format', genData.output_format);
            if (
                (genData.output_format === 'jpeg' || genData.output_format === 'webp') &&
                genData.output_compression !== undefined
            ) {
                requestOutputCompression = genData.output_compression;
                apiFormData.append('output_compression', genData.output_compression.toString());
            }
            apiFormData.append('background', genData.background);
            apiFormData.append('moderation', genData.moderation);
            if (genData.stream && genData.n === 1) {
                requestStreaming = true;
                requestPartialImages = genData.partialImages;
                apiFormData.append('stream', 'true');
                apiFormData.append('partial_images', genData.partialImages.toString());
            }
        } else {
            const editData = formData as EditingFormData;
            requestModel = editData.model;
            requestImageCount = editData.n;
            apiFormData.append('model', requestModel);
            apiFormData.append('prompt', editData.prompt);
            apiFormData.append('n', editData.n.toString());
            const editSizeToSend =
                editData.size === 'custom'
                    ? `${editData.customWidth}x${editData.customHeight}`
                    : (getPresetDimensions(editData.size, requestModel) ?? editData.size);
            requestSize = editSizeToSend;
            requestSourceImageCount = editData.imageFiles.length;
            requestHasMask = !!editData.maskFile;
            apiFormData.append('size', editSizeToSend);
            apiFormData.append('quality', editData.quality);

            editData.imageFiles.forEach((file, index) => {
                apiFormData.append(`image_${index}`, file, file.name);
            });
            if (editData.maskFile) {
                apiFormData.append('mask', editData.maskFile, editData.maskFile.name);
            }
        }

        setApiResponseInfo({
            status: 'loading',
            endpoint: '/api/images',
            method: 'POST',
            startedAt: startTime,
            mode,
            model: requestModel,
            size: requestSize,
            n: requestImageCount,
            stream: requestStreaming,
            partialImages: requestPartialImages,
            storageMode: effectiveStorageModeClient,
            streamingStats: requestStreaming
                ? {
                      partialImages: 0,
                      completedImages: 0,
                      doneReceived: false
                  }
                : undefined
        });

        try {
            const response = await fetch('/api/images', {
                method: 'POST',
                body: apiFormData
            });

            // Check if response is SSE (streaming)
            const contentType = response.headers.get('content-type');
            const responseKind = contentType?.includes('text/event-stream') ? 'event-stream' : 'json';
            setApiResponseInfo((current) =>
                current
                    ? {
                          ...current,
                          httpStatus: response.status,
                          contentType,
                          responseKind
                      }
                    : current
            );
            if (contentType?.includes('text/event-stream')) {
                if (!response.ok) {
                    throw new Error(t('page.apiRequestFailed', { status: response.status }));
                }
                if (!response.body) {
                    throw new Error(t('page.unexpectedError'));
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let hasSavedStreamingHistory = false;
                const streamedImages: Array<ApiImageResponseItem | undefined> = [];
                let streamingPartialImages = 0;
                let streamingCompletedImages = 0;
                let streamingDoneReceived = false;

                const fallbackOutputFormat = mode === 'generate' ? (formData as GenerationFormData).output_format : 'png';
                const historyPrompt = mode === 'generate' ? (formData as GenerationFormData).prompt : (formData as EditingFormData).prompt;

                const getOrderedStreamedImages = () =>
                    streamedImages.filter((image): image is ApiImageResponseItem => Boolean(image));

                const displayStreamingPreview = (event: {
                    b64_json?: string;
                    index?: number;
                    partial_image_index?: number;
                }) => {
                    if (!event.b64_json) return;

                    const previewFormat =
                        fallbackOutputFormat === 'jpeg' || fallbackOutputFormat === 'webp'
                            ? fallbackOutputFormat
                            : 'png';
                    const previewIndex = typeof event.index === 'number' ? event.index : 0;
                    const partialIndex =
                        typeof event.partial_image_index === 'number'
                            ? event.partial_image_index
                            : streamingPartialImages;
                    const previewPath = `data:${getMimeTypeFromFormat(previewFormat)};base64,${event.b64_json}`;

                    setLatestImageBatch([
                        {
                            filename: `streaming-preview-${previewIndex}-${partialIndex}.${previewFormat}`,
                            path: previewPath,
                            isStreamingPreview: true
                        }
                    ]);
                    setLatestBatchPrompt(historyPrompt);
                    setImageOutputView(0);
                };

                const updateStreamingStats = () => {
                    setApiResponseInfo((current) =>
                        current
                            ? {
                                  ...current,
                                  imageCount: getOrderedStreamedImages().length,
                                  filenames: getOrderedStreamedImages().map((image) => image.filename),
                                  streamingStats: {
                                      partialImages: streamingPartialImages,
                                      completedImages: streamingCompletedImages,
                                      doneReceived: streamingDoneReceived
                                  }
                              }
                            : current
                    );
                };

                const displayStreamingImages = async () => {
                    const processedImages = (await Promise.all(getOrderedStreamedImages().map(cacheApiImageForDisplay))).filter(
                        Boolean
                    ) as ImageBatchItem[];

                    if (processedImages.length > 0) {
                        setLatestImageBatch(processedImages);
                        setLatestBatchPrompt(historyPrompt);
                        setImageOutputView(0);
                    }
                };

                const normalizeStreamingImage = (image: Partial<ApiImageResponseItem>): ApiImageResponseItem | null => {
                    if (!image.filename) {
                        return null;
                    }

                    return {
                        filename: image.filename,
                        output_format: image.output_format || fallbackOutputFormat,
                        ...(image.b64_json ? { b64_json: image.b64_json } : {}),
                        ...(image.path ? { path: image.path } : {}),
                        ...(normalizeRevisedPrompt(image.revised_prompt)
                            ? { revised_prompt: normalizeRevisedPrompt(image.revised_prompt) }
                            : {})
                    };
                };

                const finalizeStreamingImages = async (
                    images: ApiImageResponseItem[],
                    revisedPromptFallback?: unknown,
                    usage?: ApiUsageForCost
                ) => {
                    if (hasSavedStreamingHistory) {
                        return;
                    }

                    const finalImages = images.length > 0 ? images : getOrderedStreamedImages();
                    if (finalImages.length === 0) {
                        throw new Error(t('page.apiNoImages'));
                    }

                    durationMs = Date.now() - startTime;

                    let historyQuality: GenerationFormData['quality'] = 'auto';
                    let historyBackground: GenerationFormData['background'] = 'auto';
                    let historyModeration: GenerationFormData['moderation'] = 'auto';
                    let historyOutputFormat: GenerationFormData['output_format'] = 'png';

                    if (mode === 'generate') {
                        const genData = formData as GenerationFormData;
                        historyQuality = genData.quality;
                        historyBackground = genData.background;
                        historyModeration = genData.moderation;
                        historyOutputFormat = genData.output_format;
                    } else {
                        const editData = formData as EditingFormData;
                        historyQuality = editData.quality;
                    }

                    const revisedPrompt = getBatchRevisedPrompt(finalImages, revisedPromptFallback);
                    const costDetails = calculateApiCost(usage, requestModel);

                    setApiResponseInfo((current) =>
                        current
                            ? {
                                  ...current,
                                  status: 'success',
                                  durationMs,
                                  imageCount: finalImages.length,
                                  filenames: finalImages.map((image) => image.filename),
                                  costUsd: costDetails?.estimated_cost_usd,
                                  streamingStats: {
                                      partialImages: streamingPartialImages,
                                      completedImages: streamingCompletedImages,
                                      doneReceived: streamingDoneReceived
                                  }
                              }
                            : current
                    );

                    const batchTimestamp = Date.now();
                    const newHistoryEntry: HistoryMetadata = {
                        timestamp: batchTimestamp,
                        images: finalImages.map((img) => ({
                            filename: img.filename,
                            ...(normalizeRevisedPrompt(img.revised_prompt)
                                ? { revisedPrompt: normalizeRevisedPrompt(img.revised_prompt) }
                                : {})
                        })),
                        storageModeUsed: effectiveStorageModeClient,
                        durationMs: durationMs,
                        quality: historyQuality,
                        background: historyBackground,
                        moderation: historyModeration,
                        output_format: historyOutputFormat,
                        prompt: historyPrompt,
                        revisedPrompt,
                        mode: mode,
                        costDetails: costDetails,
                        model: requestModel,
                        size: requestSize,
                        output_compression: requestOutputCompression,
                        streaming: requestStreaming,
                        partialImages: requestPartialImages,
                        sourceImageCount: requestSourceImageCount,
                        hasMask: requestHasMask
                    };

                    const processedImages = (await Promise.all(finalImages.map(cacheApiImageForDisplay))).filter(
                        Boolean
                    ) as ImageBatchItem[];

                    if (processedImages.length === 0) {
                        throw new Error(t('page.apiNoImages'));
                    }

                    setLatestImageBatch(processedImages);
                    setLatestBatchPrompt(historyPrompt);
                    setImageOutputView(0);
                    setHistory((prevHistory) => [newHistoryEntry, ...prevHistory]);
                    hasSavedStreamingHistory = true;
                };

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    // Process complete SSE events
                    const lines = buffer.split('\n\n');
                    buffer = lines.pop() || ''; // Keep incomplete event in buffer

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const jsonStr = line.slice(6);
                            try {
                                const event = JSON.parse(jsonStr);

                                if (event.type === 'partial_image') {
                                    streamingPartialImages += 1;
                                    displayStreamingPreview({
                                        b64_json: event.b64_json,
                                        index: event.index,
                                        partial_image_index: event.partial_image_index
                                    });
                                    updateStreamingStats();
                                    continue;
                                } else if (event.type === 'error') {
                                    const streamingError = typeof event.error === 'string' ? event.error : '';
                                    const streamingErrorText = streamingError.toLowerCase();
                                    const wasStreamInterrupted =
                                        event.error_code === 'stream_interrupted' ||
                                        isUpstreamConnectionErrorMessage(streamingErrorText);

                                    throw new Error(
                                        wasStreamInterrupted
                                            ? t('page.streamingInterrupted')
                                            : streamingError || t('page.streamingError')
                                    );
                                } else if (event.type === 'completed') {
                                    const completedImage = normalizeStreamingImage({
                                        filename: event.filename,
                                        b64_json: event.b64_json,
                                        output_format: event.output_format,
                                        path: event.path,
                                        revised_prompt: event.revised_prompt
                                    });

                                    if (completedImage) {
                                        const imageIndex =
                                            typeof event.index === 'number' ? event.index : streamedImages.length;
                                        streamedImages[imageIndex] = completedImage;
                                        streamingCompletedImages += 1;
                                        updateStreamingStats();
                                        await displayStreamingImages();
                                    }
                                } else if (event.type === 'done') {
                                    streamingDoneReceived = true;
                                    updateStreamingStats();
                                    const eventImages = Array.isArray(event.images)
                                        ? (event.images
                                              .map((image: Partial<ApiImageResponseItem>) =>
                                                  normalizeStreamingImage(image)
                                              )
                                              .filter(Boolean) as ApiImageResponseItem[])
                                        : [];

                                    await finalizeStreamingImages(eventImages, event.revised_prompt, event.usage);
                                }
                            } catch (parseError) {
                                console.error('Error parsing SSE event:', parseError);
                                throw parseError;
                            }
                        }
                    }
                }

                if (!hasSavedStreamingHistory && getOrderedStreamedImages().length > 0) {
                    await finalizeStreamingImages(getOrderedStreamedImages());
                }

                return; // Exit early for streaming
            }

            // Non-streaming response handling (original code)
            const result: ImageApiResult = await response.json();

            if (!response.ok) {
                if (response.status === 401 && isPasswordRequiredByBackend) {
                    setError(t('page.unauthorized'));
                    setApiResponseInfo((current) =>
                        current
                            ? {
                                  ...current,
                                  status: 'error',
                                  durationMs: Date.now() - startTime,
                                  error: t('page.unauthorized')
                              }
                            : current
                    );
                    setPasswordDialogContext('retry');
                    setLastApiCallArgs([formData]);
                    setIsPasswordDialogOpen(true);

                    return;
                }
                throw new Error(result.error || t('page.apiRequestFailed', { status: response.status }));
            }

            if (result.images && result.images.length > 0) {
                durationMs = Date.now() - startTime;

                let historyQuality: GenerationFormData['quality'] = 'auto';
                let historyBackground: GenerationFormData['background'] = 'auto';
                let historyModeration: GenerationFormData['moderation'] = 'auto';
                let historyOutputFormat: GenerationFormData['output_format'] = 'png';
                let historyPrompt: string = '';

                if (mode === 'generate') {
                    const genData = formData as GenerationFormData;
                    historyQuality = genData.quality;
                    historyBackground = genData.background;
                    historyModeration = genData.moderation;
                    historyOutputFormat = genData.output_format;
                    historyPrompt = genData.prompt;
                } else {
                    const editData = formData as EditingFormData;
                    historyQuality = editData.quality;
                    historyBackground = 'auto';
                    historyModeration = 'auto';
                    historyOutputFormat = 'png';
                    historyPrompt = editData.prompt;
                }

                const revisedPrompt = getBatchRevisedPrompt(result.images, result.revised_prompt);
                const costDetails = calculateApiCost(result.usage, requestModel);
                setApiResponseInfo((current) =>
                    current
                        ? {
                              ...current,
                              status: 'success',
                              durationMs,
                              imageCount: result.images?.length ?? 0,
                              filenames: result.images?.map((image) => image.filename) ?? [],
                              costUsd: costDetails?.estimated_cost_usd
                          }
                        : current
                );

                const batchTimestamp = Date.now();
                const newHistoryEntry: HistoryMetadata = {
                    timestamp: batchTimestamp,
                    images: result.images.map((img) => ({
                        filename: img.filename,
                        ...(normalizeRevisedPrompt(img.revised_prompt)
                            ? { revisedPrompt: normalizeRevisedPrompt(img.revised_prompt) }
                            : {})
                    })),
                    storageModeUsed: effectiveStorageModeClient,
                    durationMs: durationMs,
                    quality: historyQuality,
                    background: historyBackground,
                    moderation: historyModeration,
                    output_format: historyOutputFormat,
                    prompt: historyPrompt,
                    revisedPrompt,
                    mode: mode,
                    costDetails: costDetails,
                    model: requestModel,
                    size: requestSize,
                    output_compression: requestOutputCompression,
                    streaming: requestStreaming,
                    partialImages: requestPartialImages,
                    sourceImageCount: requestSourceImageCount,
                    hasMask: requestHasMask
                };

                const newImageBatchPromises = result.images.map((img: ApiImageResponseItem) =>
                    cacheApiImageForDisplay(img)
                );

                const processedImages = (await Promise.all(newImageBatchPromises)).filter(Boolean) as ImageBatchItem[];

                setLatestImageBatch(processedImages);
                setLatestBatchPrompt(historyPrompt);
                setImageOutputView(processedImages.length > 0 ? 0 : 'grid');

                setHistory((prevHistory) => [newHistoryEntry, ...prevHistory]);
            } else {
                setLatestImageBatch(null);
                setLatestBatchPrompt('');
                throw new Error(t('page.apiNoImages'));
            }
        } catch (err: unknown) {
            durationMs = Date.now() - startTime;
            console.error(`API Call Error after ${durationMs}ms:`, err);
            const rawErrorMessage = err instanceof Error ? err.message : '';
            const errorMessage = isUpstreamConnectionErrorMessage(rawErrorMessage)
                ? t('page.upstreamConnectionError')
                : rawErrorMessage || t('page.unexpectedError');
            setError(errorMessage);
            setApiResponseInfo((current) =>
                current
                    ? {
                          ...current,
                          status: 'error',
                          durationMs,
                          error: errorMessage
                      }
                    : current
            );
            setLatestImageBatch(null);
            setLatestBatchPrompt('');
        } finally {
            if (durationMs === 0) durationMs = Date.now() - startTime;
            setIsLoading(false);
            setActiveRequestStartedAt(null);
        }
    };

    const handleHistorySelect = React.useCallback(
        (item: HistoryMetadata, imageIndex = 0) => {
            const selectedBatchPromises = item.images.map(async (imgInfo) => {
                const originalStorageMode = item.storageModeUsed || 'fs';
                const path = getStoredImageSrc(imgInfo.filename, originalStorageMode);

                if (path) {
                    return { path, filename: imgInfo.filename, revisedPrompt: imgInfo.revisedPrompt };
                } else {
                    console.warn(
                        `Could not get image source for history item: ${imgInfo.filename} (mode: ${originalStorageMode})`
                    );
                    setError(t('page.historyImageLoadError', { filename: imgInfo.filename }));
                    return null;
                }
            });

            Promise.all(selectedBatchPromises).then((resolvedBatch) => {
                const validImages = resolvedBatch.filter(Boolean) as ImageBatchItem[];
                const selectedFilename = item.images[imageIndex]?.filename;
                const selectedValidIndex = selectedFilename
                    ? validImages.findIndex((image) => image.filename === selectedFilename)
                    : -1;

                if (validImages.length !== item.images.length) {
                    setError(t('page.historyImagesLoadSomeError'));
                } else {
                    setError(null);
                }

                setLatestImageBatch(validImages.length > 0 ? validImages : null);
                setLatestBatchPrompt(validImages.length > 0 ? item.prompt : '');
                setImageOutputView(validImages.length > 0 ? Math.max(0, selectedValidIndex) : 'grid');
            });
        },
        [getStoredImageSrc, t]
    );

    const handleClearHistory = React.useCallback(async () => {
        const confirmationMessage =
            effectiveStorageModeClient === 'indexeddb'
                ? t('history.clearConfirmIndexedDb')
                : t('history.clearConfirmFs');

        if (window.confirm(confirmationMessage)) {
            setHistory([]);
            setLatestImageBatch(null);
            setLatestBatchPrompt('');
            setImageOutputView('grid');
            setError(null);

            try {
                localStorage.removeItem('openaiImageHistory');

                await db.images.clear();
                blobUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
                blobUrlCacheRef.current.clear();
                setImageSrcByFilename({});
            } catch (e) {
                console.error('Failed during history clearing:', e);
                setError(t('page.clearHistoryError', { message: e instanceof Error ? e.message : String(e) }));
            }
        }
    }, [t]);

    const handleSendToEdit = async (filename: string) => {
        if (isSendingToEdit) return;
        setIsSendingToEdit(true);
        setError(null);

        const alreadyExists = editImageFiles.some((file) => file.name === filename);
        if (mode === 'edit' && alreadyExists) {
            setIsSendingToEdit(false);
            return;
        }

        if (mode === 'edit' && editImageFiles.length >= MAX_EDIT_IMAGES) {
            setError(t('page.editFormMaxImages', { maxImages: MAX_EDIT_IMAGES }));
            setIsSendingToEdit(false);
            return;
        }

        try {
            let blob: Blob | undefined;
            let mimeType: string = 'image/png';

            const localRecord = allDbImages?.find((img) => img.filename === filename);
            if (localRecord?.blob) {
                blob = localRecord.blob;
                mimeType = blob.type || mimeType;
            } else if (effectiveStorageModeClient === 'indexeddb') {
                throw new Error(t('page.imageNotFoundLocal', { filename }));
            } else {
                const response = await fetch(`/api/image/${filename}`);
                if (!response.ok) {
                    throw new Error(t('page.fetchImageFailed', { statusText: response.statusText }));
                }
                blob = await response.blob();
                mimeType = response.headers.get('Content-Type') || mimeType;
            }

            if (!blob) {
                throw new Error(t('page.retrieveImageFailed', { filename }));
            }

            const newFile = new File([blob], filename, { type: mimeType });
            const newPreviewUrl = URL.createObjectURL(blob);

            editSourceImagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));

            setEditImageFiles([newFile]);
            setEditSourceImagePreviewUrls([newPreviewUrl]);

            if (mode === 'generate') {
                setMode('edit');
            }
        } catch (err: unknown) {
            console.error('Error sending image to edit:', err);
            const errorMessage = err instanceof Error ? err.message : t('page.sendToEditError');
            setError(errorMessage);
        } finally {
            setIsSendingToEdit(false);
        }
    };

    const executeDeleteItem = React.useCallback(
        async (item: HistoryMetadata) => {
            if (!item) return;
            setError(null);

            const { images: imagesInEntry, storageModeUsed, timestamp } = item;
            const storageMode = storageModeUsed || 'fs';
            const filenamesToDelete = imagesInEntry.map((img) => img.filename);

            try {
                await db.images.where('filename').anyOf(filenamesToDelete).delete();
                filenamesToDelete.forEach((fn) => {
                    const url = blobUrlCacheRef.current.get(fn);
                    if (url) URL.revokeObjectURL(url);
                    blobUrlCacheRef.current.delete(fn);
                });
                setImageSrcByFilename((current) => {
                    const next = { ...current };
                    filenamesToDelete.forEach((filename) => {
                        delete next[filename];
                    });
                    return next;
                });

                if (storageMode === 'fs') {
                    const apiPayload: { filenames: string[]; passwordHash?: string } = {
                        filenames: filenamesToDelete
                    };
                    if (isPasswordRequiredByBackend && clientPasswordHash) {
                        apiPayload.passwordHash = clientPasswordHash;
                    }

                    const response = await fetch('/api/image-delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(apiPayload)
                    });

                    const result = await response.json();
                    if (!response.ok) {
                        throw new Error(result.error || t('page.deleteApiFailed', { status: response.status }));
                    }
                }

                setHistory((prevHistory) => prevHistory.filter((h) => h.timestamp !== timestamp));
                setLatestImageBatch((prev) =>
                    prev && prev.some((img) => filenamesToDelete.includes(img.filename)) ? null : prev
                );
            } catch (e: unknown) {
                console.error('Error during item deletion:', e);
                setError(e instanceof Error ? e.message : t('page.unexpectedDeleteError'));
            } finally {
                setItemToDeleteConfirm(null);
            }
        },
        [isPasswordRequiredByBackend, clientPasswordHash, t]
    );

    const handleRequestDeleteItem = React.useCallback(
        (item: HistoryMetadata) => {
            if (!skipDeleteConfirmation) {
                setDialogCheckboxStateSkipConfirm(skipDeleteConfirmation);
                setItemToDeleteConfirm(item);
            } else {
                executeDeleteItem(item);
            }
        },
        [skipDeleteConfirmation, executeDeleteItem]
    );

    const handleConfirmDeletion = React.useCallback(() => {
        if (itemToDeleteConfirm) {
            executeDeleteItem(itemToDeleteConfirm);
            setSkipDeleteConfirmation(dialogCheckboxStateSkipConfirm);
        }
    }, [itemToDeleteConfirm, executeDeleteItem, dialogCheckboxStateSkipConfirm]);

    const handleCancelDeletion = React.useCallback(() => {
        setItemToDeleteConfirm(null);
    }, []);

    const apiInfoStatusLabel =
        apiResponseInfo?.status === 'loading'
            ? t('apiInfo.statusLoading')
            : apiResponseInfo?.status === 'success'
              ? t('apiInfo.statusSuccess')
              : apiResponseInfo?.status === 'error'
                ? t('apiInfo.statusError')
                : '-';
    const apiInfoStatusClass =
        apiResponseInfo?.status === 'success'
            ? 'border-emerald-300/40 bg-emerald-400/10 text-emerald-300'
            : apiResponseInfo?.status === 'error'
              ? 'border-red-400/40 bg-red-500/10 text-red-300'
              : 'border-blue-300/40 bg-blue-400/10 text-blue-300';
    const apiInfoDuration =
        apiResponseInfo?.status === 'loading'
            ? formatApiDuration(Date.now() - apiResponseInfo.startedAt)
            : formatApiDuration(apiResponseInfo?.durationMs);
    const apiInfoRows: Array<[string, string]> = apiResponseInfo
        ? [
              [t('apiInfo.status'), apiInfoStatusLabel],
              [
                  t('apiInfo.httpStatus'),
                  apiResponseInfo.httpStatus ? `${apiResponseInfo.httpStatus}` : '-'
              ],
              [t('apiInfo.duration'), apiInfoDuration],
              [t('apiInfo.responseType'), apiResponseInfo.responseKind || formatContentType(apiResponseInfo.contentType)],
              [t('apiInfo.endpoint'), `${apiResponseInfo.method} ${apiResponseInfo.endpoint}`],
              [t('common.model'), apiResponseInfo.model],
              [t('common.size'), apiResponseInfo.size || '-'],
              [t('history.imageCount'), `${apiResponseInfo.n}`],
              [t('apiInfo.streaming'), apiResponseInfo.stream ? t('common.yes') : t('common.no')],
              [t('apiInfo.storage'), apiResponseInfo.storageMode],
              [
                  t('apiInfo.imageCount'),
                  apiResponseInfo.imageCount === undefined ? '-' : `${apiResponseInfo.imageCount}`
              ],
              [
                  t('apiInfo.cost'),
                  apiResponseInfo.costUsd === undefined ? '-' : formatUsdCny(apiResponseInfo.costUsd)
              ]
          ]
        : [];

    if (apiResponseInfo?.stream) {
        apiInfoRows.push(
            [
                t('apiInfo.partialImages'),
                `${apiResponseInfo.streamingStats?.partialImages ?? 0}${
                    apiResponseInfo.partialImages ? ` / ${apiResponseInfo.partialImages}` : ''
                }`
            ],
            [t('apiInfo.completedImages'), `${apiResponseInfo.streamingStats?.completedImages ?? 0}`]
        );
    }

    return (
        <main className='min-h-screen bg-black p-3 text-white md:p-4 lg:h-screen lg:overflow-hidden'>
            <PasswordDialog
                isOpen={isPasswordDialogOpen}
                onOpenChange={setIsPasswordDialogOpen}
                onSave={handleSavePassword}
                title={passwordDialogContext === 'retry' ? t('page.passwordRequired') : t('page.configurePassword')}
                description={
                    passwordDialogContext === 'retry'
                        ? t('page.passwordRequiredDescription')
                        : t('page.setPasswordDescription')
                }
            />
            <div className='flex min-h-screen w-full flex-col gap-3 lg:h-full lg:min-h-0'>
                <header className='shrink-0 rounded-lg border border-white/10 bg-black/95 px-4 py-3 shadow-sm'>
                    <div className='flex flex-col gap-3'>
                        <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
                            <div className='min-w-0'>
                                <p className='text-xs font-medium tracking-[0.16em] text-white/45 uppercase'>
                                    {t('home.kicker')}
                                </p>
                                <h1 className='mt-0.5 truncate text-2xl font-semibold text-white'>{t('home.title')}</h1>
                            </div>

                            <div className='flex shrink-0 items-center gap-2 md:justify-end'>
                                <Languages className='h-4 w-4 text-white/45' />
                                <Select
                                    value={languagePreference}
                                    onValueChange={(value) => setLanguagePreference(value as LanguagePreference)}>
                                    <SelectTrigger
                                        aria-label={t('settings.languageAria')}
                                        className='h-8 w-[132px] border-white/20 bg-black text-sm text-white focus:border-white/50 focus:ring-white/50'>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className='border-white/20 bg-black text-white'>
                                        <SelectItem value='system' className='focus:bg-white/10'>
                                            {t('settings.system')}
                                        </SelectItem>
                                        <SelectItem value='en' className='focus:bg-white/10'>
                                            {t('settings.english')}
                                        </SelectItem>
                                        <SelectItem value='zh' className='focus:bg-white/10'>
                                            {t('settings.chinese')}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='icon'
                                    onClick={handleThemeToggle}
                                    className='h-8 w-8 border-white/20 text-white/75 hover:bg-white/10 hover:text-white'
                                    aria-label={t('home.toggleTheme')}>
                                    {currentTheme === 'dark' ? (
                                        <Moon className='h-4 w-4' />
                                    ) : (
                                        <Sun className='h-4 w-4' />
                                    )}
                                </Button>
                            </div>
                        </div>

                        <div className='grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(220px,0.85fr)_minmax(220px,0.85fr)_minmax(340px,1.3fr)] xl:items-start'>
                            <div className='min-w-0'>
                                <Label
                                    htmlFor='home-api-base-url'
                                    className='mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/70'>
                                    <Globe2 className='h-3.5 w-3.5' />
                                    {t('settings.baseUrl')}
                                </Label>
                                <Input
                                    id='home-api-base-url'
                                    type='url'
                                    value={baseUrlDraft}
                                    onChange={(event) => handleBaseUrlChange(event.target.value)}
                                    placeholder={t('settings.baseUrlPlaceholder')}
                                    className='h-9 border-white/20 bg-black text-white placeholder:text-white/35 focus:border-white/50 focus:ring-white/50'
                                />
                            </div>

                            <div ref={modelMenuRef} className='relative min-w-0'>
                                <Label
                                    htmlFor='home-model'
                                    className='mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/70'>
                                    <Cpu className='h-3.5 w-3.5' />
                                    {t('common.model')}
                                </Label>
                                <div className='flex gap-2'>
                                    <Input
                                        id='home-model'
                                        value={modelDraft}
                                        onChange={(event) => {
                                            handleModelChange(event.target.value);
                                            setIsModelMenuOpen(true);
                                        }}
                                        onFocus={() => setIsModelMenuOpen(true)}
                                        onBlur={(event) => {
                                            const nextFocusedElement = event.relatedTarget;
                                            if (
                                                nextFocusedElement &&
                                                modelMenuRef.current?.contains(nextFocusedElement)
                                            ) {
                                                return;
                                            }

                                            saveModelChoice(modelDraft);
                                        }}
                                        placeholder={t('settings.modelPlaceholder')}
                                        className='h-9 border-white/20 bg-black text-white placeholder:text-white/35 focus:border-white/50 focus:ring-white/50'
                                    />
                                    <Button
                                        type='button'
                                        variant='outline'
                                        size='icon'
                                        onClick={() => {
                                            setIsModelMenuOpen((current) => !current);
                                            fetchModelOptions();
                                        }}
                                        className='h-9 w-9 border-white/20 text-white/75 hover:bg-white/10 hover:text-white'
                                        aria-label={t('settings.models')}>
                                        {isFetchingModels ? (
                                            <Loader2 className='h-4 w-4 animate-spin' />
                                        ) : (
                                            <ChevronDown className='h-4 w-4' />
                                        )}
                                    </Button>
                                </div>
                                {isModelMenuOpen && (
                                    <div className='absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-white/20 bg-black p-1 text-sm text-white shadow-lg'>
                                        {isFetchingModels && (
                                            <div className='flex items-center gap-2 px-2 py-2 text-xs text-white/50'>
                                                <Loader2 className='h-3.5 w-3.5 animate-spin' />
                                                {t('settings.modelsLoading')}
                                            </div>
                                        )}
                                        {!isFetchingModels &&
                                            filteredModelOptions.map((model) => (
                                                <button
                                                    key={model}
                                                    type='button'
                                                    onMouseDown={(event) => event.preventDefault()}
                                                    onClick={() => {
                                                        handleModelSelect(model);
                                                        setIsModelMenuOpen(false);
                                                    }}
                                                    className='block w-full rounded px-2 py-1.5 text-left text-white/80 hover:bg-white/10 hover:text-white'>
                                                    {model}
                                                </button>
                                            ))}
                                        {!isFetchingModels && filteredModelOptions.length === 0 && (
                                            <div className='px-2 py-2 text-xs text-white/45'>
                                                {modelFetchError || t('settings.noModelsFound')}
                                            </div>
                                        )}
                                        {!isFetchingModels && filteredModelOptions.length > 0 && modelFetchError && (
                                            <div className='border-t border-white/10 px-2 py-1.5 text-xs text-yellow-300/80'>
                                                {modelFetchError}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className='min-w-0 md:col-span-2 xl:col-span-1'>
                                <Label
                                    htmlFor='home-api-key'
                                    className='mb-1.5 flex items-center gap-1.5 text-xs font-medium text-white/70'>
                                    <KeyRound className='h-3.5 w-3.5' />
                                    {t('settings.apiKey')}
                                </Label>
                                <div className='flex gap-2'>
                                    <Input
                                        id='home-api-key'
                                        type={showApiKey ? 'text' : 'password'}
                                        value={apiKeyDraft}
                                        onChange={(event) => handleApiKeyChange(event.target.value)}
                                        placeholder={t('settings.apiKeyPlaceholder')}
                                        className='h-9 border-white/20 bg-black text-white placeholder:text-white/35 focus:border-white/50 focus:ring-white/50'
                                    />
                                    <Button
                                        type='button'
                                        variant='outline'
                                        size='icon'
                                        onClick={() => setShowApiKey((current) => !current)}
                                        className='h-9 w-9 border-white/20 text-white/75 hover:bg-white/10 hover:text-white'
                                        aria-label={showApiKey ? t('home.hideApiKey') : t('home.showApiKey')}>
                                        {showApiKey ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                                    </Button>
                                    <Button
                                        asChild={Boolean(tokenConsoleUrl)}
                                        type='button'
                                        variant='outline'
                                        disabled={!tokenConsoleUrl}
                                        className='h-9 shrink-0 border-white/20 px-2.5 text-xs text-white/75 hover:bg-white/10 hover:text-white'>
                                        {tokenConsoleUrl ? (
                                            <a
                                                href={tokenConsoleUrl}
                                                target='_blank'
                                                rel='noreferrer'
                                                aria-label={t('home.getApiKeyAria')}>
                                                <ExternalLink className='h-3.5 w-3.5' />
                                                {t('home.getApiKey')}
                                            </a>
                                        ) : (
                                            <>
                                                <ExternalLink className='h-3.5 w-3.5' />
                                                {t('home.getApiKey')}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className='flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 pt-2'>
                            <p className='flex min-h-4 items-center gap-1.5 text-xs text-white/45'>
                                {baseUrlDraft.trim() && <CheckCircle2 className='h-3.5 w-3.5 text-green-400' />}
                                {t('settings.baseUrlHelp')}
                            </p>
                            <p className='flex min-h-4 items-center gap-1.5 text-xs text-white/45'>
                                {selectedModel.trim() && <CheckCircle2 className='h-3.5 w-3.5 text-green-400' />}
                                {t('home.modelHelp')}
                            </p>
                            <p className='flex min-h-4 items-center gap-1.5 text-xs text-white/45'>
                                {apiKeyDraft.trim() && <CheckCircle2 className='h-3.5 w-3.5 text-green-400' />}
                                {t('home.apiKeyHelp')}
                            </p>
                        </div>
                    </div>
                </header>

                <div className='grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(340px,420px)_minmax(300px,1fr)_minmax(280px,320px)] lg:overflow-hidden xl:grid-cols-[minmax(420px,520px)_minmax(420px,1fr)_minmax(320px,360px)] 2xl:grid-cols-[minmax(500px,620px)_minmax(480px,1fr)_minmax(360px,400px)]'>
                    <section className='relative flex min-h-[620px] flex-col lg:min-h-0 lg:overflow-hidden'>
                        <div className={mode === 'generate' ? 'block h-full w-full' : 'hidden'}>
                            <GenerationForm
                                onSubmit={handleApiCall}
                                isLoading={isLoading}
                                currentMode={mode}
                                onModeChange={setMode}
                                isPasswordRequiredByBackend={isPasswordRequiredByBackend}
                                clientPasswordHash={clientPasswordHash}
                                onOpenPasswordDialog={handleOpenPasswordDialog}
                                model={selectedModel}
                                prompt={genPrompt}
                                setPrompt={setGenPrompt}
                                n={genN}
                                setN={setGenN}
                                size={genSize}
                                setSize={setGenSize}
                                customWidth={genCustomWidth}
                                setCustomWidth={setGenCustomWidth}
                                customHeight={genCustomHeight}
                                setCustomHeight={setGenCustomHeight}
                                quality={genQuality}
                                setQuality={setGenQuality}
                                outputFormat={genOutputFormat}
                                setOutputFormat={setGenOutputFormat}
                                compression={genCompression}
                                setCompression={setGenCompression}
                                background={genBackground}
                                setBackground={setGenBackground}
                                moderation={genModeration}
                                setModeration={setGenModeration}
                            />
                        </div>
                        <div className={mode === 'edit' ? 'block h-full w-full' : 'hidden'}>
                            <EditingForm
                                onSubmit={handleApiCall}
                                isLoading={isLoading || isSendingToEdit}
                                currentMode={mode}
                                onModeChange={setMode}
                                isPasswordRequiredByBackend={isPasswordRequiredByBackend}
                                clientPasswordHash={clientPasswordHash}
                                onOpenPasswordDialog={handleOpenPasswordDialog}
                                editModel={selectedModel}
                                imageFiles={editImageFiles}
                                sourceImagePreviewUrls={editSourceImagePreviewUrls}
                                setImageFiles={setEditImageFiles}
                                setSourceImagePreviewUrls={setEditSourceImagePreviewUrls}
                                maxImages={MAX_EDIT_IMAGES}
                                editPrompt={editPrompt}
                                setEditPrompt={setEditPrompt}
                                editN={editN}
                                setEditN={setEditN}
                                editSize={editSize}
                                setEditSize={setEditSize}
                                editCustomWidth={editCustomWidth}
                                setEditCustomWidth={setEditCustomWidth}
                                editCustomHeight={editCustomHeight}
                                setEditCustomHeight={setEditCustomHeight}
                                editQuality={editQuality}
                                setEditQuality={setEditQuality}
                                editBrushSize={editBrushSize}
                                setEditBrushSize={setEditBrushSize}
                                editShowMaskEditor={editShowMaskEditor}
                                setEditShowMaskEditor={setEditShowMaskEditor}
                                editGeneratedMaskFile={editGeneratedMaskFile}
                                setEditGeneratedMaskFile={setEditGeneratedMaskFile}
                                editIsMaskSaved={editIsMaskSaved}
                                setEditIsMaskSaved={setEditIsMaskSaved}
                                editOriginalImageSize={editOriginalImageSize}
                                setEditOriginalImageSize={setEditOriginalImageSize}
                                editDrawnPoints={editDrawnPoints}
                                setEditDrawnPoints={setEditDrawnPoints}
                                editMaskPreviewUrl={editMaskPreviewUrl}
                                setEditMaskPreviewUrl={setEditMaskPreviewUrl}
                            />
                        </div>
                    </section>

                    <section className='flex min-h-[520px] flex-col lg:min-h-0 lg:overflow-hidden'>
                        {error && (
                            <Alert variant='destructive' className='mb-3 border-red-500/50 bg-red-900/20 text-red-300'>
                                <AlertTitle className='text-red-200'>{t('common.error')}</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <div className='mb-3 shrink-0 rounded-lg border border-white/10 bg-black/95'>
                            <button
                                type='button'
                                onClick={() => setShowApiResponseInfo((current) => !current)}
                                className='flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5'>
                                <span className='flex min-w-0 items-center gap-2'>
                                    <ChevronDown
                                        className={`h-4 w-4 shrink-0 transition-transform ${
                                            showApiResponseInfo ? 'rotate-180' : ''
                                        }`}
                                    />
                                    <span className='font-medium'>{t('apiInfo.toggle')}</span>
                                    {apiResponseInfo && (
                                        <span
                                            className={`rounded-full border px-2 py-0.5 text-[11px] ${apiInfoStatusClass}`}>
                                            {apiInfoStatusLabel}
                                        </span>
                                    )}
                                </span>
                                <span className='shrink-0 text-xs text-white/45'>{apiInfoDuration}</span>
                            </button>

                            {showApiResponseInfo && (
                                <div className='border-t border-white/10 p-3'>
                                    {!apiResponseInfo ? (
                                        <p className='text-xs text-white/45'>{t('apiInfo.empty')}</p>
                                    ) : (
                                        <div className='space-y-3'>
                                            <div className='grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-3'>
                                                {apiInfoRows.map(([label, value]) => (
                                                    <div
                                                        key={label}
                                                        className='min-w-0 rounded-md border border-white/10 bg-white/[0.035] px-2 py-1.5'>
                                                        <p className='truncate text-white/40'>{label}</p>
                                                        <p className='mt-0.5 truncate font-medium text-white/80'>
                                                            {value}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                            {apiResponseInfo.filenames && apiResponseInfo.filenames.length > 0 && (
                                                <div className='rounded-md border border-white/10 bg-white/[0.035] px-2 py-1.5 text-xs'>
                                                    <p className='mb-1 text-white/40'>{t('apiInfo.files')}</p>
                                                    <div className='flex flex-wrap gap-1.5'>
                                                        {apiResponseInfo.filenames.map((filename) => (
                                                            <span
                                                                key={filename}
                                                                className='rounded border border-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white/70'>
                                                                {filename}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {apiResponseInfo.error && (
                                                <div className='rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-200'>
                                                    {apiResponseInfo.error}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className='min-h-0 flex-1'>
                            <ImageOutput
                                imageBatch={latestImageBatch}
                                promptText={latestBatchPrompt}
                                viewMode={imageOutputView}
                                onViewChange={setImageOutputView}
                                altText={t('output.generatedAlt')}
                                isLoading={isLoading || isSendingToEdit}
                                elapsedSeconds={elapsedSeconds}
                                onSendToEdit={handleSendToEdit}
                                currentMode={mode}
                                baseImagePreviewUrl={editSourceImagePreviewUrls[0] || null}
                            />
                        </div>
                    </section>

                    <section className='min-h-[480px] lg:min-h-0 lg:overflow-hidden'>
                        <HistoryPanel
                            history={history}
                            onSelectImage={handleHistorySelect}
                            onClearHistory={handleClearHistory}
                            getImageSrc={getStoredImageSrc}
                            onDeleteItemRequest={handleRequestDeleteItem}
                            itemPendingDeleteConfirmation={itemToDeleteConfirm}
                            onConfirmDeletion={handleConfirmDeletion}
                            onCancelDeletion={handleCancelDeletion}
                            deletePreferenceDialogValue={dialogCheckboxStateSkipConfirm}
                            onDeletePreferenceDialogChange={setDialogCheckboxStateSkipConfirm}
                        />
                    </section>
                </div>
            </div>
        </main>
    );
}
