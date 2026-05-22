"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function CloudMap3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Core Scene Setup
    const scene = new THREE.Scene();
    // Adds a deep space fading effect
    scene.fog = new THREE.FogExp2(0x020005, 0.06); 

    const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    camera.position.z = 15;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Optimizes for high-DPI screens
    mountRef.current.appendChild(renderer.domElement);

    // 2. Generate Server Nodes (Spheres)
    const nodes: THREE.Mesh[] = [];
    const nodeGeometry = new THREE.SphereGeometry(0.25, 16, 16);
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffcc });

    const group = new THREE.Group();
    scene.add(group);

    // Creates 50 random nodes in a 3D grid
    for (let i = 0; i < 50; i++) {
      const sphere = new THREE.Mesh(nodeGeometry, nodeMaterial);
      sphere.position.set(
        (Math.random() - 0.5) * 25,
        (Math.random() - 0.5) * 25,
        (Math.random() - 0.5) * 25
      );
      nodes.push(sphere);
      group.add(sphere);
    }

    // 3. Generate Network Traffic (Connecting Lines)
    const normalLineMaterial = new THREE.LineBasicMaterial({ color: 0x4444ff, transparent: true, opacity: 0.2 });
    const activeLineMaterial = new THREE.LineBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.6 }); // Purple active lines

    nodes.forEach((nodeA, index) => {
      nodes.slice(index + 1).forEach((nodeB) => {
        // Only connect nodes that are close to each other
        if (nodeA.position.distanceTo(nodeB.position) < 7) {
          const points = [nodeA.position, nodeB.position];
          const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
          // Randomly make some lines represent "high traffic" (purple)
          const isHighTraffic = Math.random() > 0.8;
          const line = new THREE.Line(lineGeometry, isHighTraffic ? activeLineMaterial : normalLineMaterial);
          group.add(line);
        }
      });
    });

    // 4. The Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      // Slowly rotate the entire cloud infrastructure
      group.rotation.x += 0.001;
      group.rotation.y += 0.002;
      
      renderer.render(scene, camera);
    };
    animate();

    // 5. Handle Window Resizing smoothly
    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    // 6. Memory Cleanup (Crucial for Next.js hot-reloading)
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    // We removed the boxed borders and set it to fill the entire absolute space
    <div 
      ref={mountRef} 
      className="absolute inset-0 w-full h-full overflow-hidden cursor-crosshair"
    >
      <div className="absolute top-6 left-6 z-10 font-mono text-xs text-neutral-400 space-y-1 bg-black/60 p-4 rounded-lg backdrop-blur-md border border-white/10">
        <p className="text-emerald-400 font-bold">● LIVE: 50 GLOBAL REGIONS</p>
        <p>NETWORK LATENCY: 12ms avg</p>
        <p className="text-purple-400 animate-pulse mt-2">DETECTING HIGH TRAFFIC EVENTS...</p>
      </div>
    </div>
  );
}