'use client';

import * as React from 'react';

export type Language = 'en' | 'zh';
export type LanguagePreference = 'system' | Language;

type TranslationParams = Record<string, number | string>;

const en = {
    'settings.language': 'Language',
    'settings.languageDescription': 'Select your language preference.',
    'settings.languageAria': 'Change language',
    'settings.system': 'System',
    'settings.english': 'English',
    'settings.chinese': '中文',
    'settings.title': 'Settings',
    'settings.description': 'Choose the interface language.',
    'settings.back': 'Back',
    'settings.pageTitle': 'Settings',
    'settings.pageDescription': 'Configure the local browser settings for this app.',
    'settings.localOnlyTitle': 'Local browser storage only',
    'settings.localOnlyDescription':
        'These settings are saved only in this browser with localStorage. They are not synced, uploaded, or stored on the server.',
    'settings.interface': 'Interface',
    'settings.theme': 'Theme',
    'settings.themeDescription': 'Choose the application theme.',
    'settings.light': 'Light',
    'settings.dark': 'Dark',
    'settings.api': 'API',
    'settings.baseUrl': 'Base URL',
    'settings.baseUrlPlaceholder': 'https://api.example.com/v1',
    'settings.baseUrlHelp':
        "Optional. Saved locally; Get Key opens this host's /console/token. Empty uses the server value if configured.",
    'settings.apiKey': 'API Key',
    'settings.apiKeyPlaceholder': 'sk-...',
    'settings.apiKeyHelp': 'Leave empty to use the server environment variable when it is configured.',
    'settings.models': 'Model IDs',
    'settings.modelsDescription': 'Add one or more image model IDs for the home page model dropdowns.',
    'settings.modelsFetchFailed': 'Failed to fetch models.',
    'settings.modelsLoading': 'Loading models...',
    'settings.noModelsFound': 'No models found. Type a model ID.',
    'settings.modelPlaceholder': 'gpt-image-2',
    'settings.addModel': 'Add model',
    'settings.removeModel': 'Remove {model}',
    'settings.saveSettings': 'Save settings',
    'settings.resetDefaults': 'Reset defaults',
    'settings.saved': 'Saved locally.',
    'settings.emptyModel': 'Enter a model ID first.',
    'settings.duplicateModel': 'That model is already in the list.',
    'settings.modelsRequired': 'Keep at least one model ID.',
    'home.kicker': 'Dedicated GPT Image 2 workspace',
    'home.title': 'GPT Image 2 Playground',
    'home.apiKeyHelp': 'Saved to localStorage in this browser. Leave empty to use the server API key.',
    'home.modelHelp': 'Used for generation and editing. Custom entries are saved to the local model list.',
    'home.getApiKey': 'Get Key',
    'home.getApiKeyAria': 'Open token console in a new tab',
    'home.showApiKey': 'Show API key',
    'home.hideApiKey': 'Hide API key',
    'home.toggleTheme': 'Toggle light and dark mode',
    'devtools.preferences': 'Preferences',
    'devtools.theme': 'Theme',
    'devtools.themeDescription': 'Select your theme preference.',
    'devtools.system': 'System',
    'devtools.light': 'Light',
    'devtools.dark': 'Dark',
    'devtools.position': 'Position',
    'devtools.positionDescription': 'Adjust the placement of your dev tools.',
    'devtools.bottomLeft': 'Bottom Left',
    'devtools.bottomRight': 'Bottom Right',
    'devtools.topLeft': 'Top Left',
    'devtools.topRight': 'Top Right',
    'devtools.size': 'Size',
    'devtools.sizeDescription': 'Adjust the size of your dev tools.',
    'devtools.small': 'Small',
    'devtools.medium': 'Medium',
    'devtools.large': 'Large',
    'devtools.hideSession': 'Hide Dev Tools for this session',
    'devtools.hideSessionDescription': 'Hide Dev Tools until you restart your dev server, or 1 day.',
    'devtools.hide': 'Hide',
    'devtools.hideShortcut': 'Hide Dev Tools shortcut',
    'devtools.hideShortcutDescription': 'Set a custom keyboard shortcut to toggle visibility.',
    'devtools.disableProject': 'Disable Dev Tools for this project',
    'devtools.restartServer': 'Restart Dev Server',
    'devtools.restartServerDescription': 'Restarts the development server without needing to leave the browser.',
    'devtools.restart': 'Restart',
    'devtools.resetBundlerCache': 'Reset Bundler Cache',
    'devtools.resetBundlerCacheDescription':
        'Clears the bundler cache and restarts the dev server. Helpful if you are seeing stale errors or changes are not appearing.',
    'devtools.resetCache': 'Reset Cache',
    'apiInfo.completedImages': 'Completed events',
    'apiInfo.cost': 'Cost',
    'apiInfo.duration': 'Duration',
    'apiInfo.empty': 'No API request yet.',
    'apiInfo.endpoint': 'Endpoint',
    'apiInfo.files': 'Files',
    'apiInfo.httpStatus': 'HTTP Status',
    'apiInfo.imageCount': 'Images',
    'apiInfo.partialImages': 'Preview events',
    'apiInfo.responseType': 'Response Type',
    'apiInfo.startedAt': 'Started',
    'apiInfo.status': 'Status',
    'apiInfo.statusError': 'Error',
    'apiInfo.statusLoading': 'Running',
    'apiInfo.statusSuccess': 'OK',
    'apiInfo.storage': 'Storage',
    'apiInfo.streaming': 'Streaming',
    'apiInfo.title': 'API Response Info',
    'apiInfo.toggle': 'API Info',
    'common.auto': 'Auto',
    'common.background': 'Background',
    'common.cancel': 'Cancel',
    'common.clear': 'Clear',
    'common.close': 'Close',
    'common.compression': 'Compression',
    'common.copied': 'Copied!',
    'common.copy': 'Copy',
    'common.custom': 'Custom size',
    'common.delete': 'Delete',
    'common.download': 'Download',
    'common.error': 'Error',
    'common.height': 'Height (px)',
    'common.high': 'High',
    'common.landscape': '16:9',
    'common.low': 'Low',
    'common.mask': 'Mask',
    'common.medium': 'Medium',
    'common.model': 'Model',
    'common.moderationLevel': 'Moderation Level',
    'common.opaque': 'Opaque',
    'common.outputFormat': 'Output Format',
    'common.portrait': '9:16',
    'common.prompt': 'Prompt',
    'common.quality': 'Quality',
    'common.save': 'Save',
    'common.size': 'Size',
    'common.square': '1:1',
    'common.transparent': 'Transparent',
    'common.width': 'Width (px)',
    'common.yes': 'Yes',
    'common.no': 'No',
    'mode.edit': 'Edit',
    'mode.generate': 'Generate',
    'form.brushSize': 'Brush Size: {size}px',
    'form.browse': 'Browse...',
    'form.customSizeConstraints':
        'Constraints: multiples of 16, max edge 3840px, aspect ratio <= 3:1, 655,360 to 8,294,400 total pixels.',
    'form.customSizeSummary': '{pixels} pixels ({percent}% of max) · {ratio}:1 ratio',
    'form.customSizeSummaryNoRatio': '{pixels} pixels ({percent}% of max) · --',
    'form.edit.button': 'Edit Image',
    'form.edit.buttonLoading': 'Editing...',
    'form.edit.description': 'Modify an existing image with a text prompt.',
    'form.edit.promptPlaceholder': 'e.g., Add a party hat to the main subject',
    'form.edit.title': 'Edit Image',
    'form.enableStreaming': 'Enable Streaming',
    'form.filesSelected': '{count} files selected',
    'form.generate.button': 'Generate',
    'form.generate.buttonLoading': 'Generating...',
    'form.generate.description': 'Create a new image from a text prompt.',
    'form.generate.promptPlaceholder': 'e.g., A photorealistic cat astronaut floating in space',
    'form.generate.title': 'Generate Image',
    'form.highFidelityTooltip':
        "gpt-image-2 always processes reference images at high fidelity. This improves edit quality but uses more input image tokens per request than gpt-image-1.5's default fidelity.",
    'form.qualityDescription':
        'Quality controls detail, cost, and wait time. Auto is recommended unless you need a specific tradeoff.',
    'form.invalidMaxFiles': 'You can only select up to {maxImages} images.',
    'form.maskApplied': 'Mask applied: {name}',
    'form.maskClear': 'Clear',
    'form.maskCloseEditor': 'Close Mask Editor',
    'form.maskCreate': 'Create Mask',
    'form.maskDescription':
        'Draw on the image below to mark areas for editing (drawn areas become transparent in the mask).',
    'form.maskEditSaved': 'Edit Saved Mask',
    'form.maskLoadFailed': 'Failed to load the uploaded mask image to check dimensions.',
    'form.maskPreviewAlt': 'Generated mask preview',
    'form.maskPreviewLabel': 'Generated Mask Preview:',
    'form.maskPreviewLoading': 'Generating mask preview...',
    'form.maskSave': 'Save Mask',
    'form.maskSaved': '(Saved)',
    'form.maskSavedSuccess': 'Mask saved successfully!',
    'form.maskUpload': 'Upload Mask',
    'form.noFileSelected': 'No file selected.',
    'form.numberOfImages': 'Number of Images: {count}',
    'form.previewImages': 'Preview Images',
    'form.previewImagesTooltip': 'Each preview image adds ~$0.003 to the cost (100 additional output tokens).',
    'form.removeImageAria': 'Remove image {index}',
    'form.selectModel': 'Select model',
    'form.sourceImages': 'Source Image(s) [Max: {maxImages}]',
    'form.sourcePreviewAlt': 'Source preview {index}',
    'form.streamingSingleTooltip': 'Streaming is only supported when generating a single image (n=1).',
    'form.streamingTooltip':
        'Shows partial previews while generating. Streaming responses may not include a revised prompt; turn it off if you need that prompt.',
    'form.validation.invalidMaskType': 'Invalid file type. Please upload a PNG file for the mask.',
    'form.validation.maskDimensionMismatch':
        'Mask dimensions ({maskWidth}x{maskHeight}) must match the source image dimensions ({imageWidth}x{imageHeight}).',
    'form.validation.noEditImage': 'Please select at least one image to edit.',
    'form.validation.saveMaskBeforeSubmit': 'Please save the mask you have drawn before submitting.',
    'history.averageCostPerImage': 'Average Cost Per Image:',
    'history.bg': 'BG:',
    'history.clearConfirmFs': 'Are you sure you want to clear the entire image history? This cannot be undone.',
    'history.clearConfirmIndexedDb':
        'Are you sure you want to clear the entire image history? In IndexedDB mode, this will also permanently delete all stored images. This cannot be undone.',
    'history.confirmDeleteDescription':
        'Are you sure you want to delete this history entry? This will remove {count} image(s). This action cannot be undone.',
    'history.confirmDeletion': 'Confirm Deletion',
    'history.costBreakdown': 'Cost Breakdown',
    'history.costBreakdownDescription': 'Estimated cost breakdown for this image generation.',
    'history.costCurrencyNote': 'CNY values use an estimated fixed rate: 1 USD ≈ ¥{rate}.',
    'history.createdAt': 'Created At:',
    'history.deleteHistoryItemAria': 'Delete history item',
    'history.detailDescription': 'This detail page reads the locally stored history from this browser.',
    'history.detailTitle': 'History Details',
    'history.dontAskAgain': "Don't ask me again",
    'history.downloadImageAria': 'Download image {filename}',
    'history.duration': 'Duration:',
    'history.generatedImagesWillAppear': 'Generated images will appear here.',
    'history.generatedOn': 'Generated on: {date}',
    'history.imageCount': 'Image Count:',
    'history.serverExpiryAt': 'Server Expires:',
    'history.serverExpiryCountdown': 'Online image cleanup in {time}. Expires at {date}.',
    'history.serverExpiryCountdownShort': 'Online clears in {time}',
    'history.serverExpiryExpired': 'Online copy may be gone',
    'history.serverExpiryExpiredDetail': 'This item is past the 3-day server retention window. It expired at {date}.',
    'history.serverExpiryNotice':
        'Server-hosted images are retained for 3 days only. Local browser cache may still show them, but if browser data is cleared after the server copy expires, the image cannot be recovered.',
    'history.serverExpiryNoticeTitle': 'Server image retention',
    'history.imageInput': 'Image Input',
    'history.imageInputTokens': 'Image Input Tokens:',
    'history.imageOutput': 'Image Output',
    'history.imageOutputTokens': 'Image Output Tokens:',
    'history.images': 'Images',
    'history.loading': 'Loading history details...',
    'history.mask': 'Mask:',
    'history.modeCreate': 'Create',
    'history.modeEdit': 'Edit',
    'history.mod': 'Mod:',
    'history.model': 'Model:',
    'history.noCostDetails': 'No cost details were recorded for this item.',
    'history.noPrompt': 'No prompt recorded.',
    'history.notFound': 'This history item was not found in local storage.',
    'history.outputCompression': 'Output Compression:',
    'history.partialImages': 'Preview Images:',
    'history.previewAlt': 'Preview for batch generated at {date}',
    'history.pricingFor': 'Pricing for {model}:',
    'history.promptDescription': 'The full prompt used to generate this image batch.',
    'history.promptTitle': 'Prompt',
    'history.quality': 'Quality:',
    'history.requestSettings': 'Request Settings',
    'history.revisedPromptTitle': 'Revised Prompt',
    'history.showCostBreakdownAria': 'Show cost breakdown',
    'history.showDetails': 'Show Details',
    'history.showPrompt': 'Show Prompt',
    'history.showTotalCostAria': 'Show total cost summary',
    'history.sourceImages': 'Source Images:',
    'history.storageDb': 'db',
    'history.storageFile': 'file',
    'history.storageMode': 'Storage:',
    'history.streaming': 'Streaming:',
    'history.textInput': 'Text Input',
    'history.textInputTokens': 'Text Input Tokens:',
    'history.time': 'Time:',
    'history.title': 'History',
    'history.tokensUnit': '1M tokens',
    'history.totalCost': 'Total Cost: {cost}',
    'history.totalCostSummary': 'Total Cost Summary',
    'history.totalCostSummaryDescription':
        'A summary of the total estimated cost for all generated images in the history.',
    'history.totalEstimatedCost': 'Total Estimated Cost:',
    'history.totalImagesGenerated': 'Total Images Generated:',
    'history.viewBatchAria': 'View image batch from {date}',
    'history.viewImageAria': 'View image {filename}',
    'valueComparison.fixedDeal': 'Your fixed quota stays simple: one yuan always covers 20 generated images.',
    'valueComparison.goodDeal':
        'For this batch, your quota is about {multiplier}x better, saving about {savings} ({percent}%).',
    'valueComparison.officialEstimate': 'Official estimate',
    'valueComparison.officialPerImage': 'Official / image',
    'valueComparison.quotaLine': 'Your site quota: ¥1 = {count} images, ¥{price} per image.',
    'valueComparison.sitePerImage': 'Your site / image',
    'valueComparison.siteQuota': 'Your site quota',
    'valueComparison.sourceLine': 'Official cost is estimated from API token usage and model pricing.',
    'valueComparison.title': 'Quota Value',
    'output.baseEditAlt': 'Base image for editing',
    'output.displayError': 'Error displaying image.',
    'output.downloadImage': 'Download',
    'output.downloadImageAria': 'Download image {filename}',
    'output.editing': 'Editing image...',
    'output.empty': 'Your generated image will appear here.',
    'output.elapsed': 'Elapsed {time}',
    'output.generatedAlt': 'Generated image output',
    'output.generatedGridAlt': 'Generated image {index}',
    'output.generating': 'Generating image...',
    'output.gridAria': 'Show grid view',
    'output.nextImageAria': 'Show next image',
    'output.originalPromptTitle': 'Original Prompt',
    'output.previewDescription': 'Expanded preview of the selected generated image.',
    'output.previewImageAria': 'Preview image {filename}',
    'output.previewTitle': 'Image Preview',
    'output.previousImageAria': 'Show previous image',
    'output.revisedPromptTitle': 'Revised Prompt',
    'output.selectImageAria': 'Select image {index}',
    'output.sendToEdit': 'Send to Edit',
    'output.streaming': 'Streaming...',
    'output.streamingPreviewCount': 'Streaming preview {count}/{total}',
    'output.streamingPreviewAlt': 'Streaming preview',
    'output.waitingForStreamingPreview': 'Waiting for the first streaming preview...',
    'output.thumbnailAlt': 'Thumbnail {index}',
    'page.apiNoImages': 'API response did not contain valid image data or filenames.',
    'page.apiRequestFailed': 'API request failed with status {status}',
    'page.clearHistoryError': 'Failed to clear history: {message}',
    'page.configurePassword': 'Configure Password',
    'page.deleteApiFailed': 'API deletion failed with status {status}',
    'page.editFormMaxImages': 'Cannot add more than {maxImages} images to the edit form.',
    'page.fetchImageFailed': 'Failed to fetch image: {statusText}',
    'page.historyImageLoadError': 'Image {filename} could not be loaded.',
    'page.historyImagesLoadSomeError':
        'Some images from this history entry could not be loaded (they might have been cleared or are missing).',
    'page.imageNotFoundLocal': 'Image {filename} not found in local database.',
    'page.passwordEmpty': 'Password cannot be empty.',
    'page.passwordHashError': 'Failed to save password due to a hashing error.',
    'page.passwordMissing': 'Password is required. Please configure the password by clicking the lock icon.',
    'page.passwordRequired': 'Password Required',
    'page.passwordRequiredDescription':
        'The server requires a password, or the previous one was incorrect. Please enter it to continue.',
    'page.retrieveImageFailed': 'Could not retrieve image data for {filename}.',
    'page.saveIndexedDbError': 'Failed to save image {filename} to local database.',
    'page.sendToEditError': 'Failed to send image to edit form.',
    'page.setPasswordDescription': 'Set a password to use for API requests.',
    'page.streamingError': 'Streaming error occurred',
    'page.streamingInterrupted':
        'The upstream streaming connection was interrupted before a final image was returned. Please retry, or turn off streaming preview.',
    'page.upstreamConnectionError':
        'The upstream image service is temporarily unavailable or the connection was interrupted. Please retry later.',
    'page.unauthorized': 'Unauthorized: Invalid or missing password. Please try again.',
    'page.unexpectedDeleteError': 'An unexpected error occurred during deletion.',
    'page.unexpectedError': 'An unexpected error occurred.',
    'password.placeholder': 'Enter your password',
    'validation.size.aspect': 'Aspect ratio (long:short) must be <= 3:1.',
    'validation.size.integer': 'Width and height must be whole numbers.',
    'validation.size.maxEdge': 'Maximum edge is 3840px.',
    'validation.size.maxPixels': 'Total pixels must be no more than 8,294,400.',
    'validation.size.minPixels': 'Total pixels must be at least 655,360.',
    'validation.size.multiple': 'Both edges must be multiples of 16.',
    'validation.size.positive': 'Width and height must be positive numbers.'
};

