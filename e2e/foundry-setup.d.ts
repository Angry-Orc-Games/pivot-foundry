declare module "../../scripts/foundry-setup.mjs" {
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
