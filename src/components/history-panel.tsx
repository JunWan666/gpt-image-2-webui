'use client';

import type { HistoryMetadata } from '@/app/page';
import { SiteValueComparison } from '@/components/site-value-comparison';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose
} from '@/components/ui/dialog';
import { formatUsdCny, USD_TO_CNY_RATE } from '@/lib/cost-utils';
import { formatOptionLabel, useI18n } from '@/lib/i18n';
import { getServerImageExpiryStatus } from '@/lib/image-retention';
import { cn } from '@/lib/utils';
import {
    Clock,
    Layers,
    Pencil,
    Sparkles as SparklesIcon,
    HardDrive,
    Database,
    FileImage,
    Trash2,
    Download
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import * as React from 'react';

type HistoryPanelProps = {
    history: HistoryMetadata[];
    onSelectImage: (item: HistoryMetadata, imageIndex?: number) => void;
    onClearHistory: () => void;
    getImageSrc: (filename: string, storageMode: 'fs' | 'indexeddb') => string | undefined;
    onDeleteItemRequest: (item: HistoryMetadata) => void;
    itemPendingDeleteConfirmation: HistoryMetadata | null;
    onConfirmDeletion: () => void;
    onCancelDeletion: () => void;
    deletePreferenceDialogValue: boolean;
    onDeletePreferenceDialogChange: (isChecked: boolean) => void;
};

const formatDuration = (ms: number): string => {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
};

const visibleHistoryImages = 8;

function HistoryPanelImpl({
    history,
    onSelectImage,
    onClearHistory,
    getImageSrc,
    onDeleteItemRequest,
    itemPendingDeleteConfirmation,
    onConfirmDeletion,
    onCancelDeletion,
    deletePreferenceDialogValue,
    onDeletePreferenceDialogChange
}: HistoryPanelProps) {
    const { language, t } = useI18n();
    const [isTotalCostDialogOpen, setIsTotalCostDialogOpen] = React.useState(false);
    const [now, setNow] = React.useState(() => Date.now());

    React.useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    const { totalCost, totalImages } = React.useMemo(() => {
        let cost = 0;
        let images = 0;
        history.forEach((item) => {
            if (item.costDetails) {
                cost += item.costDetails.estimated_cost_usd;
            }
            images += item.images?.length ?? 0;
        });

        return { totalCost: Math.round(cost * 10000) / 10000, totalImages: images };
    }, [history]);

    const averageCost = totalImages > 0 ? totalCost / totalImages : 0;

    return (
        <Card className='flex h-full w-full flex-col overflow-hidden rounded-lg border border-white/10 bg-black'>
            <CardHeader className='flex flex-row items-center justify-between gap-4 border-b border-white/10 px-4 py-3'>
                <div className='flex items-center gap-2'>
                    <CardTitle className='text-lg font-medium text-white'>{t('history.title')}</CardTitle>
                    {totalCost > 0 && (
                        <Dialog open={isTotalCostDialogOpen} onOpenChange={setIsTotalCostDialogOpen}>
                            <DialogTrigger asChild>
                                <button
                                    className='mt-0.5 flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[12px] font-medium text-emerald-900 transition-colors hover:bg-emerald-200 dark:bg-green-600/80 dark:text-white dark:hover:bg-green-500/90'
                                    aria-label={t('history.showTotalCostAria')}>
                                    {t('history.totalCost', { cost: formatUsdCny(totalCost) })}
                                </button>
                            </DialogTrigger>
                            <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-[450px]'>
                                <DialogHeader>
                                    <DialogTitle className='text-white'>{t('history.totalCostSummary')}</DialogTitle>
                                    {/* Add sr-only description for accessibility */}
                                    <DialogDescription className='sr-only'>
                                        {t('history.totalCostSummaryDescription')}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className='space-y-1 pt-1 text-xs text-neutral-400'>
                                    <p className='font-medium'>gpt-image-2:</p>
                                    <ul className='list-disc pl-4'>
                                        <li>
                                            {t('history.textInput')}: $5 / {t('history.tokensUnit')}
                                        </li>
                                        <li>
                                            {t('history.imageInput')}: $8 / {t('history.tokensUnit')}
                                        </li>
                                        <li>
                                            {t('history.imageOutput')}: $30 / {t('history.tokensUnit')}
                                        </li>
                                    </ul>
                                    <p className='mt-2 font-medium'>gpt-image-1.5:</p>
                                    <ul className='list-disc pl-4'>
                                        <li>
                                            {t('history.textInput')}: $5 / {t('history.tokensUnit')}
                                        </li>
                                        <li>
                                            {t('history.imageInput')}: $8 / {t('history.tokensUnit')}
                                        </li>
                                        <li>
                                            {t('history.imageOutput')}: $32 / {t('history.tokensUnit')}
                                        </li>
                                    </ul>
                                    <p className='mt-2 font-medium'>gpt-image-1:</p>
                                    <ul className='list-disc pl-4'>
                                        <li>
                                            {t('history.textInput')}: $5 / {t('history.tokensUnit')}
                                        </li>
                                        <li>
                                            {t('history.imageInput')}: $10 / {t('history.tokensUnit')}
                                        </li>
                                        <li>
                                            {t('history.imageOutput')}: $40 / {t('history.tokensUnit')}
                                        </li>
                                    </ul>
                                    <p className='mt-2 font-medium'>gpt-image-1-mini:</p>
                                    <ul className='list-disc pl-4'>
                                        <li>
                                            {t('history.textInput')}: $2 / {t('history.tokensUnit')}
                                        </li>
                                        <li>
                                            {t('history.imageInput')}: $2.50 / {t('history.tokensUnit')}
                                        </li>
                                        <li>
                                            {t('history.imageOutput')}: $8 / {t('history.tokensUnit')}
                                        </li>
                                    </ul>
                                </div>
                                <div className='space-y-2 py-4 text-sm text-neutral-300'>
                                    <div className='flex justify-between'>
                                        <span>{t('history.totalImagesGenerated')}</span>{' '}
                                        <span>{totalImages.toLocaleString()}</span>
                                    </div>
                                    <div className='flex justify-between'>
                                        <span>{t('history.averageCostPerImage')}</span>{' '}
                                        <span>{formatUsdCny(averageCost)}</span>
                                    </div>
                                    <hr className='my-2 border-neutral-700' />
                                    <div className='flex justify-between font-medium text-white'>
                                        <span>{t('history.totalEstimatedCost')}</span>
                                        <span>{formatUsdCny(totalCost)}</span>
                                    </div>
                                    <p className='pt-1 text-xs text-neutral-500'>
                                        {t('history.costCurrencyNote', { rate: USD_TO_CNY_RATE })}
                                    </p>
                                    <SiteValueComparison officialUsdCost={totalCost} imageCount={totalImages} />
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button
                                            type='button'
                                            variant='secondary'
                                            size='sm'
                                            className='bg-neutral-700 text-neutral-200 hover:bg-neutral-600'>
                                            {t('common.close')}
                                        </Button>
                                    </DialogClose>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
                {history.length > 0 && (
                    <Button
                        variant='ghost'
                        size='sm'
                        onClick={onClearHistory}
                        className='h-auto rounded-md px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white'>
                        {t('common.clear')}
                    </Button>
                )}
            </CardHeader>
            <CardContent className='min-h-0 flex-1 overflow-y-auto p-2'>
                {history.length === 0 ? (
                    <div className='flex h-full items-center justify-center text-white/40'>
                        <p>{t('history.generatedImagesWillAppear')}</p>
                    </div>
                ) : (
                    <div className='space-y-2'>
                        {[...history].map((item) => {
                            const firstImage = item.images?.[0];
                            const imageCount = item.images?.length ?? 0;
                            const itemKey = item.timestamp;
                            const originalStorageMode = item.storageModeUsed || 'fs';
                            const outputFormat = item.output_format || 'png';
                            const generatedDate = new Date(item.timestamp).toLocaleString();
                            const detailHref = `/history/${item.timestamp}`;
                            const cost = item.costDetails?.estimated_cost_usd;
                            const expiryStatus = getServerImageExpiryStatus(item.timestamp, now, language);
                            const imagePreviews = item.images
                                .slice(0, visibleHistoryImages)
                                .map((imageInfo, index) => ({
                                    ...imageInfo,
                                    index,
                                    src: getImageSrc(imageInfo.filename, originalStorageMode)
                                }));
                            const firstPreview = imagePreviews[0];
                            const hiddenImageCount = Math.max(0, imageCount - imagePreviews.length);

                            return (
                                <article
                                    key={itemKey}
                                    className='rounded-md border border-white/10 bg-white/[0.035] p-2 transition-colors hover:border-white/20 hover:bg-white/[0.055]'>
                                    <div className='flex items-start justify-between gap-2'>
                                        <button
                                            type='button'
                                            onClick={() => onSelectImage(item, 0)}
                                            className='min-w-0 flex-1 text-left'
                                            aria-label={t('history.viewBatchAria', { date: generatedDate })}>
                                            <p className='truncate text-sm font-medium text-white/90'>
                                                {item.prompt || t('history.noPrompt')}
                                            </p>
                                            <p className='mt-0.5 truncate text-[11px] text-white/45'>{generatedDate}</p>
                                        </button>
                                        {cost !== undefined && (
                                            <span className='shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-transparent dark:bg-green-600/15 dark:text-green-300'>
                                                ${cost.toFixed(4)}
                                            </span>
                                        )}
                                    </div>

                                    <div className='mt-2 grid grid-cols-[repeat(auto-fill,minmax(54px,1fr))] gap-1.5'>
                                        {imagePreviews.map((imageInfo) => (
                                            <button
                                                key={imageInfo.filename}
                                                type='button'
                                                onClick={() => onSelectImage(item, imageInfo.index)}
                                                className='relative aspect-square overflow-hidden rounded-md border border-white/15 bg-neutral-900 focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black focus:outline-none'
                                                aria-label={t('history.viewImageAria', {
                                                    filename: imageInfo.filename
                                                })}>
                                                {imageInfo.src ? (
                                                    <Image
                                                        src={imageInfo.src}
                                                        alt={t('history.previewAlt', {
                                                            date: generatedDate
                                                        })}
                                                        fill
                                                        sizes='64px'
                                                        className='h-full w-full object-cover'
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <div className='flex h-full w-full items-center justify-center bg-neutral-800 text-neutral-500'>
                                                        ?
                                                    </div>
                                                )}
                                                {imageInfo.index === 0 && (
                                                    <div
                                                        className={cn(
                                                            'pointer-events-none absolute top-1 left-1 z-10 flex items-center rounded-full px-1 py-0.5 text-white',
                                                            item.mode === 'edit' ? 'bg-orange-600/80' : 'bg-blue-600/80'
                                                        )}>
                                                        {item.mode === 'edit' ? (
                                                            <Pencil size={10} />
                                                        ) : (
                                                            <SparklesIcon size={10} />
                                                        )}
                                                    </div>
                                                )}
                                                {hiddenImageCount > 0 &&
                                                    imageInfo.index === imagePreviews.length - 1 && (
                                                        <div className='pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/60 text-xs font-medium text-white'>
                                                            +{hiddenImageCount}
                                                        </div>
                                                    )}
                                            </button>
                                        ))}
                                    </div>

                                    <div className='mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-white/50'>
                                        <span className='flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5'>
                                            <Layers size={11} />
                                            {imageCount}
                                        </span>
                                        <span className='rounded border border-white/10 px-1.5 py-0.5'>
                                            {formatDuration(item.durationMs)}
                                        </span>
                                        <span className='rounded border border-white/10 px-1.5 py-0.5'>
                                            {item.size || '-'}
                                        </span>
                                        <span className='rounded border border-white/10 px-1.5 py-0.5'>
                                            {formatOptionLabel(item.quality, t)}
                                        </span>
                                        <span className='flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5'>
                                            {originalStorageMode === 'fs' ? (
                                                <HardDrive size={11} />
                                            ) : (
                                                <Database size={11} />
                                            )}
                                            {originalStorageMode === 'fs'
                                                ? t('history.storageFile')
                                                : t('history.storageDb')}
                                        </span>
                                        <span className='flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5'>
                                            <FileImage size={11} />
                                            {outputFormat.toUpperCase()}
                                        </span>
                                        <span
                                            className={cn(
                                                'flex items-center gap-1 rounded border px-1.5 py-0.5',
                                                expiryStatus.isExpired
                                                    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200'
                                                    : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-300/30 dark:bg-amber-300/10 dark:text-amber-100'
                                            )}>
                                            <Clock size={11} />
                                            {expiryStatus.isExpired
                                                ? t('history.serverExpiryExpired')
                                                : t('history.serverExpiryCountdownShort', {
                                                      time: expiryStatus.remainingText
                                                  })}
                                        </span>
                                    </div>

                                    <div className='mt-2 flex items-center gap-1.5'>
                                        <Button
                                            asChild
                                            variant='outline'
                                            size='sm'
                                            className='h-7 flex-1 border-white/20 px-2 py-1 text-xs text-white/70 hover:bg-white/10 hover:text-white'>
                                            <Link href={detailHref}>{t('history.showDetails')}</Link>
                                        </Button>
                                        {firstPreview?.src && firstImage && (
                                            <Button
                                                asChild
                                                variant='ghost'
                                                size='icon'
                                                className='h-7 w-7 rounded-md text-white/70 hover:bg-white/10 hover:text-white'>
                                                <a
                                                    href={firstPreview.src}
                                                    download={firstImage.filename}
                                                    aria-label={t('history.downloadImageAria', {
                                                        filename: firstImage.filename
                                                    })}>
                                                    <Download className='h-4 w-4' />
                                                </a>
                                            </Button>
                                        )}
                                        <Dialog
                                            open={itemPendingDeleteConfirmation?.timestamp === item.timestamp}
                                            onOpenChange={(isOpen) => {
                                                if (!isOpen) onCancelDeletion();
                                            }}>
                                            <DialogTrigger asChild>
                                                <Button
                                                    className='h-7 w-7 bg-red-700/60 text-white hover:bg-red-600/60'
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeleteItemRequest(item);
                                                    }}
                                                    aria-label={t('history.deleteHistoryItemAria')}>
                                                    <Trash2 size={14} />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className='border-neutral-700 bg-neutral-900 text-white sm:max-w-md'>
                                                <DialogHeader>
                                                    <DialogTitle className='text-white'>
                                                        {t('history.confirmDeletion')}
                                                    </DialogTitle>
                                                    <DialogDescription className='pt-2 text-neutral-300'>
                                                        {t('history.confirmDeleteDescription', {
                                                            count: item.images.length
                                                        })}
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className='flex items-center space-x-2 py-2'>
                                                    <Checkbox
                                                        id={`dont-ask-${item.timestamp}`}
                                                        checked={deletePreferenceDialogValue}
                                                        onCheckedChange={(checked) =>
                                                            onDeletePreferenceDialogChange(!!checked)
                                                        }
                                                        className='border-neutral-400 bg-white data-[state=checked]:border-neutral-700 data-[state=checked]:bg-white data-[state=checked]:text-black dark:border-neutral-500 dark:!bg-white'
                                                    />
                                                    <label
                                                        htmlFor={`dont-ask-${item.timestamp}`}
                                                        className='text-sm leading-none font-medium text-neutral-300 peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
                                                        {t('history.dontAskAgain')}
                                                    </label>
                                                </div>
                                                <DialogFooter className='gap-2 sm:justify-end'>
                                                    <Button
                                                        type='button'
                                                        variant='outline'
                                                        size='sm'
                                                        onClick={onCancelDeletion}
                                                        className='border-neutral-600 text-neutral-300 hover:bg-neutral-700 hover:text-white'>
                                                        {t('common.cancel')}
                                                    </Button>
                                                    <Button
                                                        type='button'
                                                        variant='destructive'
                                                        size='sm'
                                                        onClick={onConfirmDeletion}
                                                        className='bg-red-600 text-white hover:bg-red-500'>
                                                        {t('common.delete')}
                                                    </Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export const HistoryPanel = React.memo(HistoryPanelImpl);
