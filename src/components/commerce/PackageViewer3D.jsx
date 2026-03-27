import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Grid } from '@react-three/drei';
import { useMediaQuery, useTheme } from '@mui/material';
import * as THREE from 'three';

const ITEM_COLORS = ['#4FC3F7', '#81C784', '#FFB74D', '#E57373', '#BA68C8', '#4DB6AC', '#FFD54F', '#F06292'];
const BOX_GAP = 1.5;

function BoxWireframe({ size, position }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#999" transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(...size)]} />
        <lineBasicMaterial color="#666" linewidth={1} />
      </lineSegments>
    </group>
  );
}

function PackedItem({ size, position, color }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} transparent opacity={0.85} />
    </mesh>
  );
}

function BoxGroup({ box, offsetX, colorStart }) {
  const { dimensions, items } = box;
  const boxSize = [dimensions.length, dimensions.height, dimensions.width];
  const boxCenter = [offsetX, dimensions.height / 2, 0];

  // Pack items inside box using shelf-packing: fill along X, then Z, then stack Y
  const itemMeshes = useMemo(() => {
    const boxL = dimensions.length;
    const boxW = dimensions.width;
    const boxH = dimensions.height;
    const meshes = [];
    // Shelves: each shelf has a Y base and a fixed height (tallest item in that shelf)
    let shelfY = 0;
    let shelfH = 0;
    let curX = 0;
    let curZ = 0;
    let rowMaxD = 0; // deepest item in current row

    items.forEach((item, i) => {
      const w = item.lengthIn;
      const h = item.heightIn;
      const d = item.widthIn;

      // Does item fit in current row on current shelf?
      if (curX + w > boxL + 0.01) {
        // Move to next row (advance Z)
        curX = 0;
        curZ += rowMaxD;
        rowMaxD = 0;
      }
      if (curZ + d > boxW + 0.01) {
        // Move to next shelf (advance Y)
        shelfY += shelfH;
        shelfH = 0;
        curX = 0;
        curZ = 0;
        rowMaxD = 0;
      }

      // Position relative to box origin (bottom-left-front corner)
      const px = -boxL / 2 + curX + w / 2;
      const py = shelfY + h / 2;
      const pz = -boxW / 2 + curZ + d / 2;

      meshes.push({
        key: i,
        size: [w, h, d],
        position: [offsetX + px, py, pz],
        color: ITEM_COLORS[(colorStart + i) % ITEM_COLORS.length],
      });

      curX += w;
      if (d > rowMaxD) rowMaxD = d;
      if (h > shelfH) shelfH = h;
    });
    return meshes;
  }, [items, dimensions, offsetX, colorStart]);

  return (
    <group>
      <BoxWireframe size={boxSize} position={boxCenter} />
      {itemMeshes.map(m => (
        <PackedItem key={m.key} size={m.size} position={m.position} color={m.color} />
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

  // Compute box positions along X axis
  const { boxes, totalWidth } = useMemo(() => {
    let x = 0;
    let colorIdx = 0;
    const boxes = binPacking.map((box, i) => {
      const w = box.dimensions.length;
      const offsetX = x + w / 2;
      x += w + BOX_GAP;
      const b = { ...box, offsetX, colorStart: colorIdx };
      colorIdx += box.items.length;
      return b;
    });
    const totalWidth = x - BOX_GAP;
    return { boxes, totalWidth };
  }, [binPacking]);

  const maxHeight = Math.max(...binPacking.map(b => b.dimensions.height), 4);
  const camDist = Math.max(totalWidth, maxHeight) * 1.6 + 4;

  return (
    <Canvas
      style={{ height, width: '100%', borderRadius: 8, background: '#fafafa' }}
      camera={{ position: [camDist * 0.6, camDist * 0.5, camDist * 0.6], fov: 35, near: 0.1, far: 200 }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} />
      <group position={[-totalWidth / 2, 0, 0]}>
        {boxes.map((box, i) => (
          <BoxGroup key={i} box={box} offsetX={box.offsetX} colorStart={box.colorStart} />
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
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI / 2.1}
      />
    </Canvas>
  );
}
