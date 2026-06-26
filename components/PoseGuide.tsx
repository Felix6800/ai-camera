'use client';

import { TargetPoseData } from '@/lib/poseData';

interface PoseGuideProps {
  targetPose: TargetPoseData;
  similarity: number;
  showPerfect: boolean;
}

export default function PoseGuide({
  targetPose,
  similarity,
  showPerfect,
}: PoseGuideProps) {
  const roundedSimilarity = Math.round(similarity);

  return (
    <div className="absolute bottom-28 left-0 right-0 z-10 flex flex-col items-center pointer-events-none">
      {/* Similarity Score */}
      <div className="flex flex-col items-center mb-3">
        <div
          className={`
            text-5xl font-bold tracking-tight
            ${showPerfect ? 'text-primary' : 'text-white'}
            transition-colors duration-300
          `}
        >
          {roundedSimilarity}
          <span className="text-2xl">%</span>
        </div>

        {/* Score Bar */}
        <div className="w-48 h-2 bg-surface rounded-full mt-2 overflow-hidden">
          <div
            className={`
              h-full rounded-full transition-all duration-300
              ${showPerfect ? 'bg-primary' : 'bg-gray-400'}
            `}
            style={{ width: `${roundedSimilarity}%` }}
          />
        </div>

        {/* Perfect Indicator */}
        {showPerfect && (
          <div className="flex items-center gap-2 mt-2 text-primary animate-pulse">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-sm font-medium">完美姿势</span>
          </div>
        )}
      </div>

      {/* Target Pose Label */}
      <div className="flex items-center gap-2 bg-surface/70 backdrop-blur-sm rounded-full px-4 py-1.5">
        <span className="text-lg">{targetPose.icon}</span>
        <span className="text-sm text-gray-300">目标: {targetPose.nameCn}</span>
      </div>
    </div>
  );
}
