import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlaskConical, Droplets, Thermometer } from "lucide-react";

const CHEMICALS = [
  { name: "HCl (acid)", color: "#d4e6f1" },
  { name: "NaOH (base)", color: "#f9e79f" },
  { name: "CuSO₄ (salt)", color: "#aed6f1" },
  { name: "AgNO₃ (silver nitrate)", color: "#e8daef" },
];

const REACTIONS: Record<string, { color: string; precipitate: boolean; gas: boolean; tempChange: number; description: string }> = {
  "HCl-NaOH": { color: "#b3e6b3", precipitate: false, gas: false, tempChange: 2, description: "Neutralization — salt and water formed." },
  "HCl-CuSO₄": { color: "#aed6f1", precipitate: false, gas: false, tempChange: 0, description: "No visible reaction." },
  "NaOH-CuSO₄": { color: "#aed6f1", precipitate: true, gas: false, tempChange: 1, description: "Blue precipitate of Cu(OH)₂." },
  "AgNO₃-HCl": { color: "#f5f5f5", precipitate: true, gas: false, tempChange: 0, description: "White precipitate of AgCl." },
};

export default function ReactSphere() {
  const [chemicalA, setChemicalA] = useState("");
  const [chemicalB, setChemicalB] = useState("");
  const [reaction, setReaction] = useState<any>(null);
  const [mixed, setMixed] = useState(false);

  const handleMix = () => {
    const key1 = `${chemicalA}-${chemicalB}`;
    const key2 = `${chemicalB}-${chemicalA}`;
    const result = REACTIONS[key1] || REACTIONS[key2];
    if (result) {
      setReaction(result);
    } else {
      setReaction({ color: "#f0f0f0", precipitate: false, gas: false, tempChange: 0, description: "No reaction or unknown combination." });
    }
    setMixed(true);
  };

  return (
    <Card className="card-hover">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-primary" /> ReactSphere — Chemistry Lab</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm">Chemical A</label>
            <Select value={chemicalA} onValueChange={setChemicalA}>
              <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
              <SelectContent>
                {CHEMICALS.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm">Chemical B</label>
            <Select value={chemicalB} onValueChange={setChemicalB}>
              <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
              <SelectContent>
                {CHEMICALS.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleMix} disabled={!chemicalA || !chemicalB} className="w-full">
          <Droplets className="h-4 w-4 mr-2" /> Mix Chemicals
        </Button>

        {mixed && reaction && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl border border-border space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full border-2" style={{ backgroundColor: reaction.color }} />
              <div>
                <p className="font-medium">{reaction.description}</p>
                <div className="flex gap-2 mt-1">
                  {reaction.precipitate && <Badge variant="secondary">Precipitate</Badge>}
                  {reaction.gas && <Badge variant="secondary">Gas evolved</Badge>}
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Thermometer className="h-3 w-3" /> {reaction.tempChange > 0 ? `+${reaction.tempChange}°C` : "No change"}
                  </Badge>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
