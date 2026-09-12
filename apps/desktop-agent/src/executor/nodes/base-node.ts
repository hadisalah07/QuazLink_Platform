import { Page, BrowserContext } from 'playwright';

export interface NodeExecutionParams {
  jobId: string;
  content: string;
  images: string[];
  targetUrl?: string;
  socialAccountId: string;
  context: BrowserContext;
  page: Page;
  otaSelectors?: any;
  onProgress: (msg: string) => void;
  requestDriverAction?: (
    screenshotBase64: string,
    goal: string,
    stepIndex: number,
    history: any[]
  ) => Promise<any>;
}

export interface NodeExecutionResult {
  success: boolean;
  resultMessage?: string;
  screenshotBase64?: string;
  error?: string;
}

export interface IPlatformNode {
  readonly platform: string;
  execute(params: NodeExecutionParams): Promise<NodeExecutionResult>;
}
