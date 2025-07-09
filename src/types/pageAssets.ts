export interface FontInfo {
  id: string;
  family: string;
  element: string;
  weight?: string;
  style?: string;
  size?: string;
  lineHeight?: string;
  css?: string;
}

export interface ImageInfo {
  id: string;
  src: string;
  filename?: string;
  alt: string;
  title?: string;
  caption?: string;
  width?: number;
  height?: number;
  format?: string;
  size?: string;
  context: 'content' | 'figure' | 'background' | 'icon' | 'logo';
  figureContext?: {
    figcaption?: string;
    figureId?: string;
  };
}

export interface SvgInfo {
  id: string;
  code: string;
  title?: string;
  description?: string;
  viewBox?: string;
  width?: string;
  height?: string;
  classes?: string[];
  context: 'inline' | 'icon' | 'illustration' | 'background';
}

export interface ScreenshotInfo {
  pageshot?: string;
  screenshot?: string;
  capturedAt?: number;
  error?: string;
}

export interface PageAssets {
  fonts: FontInfo[];
  images: ImageInfo[];
  svgs: SvgInfo[];
  screenshots?: ScreenshotInfo;
  stats: {
    totalFonts: number;
    totalImages: number;
    totalSvgs: number;
    uniqueFontFamilies: number;
    imageFormats: Record<string, number>;
    svgContexts: Record<string, number>;
  };
}

export interface PageAssetsExtractionResult {
  success: boolean;
  assets?: PageAssets;
  error?: string;
} 