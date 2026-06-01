import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CircuitBoard, FlaskConical, Shapes, Microscope } from "lucide-react";
import ForgeField from "./labs/forge-field";
import ReactSphere from "./labs/react-sphere";
import Geometrix from "./labs/geometric";
import BioSphere from "./labs/biosphere";

export default function SimVerse() {
  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">
          SimVerse
        </h1>
        <p className="text-muted-foreground">Four interactive labs — physics, chemistry, geometry, biology.</p>
      </motion.div>

      <Tabs defaultValue="physics" className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto gap-1 p-1">
          <TabsTrigger value="physics" className="gap-2 text-xs py-2">
            <CircuitBoard className="h-4 w-4" /> ForgeField
          </TabsTrigger>
          <TabsTrigger value="chemistry" className="gap-2 text-xs py-2">
            <FlaskConical className="h-4 w-4" /> ReactSphere
          </TabsTrigger>
          <TabsTrigger value="geometry" className="gap-2 text-xs py-2">
            <Shapes className="h-4 w-4" /> Geometrix
          </TabsTrigger>
          <TabsTrigger value="biology" className="gap-2 text-xs py-2">
            <Microscope className="h-4 w-4" /> BioSphere
          </TabsTrigger>
        </TabsList>

        <TabsContent value="physics">
          <ForgeField />
        </TabsContent>

        <TabsContent value="chemistry">
          <ReactSphere />
        </TabsContent>

        <TabsContent value="geometry">
          <Geometrix />
        </TabsContent>

        <TabsContent value="biology">
          <BioSphere />
        </TabsContent>
      </Tabs>
    </div>
  );
}
