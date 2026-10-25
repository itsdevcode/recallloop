import { Button } from "@/components/button";
import { Container } from "@/components/container";

export default function Home() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="py-7 sm:py-9">
        <Container>
          <span className="text-lg font-semibold tracking-tight">RecallLoop</span>
        </Container>
      </header>
      <main className="flex flex-1 items-center py-16 sm:py-24">
        <Container>
          <div className="max-w-3xl">
            <p className="mb-7 inline-block rounded-full bg-sage px-4 py-2 text-sm font-medium">
              Make room for lasting knowledge
            </p>
            <h1 className="text-5xl leading-tight font-semibold tracking-tight sm:text-7xl">
              Save it. Learn it.
              <br />
              Remember it.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
              Turn saved articles into personalized recall cards and remember what matters.
            </p>
            <div className="mt-9">
              <Button disabled aria-describedby="launch-note">Get Started</Button>
              <p id="launch-note" className="mt-3 text-sm text-muted">
                Coming soon. Your next chapter in learning.
              </p>
            </div>
          </div>
        </Container>
      </main>
      <footer className="py-7">
        <Container>
          <p className="text-sm text-muted">RecallLoop · Save it. Learn it. Remember it.</p>
        </Container>
      </footer>
    </div>
  );
}
