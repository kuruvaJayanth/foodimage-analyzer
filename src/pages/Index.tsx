import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Camera, Leaf, AlertTriangle, Loader2, Apple, Flame, Droplets, Beef } from "lucide-react";

interface AnalysisResult {
  food: string;
  description: string;
  healthStatus: "Healthy" | "Unhealthy";
  nutrients: Record<string, { value: number; unit: string }>;
}

const Index = () => {
  const [image, setImage] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please upload an image under 5MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImage(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
      setResult(null);
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImage(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
      setResult(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const analyzeFood = async () => {
    if (!imageBase64) return;
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-food", {
        body: { imageBase64 },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getNutrientIcon = (name: string) => {
    if (name.includes("Energy")) return <Flame className="h-4 w-4" />;
    if (name.includes("Protein")) return <Beef className="h-4 w-4" />;
    if (name.includes("lipid")) return <Droplets className="h-4 w-4" />;
    return <Apple className="h-4 w-4" />;
  };

  const getMaxValue = (name: string) => {
    if (name.includes("Energy")) return 500;
    if (name.includes("Protein")) return 50;
    if (name.includes("lipid")) return 65;
    if (name.includes("Carbohydrate")) return 300;
    if (name.includes("Fiber")) return 25;
    if (name.includes("Sugar")) return 50;
    if (name.includes("Sodium")) return 2300;
    if (name.includes("Cholesterol")) return 300;
    return 100;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
            <Leaf className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">NutriScan</h1>
            <p className="text-xs text-muted-foreground">AI-Powered Food Analysis</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" /> Upload Food Image
            </CardTitle>
            <CardDescription>
              Take a photo or upload an image of your food to get instant nutritional analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById("file-input")?.click()}
            >
              {image ? (
                <img src={image} alt="Food preview" className="max-h-64 mx-auto rounded-lg object-cover" />
              ) : (
                <div className="space-y-3">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">Drag & drop or click to upload</p>
                  <p className="text-xs text-muted-foreground">Supports JPG, PNG, WEBP (max 5MB)</p>
                </div>
              )}
              <input
                id="file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>

            {image && (
              <div className="mt-4 flex gap-3">
                <Button onClick={analyzeFood} disabled={loading} className="flex-1">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
                    </>
                  ) : (
                    "Analyze Food"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setImage(null); setImageBase64(null); setResult(null); }}
                >
                  Clear
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Food & Health Status */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground capitalize">{result.food}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{result.description}</p>
                  </div>
                  <Badge
                    variant={result.healthStatus === "Healthy" ? "default" : "destructive"}
                    className="text-sm px-3 py-1 shrink-0"
                  >
                    {result.healthStatus === "Healthy" ? (
                      <Leaf className="h-3 w-3 mr-1" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 mr-1" />
                    )}
                    {result.healthStatus}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Nutrients */}
            <Card>
              <CardHeader>
                <CardTitle>Nutritional Breakdown</CardTitle>
                <CardDescription>Per 100g serving (approximate)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.keys(result.nutrients).length === 0 ? (
                  <p className="text-muted-foreground text-sm">No nutritional data available.</p>
                ) : (
                  Object.entries(result.nutrients).map(([name, { value, unit }]) => (
                    <div key={name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-foreground">
                          {getNutrientIcon(name)}
                          {name}
                        </span>
                        <span className="font-medium text-foreground">
                          {value} {unit}
                        </span>
                      </div>
                      <Progress
                        value={Math.min((value / getMaxValue(name)) * 100, 100)}
                        className="h-2"
                      />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Health criteria explanation */}
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">
                  <strong>Health classification criteria:</strong> Food is considered healthy if per serving it has
                  fewer than 250 calories, less than 10g fat, less than 15g sugar, and more than 2g protein.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
