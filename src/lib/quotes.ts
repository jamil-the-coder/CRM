type LineLike = { quantity: unknown; unitPrice: unknown };

/** Always computed from lines, never cached on the Quote row — see schema.prisma comment. */
export function computeQuoteTotal(lines: LineLike[]): number {
  return lines.reduce(
    (sum, line) => sum + Number(line.quantity) * Number(line.unitPrice),
    0,
  );
}
