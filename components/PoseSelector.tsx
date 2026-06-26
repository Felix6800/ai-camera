'use client';

import { useRef } from 'react';
import { TargetPoseData } from '@/lib/poseData';

interface PoseSelectorProps {
  poses: TargetPoseData[];
  selectedIndex: number;
  onSelect: (pose: TargetPoseData) => void;
  showSceneLabel?: boolean;
}

export default function PoseSelector({
  poses,
  selectedIndex,
  onSelect,
  showSceneLabel = false,
}: PoseSelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (poses.length === 0) {
    return (
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/95 to-transparent pt-16 pb-4 px-4">
        <div className="flex justify-center items-center h-16">
          <span className="text-sm text-gray-500">等待场景识别...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/95 to-transparent pt-16 pb-4 px-4">
      {showSceneLabel && (
        <div className="text-center mb-2">
          <span className="text-xs text-gray-400">推荐姿势</span>
        </div>
      )}
      {/* Horizontal scrollable poses */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide justify-center"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {poses.map((pose, index) => (
          <button
            key={pose.name}
            onClick={() => onSelect(pose)}
            className={`
              flex flex-col items-center justify-center
              min-w-[72px] h-18 px-3 py-2 rounded-xl
              transition-all duration-200
              whitespace-nowrap
              ${
                selectedIndex === index
                  ? 'bg-primary/20 border-2 border-primary scale-105'
                  : 'bg-surface/80 border-2 border-border/50 hover:border-primary/50'
              }
            `}
          >
            <span className="text-2xl mb-1">{pose.icon}</span>
            <span className="text-[11px] text-gray-300 truncate max-w-[70px]">{pose.nameCn}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
