// Image loader for the static GitHub Pages export: serves files as-is, under the site's base path.
export default function imageLoader({ src, width }: { src: string; width: number }) {
  if (!src.startsWith('/')) return src;
  return encodeURI(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${src}?w=${width}`);
}
