declare module "react-google-recaptcha" {
  import * as React from "react";

  export interface ReCAPTCHAProps {
    sitekey: string;
    onChange?: (token: string | null) => void;
    size?: "compact" | "normal" | "invisible";
    theme?: "dark" | "light";
    tabindex?: number;
  }

  export default class ReCAPTCHA extends React.Component<ReCAPTCHAProps> {
    executeAsync(): Promise<string | null>;
    reset(): void;
  }
}
