'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Pose, ALL_POSES, getPosesForScene, TargetPoseData } from '@/lib/poseData';
import { detectPose, initDetector, warmUp } from '@/lib/movenet';
import { calculatePoseSimilarity } from '@/lib/similarity';
import { analyzeScene, captureFrame, Scene } from '@/lib/sceneRecognition';
import SkeletonOverlay from './SkeletonOverlay';
import PoseGuide from './PoseGuide';
import PoseSelector from './PoseSelector';

interface CameraViewProps {
  selectedPoseIndex: number;
  onPoseSelect: (index: number) => void;
}

export default function CameraView({
  selectedPoseIndex,
  onPoseSelect,
}: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const animationRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsRef = useRef<number>(0);
  const sceneIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const poseMatchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [userPose, setUserPose] = useState<Pose | null>(null);
  const [similarity, setSimilarity] = useState(0);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });

  // Scene recognition state
  const [currentScene, setCurrentScene] = useState<Scene | null>(null);
  const [currentScenePoses, setCurrentScenePoses] = useState<TargetPoseData[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Capture state
  const [showFlash, setShowFlash] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // Camera state
  const [isBackCamera, setIsBackCamera] = useState(true);

  // Face/Eye tracking state
  const [faceAngle, setFaceAngle] = useState({ pitch: 0, yaw: 0, roll: 0 });
  const [eyeDirection, setEyeDirection] = useState({ x: 0, y: 0 });
  const [isLookingAtCamera, setIsLookingAtCamera] = useState(false);

  // Use ALL_POSES for selection since we need global indices
  const selectedPose = ALL_POSES[selectedPoseIndex];
  const showPerfect = similarity > 80;

  // Calculate face angle and eye direction from keypoints
  const calculateFaceMetrics = useCallback((pose: Pose) => {
    if (!pose || pose.length < 5) return;

    const nose = pose[0];      // 0: nose
    const leftEye = pose[1];   // 1: left_eye
    const rightEye = pose[2];  // 2: right_eye
    const leftEar = pose[3];   // 3: left_ear
    const rightEar = pose[4]; // 4: right_ear

    if (!nose || !leftEye || !rightEye) return;

    // Calculate eye center
    const eyeCenterX = (leftEye.x + rightEye.x) / 2;
    const eyeCenterY = (leftEye.y + rightEye.y) / 2;

    // Calculate face center
    const faceCenterX = (nose.x + eyeCenterX) / 2;
    const faceCenterY = (nose.y + eyeCenterY) / 2;

    // Calculate roll (head tilt) from eyes
    const eyeDx = rightEye.x - leftEye.x;
    const eyeDy = rightEye.y - leftEye.y;
    const roll = Math.atan2(eyeDy, eyeDx) * (180 / Math.PI);

    // Calculate yaw (left-right rotation) from nose position relative to eye center
    const noseOffsetX = nose.x - eyeCenterX;
    const yaw = noseOffsetX * 100; // Normalized

    // Calculate pitch (up-down tilt) from nose position relative to eyes
    const noseOffsetY = nose.y - eyeCenterY;
    const pitch = noseOffsetY * 100; // Normalized

    // Eye direction (where user is looking)
    const eyeDxNorm = (rightEye.x - leftEye.x) / 2;
    const eyeDyNorm = (rightEye.y - leftEye.y) / 2;

    // Gaze direction based on nose offset
    const gazeX = noseOffsetX;
    const gazeY = noseOffsetY;

    // Check if looking at camera (centered)
    const isLooking = Math.abs(gazeX) < 0.1 && Math.abs(gazeY) < 0.1;

    setFaceAngle({ pitch, yaw, roll });
    setEyeDirection({ x: gazeX, y: gazeY });
    setIsLookingAtCamera(isLooking);
  }, []);

  // Switch camera
  const switchCamera = useCallback(async () => {
    if (!videoRef.current) return;

    // Stop current stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    const newIsBack = !isBackCamera;
    setIsBackCamera(newIsBack);

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: newIsBack ? 'environment' : 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = null;

      await videoRef.current.play();

      setVideoDimensions({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
      });
    } catch (err) {
      console.error('Camera switch error:', err);
    }
  }, [isBackCamera]);

  // Find best matching pose from an array of poses based on user skeleton
  const findBestMatchingPose = useCallback((poses: TargetPoseData[], userSkeletal: Pose): { pose: TargetPoseData; similarity: number; index: number } | null => {
    if (!userSkeletal || poses.length === 0) return null;

    let bestMatch: { pose: TargetPoseData; similarity: number; index: number } | null = null;

    poses.forEach((pose, idx) => {
      const sim = calculatePoseSimilarity(userSkeletal, pose.pose);
      if (!bestMatch || sim > bestMatch.similarity) {
        bestMatch = { pose, similarity: sim, index: idx };
      }
    });

    return bestMatch;
  }, []);

  // AI analyze scene (every 30s)
  const analyzeCurrentScene = useCallback(async () => {
    if (!videoRef.current || isAnalyzing) return;

    const video = videoRef.current;
    if (video.readyState < 2) return;

    setIsAnalyzing(true);

    try {
      const frameData = captureFrame(video);

      const apiKey = process.env.NEXT_PUBLIC_QWEN_API_KEY || '';
      const model = process.env.NEXT_PUBLIC_QWEN_MODEL || 'qwen3.5-plus';
      const baseUrl = process.env.NEXT_PUBLIC_QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

      if (!apiKey) {
        console.warn('Qwen API key not configured');
        setIsAnalyzing(false);
        return;
      }

      const scene = await analyzeScene(frameData, apiKey, model, baseUrl);

      if (scene && scene !== currentScene) {
        console.log('[Scene] Detected:', scene);
        setCurrentScene(scene);
        const poses = getPosesForScene(scene);
        setCurrentScenePoses(poses);
      }
    } catch (err) {
      console.error('[Scene] Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, currentScene]);

  // Match pose based on skeleton (every 5s)
  const matchPoseFromSkeleton = useCallback(() => {
    if (!userPose || currentScenePoses.length === 0) return;

    const bestMatch = findBestMatchingPose(currentScenePoses, userPose);

    if (bestMatch && bestMatch.similarity > 30) {
      const globalIndex = ALL_POSES.findIndex((p) => p.name === bestMatch.pose.name);
      if (globalIndex !== -1 && globalIndex !== selectedPoseIndex) {
        console.log('[Pose] Auto-switching to:', bestMatch.pose.nameCn, 'similarity:', Math.round(bestMatch.similarity));
        onPoseSelect(globalIndex);
      }
    }
  }, [userPose, currentScenePoses, selectedPoseIndex, onPoseSelect, findBestMatchingPose]);

  // Initialize camera and detector
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function setupCamera() {
      try {
        const warmupPromise = warmUp();

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('您的浏览器不支持摄像头访问');
        }

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: 'environment', // Default to back camera
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          await new Promise<void>((resolve) => {
            if (!videoRef.current) return resolve();
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().then(() => resolve()).catch(resolve);
            };
            setTimeout(resolve, 3000);
          });

          await new Promise((resolve) => setTimeout(resolve, 500));

          if (videoRef.current.videoWidth > 0) {
            setVideoDimensions({
              width: videoRef.current.videoWidth,
              height: videoRef.current.videoHeight,
            });
          } else {
            setVideoDimensions({ width: 720, height: 1280 });
          }
        }

        await warmupPromise;
        await initDetector();
        setIsLoading(false);
      } catch (err) {
        console.error('Camera setup error:', err);
        const errorMessage = err instanceof Error ? err.message : '未知错误';
        setError(`无法访问摄像头: ${errorMessage}`);
        setIsLoading(false);
      }
    }

    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (sceneIntervalRef.current) {
        clearInterval(sceneIntervalRef.current);
      }
      if (poseMatchIntervalRef.current) {
        clearInterval(poseMatchIntervalRef.current);
      }
    };
  }, []);

  // Start scene analysis and pose matching when camera is ready
  useEffect(() => {
    if (!isLoading && videoRef.current) {
      setTimeout(() => {
        analyzeCurrentScene();
      }, 5000);

      sceneIntervalRef.current = setInterval(analyzeCurrentScene, 30000);
      poseMatchIntervalRef.current = setInterval(matchPoseFromSkeleton, 5000);
    }

    return () => {
      if (sceneIntervalRef.current) {
        clearInterval(sceneIntervalRef.current);
      }
      if (poseMatchIntervalRef.current) {
        clearInterval(poseMatchIntervalRef.current);
      }
    };
  }, [isLoading, analyzeCurrentScene, matchPoseFromSkeleton]);

  // Detection loop
  const runDetection = useCallback(async () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(runDetection);
      return;
    }

    // FPS calculation
    frameCountRef.current++;
    const now = performance.now();
    const elapsed = now - lastFrameTimeRef.current;

    if (elapsed >= 1000) {
      fpsRef.current = Math.round((frameCountRef.current * 1000) / elapsed);
      setFps(fpsRef.current);
      frameCountRef.current = 0;
      lastFrameTimeRef.current = now;
    }

    // Detect pose
    const poses = await detectPose(video);

    if (poses.length > 0) {
      const detectedPose = poses[0];
      const keypoints: Pose = detectedPose.keypoints.map((kp) => ({
        x: kp.x / video.videoWidth,
        y: kp.y / video.videoHeight,
        score: kp.score,
      }));

      setUserPose(keypoints);

      // Calculate face metrics
      calculateFaceMetrics(keypoints);

      // Calculate similarity with current target pose
      const sim = calculatePoseSimilarity(keypoints, selectedPose.pose);
      setSimilarity(sim);
    } else {
      setUserPose(null);
      setSimilarity(0);
      setFaceAngle({ pitch: 0, yaw: 0, roll: 0 });
      setEyeDirection({ x: 0, y: 0 });
      setIsLookingAtCamera(false);
    }

    animationRef.current = requestAnimationFrame(runDetection);
  }, [selectedPose.pose, calculateFaceMetrics]);

  // Start detection loop when ready
  useEffect(() => {
    if (!isLoading && videoRef.current) {
      lastFrameTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(runDetection);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isLoading, runDetection]);

  // Capture photo
  const handleCapture = useCallback(() => {
    if (!videoRef.current || isCapturing) return;

    setIsCapturing(true);

    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 150);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsCapturing(false);
      return;
    }

    // Mirror if front camera
    if (!isBackCamera) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (userPose) {
      ctx.save();
      if (!isBackCamera) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';

      const scaleX = canvas.width;
      const scaleY = canvas.height;

      const connections: [number, number][] = [
        [0, 1], [0, 2], [1, 3], [2, 4], [5, 6], [5, 7], [7, 9],
        [6, 8], [8, 10], [5, 11], [6, 12], [11, 12], [11, 13],
        [12, 14], [13, 15], [14, 16]
      ];

      for (const [startIdx, endIdx] of connections) {
        const start = userPose[startIdx];
        const end = userPose[endIdx];
        if (!start || !end) continue;

        ctx.beginPath();
        ctx.moveTo(start.x * scaleX, start.y * scaleY);
        ctx.lineTo(end.x * scaleX, end.y * scaleY);
        ctx.stroke();
      }

      ctx.fillStyle = '#16a34a';
      for (const keypoint of userPose) {
        ctx.beginPath();
        ctx.arc(keypoint.x * scaleX, keypoint.y * scaleY, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `ai-camera-${timestamp}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();

    if (currentScenePoses.length > 1) {
      const currentIndex = currentScenePoses.findIndex((p) => p.name === selectedPose.name);
      const nextIndex = (currentIndex + 1) % currentScenePoses.length;
      const nextPose = currentScenePoses[nextIndex];
      const globalIndex = ALL_POSES.findIndex((p) => p.name === nextPose.name);
      if (globalIndex !== -1) {
        console.log('[Capture] Switching to next pose:', nextPose.nameCn);
        onPoseSelect(globalIndex);
      }
    }

    setIsCapturing(false);
  }, [userPose, isCapturing, isBackCamera, currentScenePoses, selectedPose, onPoseSelect]);

  const handleScenePoseSelect = useCallback((pose: TargetPoseData) => {
    const index = ALL_POSES.findIndex((p) => p.name === pose.name);
    if (index !== -1) {
      onPoseSelect(index);
    }
  }, [onPoseSelect]);

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-background p-6">
        <div className="text-6xl mb-4">📷</div>
        <p className="text-red-400 text-center mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-primary text-black rounded-xl font-medium"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div
      className={`
        relative w-full h-full overflow-hidden bg-background
        transition-all duration-300
        ${showPerfect ? 'pose-perfect' : ''}
      `}
    >
      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/90">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-400">正在加载 AI 模型...</p>
        </div>
      )}

      {/* Flash Effect */}
      {showFlash && (
        <div className="absolute inset-0 z-40 bg-white animate-pulse" />
      )}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/70 to-transparent pt-12 pb-4 px-4">
        <div className="flex justify-between items-center">
          {/* FPS */}
          <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1">
            <span className="text-xs text-gray-400 font-mono">{fps} FPS</span>
          </div>

          {/* Scene Badge */}
          <div>
            {isAnalyzing ? (
              <div className="bg-surface/80 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-400">分析场景中...</span>
              </div>
            ) : currentScene ? (
              <div className="bg-surface/80 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2">
                <span className="text-lg">{getSceneIcon(currentScene)}</span>
                <span className="text-sm text-white font-medium">{currentScene}</span>
              </div>
            ) : (
              <div className="bg-surface/80 backdrop-blur-sm rounded-xl px-4 py-2">
                <span className="text-sm text-gray-500">等待场景识别...</span>
              </div>
            )}
          </div>

          {/* Camera Switch Button */}
          <button
            onClick={switchCamera}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-surface/80 transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Face/Eye Tracking Indicator */}
      <div className="absolute top-28 left-4 z-20">
        <div className="bg-surface/80 backdrop-blur-sm rounded-xl px-3 py-2">
          {/* Eye Direction */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-400">视线</span>
            <div className="w-12 h-12 rounded-full bg-background relative">
              {/* Eye indicator */}
              <div
                className={`absolute w-3 h-3 rounded-full transition-all duration-200 ${
                  isLookingAtCamera ? 'bg-primary' : 'bg-yellow-500'
                }`}
                style={{
                  left: `${50 + eyeDirection.x * 100}%`,
                  top: `${50 + eyeDirection.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
              {/* Center target */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-gray-600" />
              </div>
            </div>
            <span className={`text-xs ${isLookingAtCamera ? 'text-primary' : 'text-yellow-500'}`}>
              {isLookingAtCamera ? '正中' : '偏移'}
            </span>
          </div>

          {/* Head Angle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">头部</span>
            <div className="flex gap-1">
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-gray-500">俯仰</span>
                <span className={`text-xs ${Math.abs(faceAngle.pitch) < 10 ? 'text-primary' : 'text-yellow-500'}`}>
                  {faceAngle.pitch > 0 ? '↓' : faceAngle.pitch < 0 ? '↑' : '·'}{Math.abs(Math.round(faceAngle.pitch))}°
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-gray-500">偏转</span>
                <span className={`text-xs ${Math.abs(faceAngle.yaw) < 10 ? 'text-primary' : 'text-yellow-500'}`}>
                  {faceAngle.yaw > 0 ? '→' : faceAngle.yaw < 0 ? '←' : '·'}{Math.abs(Math.round(faceAngle.yaw))}°
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-gray-500">倾斜</span>
                <span className={`text-xs ${Math.abs(faceAngle.roll) < 10 ? 'text-primary' : 'text-yellow-500'}`}>
                  {faceAngle.roll > 0 ? '↻' : faceAngle.roll < 0 ? '↺' : '·'}{Math.abs(Math.round(faceAngle.roll))}°
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Video + Canvas Container */}
      <div className="relative w-full h-full flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          onLoadedMetadata={() => {
            if (videoRef.current && videoRef.current.videoWidth > 0) {
              setVideoDimensions({
                width: videoRef.current.videoWidth,
                height: videoRef.current.videoHeight,
              });
            }
          }}
          className="absolute max-w-full max-h-full object-cover"
          style={{
            transform: isBackCamera ? 'none' : 'scaleX(-1)',
            width: '100%',
            height: '100%',
          }}
        />

        {/* Skeleton Overlay Canvas */}
        <SkeletonOverlay
          userPose={userPose}
          targetPose={selectedPose.pose}
          videoWidth={videoDimensions.width || 720}
          videoHeight={videoDimensions.height || 1280}
          isMirrored={!isBackCamera}
        />
      </div>

      {/* Pose Guide UI */}
      <PoseGuide
        targetPose={selectedPose}
        similarity={similarity}
        showPerfect={showPerfect}
      />

      {/* Capture Button */}
      <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-20">
        <button
          onClick={handleCapture}
          disabled={isCapturing || isLoading}
          className={`
            w-16 h-16 rounded-full
            bg-white border-4 border-primary
            flex items-center justify-center
            transition-all duration-200
            hover:scale-105 active:scale-95
            disabled:opacity-50 disabled:cursor-not-allowed
            shadow-lg shadow-primary/30
          `}
        >
          <div className="w-12 h-12 rounded-full bg-primary" />
        </button>
      </div>

      {/* Pose Selector */}
      <PoseSelector
        poses={currentScenePoses.length > 0 ? currentScenePoses : []}
        selectedIndex={currentScenePoses.findIndex((p) => p.name === selectedPose.name)}
        onSelect={handleScenePoseSelect}
        showSceneLabel={true}
      />
    </div>
  );
}

function getSceneIcon(scene: Scene): string {
  const icons: Record<Scene, string> = {
    '海边': '🏖️',
    '街道': '🏙️',
    '公园': '🌳',
    '咖啡厅': '☕',
    '山景': '🏔️',
    '室内': '🏠',
  };
  return icons[scene] || '📍';
}
