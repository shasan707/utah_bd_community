import Reveal from "@/components/Reveal";

type SectionHeadingProps = {
  bangla: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
};

export default function SectionHeading({
  bangla,
  title,
  subtitle,
  align = "left",
}: SectionHeadingProps) {
  const alignCls = align === "center" ? "items-center text-center" : "items-start";
  return (
    <Reveal className={`flex flex-col gap-2 ${alignCls}`}>
      <span className="text-sm font-bold uppercase tracking-[0.2em] text-bengal-red">
        ✦ {bangla}
      </span>
      <h2 className="text-3xl font-bold tracking-tight text-forest-ink md:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-1 max-w-2xl text-base text-forest-ink/60 md:text-lg">
          {subtitle}
        </p>
      )}
    </Reveal>
  );
}
