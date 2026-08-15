/**
 * If your repo already has a cosine-similarity util (e.g. lib/utils/computeSimilarity.ts,
 * used by the given academicSearchAgent), delete this stub and point
 * searchHelpers.ts's import at the real one instead — don't keep two.
 */
const computeSimilarity = (x: number[], y: number[]): number => {
  const dotProduct = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const magnitudeX = Math.sqrt(x.reduce((sum, xi) => sum + xi * xi, 0));
  const magnitudeY = Math.sqrt(y.reduce((sum, yi) => sum + yi * yi, 0));
  return dotProduct / (magnitudeX * magnitudeY);
};

export default computeSimilarity;
