interface Brand {
    id: string;
    name: string;
    description?: string;
    status?: string;
    tone?: string;
    audience?: string;
    audienceData?: string;
    blogContext?: string;
    themes?: Array<{
        id: string;
        title: string;
        content: string;
        intent?: string;
    }>;
}
export declare function brandListCommand(): Promise<void>;
export declare function displayBrandProfile(brand: Brand): void;
export declare function brandInfoCommand(): Promise<void>;
export declare function brandThemesCommand(): Promise<void>;
export declare function brandThemesEditCommand(themeId: string, options: {
    title?: string;
    content?: string;
}): Promise<void>;
export declare function brandThemesDeleteCommand(themeId: string): Promise<void>;
export declare function brandThemesGenerateCommand(options: {
    count?: string;
    instructions?: string;
    input?: string;
}): Promise<void>;
export declare function brandSetCommand(brandId: string): void;
export declare function brandOnboardCommand(websiteUrl: string, options: {
    name?: string;
}): Promise<void>;
export declare function brandCreateCommand(name: string, options: {
    description?: string;
    website?: string;
    tone?: string;
    audience?: string;
}): Promise<void>;
export {};
