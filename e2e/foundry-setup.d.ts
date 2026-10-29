declare module "../../scripts/foundry-setup.mjs" {
  export const SCREEN_TIMEOUT_MS: number;
  export const EULA_HIDDEN_MS: number;

  export function withPhaseTimeout<T>(phase: string, ms: number, work: Promise<T>): Promise<T>;

  export function handleFoundryEula(
    page: {
      getByRole(
        role: string,
        options?: { name?: string | RegExp; exact?: boolean },
      ): {
        isVisible(): Promise<boolean>;
        check(): Promise<void>;
        click(): Promise<void>;
        waitFor(options: { state: "hidden" | "visible" }): Promise<void>;
      };
    },
    env?: NodeJS.ProcessEnv,
  ): Promise<void>;
}
