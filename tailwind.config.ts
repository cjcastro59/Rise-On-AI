import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary-blue": "#A8DADC",
        "lavender": "#CDB4DB",
        "teal": "#B8E0D2",
        "light-gray": "#F5F5F5",
        "dark-text": "#4F4F4F",
        "success-green": "#B7E4C7",
        "warning-yellow": "#FFE8A1",
        "error-red": "#F4A6A6",
        "header-bg": "#EAF7F8"
      },
      fontFamily: {
        inter: ["var(--font-inter)", "system-ui", "sans-serif"],
        poppins: ["var(--font-poppins)", "system-ui", "sans-serif"],
        "dm-serif": ["var(--font-dm-serif-display)", "Georgia", "serif"],
      }
    },
  },
  plugins: [],
};
export default config;
