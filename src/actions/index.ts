export async function fetchEracuniProducts() {
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
