'use client';

import { useState } from 'react';
import CameraView from '@/components/CameraView';

export default function Home() {
  const [selectedPoseIndex, setSelectedPoseIndex] = useState(0);

  return (
    <main className="relative w-full h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/70 to-transparent pt-12 pb-8 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <span className="text-primary text-lg">AI</span>
            </div>
            <h1 className="text-lg font-semibold text-white">姿势引导</h1>
          </div>
        </div>
      </header>

      {/* Camera View */}
      <CameraView
        selectedPoseIndex={selectedPoseIndex}
        onPoseSelect={setSelectedPoseIndex}
      />
    </main>
  );
}
