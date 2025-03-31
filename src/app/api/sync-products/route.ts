/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

// Helper function to fetch products from e-Računi
async function fetchEracuniProducts() {
  const response = await fetch("https://e-racuni.com/S8c/API", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: process.env.ERACUNI_USERNAME,
      md5pass: process.env.ERACUNI_PASSWORD_HASH,
      token: process.env.ERACUNI_TOKEN,
      method: "ProductList",
      parameters: {},
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch e-Računi products");
  }

  const data = await response.json();
  return data.response.result || [];
}

// Helper function to sync products from Shopify to e-Računi
async function syncProductsToEracuni(shopifyProducts: any) {
  console.log("RUNNING SYNC PRODUCTS TO ERACUNI");

  console.log("FETCHING PRODUCTS FROM E-RAČUNI");
  const eracuniProducts = await fetchEracuniProducts();

  for (const product of shopifyProducts) {
    console.log("INSIDE PRODUCTS FOR LOOP");
    // Loop over the variants of the product
    for (const variant of product.variants) {
      console.log("INSIDE VARIANTS FOR LOOP");
      const existingProduct = eracuniProducts.find(
        (p: any) => p.productCode === variant.barcode
      ); // Compare with barcode
      console.log("CHECKING FOR EXISTING PRODUCTS");
      if (!existingProduct) {
        console.log(
          "Adding new product:",
          `${product.title}, ${variant.title}`
        );
        await createProductInEracuni(product, variant);
        await delay(2000); // Delay of 1 second between requests
      } else {
        // If product variant exists, update it
        console.log(
          "Updating existing product:",
          `${product.title}, ${variant.title}`
        );
        await updateProductInEracuni(
          existingProduct.documentID,
          product,
          variant
        );
        await delay(2000); // Delay of 1 second between requests
      }
    }
  }
}
// Helper function to create a product in e-Računi
async function createProductInEracuni(product: any, variant: any) {
  const response = await fetch("https://e-racuni.com/S8c/API", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: process.env.ERACUNI_USERNAME,
      md5pass: process.env.ERACUNI_PASSWORD_HASH,
      token: process.env.ERACUNI_TOKEN,
      method: "ProductCreate", // Assuming this is the correct method for creating products
      parameters: {
        product: {
          productCode: variant.barcode,
          name: `${product.title} ${variant.title}`,
          grossPrice: parseFloat(variant.price), // Example price
          packingQuantity: variant.inventory_quantity, // Example stock
          vatTransactionType: "0",
          vatPercentage: 22,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text(); // Log response text for debugging
    console.error(`Failed to create product: ${response.statusText}`);
    console.error(`Error details: ${errorText}`);
  }
}

// Helper function to update product in e-Računi
async function updateProductInEracuni(
  documentID: string,
  product: any,
  variant: any
) {
  const response = await fetch("https://e-racuni.com/S8c/API", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: process.env.ERACUNI_USERNAME,
      md5pass: process.env.ERACUNI_PASSWORD_HASH,
      token: process.env.ERACUNI_TOKEN,
      method: "ProductUpdate", // Assuming this is the correct method for updating products
      parameters: {
        // Assuming 'product' is the correct parameter name
        product: {
          // Assuming 'product' is the correct parameter name
          documentID, // Assuming documentID is required for update
          productCode: variant.barcode,
          name: `${product.title} ${variant.title}`,
          grossPrice: parseFloat(variant.price),
          packingQuantity: variant.inventory_quantity,
          unit: "kos",
          vatTransactionType: "0",
          vatPercentage: 22,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text(); // Log response text for debugging
    console.error(`Failed to create product: ${response.statusText}`);
    console.error(`Error details: ${errorText}`);
  }
}

// API route handler to sync products
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(req: NextRequest) {
  console.log("RUNNING API!");
  try {
    // Fetch products from Shopify
    const shopifyData = await fetchShopifyProducts();
    const shopifyProducts = shopifyData.products;

    await syncProductsToEracuni(shopifyProducts);

    return NextResponse.json({
      success: true,
      message: "Products synced successfully",
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json({
      success: false,
      message: "Failed to sync products",
      error: error instanceof Error ? error.message : JSON.stringify(error),
    });
  }
}