export type TranslationKey = keyof typeof en;
type Translations = Record<TranslationKey, string>;

const zh: Translations = {
    'settings.language': '语言',
    'settings.languageDescription': '选择语言偏好。',
    'settings.languageAria': '切换语言',
    'settings.system': '跟随系统',
    'settings.english': 'English',
    'settings.chinese': '中文',
    'settings.title': '设置',
    'settings.description': '选择界面语言。',
    'settings.back': '返回',
    'settings.pageTitle': '设置',
    'settings.pageDescription': '配置此应用的浏览器本地设置。',
    'settings.localOnlyTitle': '仅保存到浏览器本地',
    'settings.localOnlyDescription': '这些设置只会通过 localStorage 保存在当前浏览器中，不会同步、上传或存储到服务器。',
    'settings.interface': '界面',
    'settings.theme': '主题',
    'settings.themeDescription': '选择应用主题。',
    'settings.light': '浅色',
    'settings.dark': '深色',
    'settings.api': 'API',
    'settings.baseUrl': 'Base URL',
    'settings.baseUrlPlaceholder': 'https://api.example.com/v1',
    'settings.baseUrlHelp': '可选，保存在本浏览器；获取 Key 会打开该域名的 /console/token。留空时使用服务端值。',
    'settings.apiKey': 'API Key',
    'settings.apiKeyPlaceholder': 'sk-...',
    'settings.apiKeyHelp': '留空时会使用已配置的服务端环境变量。',
    'settings.models': '模型 ID',
    'settings.modelsDescription': '添加一个或多个图片模型 ID，用于首页的模型下拉选择。',
    'settings.modelsFetchFailed': '获取模型列表失败。',
    'settings.modelsLoading': '正在加载模型...',
    'settings.noModelsFound': '没有找到模型，请手动输入模型 ID。',
    'settings.modelPlaceholder': 'gpt-image-2',
    'settings.addModel': '添加模型',
    'settings.removeModel': '移除 {model}',
    'settings.saveSettings': '保存设置',
    'settings.resetDefaults': '恢复默认',
    'settings.saved': '已保存到本地。',
    'settings.emptyModel': '请先输入模型 ID。',
    'settings.duplicateModel': '这个模型已经在列表里。',
    'settings.modelsRequired': '至少保留一个模型 ID。',
    'home.kicker': '专为 GPT Image 2 准备',
    'home.title': 'GPT Image 2 生成工作台',
    'home.apiKeyHelp': '输入后会自动保存到当前浏览器 localStorage。留空时使用服务端 API Key。',
    'home.modelHelp': '生成和编辑都会使用这个模型；手动输入的模型会保存到本地列表。',
    'home.getApiKey': '获取 Key',
    'home.getApiKeyAria': '在新标签页打开令牌控制台',
    'home.showApiKey': '显示 API Key',
    'home.hideApiKey': '隐藏 API Key',
    'home.toggleTheme': '切换浅色和深色模式',
    'devtools.preferences': '偏好设置',
    'devtools.theme': '主题',
    'devtools.themeDescription': '选择主题偏好。',
    'devtools.system': '跟随系统',
    'devtools.light': '浅色',
    'devtools.dark': '深色',
    'devtools.position': '位置',
    'devtools.positionDescription': '调整开发工具的位置。',
    'devtools.bottomLeft': '左下角',
    'devtools.bottomRight': '右下角',
    'devtools.topLeft': '左上角',
    'devtools.topRight': '右上角',
    'devtools.size': '大小',
    'devtools.sizeDescription': '调整开发工具大小。',
    'devtools.small': '小',
    'devtools.medium': '中',
    'devtools.large': '大',
    'devtools.hideSession': '本次会话隐藏开发工具',
    'devtools.hideSessionDescription': '隐藏开发工具，直到重启开发服务器或 1 天后恢复。',
    'devtools.hide': '隐藏',
    'devtools.hideShortcut': '隐藏开发工具快捷键',
    'devtools.hideShortcutDescription': '设置用于切换显示状态的自定义快捷键。',
    'devtools.disableProject': '对此项目禁用开发工具',
    'devtools.restartServer': '重启开发服务器',
    'devtools.restartServerDescription': '无需离开浏览器即可重启开发服务器。',
    'devtools.restart': '重启',
    'devtools.resetBundlerCache': '重置打包缓存',
    'devtools.resetBundlerCacheDescription': '清除打包缓存并重启开发服务器。适用于看到过期错误或改动未生效的情况。',
    'devtools.resetCache': '重置缓存',
    'apiInfo.completedImages': '完成事件',
    'apiInfo.cost': '成本',
    'apiInfo.duration': '耗时',
    'apiInfo.empty': '暂无接口请求记录。',
    'apiInfo.endpoint': '接口',
    'apiInfo.files': '文件',
    'apiInfo.httpStatus': 'HTTP 状态',
    'apiInfo.imageCount': '图片数',
    'apiInfo.partialImages': '预览事件',
    'apiInfo.responseType': '响应类型',
    'apiInfo.startedAt': '开始时间',
    'apiInfo.status': '状态',
    'apiInfo.statusError': '异常',
    'apiInfo.statusLoading': '请求中',
    'apiInfo.statusSuccess': '成功',
    'apiInfo.storage': '存储',
    'apiInfo.streaming': '流式',
    'apiInfo.title': '接口响应信息',
    'apiInfo.toggle': '接口信息',
    'common.auto': '自动',
    'common.background': '背景',
    'common.cancel': '取消',
    'common.clear': '清除',
    'common.close': '关闭',
    'common.compression': '压缩',
    'common.copied': '已复制',
    'common.copy': '复制',
    'common.custom': '自定义',
    'common.delete': '删除',
    'common.download': '下载',
    'common.error': '错误',
    'common.height': '高度 (px)',
    'common.high': '高',
    'common.landscape': '16:9',
    'common.low': '低',
    'common.mask': '蒙版',
    'common.medium': '中',
    'common.model': '模型',
    'common.moderationLevel': '审核级别',
    'common.opaque': '不透明',
    'common.outputFormat': '输出格式',
    'common.portrait': '9:16',
    'common.prompt': '提示词',
    'common.quality': '质量',
    'common.save': '保存',
    'common.size': '尺寸',
    'common.square': '1:1',
    'common.transparent': '透明',
    'common.width': '宽度 (px)',
    'common.yes': '是',
    'common.no': '否',
    'mode.edit': '编辑',
    'mode.generate': '生成',
    'form.brushSize': '画笔大小：{size}px',
    'form.browse': '浏览...',
    'form.customSizeConstraints':
        '限制：边长需为 16 的倍数，最大边 3840px，宽高比 <= 3:1，总像素 655,360 到 8,294,400。',
    'form.customSizeSummary': '{pixels} 像素（最大值的 {percent}%）· {ratio}:1 比例',
    'form.customSizeSummaryNoRatio': '{pixels} 像素（最大值的 {percent}%）· --',
    'form.edit.button': '编辑图片',
    'form.edit.buttonLoading': '正在编辑...',
    'form.edit.description': '用提示词修改已有图片。',
    'form.edit.promptPlaceholder': '例如：给主体添加一顶派对帽',
    'form.edit.title': '编辑图片',
    'form.enableStreaming': '启用流式预览',
    'form.filesSelected': '已选择 {count} 个文件',
    'form.generate.button': '生成',
    'form.generate.buttonLoading': '正在生成...',
    'form.generate.description': '根据文字提示词创建新图片。',
    'form.generate.promptPlaceholder': '例如：一只写实风格的猫宇航员漂浮在太空中',
    'form.generate.title': '生成图片',
    'form.highFidelityTooltip':
        'gpt-image-2 会始终以高保真方式处理参考图。这样能提升编辑质量，但每次请求会比 gpt-image-1.5 的默认保真度使用更多图片输入 token。',
    'form.qualityDescription': '质量会影响细节、成本和等待时间。不确定时建议使用自动。',
    'form.invalidMaxFiles': '最多只能选择 {maxImages} 张图片。',
    'form.maskApplied': '已应用蒙版：{name}',
    'form.maskClear': '清除',
    'form.maskCloseEditor': '关闭蒙版编辑器',
    'form.maskCreate': '创建蒙版',
    'form.maskDescription': '在下方图片上涂抹要编辑的区域（涂抹区域会在蒙版中变为透明）。',
    'form.maskEditSaved': '编辑已保存蒙版',
    'form.maskLoadFailed': '无法加载上传的蒙版图片来检查尺寸。',
    'form.maskPreviewAlt': '生成的蒙版预览',
    'form.maskPreviewLabel': '生成的蒙版预览：',
    'form.maskPreviewLoading': '正在生成蒙版预览...',
    'form.maskSave': '保存蒙版',
    'form.maskSaved': '（已保存）',
    'form.maskSavedSuccess': '蒙版保存成功！',
    'form.maskUpload': '上传蒙版',
    'form.noFileSelected': '未选择文件。',
    'form.numberOfImages': '图片数量：{count}',
    'form.previewImages': '预览图片',
    'form.previewImagesTooltip': '每张预览图会额外增加约 $0.003 成本（100 个输出 token）。',
    'form.removeImageAria': '移除图片 {index}',
    'form.selectModel': '选择模型',
    'form.sourceImages': '源图片 [最多：{maxImages}]',
    'form.sourcePreviewAlt': '源图片预览 {index}',
    'form.streamingSingleTooltip': '流式预览只支持生成单张图片（n=1）。',
    'form.streamingTooltip': '生成过程中显示局部预览图，体验更即时；流式响应可能不返回修订提示词，需要查看修订提示词时请关闭流式预览。',
    'form.validation.invalidMaskType': '文件类型无效。请上传 PNG 格式的蒙版文件。',
    'form.validation.maskDimensionMismatch':
        '蒙版尺寸（{maskWidth}x{maskHeight}）必须与源图片尺寸（{imageWidth}x{imageHeight}）一致。',
    'form.validation.noEditImage': '请至少选择一张要编辑的图片。',
    'form.validation.saveMaskBeforeSubmit': '提交前请先保存你绘制的蒙版。',
    'history.averageCostPerImage': '每张平均成本：',
    'history.bg': '背景：',
    'history.clearConfirmFs': '确定要清空全部图片历史吗？此操作不可撤销。',
    'history.clearConfirmIndexedDb':
        '确定要清空全部图片历史吗？在 IndexedDB 模式下，这也会永久删除所有已存储图片。此操作不可撤销。',
    'history.confirmDeleteDescription': '确定要删除这条历史记录吗？这会移除 {count} 张图片。此操作不可撤销。',
    'history.confirmDeletion': '确认删除',
    'history.costBreakdown': '成本明细',
    'history.costBreakdownDescription': '这次图片生成的预估成本明细。',
    'history.costCurrencyNote': '人民币金额按固定估算汇率换算：1 USD ≈ ¥{rate}。',
    'history.createdAt': '创建时间：',
    'history.deleteHistoryItemAria': '删除历史记录',
    'history.detailDescription': '此详情页读取当前浏览器本地保存的历史记录。',
    'history.detailTitle': '历史详情',
    'history.dontAskAgain': '不再询问',
    'history.downloadImageAria': '下载图片 {filename}',
    'history.duration': '耗时：',
    'history.generatedImagesWillAppear': '生成的图片会显示在这里。',
    'history.generatedOn': '生成时间：{date}',
    'history.imageCount': '图片数量：',
    'history.serverExpiryAt': '线上过期：',
    'history.serverExpiryCountdown': '线上图片约 {time} 后清理，过期时间：{date}。',
    'history.serverExpiryCountdownShort': '线上 {time} 后清理',
    'history.serverExpiryExpired': '线上图可能已清理',
    'history.serverExpiryExpiredDetail': '这条记录已超过 3 天线上保留期，过期时间：{date}。',
    'history.serverExpiryNotice':
        '线上服务器图片只保留 3 天。本地浏览器缓存可能仍可显示，但如果清除了浏览器数据，且线上图片已经过期清理，就无法再恢复图片。',
    'history.serverExpiryNoticeTitle': '线上图片保留提醒',
    'history.imageInput': '图片输入',
    'history.imageInputTokens': '图片输入 Tokens：',
    'history.imageOutput': '图片输出',
    'history.imageOutputTokens': '图片输出 Tokens：',
    'history.images': '图片',
    'history.loading': '正在加载历史详情...',
    'history.mask': '蒙版：',
    'history.modeCreate': '生成',
    'history.modeEdit': '编辑',
    'history.mod': '审核：',
    'history.model': '模型：',
    'history.noCostDetails': '这条记录没有成本明细。',
    'history.noPrompt': '没有记录提示词。',
    'history.notFound': '没有在本地存储中找到这条历史记录。',
    'history.outputCompression': '输出压缩：',
    'history.partialImages': '预览图数量：',
    'history.previewAlt': '生成于 {date} 的批次预览',
    'history.pricingFor': '{model} 定价：',
    'history.promptDescription': '这批图片使用的完整提示词。',
    'history.promptTitle': '提示词',
    'history.quality': '质量：',
    'history.requestSettings': '请求参数',
    'history.revisedPromptTitle': '修订提示词',
    'history.showCostBreakdownAria': '查看成本明细',
    'history.showDetails': '查看详情',
    'history.showPrompt': '查看提示词',
    'history.showTotalCostAria': '查看总成本摘要',
    'history.sourceImages': '源图片数量：',
    'history.storageDb': '库',
    'history.storageFile': '文件',
    'history.storageMode': '存储：',
    'history.streaming': '流式生成：',
    'history.textInput': '文本输入',
    'history.textInputTokens': '文本输入 Tokens：',
    'history.time': '耗时：',
    'history.title': '历史',
    'history.tokensUnit': '百万 tokens',
    'history.totalCost': '总成本：{cost}',
    'history.totalCostSummary': '总成本摘要',
    'history.totalCostSummaryDescription': '历史中所有生成图片的预估总成本摘要。',
    'history.totalEstimatedCost': '预估总成本：',
    'history.totalImagesGenerated': '已生成图片总数：',
    'history.viewBatchAria': '查看生成于 {date} 的图片批次',
    'history.viewImageAria': '查看图片 {filename}',
    'valueComparison.fixedDeal': '本站额度很简单：1 元始终可以生成 20 张图。',
    'valueComparison.goodDeal': '按这次记录计算，本站额度约划算 {multiplier} 倍，约省 {savings}（{percent}%）。',
    'valueComparison.officialEstimate': '官方估算',
    'valueComparison.officialPerImage': '官方单图',
    'valueComparison.quotaLine': '本站额度：¥1 = {count} 张图，单张 ¥{price}。',
    'valueComparison.sitePerImage': '本站单图',
    'valueComparison.siteQuota': '本站额度价',
    'valueComparison.sourceLine': '官方成本按 API usage 和模型 token 单价估算。',
    'valueComparison.title': '额度价值对比',
    'output.baseEditAlt': '用于编辑的基础图片',
    'output.displayError': '图片显示失败。',
    'output.downloadImage': '下载',
    'output.downloadImageAria': '下载图片 {filename}',
    'output.editing': '正在编辑图片...',
    'output.empty': '你生成的图片会显示在这里。',
    'output.elapsed': '已用时 {time}',
    'output.generatedAlt': '生成图片输出',
    'output.generatedGridAlt': '生成图片 {index}',
    'output.generating': '正在生成图片...',
    'output.gridAria': '显示网格视图',
    'output.nextImageAria': '查看下一张图片',
    'output.originalPromptTitle': '原始提示词',
    'output.previewDescription': '所选生成图片的放大预览。',
    'output.previewImageAria': '预览图片 {filename}',
    'output.previewTitle': '图片预览',
    'output.previousImageAria': '查看上一张图片',
    'output.revisedPromptTitle': '修订提示词',
    'output.selectImageAria': '选择图片 {index}',
    'output.sendToEdit': '发送到编辑',
    'output.streaming': '流式生成中...',
    'output.streamingPreviewCount': '流式预览 {count}/{total}',
    'output.streamingPreviewAlt': '流式预览',
    'output.waitingForStreamingPreview': '等待第一张流式预览...',
    'output.thumbnailAlt': '缩略图 {index}',
    'page.apiNoImages': 'API 响应中没有有效的图片数据或文件名。',
    'page.apiRequestFailed': 'API 请求失败，状态码 {status}',
    'page.clearHistoryError': '清空历史失败：{message}',
    'page.configurePassword': '配置密码',
    'page.deleteApiFailed': 'API 删除失败，状态码 {status}',
    'page.editFormMaxImages': '编辑表单最多只能添加 {maxImages} 张图片。',
    'page.fetchImageFailed': '获取图片失败：{statusText}',
    'page.historyImageLoadError': '图片 {filename} 无法加载。',
    'page.historyImagesLoadSomeError': '这条历史记录中的部分图片无法加载（可能已被清除或丢失）。',
    'page.imageNotFoundLocal': '本地数据库中找不到图片 {filename}。',
    'page.passwordEmpty': '密码不能为空。',
    'page.passwordHashError': '保存密码失败：哈希计算出错。',
    'page.passwordMissing': '需要密码。请点击锁图标配置密码。',
    'page.passwordRequired': '需要密码',
    'page.passwordRequiredDescription': '服务器需要密码，或者之前的密码不正确。请输入密码后继续。',
    'page.retrieveImageFailed': '无法读取图片 {filename} 的数据。',
    'page.saveIndexedDbError': '保存图片 {filename} 到本地数据库失败。',
    'page.sendToEditError': '发送图片到编辑表单失败。',
    'page.setPasswordDescription': '设置用于 API 请求的密码。',
    'page.streamingError': '流式生成出错',
    'page.streamingInterrupted': '上游流式连接在返回最终图片前中断了。请重试，或关闭流式预览后再生成。',
    'page.upstreamConnectionError': '上游图片服务暂时不可用，或连接中途断开了。请稍后重试。',
    'page.unauthorized': '未授权：密码无效或缺失。请重试。',
    'page.unexpectedDeleteError': '删除过程中发生未知错误。',
    'page.unexpectedError': '发生未知错误。',
    'password.placeholder': '输入你的密码',
    'validation.size.aspect': '宽高比（长边:短边）必须 <= 3:1。',
    'validation.size.integer': '宽度和高度必须是整数。',
    'validation.size.maxEdge': '最大边长为 3840px。',
    'validation.size.maxPixels': '总像素不能超过 8,294,400。',
    'validation.size.minPixels': '总像素至少为 655,360。',
    'validation.size.multiple': '两条边都必须是 16 的倍数。',
    'validation.size.positive': '宽度和高度必须为正数。'
};

