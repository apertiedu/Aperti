import { useRef, useEffect } from "react";
import * as THREE from "three";
// @ts-ignore
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BioSphere() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e8f5e9");
    const camera = new THREE.PerspectiveCamera(45, mountRef.current.clientWidth / 400, 0.1, 1000);
    camera.position.z = 8;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, 400);
    mountRef.current.appendChild(renderer.domElement);
    new OrbitControls(camera, renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 0.8);
    light.position.set(2,5,2);
    scene.add(light);
    const ambient = new THREE.AmbientLight(0x404040);
    scene.add(ambient);

    // Outer membrane (transparent)
    const membraneGeometry = new THREE.SphereGeometry(2.5, 32, 32);
    const membraneMaterial = new THREE.MeshPhongMaterial({ color: "#a5d6a7", opacity: 0.3, transparent: true });
    const membrane = new THREE.Mesh(membraneGeometry, membraneMaterial);
    scene.add(membrane);

    // Nucleus
    const nucleusGeometry = new THREE.SphereGeometry(1, 32, 32);
    const nucleusMaterial = new THREE.MeshPhongMaterial({ color: "#f44336" });
    const nucleus = new THREE.Mesh(nucleusGeometry, nucleusMaterial);
    scene.add(nucleus);

    // Mitochondria (smaller)
    for (let i = 0; i < 5; i++) {
      const mito = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 16, 16),
        new THREE.MeshPhongMaterial({ color: "#ff9800" })
      );
      mito.position.set(Math.sin(i)*1.5, Math.cos(i)*1.5, 0);
      scene.add(mito);
    }

    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <Card className="card-hover">
      <CardHeader><CardTitle>BioSphere™ – Cell Explorer</CardTitle></CardHeader>
      <CardContent><div ref={mountRef} className="w-full h-96 border rounded-lg" /></CardContent>
    </Card>
  );
}
