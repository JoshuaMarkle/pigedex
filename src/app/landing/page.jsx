export default function LandingPage() {
  return (
    <header className="relative isolate grid place-items-center overflow-hidden bg-background px-6 p-32 text-center">
      {/* Background grid */}
      <div className="pointer-events-none absolute inset-0 -z-10 mx-auto w-8xl bg-[radial-gradient(circle,var(--color-dot)_2px,transparent_2px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_at_50%_30%,blue_50%,transparent_65%)] [-webkit-mask-image:radial-gradient(ellipse_at_50%_30%,blue_50%,transparent_65%)]" />

      {/* Sticker title and subtitle */}
      <div className="space-y-8">
        <h1
          data-text="Every pigeon, confidently managed all in one place."
          className="relative inline-block text-[clamp(2.5rem,1.757rem+3.05vw,4.5rem)] font-medium leading-none -rotate-1 tracking-tight text-foreground before:absolute before:inset-0 before:-z-10 before:content-[attr(data-text)] before:text-white before:[-webkit-text-stroke:16px_white] before:[paint-order:stroke_fill] before:drop-shadow-[0px_2px_5px_rgb(0_0_0_/_0.25)]"
        >
          <span className="text-blue">Every pigeon, </span>
          confidently<br></br>
          managed all in one place.
        </h1>

        <p className="text-xl font-medium text-muted-foreground">
          Pigedex is the all in one platform for modern loft management.
        </p>

        {/* Button */}
        <button className="mt-8 p-2 px-16 rounded-full shadow-lg font-medium text-white bg-blue hover:bg-blue/80 border-6 border-white rotate-1 hover:rotate-0 transition-all">
          Start now
        </button>
      </div>
    </header>
  );
}
