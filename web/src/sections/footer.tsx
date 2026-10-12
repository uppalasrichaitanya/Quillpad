import { QuillMark } from "../components/quill-mark";
import { RELEASE } from "../release";

const REPO = "https://github.com/uppalasrichaitanya/Quillpad";

export function Footer() {
  return (
    <footer className="relative border-t border-desk-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 text-[14.5px] text-cream-soft sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-center gap-3">
          <QuillMark className="size-6 text-cream" />
          <span>Made for late-night revision.</span>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          <li>
            <a href={REPO} className="hover:text-cream">
              Source on GitHub
            </a>
          </li>
          <li>
            <a href={RELEASE.releasesUrl} className="hover:text-cream">
              Releases
            </a>
          </li>
          <li>
            <a href={`${REPO}#readme`} className="hover:text-cream">
              Read me
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
