import { BrandMark } from "./BrandMark";

export function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <BrandMark className="h-12 w-12 animate-breathe text-bone" />
      <p className="mt-7 font-display text-[22px] italic text-sage">
        Preparing your practice.
      </p>
      <div className="mt-6 h-px w-36 overflow-hidden bg-bone/10">
        <div className="h-px w-1/3 animate-scan bg-lichen" />
      </div>
    </div>
  );
}
