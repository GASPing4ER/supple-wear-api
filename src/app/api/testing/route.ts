import { NextRequest, NextResponse } from "next/server";

async function fetchShopifyProducts() {
  const response = await fetch(
    "https://supple-wear.myshopify.com/admin/api/2024-01/products.json",
    {
      headers: {
        "X-Shopify-Access-Token": process.env.SHOPIFY_API_PASSWORD!,
        "Content-Type": "application/json",
      },
    }
  );
  if (!response.ok) {
    throw new Error("Failed to fetch Shopify products");
  }
  return await response.json();
}

// Helper function to sync products from Shopify to e-Računi
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncProductsToEracuni(shopifyProducts: any) {
  const data = [];
  for (const product of shopifyProducts) {
    // Loop over the variants of the product
    for (const variant of product.variants) {
      data.push({
        product: product,
        variant: variant,
      });
    }
  }
  return data;
}

// API route handler to sync products
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(req: NextRequest) {
  try {
    // Fetch products from Shopify
    const shopifyData = await fetchShopifyProducts();
    const shopifyProducts = shopifyData.products;

    // Sync products to e-Računi
    const data = await syncProductsToEracuni(shopifyProducts);

    return NextResponse.json({
      success: true,
      data,
      message: "Products synced successfully",
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: "Failed to sync products",
      error: error,
    });
  }
}
