import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="gutter mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-4xl font-semibold">Page not found</h1>
      <p className="text-muted">
        That page doesn't exist. If you scanned a QR code at your table, try the link below.
      </p>
      <Link
        to="/"
        className="inline-flex min-h-12 items-center rounded bg-forest px-5 font-semibold text-ivory"
      >
        Go to the drinks menu
      </Link>
    </main>
  );
}
