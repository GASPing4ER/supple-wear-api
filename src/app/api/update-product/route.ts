/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper function to update product in e-Računi
async function updateProductInEracuni(productTitle: string, variant: any) {
  const response = await fetch("https://e-racuni.com/S8c/API", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: process.env.ERACUNI_USERNAME,
      md5pass: process.env.ERACUNI_PASSWORD_HASH,
      token: process.env.ERACUNI_TOKEN,
      method: "ProductUpdate",
      parameters: {
        product: {
          productCode: variant.barcode,
          name: `${productTitle} ${variant.title}`,
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
    const errorText = await response.text();
    console.error(`Failed to update product: ${response.statusText}`);
    console.error(`Error details: ${errorText}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Body:", body);

    // Ensure that variant_gids exist and variants are available in the payload
    if (body?.variant_gids && body?.variants) {
      console.log("Variants updated:", body.variant_gids);

      const oneMinuteAgo = new Date(Date.now() - 120 * 1000); // Current time - 2 minute

      // Loop through each updated variant
      for (const updatedVariant of body.variant_gids) {
        const variantId = updatedVariant.admin_graphql_api_id.split("/").pop(); // Extract ID

        // Find the matching variant in the product's variants array
        const variant = body.variants.find(
          (v: any) => v.id.toString() === variantId
        );

        if (variant) {
          const variantUpdatedAt = new Date(variant.updated_at);

          // Check if the variant was updated in the last minute
          if (variantUpdatedAt > oneMinuteAgo) {
            console.log(
              `Updating variant: ${variant.title} (${variant.id}) - Last updated: ${variant.updated_at}`
            );
            await updateProductInEracuni(body.title, variant);
            await delay(2000); // Add a small delay between API calls to prevent rate limits
          } else {
            console.log(
              `Skipping variant: ${variant.title} (${variant.id}) - Not updated recently`
            );
          }
        } else {
          console.warn(`Variant ID ${variantId} not found in product variants`);
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error handling webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
