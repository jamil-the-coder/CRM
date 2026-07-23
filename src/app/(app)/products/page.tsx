import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { NewProductForm } from "./new-product-form";
import { ProductActiveToggle } from "./product-active-toggle";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default async function ProductsPage() {
  const user = await getCurrentUser();
  const products = await db.product.findMany({
    where: { tenantId: user!.tenantId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Products
        </h1>
        <p className="text-sm text-zinc-500">
          Your price list — used as line items on quotes.
        </p>
      </div>

      <NewProductForm />

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-zinc-500">
            No products yet. Add one above to get started.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
            {products.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {product.name}
                    {product.sku && (
                      <span className="ml-2 font-normal text-zinc-500">
                        ({product.sku})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {currencyFormatter.format(Number(product.unitPrice))}
                  </p>
                </div>
                <ProductActiveToggle id={product.id} active={product.active} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
