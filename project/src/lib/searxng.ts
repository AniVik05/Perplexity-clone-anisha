import axios from 'axios';

interface SearxngSearchOptions {
  categories?: string[];
  engines?: string[];
  language?: string;
  pageno?: number;
}

interface SearxngSearchResult {
  title: string;
  url: string;
  img_src?: string;
  thumbnail_src?: string;
  thumbnail?: string;
  content?: string;
  author?: string;
  iframe_src?: string;
}

/**
 * NOTE: This assumes the same `searchSearxng(query, opts)` signature your
 * given reference agents (academicSearchAgent / imageSearchAgent) already
 * import — most likely from this exact path (`lib/searxng`). If your repo
 * already has this file, DELETE this stub and keep the original; do not
 * have two copies.
 */
export const searchSearxng = async (
  query: string,
  opts?: SearxngSearchOptions,
) => {
  const url = new URL(`${process.env.SEARXNG_API_URL}/search`);
  url.searchParams.append('q', query);
  url.searchParams.append('format', 'json');

  if (opts) {
    Object.keys(opts).forEach((key) => {
      const value = (opts as any)[key];
      if (Array.isArray(value)) {
        url.searchParams.append(key, value.join(','));
      } else {
        url.searchParams.append(key, value as string);
      }
    });
  }

  const res = await axios.get(url.toString());

  const results: SearxngSearchResult[] = res.data.results;
  const suggestions: string[] = res.data.suggestions;

  return { results, suggestions };
};