const dictionaries: Record<Language, Translations> = {
    en,
    zh
};

export type Translate = (key: TranslationKey, params?: TranslationParams) => string;

type I18nContextValue = {
    language: Language;
    languagePreference: LanguagePreference;
    setLanguage: (language: Language) => void;
    setLanguagePreference: (languagePreference: LanguagePreference) => void;
    t: Translate;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

function interpolate(template: string, params?: TranslationParams): string {
    if (!params) return template;

    return template.replace(/\{(\w+)\}/g, (match, key: string) => {
        const value = params[key];
        return value === undefined ? match : String(value);
    });
}

const languageStorageKey = 'gptImageLanguage';
const defaultLanguage: Language = 'zh';
const defaultLanguagePreference: LanguagePreference = 'zh';

function getBrowserLanguage(): Language {
    if (typeof window === 'undefined') return defaultLanguage;

    return window.navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function getStoredLanguagePreference(): LanguagePreference {
    if (typeof window === 'undefined') return defaultLanguagePreference;

    const storedLanguage = window.localStorage.getItem(languageStorageKey);
    if (storedLanguage === 'system' || storedLanguage === 'en' || storedLanguage === 'zh') {
        return storedLanguage;
    }

    return defaultLanguagePreference;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
    const [languagePreference, setLanguagePreferenceState] =
        React.useState<LanguagePreference>(defaultLanguagePreference);
    const [systemLanguage, setSystemLanguage] = React.useState<Language>(defaultLanguage);

    const syncLanguageState = React.useCallback(() => {
        setSystemLanguage(getBrowserLanguage());
        setLanguagePreferenceState(getStoredLanguagePreference());
    }, []);

    React.useEffect(() => {
        syncLanguageState();
    }, [syncLanguageState]);

    React.useEffect(() => {
        const syncWhenVisible = () => {
            if (!document.hidden) {
                syncLanguageState();
            }
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key === languageStorageKey) {
                syncLanguageState();
            }
        };

        window.addEventListener('languagechange', syncLanguageState);
        window.addEventListener('pageshow', syncLanguageState);
        window.addEventListener('focus', syncLanguageState);
        window.addEventListener('storage', handleStorage);
        document.addEventListener('visibilitychange', syncWhenVisible);

        return () => {
            window.removeEventListener('languagechange', syncLanguageState);
            window.removeEventListener('pageshow', syncLanguageState);
            window.removeEventListener('focus', syncLanguageState);
            window.removeEventListener('storage', handleStorage);
            document.removeEventListener('visibilitychange', syncWhenVisible);
        };
    }, [syncLanguageState]);

    const language: Language = languagePreference === 'system' ? systemLanguage : languagePreference;

    React.useEffect(() => {
        document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    }, [language]);

    const setLanguagePreference = React.useCallback((nextLanguagePreference: LanguagePreference) => {
        setLanguagePreferenceState(nextLanguagePreference);
        window.localStorage.setItem(languageStorageKey, nextLanguagePreference);
    }, []);

    const setLanguage = React.useCallback(
        (nextLanguage: Language) => {
            setLanguagePreference(nextLanguage);
        },
        [setLanguagePreference]
    );

    const t = React.useCallback<Translate>(
        (key, params) => interpolate(dictionaries[language][key] ?? dictionaries.en[key], params),
        [language]
    );

    const value = React.useMemo(
        () => ({ language, languagePreference, setLanguage, setLanguagePreference, t }),
        [language, languagePreference, setLanguage, setLanguagePreference, t]
    );

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
    const context = React.useContext(I18nContext);
    if (!context) {
        throw new Error('useI18n must be used within I18nProvider.');
    }

    return context;
}

export function formatOptionLabel(value: string | undefined, t: Translate): string {
    switch (value) {
        case 'auto':
            return t('common.auto');
        case 'custom':
            return t('common.custom');
        case 'square':
            return t('common.square');
        case 'landscape':
            return t('common.landscape');
        case 'portrait':
            return t('common.portrait');
        case 'low':
            return t('common.low');
        case 'medium':
            return t('common.medium');
        case 'high':
            return t('common.high');
        case 'opaque':
            return t('common.opaque');
        case 'transparent':
            return t('common.transparent');
        default:
            return value ?? '';
    }
}

export function formatSizeValidationReason(reason: string, t: Translate): string {
    if (reason.startsWith('Width and height must be positive')) return t('validation.size.positive');
    if (reason.startsWith('Width and height must be whole')) return t('validation.size.integer');
    if (reason.startsWith('Both edges must be multiples')) return t('validation.size.multiple');
    if (reason.startsWith('Maximum edge')) return t('validation.size.maxEdge');
    if (reason.startsWith('Aspect ratio')) return t('validation.size.aspect');
    if (reason.startsWith('Total pixels must be at least')) return t('validation.size.minPixels');
    if (reason.startsWith('Total pixels must be no more')) return t('validation.size.maxPixels');

    return reason;
}
