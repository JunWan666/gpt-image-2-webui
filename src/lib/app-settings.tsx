'use client';

import * as React from 'react';

export const defaultModelIds = ['gpt-image-2'];
const legacyDefaultModelIds = ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'];

export type AppSettings = {
    baseUrl: string;
    apiKey: string;
    models: string[];
};

type AppSettingsContextValue = {
    settings: AppSettings;
    modelOptions: string[];
    saveSettings: (settings: AppSettings) => void;
    resetSettings: () => void;
};

const storageKey = 'gptImageAppSettings';

const defaultSettings: AppSettings = {
    baseUrl: '',
    apiKey: '',
    models: defaultModelIds
};

const AppSettingsContext = React.createContext<AppSettingsContextValue | null>(null);

function normalizeModels(models: string[]): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const model of models) {
        const trimmedModel = model.trim();
        if (!trimmedModel || seen.has(trimmedModel)) continue;

        seen.add(trimmedModel);
        normalized.push(trimmedModel);
    }

    const withoutIncompletePrefixes = normalized.filter((model) => {
        if (legacyDefaultModelIds.includes(model)) return true;

        const looksIncomplete = model.endsWith('-') || !/\d/.test(model);
        if (!looksIncomplete) return true;

        return !normalized.some((otherModel) => otherModel !== model && otherModel.startsWith(model));
    });

    return withoutIncompletePrefixes.length > 0 ? withoutIncompletePrefixes : defaultModelIds;
}

function isLegacyDefaultModels(models: string[]): boolean {
    return (
        models.length === legacyDefaultModelIds.length &&
        legacyDefaultModelIds.every((model, index) => models[index] === model)
    );
}

function normalizeSettings(settings: Partial<AppSettings> | null | undefined): AppSettings {
    const rawModels = settings?.models ?? defaultModelIds;

    return {
        baseUrl: settings?.baseUrl?.trim() ?? '',
        apiKey: settings?.apiKey?.trim() ?? '',
        models: isLegacyDefaultModels(rawModels) ? defaultModelIds : normalizeModels(rawModels)
    };
}

function loadSettings(): AppSettings {
    if (typeof window === 'undefined') return defaultSettings;

    try {
        const storedSettings = window.localStorage.getItem(storageKey);
        if (!storedSettings) return defaultSettings;

        return normalizeSettings(JSON.parse(storedSettings) as Partial<AppSettings>);
    } catch (error) {
        console.warn('Failed to load app settings from localStorage:', error);
        return defaultSettings;
    }
}

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = React.useState<AppSettings>(defaultSettings);

    React.useEffect(() => {
        const loadedSettings = loadSettings();
        setSettings(loadedSettings);
        window.localStorage.setItem(storageKey, JSON.stringify(loadedSettings));
    }, []);

    React.useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key === storageKey) {
                setSettings(loadSettings());
            }
        };

        const syncSettings = () => {
            setSettings(loadSettings());
        };

        const syncWhenVisible = () => {
            if (!document.hidden) {
                syncSettings();
            }
        };

        window.addEventListener('storage', handleStorage);
        window.addEventListener('pageshow', syncSettings);
        window.addEventListener('focus', syncSettings);
        document.addEventListener('visibilitychange', syncWhenVisible);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('pageshow', syncSettings);
            window.removeEventListener('focus', syncSettings);
            document.removeEventListener('visibilitychange', syncWhenVisible);
        };
    }, []);

    const saveSettings = React.useCallback((nextSettings: AppSettings) => {
        const normalizedSettings = normalizeSettings(nextSettings);
        setSettings(normalizedSettings);
        window.localStorage.setItem(storageKey, JSON.stringify(normalizedSettings));
    }, []);

    const resetSettings = React.useCallback(() => {
        setSettings(defaultSettings);
        window.localStorage.setItem(storageKey, JSON.stringify(defaultSettings));
    }, []);

    const value = React.useMemo(
        () => ({
            settings,
            modelOptions: normalizeModels(settings.models),
            saveSettings,
            resetSettings
        }),
        [settings, saveSettings, resetSettings]
    );

    return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
    const context = React.useContext(AppSettingsContext);
    if (!context) {
        throw new Error('useAppSettings must be used within AppSettingsProvider.');
    }

    return context;
}
