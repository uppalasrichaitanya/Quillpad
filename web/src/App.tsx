import { Download } from "./sections/download";
import { Faq } from "./sections/faq";
import { Features } from "./sections/features";
import { Files } from "./sections/files";
import { Footer } from "./sections/footer";
import { Hero } from "./sections/hero";
import { HowItWorks } from "./sections/how-it-works";
import { Nav } from "./sections/nav";

export default function App() {
  return (
    <>
      <div className="desk-light" aria-hidden="true" />
      <div className="desk-grain" aria-hidden="true" />
      <Nav />
      <main id="main" className="relative z-10">
        <Hero />
        <HowItWorks />
        <Features />
        <Files />
        <Download />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
