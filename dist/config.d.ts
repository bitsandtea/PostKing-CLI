interface Config {
    apiKey?: string;
    apiUrl?: string;
    brandId?: string;
}
export declare function getConfig(): Config;
export declare function setConfig(updates: Partial<Config>): void;
export declare function clearConfig(): void;
export declare function getApiKey(): string | undefined;
export declare function getApiUrl(): string;
export declare function getBrandId(): string | undefined;
export declare function getAiDetectionUrl(): string;
export {};
