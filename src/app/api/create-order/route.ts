/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

async function createInvoiceInEracuni(order: any) {
  console.log("Creating invoice in e-Računi for order:", order.id);

  const response = await fetch("https://e-racuni.com/S8c/API", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: process.env.ERACUNI_USERNAME,
      md5pass: process.env.ERACUNI_PASSWORD_HASH,
      token: process.env.ERACUNI_TOKEN,
      method: "SalesInvoiceCreate",
      parameters: {
        SalesInvoice: {
          buyerName: `${order.customer.first_name} ${order.customer.last_name}`,
          buyerEmail: order.customer.email,
          Items: order.line_items.map((item: any) => ({
            productCode: item.sku,
            quantity: item.quantity,
          })),
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Failed to create invoice: ${response.statusText}`);
    console.error(`Error details: ${errorText}`);
  }

  const responseData = await response.json();
  console.log("✅ Invoice creation response:", responseData);
  return responseData;
}

async function getInvoicePublicURL(documentID: string) {
  console.log(`Fetching public URL for documentID: ${documentID}`);

  const response = await fetch("https://e-racuni.com/S8c/API", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: process.env.ERACUNI_USERNAME,
      md5pass: process.env.ERACUNI_PASSWORD_HASH,
      token: process.env.ERACUNI_TOKEN,
      method: "SalesInvoiceGetPublicURL",
      parameters: {
        documentID: documentID,
      },
    }),
  });

  if (!response.ok) {
    console.error(
      `❌ Failed to get invoice public URL: ${response.statusText}`
    );
    throw new Error("Failed to get invoice public URL");
  }

  const responseData = await response.json();
  console.log("✅ Public URL response:", responseData);
  return responseData;
}

export async function POST(req: Request) {
  try {
    console.log("📩 Received new webhook request");

    const rawBody = await req.text();
    console.log("📜 Raw request body:", rawBody);

    const order = JSON.parse(rawBody);
    console.log("🛍️ Processed order:", order.id);

    // Create invoice
    const invoiceData = await createInvoiceInEracuni(order);
    const documentID = invoiceData.response.result.documentID;
    console.log("🆔 Extracted documentID:", documentID);

    if (!documentID) {
      throw new Error("❌ Missing documentID in invoice response");
    }

    // Get public invoice URL
    const publicURLData = await getInvoicePublicURL(documentID);
    const invoiceURL = publicURLData.response.result.publicURL;
    console.log("🌍 Invoice Public URL:", invoiceURL);

    if (!invoiceURL) {
      throw new Error("❌ Failed to retrieve invoice public URL");
    }

    // Send invoice URL as a note in Shopify order
    console.log(`🔄 Updating Shopify order ${order.id} with invoice URL...`);

    const response = await fetch(
      `https://supple-wear.myshopify.com/admin/api/2025-04/orders/6580842824018.json`,
      {
        method: "PUT",
        headers: {
          "X-Shopify-Access-Token": process.env.SHOPIFY_API_PASSWORD as string,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order: {
            id: order.id,
            note: `Invoice generated: ${invoiceURL}`,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error(
        "❌ Failed to update Shopify order:",
        await response.text()
      );
      throw new Error("Failed to update Shopify order with invoice URL");
    }

    console.log(
      `✅ Successfully updated Shopify order ${order.id} with invoice URL.`
    );

    return NextResponse.json({ success: true, invoiceURL });
  } catch (error: any) {
    console.error("🚨 Webhook processing error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
