import { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const shapes = {
  cube: new THREE.BoxGeometry(2,2,2),
  sphere: new THREE.SphereGeometry(1.2,32,32),
  pyramid: new THREE.ConeGeometry(1.3, 2, 4),
  cylinder: new THREE.CylinderGeometry(1,1,2,32),
};

export default function Geometrix() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [shape, setShape] = useState<keyof typeof shapes>("cube");

  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f5f5f5");
    const camera = new THREE.PerspectiveCamera(50, mountRef.current.clientWidth / 400, 0.1, 1000);
    camera.position.set(4,3,5);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, 400);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5,10,5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const geometry = shapes[shape];
    const material = new THREE.MeshStandardMaterial({ color: "#00796B", roughness: 0.4, metalness: 0.1 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current) return;
      renderer.setSize(mountRef.current.clientWidth, 400);
      camera.aspect = mountRef.current.clientWidth / 400;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, [shape]);

  return (
    <Card className="card-hover">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Geometrix™ – 3D Lab</CardTitle>
        <div className="flex gap-2">
          {Object.keys(shapes).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={s === shape ? "default" : "outline"}
              onClick={() => setShape(s as keyof typeof shapes)}
            >
              {s}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div ref={mountRef} className="w-full h-96 border rounded-lg" />
      </CardContent>
    </Card>
  );
}
