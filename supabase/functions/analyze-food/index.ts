import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function classifyHealth(nutrients: Record<string, number>): string {
  const calories = nutrients["Energy"] || 0;
  const fat = nutrients["Total lipid (fat)"] || 0;
  const sugar = nutrients["Sugars, total including NLEA"] || nutrients["Sugars, total"] || 0;
  const protein = nutrients["Protein"] || 0;

  if (calories < 250 && fat < 10 && sugar < 15 && protein > 2) {
    return "Healthy";
  }
  return "Unhealthy";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const USDA_API_KEY = Deno.env.get("USDA_API_KEY");
    if (!USDA_API_KEY) throw new Error("USDA_API_KEY not configured");

    // Step 1: Identify the food using AI vision
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a food identification expert. Identify the food item in the image. Respond with ONLY the food name, nothing else. Be specific (e.g. 'grilled chicken breast' not just 'chicken'). If you cannot identify a food item, respond with 'unknown'.",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
              { type: "text", text: "What food is this?" },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const foodName = aiData.choices?.[0]?.message?.content?.trim() || "unknown";

    if (foodName.toLowerCase() === "unknown") {
      return new Response(JSON.stringify({ error: "Could not identify food in the image. Please try a clearer photo." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Get nutrition from USDA
    const usdaUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(foodName)}&api_key=${USDA_API_KEY}&pageSize=1`;
    const usdaResponse = await fetch(usdaUrl);
    const usdaData = await usdaResponse.json();

    const nutrients: Record<string, number> = {};
    let foodDescription = foodName;

    if (usdaData.foods && usdaData.foods.length > 0) {
      const food = usdaData.foods[0];
      foodDescription = food.description || foodName;
      for (const n of food.foodNutrients || []) {
        nutrients[n.nutrientName] = n.value;
      }
    }

    const healthStatus = classifyHealth(nutrients);

    // Pick key nutrients to display
    const keyNutrients = [
      "Energy", "Protein", "Total lipid (fat)", "Carbohydrate, by difference",
      "Fiber, total dietary", "Sugars, total including NLEA", "Sugars, total",
      "Sodium, Na", "Cholesterol", "Calcium, Ca", "Iron, Fe",
      "Vitamin C, total ascorbic acid", "Vitamin A, IU",
    ];

    const displayNutrients: Record<string, { value: number; unit: string }> = {};
    if (usdaData.foods?.[0]) {
      for (const n of usdaData.foods[0].foodNutrients || []) {
        if (keyNutrients.includes(n.nutrientName)) {
          displayNutrients[n.nutrientName] = { value: n.value, unit: n.unitName || "" };
        }
      }
    }

    return new Response(JSON.stringify({
      food: foodName,
      description: foodDescription,
      healthStatus,
      nutrients: displayNutrients,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-food error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
