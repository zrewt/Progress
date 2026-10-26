import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#11140F",
        ink: {
          950: "#0B0D09",
          900: "#11140F",
          850: "#171B14",
          800: "#1D2219",
          700: "#262C21",
          600: "#31382A",
        },
        bone: {
          DEFAULT: "#E9E2D0",
          dim: "#D3CCB9",
          faint: "#BDB7A4",
        },
        sage: {
          DEFAULT: "#A9A48F",
          dim: "#8B8877",
          deep: "#918E7C",
        },
        lichen: {
          DEFAULT: "#C6CB9C",
          dim: "#9BA177",
        },
        copper: {
          DEFAULT: "#C17845",
          light: "#D99A68",
          dim: "#8E5A35",
        },
        clay: "#BE7360",
        heather: "#B3A3B8",
        ochre: "#C1A473",
        moss: "#92A89B",
      },
      fontFamily: {
        display: ["var(--font-newsreader)", "Georgia", "serif"],
        sans: [
          "var(--font-manrope)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["var(--font-dm-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        xs: "2px",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        breathe: {
          "0%, 100%": { opacity: "0.55", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.035)" },
        },
        "leaf-fall": {
          "0%": {
            opacity: "0",
            transform: "translate3d(0, -12px, 0) rotate(0deg)",
          },
          "12%": { opacity: "1" },
          "100%": {
            opacity: "0",
            transform: "translate3d(var(--drift), 68vh, 0) rotate(320deg)",
          },
        },
        toast: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        draw: {
          "0%": { strokeDashoffset: "1" },
          "100%": { strokeDashoffset: "0" },
        },
        scan: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(420%)" },
        },
      },
      animation: {
        rise: "rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        breathe: "breathe 4.5s ease-in-out infinite",
        "leaf-fall": "leaf-fall 2.4s cubic-bezier(0.25, 0.8, 0.4, 1) forwards",
        toast: "toast 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
        draw: "draw 1.8s ease-out forwards",
        scan: "scan 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
