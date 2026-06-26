'use client';

import { useEffect, useRef } from 'react';
import { Pose, SKELETON_CONNECTIONS } from '@/lib/poseData';

interface SkeletonOverlayProps {
  userPose: Pose | null;
  targetPose: Pose | null;
  videoWidth: number;
  videoHeight: number;
  isMirrored?: boolean;
}

export default function SkeletonOverlay({
  userPose,
  targetPose,
  videoWidth,
  videoHeight,
  isMirrored = false,
}: SkeletonOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw target pose first (ghost - white semi-transparent)
    if (targetPose) {
      drawSkeleton(ctx, targetPose, 'rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0.5)', isMirrored);
    }

    // Draw user pose on top (green)
    if (userPose) {
      drawSkeleton(ctx, userPose, '#22c55e', '#16a34a', isMirrored);
    }
  }, [userPose, targetPose, videoWidth, videoHeight, isMirrored]);

  function drawSkeleton(
    ctx: CanvasRenderingContext2D,
    pose: Pose,
    lineColor: string,
    pointColor: string,
    mirrored: boolean
  ) {
    // Helper to flip x coordinate if mirrored
    const flipX = (x: number) => mirrored ? (1 - x) * videoWidth : x * videoWidth;
    const getY = (y: number) => y * videoHeight;

    // Draw connections
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    for (const [startIdx, endIdx] of SKELETON_CONNECTIONS) {
      const start = pose[startIdx];
      const end = pose[endIdx];

      if (!start || !end) continue;
      if (start.score !== undefined && start.score < 0.3) continue;
      if (end.score !== undefined && end.score < 0.3) continue;

      ctx.beginPath();
      ctx.moveTo(flipX(start.x), getY(start.y));
      ctx.lineTo(flipX(end.x), getY(end.y));
      ctx.stroke();
    }

    // Draw keypoints
    ctx.fillStyle = pointColor;

    for (const keypoint of pose) {
      if (keypoint.score !== undefined && keypoint.score < 0.3) continue;

      const x = flipX(keypoint.x);
      const y = getY(keypoint.y);

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={videoWidth}
      height={videoHeight}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
    />
  );
}
