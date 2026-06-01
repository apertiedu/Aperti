import { useRef, useEffect } from "react";
import * as THREE from "three";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Geometrix() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f5f5f5");
    const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / 400, 0.1, 1000);
    camera.position.z = 5;
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(mountRef.current.clientWidth, 400);
    mountRef.current.appendChild(renderer.domElement);
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial({ color: "#00796B" });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    const light = new THREE.AmbientLight(0x404040);
    scene.add(light);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    scene.add(dirLight);
    const animate = () => {
      requestAnimationFrame(animate);
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      renderer.render(scene, camera);
    };
    animate();
    return () => { mountRef.current?.removeChild(renderer.domElement); };
  }, []);

  return (
    <Card className="card-hover">
      <CardHeader><CardTitle>Geometrix™ — 3D Shapes</CardTitle></CardHeader>
      <CardContent><div ref={mountRef} className="w-full h-96 border rounded-lg" /></CardContent>
    </Card>
  );
}
