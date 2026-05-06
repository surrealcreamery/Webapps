import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Grid } from '@react-three/drei';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import * as THREE from 'three';

const ITEM_COLORS = ['#4FC3F7', '#81C784', '#FFB74D', '#E57373', '#BA68C8', '#4DB6AC', '#FFD54F', '#F06292'];
const BOX_GAP = 1.5;

function BoxWireframe({ size, position }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#999" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(...size)]} />
        <lineBasicMaterial color="#666" linewidth={1} />
      </lineSegments>
    </group>
  );
}

function PackedItem({ size, position, color, label }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} transparent opacity={0.85} />
      </mesh>
      {label && (
        <Text
          position={[0, size[1] / 2 + 0.01, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={Math.min(size[0], size[2]) * 0.6}
          color="#000"
          fontWeight={700}
          anchorX="center"
          anchorY="middle"
          depthOffset={-1}
        >
          {label}
        </Text>
      )}
    </group>
  );
}

function BoxGroup({ box, offsetX, colorStart, globalIndexStart }) {
  const { dimensions, items } = box;
  const boxSize = [dimensions.length, dimensions.height, dimensions.width];
  const boxCenter = [offsetX, dimensions.height / 2, 0];

  // Pack items inside box using shelf-packing: fill along X, then Z, then stack Y
  const itemMeshes = useMemo(() => {
    const boxL = dimensions.length;
    const boxW = dimensions.width;
    const meshes = [];
    let shelfY = 0;
    let shelfH = 0;
    let curX = 0;
    let curZ = 0;
    let rowMaxD = 0;

    items.forEach((item, i) => {
      const w = item.lengthIn;
      const h = item.heightIn;
      const d = item.widthIn;

      if (curX + w > boxL + 0.01) {
        curX = 0;
        curZ += rowMaxD;
        rowMaxD = 0;
      }
      if (curZ + d > boxW + 0.01) {
        shelfY += shelfH;
        shelfH = 0;
        curX = 0;
        curZ = 0;
        rowMaxD = 0;
      }

      const px = -boxL / 2 + curX + w / 2;
      const py = shelfY + h / 2;
      const pz = -boxW / 2 + curZ + d / 2;

      meshes.push({
        key: i,
        size: [w, h, d],
        position: [offsetX + px, py, pz],
        color: ITEM_COLORS[(colorStart + i) % ITEM_COLORS.length],
        label: String(globalIndexStart + i + 1),
      });

      curX += w;
      if (d > rowMaxD) rowMaxD = d;
      if (h > shelfH) shelfH = h;
    });
    return meshes;
  }, [items, dimensions, offsetX, colorStart, globalIndexStart]);

  return (
    <group>
      <BoxWireframe size={boxSize} position={boxCenter} />
      {itemMeshes.map(m => (
        <PackedItem key={m.key} size={m.size} position={m.position} color={m.color} label={m.label} />
      ))}
      <Text
        position={[offsetX, -0.6, 0]}
        fontSize={0.4}
        color="#555"
        anchorX="center"
        anchorY="top"
      >
        {box.boxName}
      </Text>
      <Text
        position={[offsetX, -1.1, 0]}
        fontSize={0.3}
        color="#888"
        anchorX="center"
        anchorY="top"
      >
        {`${dimensions.length}×${dimensions.width}×${dimensions.height}" • ${box.usedWeightOz.toFixed(1)}oz`}
      </Text>
    </group>
  );
}

export default function PackageViewer3D({ binPacking }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const height = isMobile ? 200 : 250;

  const { boxes, totalWidth, legend } = useMemo(() => {
    let x = 0;
    let colorIdx = 0;
    let globalIdx = 0;
    const boxes = binPacking.map((box) => {
      const w = box.dimensions.length;
      const offsetX = x + w / 2;
      x += w + BOX_GAP;
      const b = { ...box, offsetX, colorStart: colorIdx, globalIndexStart: globalIdx };
      colorIdx += box.items.length;
      globalIdx += box.items.length;
      return b;
    });
    const totalWidth = x - BOX_GAP;
    // Build per-package legend with item numbers for cross-referencing the 3D view
    let legendIdx = 0;
    const legend = binPacking.map((box) => {
      const entries = [];
      for (const item of box.items) {
        const name = item.name || item.sku || '?';
        const last = entries[entries.length - 1];
        if (last && last.name === name) {
          last.nums.push(legendIdx + 1);
        } else {
          entries.push({ name, nums: [legendIdx + 1] });
        }
        legendIdx++;
      }
      return { boxName: box.boxName, entries };
    });
    return { boxes, totalWidth, legend };
  }, [binPacking]);

  const maxHeight = Math.max(...binPacking.map(b => b.dimensions.height), 4);
  // Use scene diagonal so the camera can see everything even when orbited to the side
  const sceneRadius = Math.sqrt((totalWidth / 2) ** 2 + (maxHeight / 2) ** 2);
  const fov = 50;
  const camDist = sceneRadius / Math.tan((fov / 2) * Math.PI / 180) + 2;

  return (
    <>
      <Canvas
        style={{ height, width: '100%', borderRadius: 8, background: '#fafafa' }}
        camera={{ position: [camDist * 0.6, camDist * 0.5, camDist * 0.6], fov, near: 0.1, far: 500 }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={0.8} />
        <group position={[-totalWidth / 2, 0, 0]}>
          {boxes.map((box, i) => (
            <BoxGroup key={i} box={box} offsetX={box.offsetX} colorStart={box.colorStart} globalIndexStart={box.globalIndexStart} />
          ))}
        </group>
        <Grid
          args={[40, 40]}
          position={[0, -0.01, 0]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#ddd"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#ccc"
          fadeDistance={30}
          infiniteGrid
        />
        <OrbitControls
          enableZoom={!isMobile}
          enablePan={false}
          target={[0, maxHeight / 2, 0]}
          minDistance={camDist * 0.5}
          maxDistance={camDist * 2}
          minPolarAngle={0.3}
          maxPolarAngle={Math.PI / 2.1}
        />
      </Canvas>
      {legend.length > 0 && (
        <Box sx={{ mt: 1.5, px: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {legend.map((pkg, i) => (
            <Box key={i}>
              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '1.6rem' }}>
                Package {i + 1}: {pkg.boxName}
              </Typography>
              {pkg.entries.map((entry, j) => (
                <Typography key={j} variant="caption" color="text.secondary" display="block" sx={{ fontSize: '1.6rem', pl: 1.5 }}>
                  {entry.nums.length > 1
                    ? `#${entry.nums[0]}–${entry.nums[entry.nums.length - 1]}`
                    : `#${entry.nums[0]}`}
                  {' '}{entry.name}
                </Typography>
              ))}
            </Box>
          ))}
        </Box>
      )}
    </>
  );
}
